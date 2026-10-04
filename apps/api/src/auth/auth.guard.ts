import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '../generated/prisma/client';
import { getRequest, IS_PUBLIC, ROLES } from './auth-context';
import { AuthService } from './auth.service';
import { extractBearerToken } from './bearer-token';

/**
 * Runs before every resolver and controller (registered globally in
 * AuthModule), so every endpoint requires login unless it's marked
 * @Public(). Forgetting to protect a new endpoint is therefore impossible;
 * forgetting to open one only shows up as a 401.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Method decorators win over class decorators.
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) {
      return true;
    }

    const request = getRequest(context);
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Log in to use this');
    }
    const user = await this.authService.authenticate(token);
    if (!user) {
      throw new UnauthorizedException(
        'Your session is invalid or has expired; log in again',
      );
    }
    request.user = user;

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES,
      targets,
    );
    if (roles && !roles.includes(user.role)) {
      throw new ForbiddenException('Your role does not allow this');
    }
    return true;
  }
}
