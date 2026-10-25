import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVesselInput } from './create-vessel.input';

@Injectable()
export class VesselsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.vessel.findMany({
      include: { teamLead: true },
      orderBy: { name: 'asc' },
    });
  }

  findOne(id: string) {
    return this.prisma.vessel.findUnique({
      where: { id },
      include: { teamLead: true },
    });
  }

  async create(input: CreateVesselInput) {
    try {
      return await this.prisma.vessel.create({
        data: input,
        include: { teamLead: true },
      });
    } catch (error) {
      // P2002 = unique constraint violation; imoNumber is the only unique field.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `A vessel with IMO number ${input.imoNumber} already exists`,
        );
      }
      throw error;
    }
  }

  /** For vessels that come from a relation (an order's vessel) without it. */
  findTeamLead(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  /**
   * Sets the team lead responsible for the vessel on the yard, or clears it.
   * Only an active team lead can be chosen.
   */
  async setTeamLead(vesselId: string, userId: string | null) {
    const vessel = await this.prisma.vessel.findUnique({
      where: { id: vesselId },
    });
    if (!vessel) throw new NotFoundException(`Vessel ${vesselId} not found`);

    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException(`User ${userId} not found`);
      if (user.role !== 'TEAM_LEAD' || !user.active) {
        throw new BadRequestException(
          `${user.name} is not an active team lead`,
        );
      }
    }
    return this.prisma.vessel.update({
      where: { id: vesselId },
      data: { teamLeadId: userId },
      include: { teamLead: true },
    });
  }
}
