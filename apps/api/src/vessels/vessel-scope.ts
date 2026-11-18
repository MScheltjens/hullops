import type { AuthUser } from '../auth/auth-context';
import type { Prisma } from '../generated/prisma/client';
import { addWeeks, weekStartOf } from '../staffing/week';

/** A filter that matches no vessel at all. */
const NO_VESSELS: Prisma.VesselWhereInput = { id: { in: [] } };

/**
 * The vessels a user may see, as a Prisma filter. Every read of orders,
 * vessels and staffing goes through this one rule, so it can't drift apart
 * between queries:
 *
 * - Project leads and administrators see every vessel.
 * - A team lead sees the vessels he leads: one or several.
 * - A worker sees the vessels the project lead planned him on for this week
 *   and next week. Next week stays empty until it has been planned.
 * - HR sees none: it manages people, not the work. The resolvers already
 *   refuse HR; returning nothing here keeps that true if a service is called
 *   from somewhere else. A role added later also sees nothing until someone
 *   decides otherwise.
 *
 * Returning a filter instead of a list of ids keeps it to one query: the
 * database applies it as part of the orders or vessels query itself.
 */
export function visibleVesselsWhere(
  actor: Pick<AuthUser, 'id' | 'role'>,
  now: Date,
): Prisma.VesselWhereInput {
  switch (actor.role) {
    case 'ADMIN':
    case 'PROJECT_LEAD':
      return {};
    case 'TEAM_LEAD':
      return { teamLeadId: actor.id };
    case 'WORKER': {
      const thisWeek = weekStartOf(now);
      return {
        crewAssignments: {
          some: {
            userId: actor.id,
            weekStart: { in: [thisWeek, addWeeks(thisWeek, 1)] },
          },
        },
      };
    }
    default:
      return NO_VESSELS;
  }
}
