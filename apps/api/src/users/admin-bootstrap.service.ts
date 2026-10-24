import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hashPassword } from '../auth/password';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Creates the first administrator. A new database has no users, and only an
 * administrator can create users, so without this nobody could get in.
 *
 * It runs at startup, inside the API, so the database never has to be opened
 * to the internet for it. It only acts when ADMIN_EMAIL and ADMIN_PASSWORD
 * are set and no active administrator exists, so it does nothing on later
 * starts and can't overwrite or reset an existing account.
 */
@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = this.config.get('ADMIN_EMAIL', { infer: true });
    const password = this.config.get('ADMIN_PASSWORD', { infer: true });
    if (!email || !password) return;

    const admins = await this.prisma.user.count({
      where: { role: 'ADMIN', active: true },
    });
    if (admins > 0) return;

    const normalized = email.trim().toLowerCase();
    const taken = await this.prisma.user.findUnique({
      where: { email: normalized },
    });
    if (taken) {
      // Never change an existing account from an environment variable.
      this.logger.warn(
        'ADMIN_EMAIL belongs to an existing user who is not an active ' +
          'administrator; leaving that account unchanged.',
      );
      return;
    }

    await this.prisma.user.create({
      data: {
        name: 'Administrator',
        email: normalized,
        passwordHash: await hashPassword(password),
        role: 'ADMIN',
      },
    });
    this.logger.log(`Created the first administrator (${normalized})`);
  }
}
