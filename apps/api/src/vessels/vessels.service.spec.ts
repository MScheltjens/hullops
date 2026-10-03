import { ConflictException } from '@nestjs/common';
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
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        VesselsService,
        { provide: PrismaService, useValue: { vessel } },
      ],
    }).compile();
    service = moduleRef.get(VesselsService);
  });

  it('lists vessels sorted by name', async () => {
    vessel.findMany.mockResolvedValue([]);
    await service.findAll();
    expect(vessel.findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } });
  });

  it('creates a vessel from the input', async () => {
    const input = { name: 'Aurora', imoNumber: '9074729' };
    vessel.create.mockResolvedValue({ id: 'v1', ...input });

    await expect(service.create(input)).resolves.toMatchObject({ id: 'v1' });
    expect(vessel.create).toHaveBeenCalledWith({ data: input });
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
});
