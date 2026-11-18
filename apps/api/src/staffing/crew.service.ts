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
import type { PlanCrewMemberInput } from './crew.inputs';
import { isMonday, parseDateOnly } from './week';

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
   * Puts a worker on a vessel for a week. A worker is on one vessel per
   * week, so planning him again moves him: the row is keyed by worker and
   * week, and an upsert replaces the vessel.
   */
  async plan(
    input: PlanCrewMemberInput,
    actor: AuthUser,
  ): Promise<CrewAssignmentWithRelations> {
    requireProjectLead(actor);
    const week = parseWeekStart(input.weekStart);

    return this.prisma.$transaction(async (tx) => {
      const vessel = await tx.vessel.findUnique({
        where: { id: input.vesselId },
      });
      if (!vessel) {
        throw new NotFoundException(`Vessel ${input.vesselId} not found`);
      }
      const user = await tx.user.findUnique({ where: { id: input.userId } });
      if (!user) {
        throw new NotFoundException(`User ${input.userId} not found`);
      }
      // Team leads have their vessels through Vessel.teamLead, and the
      // office doesn't work on the vessels; only workers are planned.
      if (user.role !== 'WORKER' || !user.active) {
        throw new BadRequestException(`${user.name} is not an active worker`);
      }

      return tx.crewAssignment.upsert({
        where: { userId_weekStart: { userId: user.id, weekStart: week } },
        create: { userId: user.id, vesselId: vessel.id, weekStart: week },
        update: { vesselId: vessel.id },
        include: CREW_INCLUDE,
      });
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
