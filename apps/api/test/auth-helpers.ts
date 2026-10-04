import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { hashPassword } from './../src/auth/password';
import type { Role, ServiceType } from './../src/generated/prisma/client';
import { PrismaService } from './../src/prisma/prisma.service';

export const TEST_PASSWORD = 'e2e-test-password';

// scrypt is slow on purpose, so hash the shared test password once and reuse
// it for every test user instead of once per user.
let testPasswordHash: Promise<string> | undefined;
const getTestPasswordHash = () =>
  (testPasswordHash ??= hashPassword(TEST_PASSWORD));

/**
 * Sends a GraphQL request, logged in when a token is given. Errors are in
 * `body.errors`. The HTTP status is 200 even for most errors (e.g. a
 * permission error); only a query that doesn't match the schema gets 400.
 */
export function graphql(app: INestApplication<App>, token?: string) {
  return (query: string, variables?: Record<string, unknown>) => {
    const req = request(app.getHttpServer()).post('/graphql');
    if (token) req.set('Authorization', `Bearer ${token}`);
    return req.send({ query, variables });
  };
}

/**
 * Creates a user with TEST_PASSWORD and logs them in through the real
 * `login` mutation. Returns the access token. The caller deletes the user.
 */
export async function createUserAndLogin(
  app: INestApplication<App>,
  user: { id: string; role: Role; serviceTypes: ServiceType[] },
): Promise<string> {
  const email = `${user.id}@hullops.example`;
  await app.get(PrismaService).user.create({
    data: {
      ...user,
      email,
      name: user.id,
      passwordHash: await getTestPasswordHash(),
    },
  });
  const response = await graphql(app)(
    'mutation ($input: LoginInput!) { login(input: $input) { accessToken } }',
    { input: { email, password: TEST_PASSWORD } },
  );
  return response.body.data.login.accessToken;
}
