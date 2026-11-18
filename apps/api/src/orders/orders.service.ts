import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type ServiceType } from '../generated/prisma/client';
import type { AuthUser } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import { addWeeks, weekStartOf } from '../common/week';
import { visibleVesselsWhere } from '../vessels/vessel-scope';
import {
  AddOrderCommentInput,
  AddStatusUpdateInput,
  CreateOrderInput,
  OrdersArgs,
} from './order.inputs';
import {
  canWorkOn,
  isAllowedStatusChange,
  splitOrderPage,
  validateOrderInput,
} from './order-rules';

/**
 * Everything an Order response can contain, loaded in one query. Loading
 * relations up front (instead of one query per field) avoids the "N+1"
 * problem: a list of 50 orders still costs one round trip, not 50 more for
 * their vessels. At HullOps' scale, loading a few fields a client didn't ask
 * for is cheaper than adding a batching layer such as DataLoader.
 */
export const ORDER_INCLUDE = {
  vessel: true,
  createdBy: true,
  cleaningDetails: true,
  protectionDetails: true,
  // Team sorted by name: members added together share the same assignedAt.
  assignments: { include: { user: true }, orderBy: { user: { name: 'asc' } } },
  statusUpdates: { include: { author: true }, orderBy: { createdAt: 'asc' } },
  comments: { include: { author: true }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.OrderInclude;

export type OrderWithRelations = Prisma.OrderGetPayload<{
  include: typeof ORDER_INCLUDE;
}>;

/**
 * An order as the queries load it: the order itself, plus only the relations
 * the query asked for (see order-selection.ts). The resolver fields that read
 * a relation check that it was loaded.
 */
export type LoadedOrder = Prisma.OrderGetPayload<object> &
  Partial<Omit<OrderWithRelations, keyof Prisma.OrderGetPayload<object>>> & {
    _count?: { comments: number };
  };

/** Translates the `orders` query filters into a Prisma `where`. */
export function buildOrdersWhere(
  args: Omit<OrdersArgs, 'skip' | 'take'>,
  now: Date,
): Prisma.OrderWhereInput {
  const conditions: Prisma.OrderWhereInput[] = [];
  if (args.status) conditions.push({ status: args.status });
  if (args.serviceType) conditions.push({ serviceType: args.serviceType });
  if (args.vesselId) conditions.push({ vesselId: args.vesselId });
  // Same rule as isOverdue() in order-rules.ts, expressed as a query so the
  // database does the filtering.
  if (args.overdue === true) {
    conditions.push({ dueDate: { lt: now }, status: { not: 'DONE' } });
  } else if (args.overdue === false) {
    conditions.push({ OR: [{ dueDate: { gte: now } }, { status: 'DONE' }] });
  }
  return { AND: conditions };
}

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Open orders first, soonest due date first, so the most urgent ones lead
   * the list. Done orders follow, latest first, because the recent ones are
   * the ones people still look up. Only orders on vessels the user may see
   * are listed (see vessel-scope.ts).
   */
  async findAll(
    args: OrdersArgs,
    actor: AuthUser,
    now = new Date(),
    include: Prisma.OrderInclude = ORDER_INCLUDE,
  ): Promise<LoadedOrder[]> {
    const { skip, take, ...filters } = args;
    const where: Prisma.OrderWhereInput = {
      AND: [
        buildOrdersWhere(filters, now),
        { vessel: visibleVesselsWhere(actor, now) },
      ],
    };
    const openWhere = { AND: [where, { status: { not: 'DONE' as const } }] };
    const doneWhere = { AND: [where, { status: 'DONE' as const }] };

    const openCount = await this.prisma.order.count({ where: openWhere });
    const page = splitOrderPage(skip, take, openCount);

    const [open, done] = await Promise.all([
      this.prisma.order.findMany({
        where: openWhere,
        include,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
        ...page.open,
      }),
      this.prisma.order.findMany({
        where: doneWhere,
        include,
        orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }],
        ...page.done,
      }),
    ]);
    // The include is built from the query at run time, so Prisma can't type
    // the result; LoadedOrder describes it (see there).
    return [...open, ...done] as unknown as LoadedOrder[];
  }

  /**
   * One order, or null when it doesn't exist or is on a vessel the user may
   * not see. Both look the same, so the answer doesn't reveal that an order
   * exists. findFirst instead of findUnique, because the vessel filter isn't
   * part of a unique key.
   */
  findOne(
    id: string,
    actor: AuthUser,
    now = new Date(),
    include: Prisma.OrderInclude = ORDER_INCLUDE,
  ): Promise<LoadedOrder | null> {
    return this.prisma.order.findFirst({
      where: { id, vessel: visibleVesselsWhere(actor, now) },
      include,
    }) as unknown as Promise<LoadedOrder | null>;
  }

  /** `creator` is the logged-in user. */
  async create(
    input: CreateOrderInput,
    creator: AuthUser,
  ): Promise<OrderWithRelations> {
    const errors = validateOrderInput(input);
    if (errors.length > 0) {
      // An array message is reported as "Validation failed" with the list in
      // extensions.validationErrors (see format-graphql-error.ts).
      throw new BadRequestException(errors);
    }

    // One transaction: the checks and the insert see the same data, and
    // either everything is written or nothing is.
    return this.prisma.$transaction(async (tx) => {
      const vessel = await tx.vessel.findUnique({
        where: { id: input.vesselId },
      });
      if (!vessel) {
        throw new NotFoundException(`Vessel ${input.vesselId} not found`);
      }

      // The resolver already restricts this to project leads; checking here
      // too keeps the rule intact if the service is called from elsewhere.
      if (creator.role !== 'PROJECT_LEAD') {
        throw new ForbiddenException('Only project leads can create orders');
      }

      await this.checkTeamMembers(tx, input.teamIds, input.serviceType);

      return tx.order.create({
        data: {
          title: input.title,
          description: input.description,
          serviceType: input.serviceType,
          status: 'PLANNED',
          shipyard: input.shipyard,
          berth: input.berth,
          areaSqm: input.areaSqm,
          startDate: input.startDate,
          dueDate: input.dueDate,
          vessel: { connect: { id: vessel.id } },
          createdBy: { connect: { id: creator.id } },
          cleaningDetails: input.cleaning
            ? {
                create: {
                  method: input.cleaning.method,
                  surface: input.cleaning.surface,
                },
              }
            : undefined,
          protectionDetails: input.protection
            ? {
                create: {
                  kind: input.protection.kind,
                  protectedItem: input.protection.protectedItem,
                  materials: input.protection.materials,
                  coatingProduct: input.protection.coatingProduct,
                  layers: input.protection.layers,
                  targetThicknessUm: input.protection.targetThicknessUm,
                },
              }
            : undefined,
          assignments: {
            create: input.teamIds.map((userId) => ({
              user: { connect: { id: userId } },
            })),
          },
          // The history starts with the order being planned.
          statusUpdates: {
            create: {
              status: 'PLANNED',
              author: { connect: { id: creator.id } },
            },
          },
        },
        include: ORDER_INCLUDE,
      });
    });
  }

  /**
   * Adds an entry to the order's history: either a note (same status) or a
   * step forward in the status flow, optionally with a note.
   */
  /** `author` is the logged-in user. */
  async addStatusUpdate(
    input: AddStatusUpdateInput,
    author: AuthUser,
  ): Promise<OrderWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: input.orderId },
        include: { assignments: true },
      });
      if (!order) {
        throw new NotFoundException(`Order ${input.orderId} not found`);
      }

      const isOnTeam = order.assignments.some((a) => a.userId === author.id);
      if (!isOnTeam && author.role !== 'PROJECT_LEAD') {
        throw new ForbiddenException(
          'Only the order’s team and project leads can update it',
        );
      }

      if (!isAllowedStatusChange(order.status, input.status)) {
        throw new BadRequestException(
          `Cannot change status from ${order.status} to ${input.status}`,
        );
      }
      const statusChanges = input.status !== order.status;
      if (!statusChanges && !input.note?.trim()) {
        throw new BadRequestException(
          'An update that keeps the status needs a note',
        );
      }

      await tx.statusUpdate.create({
        data: {
          status: input.status,
          note: input.note,
          order: { connect: { id: order.id } },
          author: { connect: { id: author.id } },
        },
      });
      return tx.order.update({
        where: { id: order.id },
        data: { status: input.status },
        include: ORDER_INCLUDE,
      });
    });
  }

  /**
   * Adds a comment: information the project lead passes on, which the app
   * has no field for. Anyone can read it; the resolver limits writing to
   * project leads, and it's checked here too like in `create`.
   */
  async addComment(
    input: AddOrderCommentInput,
    author: AuthUser,
  ): Promise<OrderWithRelations> {
    if (author.role !== 'PROJECT_LEAD') {
      throw new ForbiddenException('Only project leads can add comments');
    }
    // @IsNotEmpty accepts "   ", so check for a blank text here.
    const text = input.text.trim();
    if (!text) {
      throw new BadRequestException('A comment cannot be empty');
    }

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: input.orderId } });
      if (!order) {
        throw new NotFoundException(`Order ${input.orderId} not found`);
      }
      await tx.orderComment.create({
        data: {
          text,
          source: input.source?.trim() || null,
          order: { connect: { id: order.id } },
          author: { connect: { id: author.id } },
        },
      });
      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: ORDER_INCLUDE,
      });
    });
  }

  /**
   * Adds someone to the team. Adding a current member changes nothing.
   *
   * A team lead hands out the work on his own vessels, but only to the
   * workers the project lead planned there for this week or next week. A
   * project lead can add anyone, e.g. while creating the order before the
   * week is planned.
   */
  async assignTeamMember(
    orderId: string,
    userId: string,
    actor: AuthUser,
    now = new Date(),
  ): Promise<OrderWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      const order = await this.findOrderForTeamChange(tx, orderId, actor);
      await this.checkTeamMembers(tx, [userId], order.serviceType);
      if (actor.role === 'TEAM_LEAD') {
        const thisWeek = weekStartOf(now);
        const planned = await tx.crewAssignment.findFirst({
          where: {
            userId,
            vesselId: order.vesselId,
            weekStart: { in: [thisWeek, addWeeks(thisWeek, 1)] },
          },
        });
        if (!planned) {
          throw new BadRequestException(
            'This worker is not planned on this vessel this week or next week',
          );
        }
      }
      await tx.orderAssignment.upsert({
        where: { orderId_userId: { orderId, userId } },
        create: { orderId, userId },
        update: {},
      });
      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: ORDER_INCLUDE,
      });
    });
  }

  /** Removes someone from the team. Removing a non-member changes nothing. */
  async removeTeamMember(
    orderId: string,
    userId: string,
    actor: AuthUser,
  ): Promise<OrderWithRelations> {
    return this.prisma.$transaction(async (tx) => {
      await this.findOrderForTeamChange(tx, orderId, actor);
      await tx.orderAssignment.deleteMany({ where: { orderId, userId } });
      return tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: ORDER_INCLUDE,
      });
    });
  }

  /**
   * Loads an order whose team the actor wants to change. Project leads may
   * change any team, a team lead only those on the vessels he leads. The
   * resolver lets only these two roles in; this checks the vessel too, and
   * keeps the rule intact if the service is called from elsewhere.
   */
  private async findOrderForTeamChange(
    tx: Prisma.TransactionClient,
    orderId: string,
    actor: AuthUser,
  ) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { vessel: true },
    });
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }
    const mayChange =
      actor.role === 'PROJECT_LEAD' ||
      (actor.role === 'TEAM_LEAD' && order.vessel.teamLeadId === actor.id);
    if (!mayChange) {
      throw new ForbiddenException(
        'Only project leads, and team leads on their own vessels, can change the team',
      );
    }
    return order;
  }

  /** Every team member must exist and work in the order's service area. */
  private async checkTeamMembers(
    tx: Prisma.TransactionClient,
    userIds: string[],
    serviceType: ServiceType,
  ): Promise<void> {
    if (userIds.length === 0) return;
    const users = await tx.user.findMany({ where: { id: { in: userIds } } });

    const missing = userIds.filter((id) => !users.some((u) => u.id === id));
    if (missing.length > 0) {
      throw new NotFoundException(`User(s) not found: ${missing.join(', ')}`);
    }
    const unqualified = users.filter((user) => !canWorkOn(user, serviceType));
    if (unqualified.length > 0) {
      throw new BadRequestException(
        unqualified.map(
          (user) =>
            `${user.name} does not work in ${serviceType.toLowerCase()}`,
        ),
      );
    }
  }
}
