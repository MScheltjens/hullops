import { Injectable } from '@nestjs/common';
import type { Role, ServiceType } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lists users, e.g. the workers who can join a protection order. */
  findAll(filter: { role?: Role; serviceType?: ServiceType } = {}) {
    return this.prisma.user.findMany({
      where: {
        role: filter.role,
        serviceTypes: filter.serviceType
          ? { has: filter.serviceType }
          : undefined,
      },
      orderBy: { name: 'asc' },
    });
  }
}
