import { join } from 'node:path';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { AuthModule } from './auth/auth.module';
import { Env, validateEnv } from './config/env';
import { formatGraphqlError } from './graphql/format-graphql-error';
import { HealthModule } from './health/health.module';
import { OrdersModule } from './orders/orders.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { VesselsModule } from './vessels/vessels.module';

@Module({
  imports: [
    // Loads apps/api/.env into process.env (variables already set, e.g. in CI,
    // win) and checks them against the schema in config/env.ts.
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // forRootAsync so the GraphQL options can depend on the validated config.
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const isProduction =
          config.get('NODE_ENV', { infer: true }) === 'production';
        return {
          // Code-first: the schema is generated from the decorated TypeScript
          // classes. In development it's also written to src/schema.gql, so
          // schema changes show up in code review. In production (a built
          // image has no src/ folder) it stays in memory.
          autoSchemaFile: isProduction
            ? true
            : join(process.cwd(), 'src/schema.gql'),
          sortSchema: true,
          // Makes the HTTP request available to guards and @CurrentUser().
          context: ({ req }: { req: unknown }) => ({ req }),
          // In production, don't let anyone browse or download the schema.
          graphiql: !isProduction,
          introspection: !isProduction,
          formatError: (formatted) =>
            formatGraphqlError(formatted, isProduction),
        };
      },
    }),
    PrismaModule,
    AuthModule,
    HealthModule,
    VesselsModule,
    UsersModule,
    OrdersModule,
  ],
})
export class AppModule {}
