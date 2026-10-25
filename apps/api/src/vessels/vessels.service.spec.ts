import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VesselsService } from './vessels.service';

describe('VesselsService', () => {
  let service: VesselsService;
  // Only the delegate methods the service calls; no database is involved.
  const vessel = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const user = { findUnique: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        VesselsService,
        { provide: PrismaService, useValue: { vessel, user } },
      ],
    }).compile();
    service = moduleRef.get(VesselsService);
  });

  it('lists vessels with their team lead, sorted by name', async () => {
    vessel.findMany.mockResolvedValue([]);
    await service.findAll();
    expect(vessel.findMany).toHaveBeenCalledWith({
      include: { teamLead: true },
      orderBy: { name: 'asc' },
    });
  });

  it('creates a vessel from the input', async () => {
    const input = { name: 'Aurora', imoNumber: '9074729' };
    vessel.create.mockResolvedValue({ id: 'v1', ...input });

    await expect(service.create(input)).resolves.toMatchObject({ id: 'v1' });
    expect(vessel.create).toHaveBeenCalledWith({
      data: input,
      include: { teamLead: true },
    });
  });

  it('turns a duplicate IMO number into a ConflictException', async () => {
    vessel.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.create({ name: 'Aurora', imoNumber: '9074729' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rethrows other database errors unchanged', async () => {
    const dbError = new Error('connection lost');
    vessel.create.mockRejectedValue(dbError);

    await expect(service.create({ name: 'Aurora' })).rejects.toBe(dbError);
  });

  describe('setTeamLead', () => {
    beforeEach(() => {
      vessel.findUnique.mockResolvedValue({ id: 'v1' });
    });

    it('puts an active team lead in charge of the vessel', async () => {
      user.findUnique.mockResolvedValue({
        id: 'u1',
        name: 'Heinz',
        role: 'TEAM_LEAD',
        active: true,
      });

      await service.setTeamLead('v1', 'u1');

      expect(vessel.update).toHaveBeenCalledWith({
        where: { id: 'v1' },
        data: { teamLeadId: 'u1' },
        include: { teamLead: true },
      });
    });

    it('clears the team lead when no user is given', async () => {
      await service.setTeamLead('v1', null);

      expect(user.findUnique).not.toHaveBeenCalled();
      expect(vessel.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { teamLeadId: null } }),
      );
    });

    it.each([
      ['a worker', { role: 'WORKER', active: true }],
      ['a project lead', { role: 'PROJECT_LEAD', active: true }],
      ['a deactivated team lead', { role: 'TEAM_LEAD', active: false }],
    ])('refuses %s', async (_label, fields) => {
      user.findUnique.mockResolvedValue({
        id: 'u1',
        name: 'Someone',
        ...fields,
      });

      await expect(service.setTeamLead('v1', 'u1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(vessel.update).not.toHaveBeenCalled();
    });

    it('rejects an unknown vessel or user', async () => {
      vessel.findUnique.mockResolvedValue(null);
      await expect(service.setTeamLead('nope', null)).rejects.toBeInstanceOf(
        NotFoundException,
      );

      vessel.findUnique.mockResolvedValue({ id: 'v1' });
      user.findUnique.mockResolvedValue(null);
      await expect(service.setTeamLead('v1', 'ghost')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
