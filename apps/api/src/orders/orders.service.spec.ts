import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AuthUser } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderInput } from './order.inputs';
import {
  buildOrdersWhere,
  ORDER_INCLUDE,
  OrdersService,
} from './orders.service';

// A fake database: one jest.fn() per Prisma method the service uses.
const db = {
  order: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  vessel: { findUnique: jest.fn() },
  user: { findMany: jest.fn() },
  statusUpdate: { create: jest.fn() },
  orderComment: { create: jest.fn() },
  orderAssignment: { upsert: jest.fn(), deleteMany: jest.fn() },
  $transaction: jest.fn(),
};

// The logged-in user, as the resolver passes it to the service.
const makeUser = (
  fields: Pick<AuthUser, 'id' | 'name' | 'role' | 'serviceTypes'>,
): AuthUser => ({
  ...fields,
  email: `${fields.id}@hullops.example`,
  locale: 'EN',
  createdAt: new Date(0),
  updatedAt: new Date(0),
});
const lead = makeUser({
  id: 'lead-1',
  name: 'Lena Hoffmann',
  role: 'PROJECT_LEAD',
  serviceTypes: ['CLEANING', 'PROTECTION'],
});
const cleaner = makeUser({
  id: 'worker-1',
  name: 'Mehmet Yilmaz',
  role: 'WORKER',
  serviceTypes: ['CLEANING'],
});
const protector = makeUser({
  id: 'worker-2',
  name: 'Anna Schulz',
  role: 'WORKER',
  serviceTypes: ['PROTECTION'],
});

const cleaningInput = (
  overrides: Partial<CreateOrderInput> = {},
): CreateOrderInput => ({
  title: 'Hull cleaning',
  serviceType: 'CLEANING',
  shipyard: 'Blohm+Voss',
  startDate: new Date('2026-10-05'),
  dueDate: new Date('2026-10-08'),
  vesselId: 'vessel-1',
  cleaning: { method: 'High-pressure water', surface: 'Hull' },
  teamIds: [],
  ...overrides,
});

