import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-context';
import { hashPassword } from '../auth/password';
import {
  Prisma,
  type Locale,
  type Role,
  type ServiceType,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateUserInput,
  ResetPasswordInput,
  UpdateUserInput,
} from './user.inputs';
import { canManageRole, validateUserChange } from './user-rules';

/**
 * Managing users is for administrators and HR. The resolver already
 * restricts it to them; the service checks too, like OrdersService does for
 * creating orders, so the rule holds if the service is ever called from
 * elsewhere.
 */
function requireUserManager(actor: AuthUser): void {
  if (actor.role !== 'ADMIN' && actor.role !== 'HR') {
    throw new ForbiddenException('Only administrators and HR can manage users');
  }
}

/** HR only manages some roles (see canManageRole); admins manage all. */
function requireMayManage(actor: AuthUser, ...roles: (Role | undefined)[]) {
  for (const role of roles) {
    if (role !== undefined && !canManageRole(actor.role, role)) {
      throw new ForbiddenException(`Your role cannot manage ${role} users`);
    }
  }
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lists active users, e.g. the workers who can join a protection order.
   * Deactivated users are left out unless an administrator asks for them.
   */
  findAll(
    filter: {
      role?: Role;
      serviceType?: ServiceType;
      includeInactive?: boolean;
    } = {},
    actor?: AuthUser,
  ) {
    if (filter.includeInactive) {
      if (!actor) throw new ForbiddenException('Log in to use this');
      requireUserManager(actor);
    }
    return this.prisma.user.findMany({
      where: {
        role: filter.role,
        serviceTypes: filter.serviceType
          ? { has: filter.serviceType }
          : undefined,
        active: filter.includeInactive ? undefined : true,
      },
      orderBy: { name: 'asc' },
    });
  }

  setLocale(userId: string, locale: Locale) {
    return this.prisma.user.update({ where: { id: userId }, data: { locale } });
  }

  async create(input: CreateUserInput, actor: AuthUser) {
    requireUserManager(actor);
    requireMayManage(actor, input.role);
    // @IsNotEmpty accepts "   ", so check for a blank name here.
    const name = input.name.trim();
    if (!name) throw new BadRequestException('A name cannot be empty');

    const passwordHash = await hashPassword(input.password);
    try {
      return await this.prisma.user.create({
        data: {
          name,
          // Login looks emails up in lower case (see AuthService).
          email: input.email.trim().toLowerCase(),
          passwordHash,
          role: input.role,
          serviceTypes: input.serviceTypes,
          locale: input.locale,
        },
      });
    } catch (error) {
      // P2002: the unique email constraint.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A user with this email already exists');
      }
      throw error;
    }
  }

  async update(input: UpdateUserInput, actor: AuthUser) {
    requireUserManager(actor);
    const target = await this.findTarget(input.userId);
    requireMayManage(actor, target.role, input.role);
    this.checkChange(actor, target, { role: input.role });

    const name = input.name?.trim();
    if (input.name !== undefined && !name) {
      throw new BadRequestException('A name cannot be empty');
    }
    return this.prisma.user.update({
      where: { id: target.id },
      data: { name, role: input.role, serviceTypes: input.serviceTypes },
    });
  }

  async setActive(userId: string, active: boolean, actor: AuthUser) {
    requireUserManager(actor);
    const target = await this.findTarget(userId);
    requireMayManage(actor, target.role);
    this.checkChange(actor, target, { active });
    return this.prisma.user.update({
      where: { id: target.id },
      data: { active },
    });
  }

  async resetPassword(input: ResetPasswordInput, actor: AuthUser) {
    requireUserManager(actor);
    const target = await this.findTarget(input.userId);
    requireMayManage(actor, target.role);
    return this.prisma.user.update({
      where: { id: target.id },
      data: { passwordHash: await hashPassword(input.password) },
    });
  }

  private async findTarget(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    return user;
  }

  private checkChange(
    actor: AuthUser,
    target: { id: string; role: Role },
    change: { role?: Role; active?: boolean },
  ) {
    const errors = validateUserChange(actor.id, target, change);
    if (errors.length > 0) throw new BadRequestException(errors);
  }
}
