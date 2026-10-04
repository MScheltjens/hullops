import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from './config/env';

/**
 * App-wide setup that is not part of a module. It lives here, not in main.ts,
 * so e2e tests can apply it to their app and test the same behavior that
 * runs in production.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  // Browsers block requests from the web app (another origin) unless the API
  // allows that origin explicitly.
  app.enableCors({ origin: config.get('CORS_ORIGINS', { infer: true }) });

  // Validates GraphQL input types against their class-validator decorators.
  // `whitelist` drops any property that has no decorator.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
}
