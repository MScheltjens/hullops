import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../generated/prisma/client';

/**
 * The single Prisma client for the whole app. Each PrismaClient owns a
 * connection pool, so it is provided once (see PrismaModule) and injected
 * everywhere instead of being instantiated per feature.
 *
 * Prisma 7 no longer bundles a query engine with its own database driver,
 * so the connection goes through the `pg` driver adapter.
 */
/**
 * Fields that are never loaded unless a query asks for them explicitly with
 * `omit: { passwordHash: false }` (only the login does). Orders load users
 * for `createdBy` and `team`; this keeps password hashes out of memory and
 * out of any response by accident. The type parameter below makes
 * TypeScript know the field is absent too.
 */
const OMIT_BY_DEFAULT = {
  user: { passwordHash: true },
} as const;

@Injectable()
export class PrismaService
  extends PrismaClient<
    Prisma.PrismaClientOptions & { omit: typeof OMIT_BY_DEFAULT }
  >
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: ConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: config.getOrThrow<string>('DATABASE_URL'),
      }),
      omit: OMIT_BY_DEFAULT,
    });
  }

  // Connect eagerly so a wrong DATABASE_URL fails at startup, not on the first request.
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
