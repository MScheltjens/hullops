import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  const user = { findMany: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: { user } }],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  it('lists everyone sorted by name when no filter is given', async () => {
    await service.findAll();
    expect(user.findMany).toHaveBeenCalledWith({
      where: { role: undefined, serviceTypes: undefined },
      orderBy: { name: 'asc' },
    });
  });

  it('filters by role and service area', async () => {
    await service.findAll({ role: 'WORKER', serviceType: 'PROTECTION' });
    expect(user.findMany).toHaveBeenCalledWith({
      where: { role: 'WORKER', serviceTypes: { has: 'PROTECTION' } },
      orderBy: { name: 'asc' },
    });
  });
});
