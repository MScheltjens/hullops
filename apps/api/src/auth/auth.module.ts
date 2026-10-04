import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import type { Env } from '../config/env';
import { UsersModule } from '../users/users.module';
import { AuthGuard } from './auth.guard';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: {
          algorithm: 'HS256',
          expiresIn: config.get('JWT_EXPIRES_IN_HOURS', { infer: true }) * 3600,
        },
        // Only accept the algorithm we sign with; a token that claims
        // another one (e.g. "none") is rejected.
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  providers: [
    AuthService,
    AuthResolver,
    // Registered as a global guard: it protects every endpoint in the app.
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
