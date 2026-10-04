import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { hashPassword } from './password';

describe('AuthService', () => {
  // A real JwtService: signing and verifying are what's under test here.
  const jwt = new JwtService({
    secret: 'a-test-secret-that-is-long-enough-1234',
    signOptions: { algorithm: 'HS256', expiresIn: 3600 },
    verifyOptions: { algorithms: ['HS256'] },
  });
  const config = { get: () => 8 } as unknown as ConfigService;
  const prisma = { user: { findUnique: jest.fn() } };
  const service = new AuthService(
    prisma as unknown as PrismaService,
    jwt,
    config as never,
  );

  let lena: {
    id: string;
    email: string;
    role: string;
    passwordHash: string;
  };

  beforeAll(async () => {
    lena = {
      id: 'user-lena',
      email: 'lena@hullops.example',
      role: 'PROJECT_LEAD',
      passwordHash: await hashPassword('right-password'),
    };
  });

  beforeEach(() => jest.resetAllMocks());

  describe('login', () => {
    it('returns a token for the user and the user without the hash', async () => {
      prisma.user.findUnique.mockResolvedValue(lena);

      const result = await service.login(lena.email, 'right-password');

      const payload = await jwt.verifyAsync<{ sub: string }>(
        result.accessToken,
      );
      expect(payload.sub).toBe(lena.id);
      expect(result.user).toEqual({
        id: lena.id,
        email: lena.email,
        role: 'PROJECT_LEAD',
      });
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('says when the token expires', async () => {
      prisma.user.findUnique.mockResolvedValue(lena);
      const before = Date.now();

      const { expiresAt } = await service.login(lena.email, 'right-password');

      const eightHours = 8 * 3_600_000;
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + eightHours);
      expect(expiresAt.getTime()).toBeLessThan(before + eightHours + 5_000);
    });

    it('ignores case and surrounding spaces in the email', async () => {
      prisma.user.findUnique.mockResolvedValue(lena);
      await service.login('  Lena@HullOps.example ', 'right-password');
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'lena@hullops.example' } }),
      );
    });

    it('rejects a wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue(lena);
      await expect(service.login(lena.email, 'wrong-password')).rejects.toThrow(
        new UnauthorizedException('Invalid email or password'),
      );
    });

    it('rejects an unknown email with the very same error', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.login('nobody@hullops.example', 'right-password'),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    });
  });

  describe('authenticate', () => {
    it('returns the user a valid token belongs to', async () => {
      const token = await jwt.signAsync({ sub: lena.id });
      prisma.user.findUnique.mockResolvedValue({ id: lena.id });

      await expect(service.authenticate(token)).resolves.toEqual({
        id: lena.id,
      });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: lena.id },
      });
    });

    it('returns null for a user that no longer exists', async () => {
      const token = await jwt.signAsync({ sub: 'deleted-user' });
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.authenticate(token)).resolves.toBeNull();
    });

    it('returns null for a token signed with another secret', async () => {
      const forged = await new JwtService({
        secret: 'someone-elses-secret-that-is-long-enough',
      }).signAsync({ sub: lena.id });
      await expect(service.authenticate(forged)).resolves.toBeNull();
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('returns null for an expired token', async () => {
      const expired = await jwt.signAsync({ sub: lena.id }, { expiresIn: -10 });
      await expect(service.authenticate(expired)).resolves.toBeNull();
    });

    it('returns null for something that is not a token', async () => {
      await expect(service.authenticate('not-a-jwt')).resolves.toBeNull();
    });
  });
});
