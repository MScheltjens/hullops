import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-context';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { SaveStaffingRequestInput } from './staffing.inputs';
import { validateStaffingRequest } from './staffing-rules';
import { isMonday, parseDateOnly } from './week';

/** Everything a StaffingRequest response can contain, loaded in one query. */
export const STAFFING_INCLUDE = {
  vessel: true,
  enteredBy: true,
  requestedWorkers: {
    include: { user: true },
    orderBy: { user: { name: 'asc' } },
  },
} satisfies Prisma.StaffingRequestInclude;

export type StaffingRequestWithRelations = Prisma.StaffingRequestGetPayload<{
  include: typeof STAFFING_INCLUDE;
}>;

@Injectable()
export class StaffingService {
  constructor(private readonly prisma: PrismaService) {}

  /** The requests for one week (given as its Monday), one per vessel. */
  findForWeek(weekStart: string) {
    const week = parseDateOnly(weekStart);
    if (!week || !isMonday(week)) {
      throw new BadRequestException(
        'weekStart must be a Monday, written like 2026-10-26',
      );
    }
    return this.prisma.staffingRequest.findMany({
      where: { weekStart: week },
      include: STAFFING_INCLUDE,
      orderBy: { vessel: { name: 'asc' } },
    });
  }

  /**
   * Saves what a foreman asked for. There is one request per vessel and
   * week, so saving again replaces it, including the list of named workers.
   */
  async save(
    input: SaveStaffingRequestInput,
    actor: AuthUser,
  ): Promise<StaffingRequestWithRelations> {
    // The resolver already restricts this to project leads and team leads;
    // checking here too keeps the rule intact if the service is called from
    // elsewhere. A team lead may only enter requests for his own vessel,
    // which is checked below once the vessel is loaded.
    if (actor.role !== 'PROJECT_LEAD' && actor.role !== 'TEAM_LEAD') {
      throw new ForbiddenException(
        'Only project leads and team leads can enter staffing requests',
      );
    }
    const errors = validateStaffingRequest(input);
    if (errors.length > 0) throw new BadRequestException(errors);

    const week = parseDateOnly(input.weekStart) as Date; // checked above
    const workerIds = [...new Set(input.requestedWorkerIds)];
    const fields = {
      workersNeeded: input.workersNeeded,
      workersActual: input.workersActual ?? null,
      note: input.note?.trim() || null,
    };

    // One transaction: the checks and the writes see the same data, and
    // either everything is saved or nothing is.
    return this.prisma.$transaction(async (tx) => {
      const vessel = await tx.vessel.findUnique({
        where: { id: input.vesselId },
      });
      if (!vessel) {
        throw new NotFoundException(`Vessel ${input.vesselId} not found`);
      }
      if (actor.role === 'TEAM_LEAD' && vessel.teamLeadId !== actor.id) {
        throw new ForbiddenException(
          'A team lead can only enter requests for his own vessels',
        );
      }

      if (workerIds.length > 0) {
        const users = await tx.user.findMany({
          where: { id: { in: workerIds } },
        });
        const missing = workerIds.filter(
          (id) => !users.some((u) => u.id === id),
        );
        if (missing.length > 0) {
          throw new NotFoundException(
            `User(s) not found: ${missing.join(', ')}`,
          );
        }
        // Only active workers can be asked for: project leads and
        // administrators don't work on the vessels.
        const ineligible = users.filter(
          (u) => u.role !== 'WORKER' || !u.active,
        );
        if (ineligible.length > 0) {
          throw new BadRequestException(
            ineligible.map((u) => `${u.name} is not an active worker`),
          );
        }
      }

      const request = await tx.staffingRequest.upsert({
        where: {
          vesselId_weekStart: { vesselId: vessel.id, weekStart: week },
        },
        create: {
          ...fields,
          weekStart: week,
          vessel: { connect: { id: vessel.id } },
          enteredBy: { connect: { id: actor.id } },
        },
        update: { ...fields, enteredBy: { connect: { id: actor.id } } },
      });

      await tx.staffingRequestWorker.deleteMany({
        where: { requestId: request.id },
      });
      if (workerIds.length > 0) {
        await tx.staffingRequestWorker.createMany({
          data: workerIds.map((userId) => ({ requestId: request.id, userId })),
        });
      }

      return tx.staffingRequest.findUniqueOrThrow({
        where: { id: request.id },
        include: STAFFING_INCLUDE,
      });
    });
  }
}
