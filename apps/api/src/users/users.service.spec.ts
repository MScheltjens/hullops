import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AuthUser } from '../auth/auth-context';
import { verifyPassword } from '../auth/password';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateUserInput } from './user.inputs';
import { UsersService } from './users.service';

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
const admin = makeUser('admin-1', 'ADMIN');
const lead = makeUser('lead-1', 'PROJECT_LEAD');

describe('UsersService', () => {
  let service: UsersService;
  const user = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: { user } }],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  describe('findAll', () => {
    it('lists active users sorted by name when no filter is given', async () => {
      await service.findAll();
      expect(user.findMany).toHaveBeenCalledWith({
        where: { role: undefined, serviceTypes: undefined, active: true },
        orderBy: { name: 'asc' },
      });
    });

    it('filters by role and service area', async () => {
      await service.findAll({ role: 'WORKER', serviceType: 'PROTECTION' });
      expect(user.findMany).toHaveBeenCalledWith({
        where: {
          role: 'WORKER',
          serviceTypes: { has: 'PROTECTION' },
          active: true,
        },
        orderBy: { name: 'asc' },
      });
    });

    it('includes deactivated users for administrators', async () => {
      await service.findAll({ includeInactive: true }, admin);
      expect(user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ active: undefined }),
        }),
      );
    });

    it('refuses everyone else the deactivated users', () => {
      expect(() => service.findAll({ includeInactive: true }, lead)).toThrow(
        ForbiddenException,
      );
    });
  });

  describe('create', () => {
    const makeInput = (
      overrides: Partial<CreateUserInput> = {},
    ): CreateUserInput => ({
      name: '  New Person ',
      email: '  New.Person@Hullops.Example ',
      password: 'a-long-enough-password',
      role: 'WORKER',
      serviceTypes: ['CLEANING'],
      locale: 'DE',
      ...overrides,
    });
    const input = makeInput();

    it('stores a trimmed name, a lower-case email and a password hash', async () => {
      user.create.mockImplementation(({ data }) => Promise.resolve(data));

      const created = (await service.create(input, admin)) as unknown as {
        name: string;
        email: string;
        passwordHash: string;
        role: string;
      };

      expect(created.name).toBe('New Person');
      expect(created.email).toBe('new.person@hullops.example');
      expect(created.role).toBe('WORKER');
      // Never the password itself, but a hash that verifies against it.
      expect(created.passwordHash).not.toContain(input.password);
      await expect(
        verifyPassword(input.password, created.passwordHash),
      ).resolves.toBe(true);
    });

    it('only lets administrators create users', async () => {
      await expect(service.create(input, lead)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(user.create).not.toHaveBeenCalled();
    });

    it('rejects a blank name', async () => {
      await expect(
        service.create(makeInput({ name: '   ' }), admin),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('reports a duplicate email as a conflict', async () => {
      user.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );
      await expect(service.create(input, admin)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('update', () => {
    it('changes the role of someone else', async () => {
      user.findUnique.mockResolvedValue({ id: 'w-1', role: 'WORKER' });
      await service.update({ userId: 'w-1', role: 'PROJECT_LEAD' }, admin);
      expect(user.update).toHaveBeenCalledWith({
        where: { id: 'w-1' },
        data: {
          name: undefined,
          role: 'PROJECT_LEAD',
          serviceTypes: undefined,
        },
      });
    });

    it('refuses to change your own role', async () => {
      user.findUnique.mockResolvedValue({ id: admin.id, role: 'ADMIN' });
      await expect(
        service.update({ userId: admin.id, role: 'WORKER' }, admin),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(user.update).not.toHaveBeenCalled();
    });

    it('rejects an unknown user', async () => {
      user.findUnique.mockResolvedValue(null);
      await expect(
        service.update({ userId: 'nope', name: 'X' }, admin),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('only lets administrators update users', async () => {
      await expect(
        service.update({ userId: 'w-1', name: 'X' }, lead),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('setActive', () => {
    it('deactivates someone else', async () => {
      user.findUnique.mockResolvedValue({ id: 'w-1', role: 'WORKER' });
      await service.setActive('w-1', false, admin);
      expect(user.update).toHaveBeenCalledWith({
        where: { id: 'w-1' },
        data: { active: false },
      });
    });

    it('refuses to deactivate yourself', async () => {
      user.findUnique.mockResolvedValue({ id: admin.id, role: 'ADMIN' });
      await expect(
        service.setActive(admin.id, false, admin),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(user.update).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('stores a hash of the new password', async () => {
      user.findUnique.mockResolvedValue({ id: 'w-1', role: 'WORKER' });
      user.update.mockImplementation(({ data }) => Promise.resolve(data));

      const result = (await service.resetPassword(
        { userId: 'w-1', password: 'another-long-password' },
        admin,
      )) as unknown as { passwordHash: string };

      await expect(
        verifyPassword('another-long-password', result.passwordHash),
      ).resolves.toBe(true);
    });

    it('only lets administrators reset passwords', async () => {
      await expect(
        service.resetPassword(
          { userId: 'w-1', password: 'x'.repeat(12) },
          lead,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
