import { Logger } from '@nestjs/common';
import { verifyPassword } from '../auth/password';
import { AdminBootstrapService } from './admin-bootstrap.service';

describe('AdminBootstrapService', () => {
  const user = { count: jest.fn(), findUnique: jest.fn(), create: jest.fn() };
  const settings: Record<string, string | undefined> = {};
  const config = { get: (key: string) => settings[key] };
  const service = new AdminBootstrapService({ user } as never, config as never);

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    settings.ADMIN_EMAIL = 'Boss@Hullops.Example';
    settings.ADMIN_PASSWORD = 'a-long-enough-password';
    user.count.mockResolvedValue(0);
    user.findUnique.mockResolvedValue(null);
  });

  it('creates the first administrator', async () => {
    user.create.mockImplementation(({ data }) => Promise.resolve(data));

    await service.onApplicationBootstrap();

    const { data } = user.create.mock.calls[0][0] as {
      data: { email: string; role: string; passwordHash: string };
    };
    expect(data.email).toBe('boss@hullops.example');
    expect(data.role).toBe('ADMIN');
    await expect(
      verifyPassword('a-long-enough-password', data.passwordHash),
    ).resolves.toBe(true);
  });

  it('does nothing without the settings', async () => {
    settings.ADMIN_EMAIL = undefined;
    settings.ADMIN_PASSWORD = undefined;
    await service.onApplicationBootstrap();
    expect(user.count).not.toHaveBeenCalled();
    expect(user.create).not.toHaveBeenCalled();
  });

  it('does nothing when an active administrator exists', async () => {
    user.count.mockResolvedValue(1);
    await service.onApplicationBootstrap();
    expect(user.create).not.toHaveBeenCalled();
  });

  it('never changes an existing account', async () => {
    user.findUnique.mockResolvedValue({ id: 'u-1', role: 'WORKER' });
    await service.onApplicationBootstrap();
    expect(user.create).not.toHaveBeenCalled();
  });
});
