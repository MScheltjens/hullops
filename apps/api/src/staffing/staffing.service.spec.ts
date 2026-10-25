import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AuthUser } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import type { SaveStaffingRequestInput } from './staffing.inputs';
import { StaffingService } from './staffing.service';

// A fake database: one jest.fn() per Prisma method the service uses.
const db = {
  vessel: { findUnique: jest.fn() },
  user: { findMany: jest.fn() },
  staffingRequest: {
    findMany: jest.fn(),
    upsert: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
  staffingRequestWorker: { deleteMany: jest.fn(), createMany: jest.fn() },
  $transaction: jest.fn(),
};

const makeUser = (id: string, role: AuthUser['role']): AuthUser => ({
  id,
  name: id,
  email: `${id}@hullops.example`,
  role,
  serviceTypes: [],
  locale: 'EN',
  active: true,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});
const lead = makeUser('lead-1', 'PROJECT_LEAD');
const worker = (id: string, active = true) => ({
  ...makeUser(id, 'WORKER'),
  active,
});

const makeInput = (
  overrides: Partial<SaveStaffingRequestInput> = {},
): SaveStaffingRequestInput => ({
  vesselId: 'vessel-1',
  weekStart: '2026-10-26',
  workersNeeded: 6,
  requestedWorkerIds: [],
  ...overrides,
});

describe('StaffingService', () => {
  let service: StaffingService;

  beforeEach(async () => {
    jest.resetAllMocks();
    // Run the transaction callback with the same fake database.
    db.$transaction.mockImplementation((callback: (tx: typeof db) => unknown) =>
      callback(db),
    );
    db.vessel.findUnique.mockResolvedValue({ id: 'vessel-1' });
    db.staffingRequest.upsert.mockResolvedValue({ id: 'request-1' });
    const moduleRef = await Test.createTestingModule({
      providers: [StaffingService, { provide: PrismaService, useValue: db }],
    }).compile();
    service = moduleRef.get(StaffingService);
  });

  describe('findForWeek', () => {
    it('finds the requests of that Monday, sorted by vessel name', async () => {
      await service.findForWeek('2026-10-26');
      expect(db.staffingRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { weekStart: new Date('2026-10-26T00:00:00Z') },
          orderBy: { vessel: { name: 'asc' } },
        }),
      );
    });

    it('rejects a day that is not a Monday', () => {
      expect(() => service.findForWeek('2026-10-27')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('save', () => {
    it('only lets project leads enter requests', async () => {
      await expect(
        service.save(makeInput(), makeUser('admin-1', 'ADMIN')),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('rejects input that breaks a rule before touching the database', async () => {
      await expect(
        service.save(makeInput({ weekStart: '2026-10-27' }), lead),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('rejects an unknown vessel', async () => {
      db.vessel.findUnique.mockResolvedValue(null);
      await expect(service.save(makeInput(), lead)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects an unknown worker', async () => {
      db.user.findMany.mockResolvedValue([]);
      await expect(
        service.save(makeInput({ requestedWorkerIds: ['ghost'] }), lead),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects someone who is not an active worker', async () => {
      db.user.findMany.mockResolvedValue([
        worker('w-1'),
        makeUser('lead-2', 'PROJECT_LEAD'),
        worker('w-3', false),
      ]);
      await expect(
        service.save(
          makeInput({ requestedWorkerIds: ['w-1', 'lead-2', 'w-3'] }),
          lead,
        ),
      ).rejects.toMatchObject({
        response: {
          message: [
            'lead-2 is not an active worker',
            'w-3 is not an active worker',
          ],
        },
      });
      expect(db.staffingRequest.upsert).not.toHaveBeenCalled();
    });

    it('saves the request and replaces the named workers', async () => {
      db.user.findMany.mockResolvedValue([worker('w-1'), worker('w-2')]);

      await service.save(
        makeInput({
          requestedWorkerIds: ['w-1', 'w-2', 'w-1'],
          reportedBy: '  Heinz  ',
          note: '   ',
          workersActual: 5,
        }),
        lead,
      );

      expect(db.staffingRequest.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            vesselId_weekStart: {
              vesselId: 'vessel-1',
              weekStart: new Date('2026-10-26T00:00:00Z'),
            },
          },
          create: expect.objectContaining({
            workersNeeded: 6,
            workersActual: 5,
            reportedBy: 'Heinz',
            note: null,
          }),
        }),
      );
      // The list is replaced, not added to, and a worker named twice counts once.
      expect(db.staffingRequestWorker.deleteMany).toHaveBeenCalledWith({
        where: { requestId: 'request-1' },
      });
      expect(db.staffingRequestWorker.createMany).toHaveBeenCalledWith({
        data: [
          { requestId: 'request-1', userId: 'w-1' },
          { requestId: 'request-1', userId: 'w-2' },
        ],
      });
    });

    it('clears the named workers when none are given', async () => {
      await service.save(makeInput(), lead);
      expect(db.staffingRequestWorker.deleteMany).toHaveBeenCalled();
      expect(db.staffingRequestWorker.createMany).not.toHaveBeenCalled();
    });
  });
});
