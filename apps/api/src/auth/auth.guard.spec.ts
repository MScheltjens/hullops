import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthRequest } from './auth-context';
import { IS_PUBLIC, ROLES } from './auth-context';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('AuthGuard', () => {
  const worker = { id: 'worker-1', role: 'WORKER' };
  const authService = { authenticate: jest.fn() };

  // Builds what Nest hands the guard: the request plus the decorators
  // (metadata) on the endpoint being called.
  const run = (
    authorization: string | undefined,
    metadata: Record<string, unknown> = {},
  ) => {
    const request = { headers: { authorization } } as AuthRequest;
    const context = {
      getType: () => 'http',
      getHandler: () => () => undefined,
      getClass: () => class {},
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    const reflector = {
      getAllAndOverride: (key: string) => metadata[key],
    } as unknown as Reflector;
    const guard = new AuthGuard(
      reflector,
      authService as unknown as AuthService,
    );
    return { result: guard.canActivate(context), request };
  };

  beforeEach(() => jest.resetAllMocks());

  it('lets anyone through to a @Public() endpoint', async () => {
    const { result } = run(undefined, { [IS_PUBLIC]: true });
    await expect(result).resolves.toBe(true);
    expect(authService.authenticate).not.toHaveBeenCalled();
  });

  it('requires a token everywhere else', async () => {
    await expect(run(undefined).result).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token that does not authenticate', async () => {
    authService.authenticate.mockResolvedValue(null);
    await expect(run('Bearer bad-token').result).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(authService.authenticate).toHaveBeenCalledWith('bad-token');
  });

  it('attaches the logged-in user to the request', async () => {
    authService.authenticate.mockResolvedValue(worker);
    const { result, request } = run('Bearer good-token');
    await expect(result).resolves.toBe(true);
    expect(request.user).toBe(worker);
  });

  it('allows a user whose role is listed in @Roles()', async () => {
    authService.authenticate.mockResolvedValue(worker);
    const { result } = run('Bearer good-token', {
      [ROLES]: ['WORKER', 'PROJECT_LEAD'],
    });
    await expect(result).resolves.toBe(true);
  });

  it('forbids a user whose role is not listed', async () => {
    authService.authenticate.mockResolvedValue(worker);
    const { result } = run('Bearer good-token', { [ROLES]: ['PROJECT_LEAD'] });
    await expect(result).rejects.toBeInstanceOf(ForbiddenException);
  });
});
