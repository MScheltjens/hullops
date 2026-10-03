import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

/**
 * The single Prisma client for the whole app. Each PrismaClient owns a
 * connection pool, so it is provided once (see PrismaModule) and injected
 * everywhere instead of being instantiated per feature.
 *
 * Prisma 7 no longer bundles a query engine with its own database driver,
 * so the connection goes through the `pg` driver adapter.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: ConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: config.getOrThrow<string>('DATABASE_URL'),
      }),
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