describe('OrdersService', () => {
  let service: OrdersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    // The service passes a callback to $transaction; run it with the same
    // fake database, as Prisma would with a transaction client.
    db.$transaction.mockImplementation((callback: (tx: typeof db) => unknown) =>
      callback(db),
    );
    const moduleRef = await Test.createTestingModule({
      providers: [OrdersService, { provide: PrismaService, useValue: db }],
    }).compile();
    service = moduleRef.get(OrdersService);
  });

  describe('findAll', () => {
    it('loads the relations, sorts by due date and pages', async () => {
      db.order.findMany.mockResolvedValue([]);
      await service.findAll({ skip: 10, take: 5 });
      expect(db.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: ORDER_INCLUDE,
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
          skip: 10,
          take: 5,
        }),
      );
    });
  });

  describe('create', () => {
    beforeEach(() => {
      db.vessel.findUnique.mockResolvedValue({ id: 'vessel-1' });
      db.user.findMany.mockResolvedValue([]);
      db.order.create.mockResolvedValue({ id: 'order-1' });
    });

    it('creates a planned order with its details, team and first history entry', async () => {
      db.user.findMany.mockResolvedValue([cleaner]);

      await service.create(cleaningInput({ teamIds: [cleaner.id] }), lead);

      const { data } = db.order.create.mock.calls[0][0];
      expect(data).toMatchObject({
        status: 'PLANNED',
        vessel: { connect: { id: 'vessel-1' } },
        createdBy: { connect: { id: lead.id } },
        cleaningDetails: {
          create: { method: 'High-pressure water', surface: 'Hull' },
        },
        assignments: { create: [{ user: { connect: { id: cleaner.id } } }] },
        statusUpdates: {
          create: { status: 'PLANNED', author: { connect: { id: lead.id } } },
        },
      });
      expect(data.protectionDetails).toBeUndefined();
    });

    it('rejects input that breaks an order rule before touching the database', async () => {
      const input = cleaningInput({ cleaning: undefined });

      await expect(service.create(input, lead)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('rejects an unknown vessel', async () => {
      db.vessel.findUnique.mockResolvedValue(null);
      await expect(
        service.create(cleaningInput(), lead),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('only lets project leads create orders', async () => {
      await expect(
        service.create(cleaningInput(), cleaner),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(db.order.create).not.toHaveBeenCalled();
    });

    it('rejects an unknown team member', async () => {
      await expect(
        service.create(cleaningInput({ teamIds: ['nobody'] }), lead),
      ).rejects.toThrow('User(s) not found: nobody');
    });

    it('rejects a team member from another service area', async () => {
      db.user.findMany.mockResolvedValue([protector]);
      const error = await service
        .create(cleaningInput({ teamIds: [protector.id] }), lead)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        message: ['Anna Schulz does not work in cleaning'],
      });
    });
  });

  describe('addStatusUpdate', () => {
    const order = (status: string, teamIds: string[] = [cleaner.id]) => ({
      id: 'order-1',
      status,
      assignments: teamIds.map((userId) => ({ userId })),
    });

    it('moves the order one step forward and records it in the history', async () => {
      db.order.findUnique.mockResolvedValue(order('PLANNED'));

      await service.addStatusUpdate(
        {
          orderId: 'order-1',
          status: 'IN_PROGRESS',
          note: 'Started on the port side',
        },
        cleaner,
      );

      expect(db.statusUpdate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'IN_PROGRESS',
          note: 'Started on the port side',
        }),
      });
      expect(db.order.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'IN_PROGRESS' } }),
      );
    });

    it('rejects a step that skips or goes back', async () => {
      db.order.findUnique.mockResolvedValue(order('PLANNED'));

      await expect(
        service.addStatusUpdate(
          {
            orderId: 'order-1',
            status: 'DONE',
          },
          cleaner,
        ),
      ).rejects.toThrow('Cannot change status from PLANNED to DONE');
      expect(db.statusUpdate.create).not.toHaveBeenCalled();
    });

    it('accepts a note without a status change', async () => {
      db.order.findUnique.mockResolvedValue(order('IN_PROGRESS'));

      await service.addStatusUpdate(
        {
          orderId: 'order-1',
          status: 'IN_PROGRESS',
          note: 'Half the hull done',
        },
        cleaner,
      );
      expect(db.statusUpdate.create).toHaveBeenCalled();
    });

    it('rejects an update that changes nothing and has no note', async () => {
      db.order.findUnique.mockResolvedValue(order('IN_PROGRESS'));

      await expect(
        service.addStatusUpdate(
          {
            orderId: 'order-1',
            status: 'IN_PROGRESS',
            note: '   ',
          },
          cleaner,
        ),
      ).rejects.toThrow('An update that keeps the status needs a note');
    });

    it('refuses workers who are not on the team', async () => {
      db.order.findUnique.mockResolvedValue(order('PLANNED', []));

      await expect(
        service.addStatusUpdate(
          {
            orderId: 'order-1',
            status: 'IN_PROGRESS',
          },
          cleaner,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows project leads who are not on the team', async () => {
      db.order.findUnique.mockResolvedValue(order('PLANNED', []));

      await service.addStatusUpdate(
        {
          orderId: 'order-1',
          status: 'IN_PROGRESS',
        },
        lead,
      );
      expect(db.order.update).toHaveBeenCalled();
    });

    it('rejects an unknown order', async () => {
      db.order.findUnique.mockResolvedValue(null);
      await expect(
        service.addStatusUpdate(
          {
            orderId: 'nope',
            status: 'IN_PROGRESS',
          },
          lead,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('addComment', () => {
    it('stores a trimmed comment with its source and author', async () => {
      db.order.findUnique.mockResolvedValue({ id: 'order-1' });

      await service.addComment(
        {
          orderId: 'order-1',
          text: '  Crane is booked until 10:00 ',
          source: ' Lürssen, by mail ',
        },
        lead,
      );

      expect(db.orderComment.create).toHaveBeenCalledWith({
        data: {
          text: 'Crane is booked until 10:00',
          source: 'Lürssen, by mail',
          order: { connect: { id: 'order-1' } },
          author: { connect: { id: lead.id } },
        },
      });
    });

    it('stores a blank source as none', async () => {
      db.order.findUnique.mockResolvedValue({ id: 'order-1' });

      await service.addComment(
        { orderId: 'order-1', text: 'Hello', source: '   ' },
        lead,
      );

      expect(db.orderComment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ source: null }),
      });
    });

    it('only lets project leads add comments', async () => {
      await expect(
        service.addComment({ orderId: 'order-1', text: 'Hello' }, cleaner),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(db.orderComment.create).not.toHaveBeenCalled();
    });

    it('rejects a blank comment', async () => {
      await expect(
        service.addComment({ orderId: 'order-1', text: '   ' }, lead),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(db.orderComment.create).not.toHaveBeenCalled();
    });

    it('rejects an unknown order', async () => {
      db.order.findUnique.mockResolvedValue(null);
      await expect(
        service.addComment({ orderId: 'nope', text: 'Hello' }, lead),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('team', () => {
    beforeEach(() => {
      db.order.findUnique.mockResolvedValue({
        id: 'order-1',
        serviceType: 'PROTECTION',
      });
    });

    it('adds a qualified member, without duplicating an existing one', async () => {
      db.user.findMany.mockResolvedValue([protector]);
      await service.assignTeamMember('order-1', protector.id);
      // upsert with an empty update: adding an existing member is a no-op.
      expect(db.orderAssignment.upsert).toHaveBeenCalledWith({
        where: { orderId_userId: { orderId: 'order-1', userId: protector.id } },
        create: { orderId: 'order-1', userId: protector.id },
        update: {},
      });
    });

    it('refuses someone from another service area', async () => {
      db.user.findMany.mockResolvedValue([cleaner]);
      await expect(
        service.assignTeamMember('order-1', cleaner.id),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(db.orderAssignment.upsert).not.toHaveBeenCalled();
    });

    it('removes a member', async () => {
      await service.removeTeamMember('order-1', protector.id);
      expect(db.orderAssignment.deleteMany).toHaveBeenCalledWith({
        where: { orderId: 'order-1', userId: protector.id },
      });
    });
  });
});

describe('buildOrdersWhere', () => {
  const now = new Date('2026-10-04T12:00:00Z');

  it('has no conditions without filters', () => {
    expect(buildOrdersWhere({}, now)).toEqual({ AND: [] });
  });

  it('combines filters', () => {
    expect(
      buildOrdersWhere({ status: 'PLANNED', serviceType: 'CLEANING' }, now),
    ).toEqual({ AND: [{ status: 'PLANNED' }, { serviceType: 'CLEANING' }] });
  });

  it('finds overdue orders: due date passed and not done', () => {
    expect(buildOrdersWhere({ overdue: true }, now)).toEqual({
      AND: [{ dueDate: { lt: now }, status: { not: 'DONE' } }],
    });
  });

  it('finds orders on time: not yet due, or done', () => {
    expect(buildOrdersWhere({ overdue: false }, now)).toEqual({
      AND: [{ OR: [{ dueDate: { gte: now } }, { status: 'DONE' }] }],
    });
  });
});
