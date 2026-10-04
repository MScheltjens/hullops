import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from './auth-context';
import { hashPassword, verifyPassword } from './password';

interface TokenPayload {
  /** The user's id ("subject" in JWT terms). */
  sub: string;
}

@Injectable()
export class AuthService {
  /**
   * Compared against when the email doesn't exist, so a failed login takes
   * as long for an unknown email as for a wrong password. Otherwise the
   * response time would reveal which email addresses have an account.
   */
  private readonly dummyHash = hashPassword('no-user-has-this-password');

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      // The only query that needs the hash (see PrismaService).
      omit: { passwordHash: false },
    });
    const passwordMatches = await verifyPassword(
      password,
      user?.passwordHash ?? (await this.dummyHash),
    );
    if (!user || !passwordMatches) {
      // One message for both cases, for the same reason as dummyHash.
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload: TokenPayload = { sub: user.id };
    const hours = this.config.get('JWT_EXPIRES_IN_HOURS', { infer: true });
    const { passwordHash: _hash, ...safeUser } = user;
    return {
      accessToken: await this.jwt.signAsync(payload),
      expiresAt: new Date(Date.now() + hours * 3_600_000),
      user: safeUser,
    };
  }

  /**
   * Returns the user a token belongs to, or null if the token is invalid,
   * expired, or the user no longer exists.
   *
   * The user is loaded on every request (one indexed query) rather than
   * trusted from the token, so a deleted user or a changed role takes effect
   * immediately instead of when the token expires.
   */
  async authenticate(token: string): Promise<AuthUser | null> {
    let payload: TokenPayload;
    try {
      payload = await this.jwt.verifyAsync<TokenPayload>(token);
    } catch {
      return null;
    }
    return this.prisma.user.findUnique({ where: { id: payload.sub } });
  }
}
