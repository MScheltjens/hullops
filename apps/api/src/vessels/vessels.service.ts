import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVesselInput } from './create-vessel.input';

@Injectable()
export class VesselsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.vessel.findMany({ orderBy: { name: 'asc' } });
  }

  findOne(id: string) {
    return this.prisma.vessel.findUnique({ where: { id } });
  }

  async create(input: CreateVesselInput) {
    try {
      return await this.prisma.vessel.create({ data: input });
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
}
