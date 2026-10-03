import { INestApplication, ValidationPipe } from '@nestjs/common';

/**
 * App-wide setup that is not part of a module. It lives here, not in main.ts,
 * so e2e tests can apply it to their app and test the same behavior that
 * runs in production.
 */
export function configureApp(app: INestApplication): void {
  // Validates GraphQL input types against their class-validator decorators.
  // `whitelist` drops any property that has no decorator.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
}
