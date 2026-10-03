import { join } from 'node:path';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { VesselsModule } from './vessels/vessels.module';

@Module({
  imports: [
    // Loads apps/api/.env into process.env (variables already set, e.g. in CI, win).
    ConfigModule.forRoot({ isGlobal: true }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      // Code-first: the schema is generated from the decorated TypeScript classes
      // and written to src/schema.gql, so schema changes show up in code review.
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      graphiql: true,
    }),
    PrismaModule,
    VesselsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
