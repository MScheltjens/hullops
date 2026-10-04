import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { PrismaService } from './../src/prisma/prisma.service';
import { createUserAndLogin, graphql, TEST_PASSWORD } from './auth-helpers';

/**
 * Login, tokens and roles, through the real app and test database.
 */
describe('Authentication (e2e)', () => {
  let app: INestApplication<App>;
  const run = Date.now().toString(36);
  const workerId = `e2e-${run}-auth-worker`;
  const workerEmail = `${workerId}@hullops.example`;
  let workerToken: string;

  const LOGIN = `
    mutation ($input: LoginInput!) {
      login(input: $input) { accessToken expiresAt user { id email locale } }
    }`;
  const anonymous = () => graphql(app);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    workerToken = await createUserAndLogin(app, {
      id: workerId,
      role: 'WORKER',
      serviceTypes: ['CLEANING'],
    });
  });

  afterAll(async () => {
    await app.get(PrismaService).user.deleteMany({ where: { id: workerId } });
    await app.close();
  });

  it('logs in and returns a working token', async () => {
    const response = await anonymous()(LOGIN, {
      input: { email: workerEmail, password: TEST_PASSWORD },
    });
    const { accessToken, expiresAt, user } = response.body.data.login;
    expect(user).toEqual({ id: workerId, email: workerEmail, locale: 'EN' });
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());

    const me = await graphql(app, accessToken)('{ me { id role } }');
    expect(me.body.data.me).toEqual({ id: workerId, role: 'WORKER' });
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const wrongPassword = await anonymous()(LOGIN, {
      input: { email: workerEmail, password: 'not-the-password' },
    });
    const unknownEmail = await anonymous()(LOGIN, {
      input: { email: 'nobody@hullops.example', password: TEST_PASSWORD },
    });

    for (const response of [wrongPassword, unknownEmail]) {
      const [error] = response.body.errors;
      expect(error.extensions.code).toBe('UNAUTHENTICATED');
      expect(error.message).toBe('Invalid email or password');
    }
  });

  it('requires login for everything except login and health', async () => {
    const response = await anonymous()('{ orders { id } }');
    expect(response.body.errors[0].extensions.code).toBe('UNAUTHENTICATED');

    await request(app.getHttpServer()).get('/health').expect(200);
  });

  it('rejects a tampered token', async () => {
    const tampered = `${workerToken.slice(0, -2)}xx`;
    const response = await graphql(app, tampered)('{ me { id } }');
    expect(response.body.errors[0].extensions.code).toBe('UNAUTHENTICATED');
  });

  it('forbids workers from adding vessels', async () => {
    const response = await graphql(
      app,
      workerToken,
    )('mutation { createVessel(input: { name: "Not allowed" }) { id } }');
    expect(response.body.errors[0].extensions.code).toBe('FORBIDDEN');
  });

  it('never exposes password hashes', async () => {
    const response = await graphql(
      app,
      workerToken,
    )('{ users { passwordHash } }');
    // The field doesn't exist in the schema at all, so the query is
    // rejected before it runs.
    expect(response.status).toBe(400);
    expect(response.body.errors[0].extensions.code).toBe(
      'GRAPHQL_VALIDATION_FAILED',
    );
  });

  it('lets users choose their language', async () => {
    const asWorker = graphql(app, workerToken);
    const updated = await asWorker(
      'mutation { setMyLocale(locale: DE) { locale } }',
    );
    expect(updated.body.data.setMyLocale).toEqual({ locale: 'DE' });

    const me = await asWorker('{ me { locale } }');
    expect(me.body.data.me).toEqual({ locale: 'DE' });
  });
});
