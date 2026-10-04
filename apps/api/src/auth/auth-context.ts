import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import type { Request } from 'express';
import type { Role, User } from '../generated/prisma/client';

/** The logged-in user, as the API keeps it during a request. */
export type AuthUser = Omit<User, 'passwordHash'>;

export type AuthRequest = Request & { user?: AuthUser };

/** The HTTP request behind a REST call or a GraphQL operation. */
export function getRequest(context: ExecutionContext): AuthRequest {
  if (context.getType<GqlContextType>() === 'graphql') {
    return GqlExecutionContext.create(context).getContext<{
      req: AuthRequest;
    }>().req;
  }
  return context.switchToHttp().getRequest<AuthRequest>();
}

export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';

/** Opens an endpoint to visitors who aren't logged in. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Restricts an endpoint to users with one of these roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

/** Injects the logged-in user into a resolver or controller method. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const user = getRequest(context).user;
    if (!user) {
      // Only reachable if a @Public() endpoint asks for the user: a bug.
      throw new Error('@CurrentUser() used on an endpoint without login');
    }
    return user;
  },
);
