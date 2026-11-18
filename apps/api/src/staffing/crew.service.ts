import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-context';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { visibleVesselsWhere } from '../vessels/vessel-scope';
import type { PlanCrewMembersInput } from './crew.inputs';
import { isMonday, parseDateOnly } from '../common/week';

export const CREW_INCLUDE = {
  user: true,
  vessel: true,
} satisfies Prisma.CrewAssignmentInclude;

export type CrewAssignmentWithRelations = Prisma.CrewAssignmentGetPayload<{
  include: typeof CREW_INCLUDE;
}>;

/** Parses a week given as its Monday, or refuses it. */
function parseWeekStart(value: string): Date {
  const week = parseDateOnly(value);
  if (!week || !isMonday(week)) {
    throw new BadRequestException(
      'weekStart must be a Monday, written like 2026-10-26',
    );
  }
  return week;
}

/**
 * Only project leads plan the crew. The resolver already restricts it;
 * checking here too keeps the rule intact if the service is called from
 * elsewhere, like the other services do.
 */
function requireProjectLead(actor: AuthUser): void {
  if (actor.role !== 'PROJECT_LEAD') {
    throw new ForbiddenException('Only project leads can plan the crew');
  }
}

/**
 * The weekly plan: which worker is on which vessel. The team leads' staffing
 * requests are what they asked for; this is what the project lead decided.
 */
@Injectable()
export class CrewService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The plan for one week, on the vessels this user may see: a team lead
   * gets the crew of his own vessels, to hand out the tasks.
   */
  findForWeek(weekStart: string, actor: AuthUser, now = new Date()) {
    return this.prisma.crewAssignment.findMany({
      where: {
        weekStart: parseWeekStart(weekStart),
        vessel: visibleVesselsWhere(actor, now),
      },
      include: CREW_INCLUDE,
      orderBy: [{ vessel: { name: 'asc' } }, { user: { name: 'asc' } }],
    });
  }

  /**
   * Puts workers on a vessel for a week, all or none. A worker is on one
   * vessel per week, so planning him again moves him: the row is keyed by
   * worker and week, and an upsert replaces the vessel. Returns the rows
   * that were saved.
   */
  async plan(
    input: PlanCrewMembersInput,
    actor: AuthUser,
  ): Promise<CrewAssignmentWithRelations[]> {
    requireProjectLead(actor);
    const week = parseWeekStart(input.weekStart);
    const userIds = [...new Set(input.userIds)];

    return this.prisma.$transaction(async (tx) => {
      const vessel = await tx.vessel.findUnique({
        where: { id: input.vesselId },
      });
      if (!vessel) {
        throw new NotFoundException(`Vessel ${input.vesselId} not found`);
      }
      const users = await tx.user.findMany({ where: { id: { in: userIds } } });
      const missing = userIds.filter((id) => !users.some((u) => u.id === id));
      if (missing.length > 0) {
        throw new NotFoundException(`User(s) not found: ${missing.join(', ')}`);
      }
      // Team leads have their vessels through Vessel.teamLead, and the
      // office doesn't work on the vessels; only workers are planned.
      const ineligible = users.filter((u) => u.role !== 'WORKER' || !u.active);
      if (ineligible.length > 0) {
        throw new BadRequestException(
          ineligible.map((u) => `${u.name} is not an active worker`),
        );
      }

      const saved: CrewAssignmentWithRelations[] = [];
      for (const userId of userIds) {
        saved.push(
          await tx.crewAssignment.upsert({
            where: { userId_weekStart: { userId, weekStart: week } },
            create: { userId, vesselId: vessel.id, weekStart: week },
            update: { vesselId: vessel.id },
            include: CREW_INCLUDE,
          }),
        );
      }
      return saved;
    });
  }

  /**
   * Takes a worker off the plan for a week. Returns whether he was planned,
   * so removing twice is harmless.
   */
  async unplan(
    weekStart: string,
    userId: string,
    actor: AuthUser,
  ): Promise<boolean> {
    requireProjectLead(actor);
    const { count } = await this.prisma.crewAssignment.deleteMany({
      where: { userId, weekStart: parseWeekStart(weekStart) },
    });
    return count > 0;
  }
}
