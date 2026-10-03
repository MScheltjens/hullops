import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { PrismaService } from './../src/prisma/prisma.service';

/**
 * Runs the real app against the database in DATABASE_URL (in CI, a throwaway
 * test database). Every vessel this suite creates is deleted afterwards.
 */
describe('Vessels GraphQL API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdIds: string[] = [];

  const gql = (query: string, variables?: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/graphql')
      .send({ query, variables })
      .expect(200);

  const createVessel = `
    mutation ($input: CreateVesselInput!) {
      createVessel(input: $input) { id name imoNumber lengthM }
    }`;

  // A random IMO number with a valid check digit, so repeated runs against a
  // local database don't collide on the unique constraint.
  const randomImoNumber = () => {
    const digits = Array.from({ length: 6 }, () =>
      Math.floor(Math.random() * 10),
    );
    const sum = digits.reduce((acc, digit, i) => acc + digit * (7 - i), 0);
    return [...digits, sum % 10].join('');
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.vessel.deleteMany({ where: { id: { in: createdIds } } });
    await app.close();
  });

  it('creates a vessel and returns it by id and in the list', async () => {
    const imoNumber = randomImoNumber();
    const created = await gql(createVessel, {
      input: { name: 'E2E Aurora', imoNumber, lengthM: 72.5 },
    });
    const vessel = created.body.data.createVessel;
    createdIds.push(vessel.id);
    expect(vessel).toMatchObject({
      name: 'E2E Aurora',
      imoNumber,
      lengthM: 72.5,
    });

    const byId = await gql('query ($id: ID!) { vessel(id: $id) { name } }', {
      id: vessel.id,
    });
    expect(byId.body.data.vessel).toEqual({ name: 'E2E Aurora' });

    const list = await gql('{ vessels { id } }');
    expect(list.body.data.vessels).toContainEqual({ id: vessel.id });
  });

  it('rejects a duplicate IMO number with CONFLICT', async () => {
    const imoNumber = randomImoNumber();
    const first = await gql(createVessel, {
      input: { name: 'First', imoNumber },
    });
    createdIds.push(first.body.data.createVessel.id);

    const second = await gql(createVessel, {
      input: { name: 'Second', imoNumber },
    });
    const [error] = second.body.errors;
    expect(error.extensions.code).toBe('CONFLICT');
    expect(error.message).toContain(imoNumber);
  });

  it('reports every failed validation rule', async () => {
    const response = await gql(createVessel, {
      input: { name: 'Bad', imoNumber: '1234568', lengthM: -3 },
    });
    const [error] = response.body.errors;
    expect(error.message).toBe('Validation failed');
    expect(error.extensions.code).toBe('BAD_REQUEST');
    expect(error.extensions.validationErrors).toEqual(
      expect.arrayContaining([
        'imoNumber must be a valid 7-digit IMO number',
        'lengthM must be a positive number',
      ]),
    );
  });

  it('returns null for an unknown id', async () => {
    const response = await gql('{ vessel(id: "does-not-exist") { id } }');
    expect(response.body.data.vessel).toBeNull();
  });
});
