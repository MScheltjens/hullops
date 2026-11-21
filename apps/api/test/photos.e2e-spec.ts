import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { weekStartOf } from './../src/common/week';
import type { Role } from './../src/generated/prisma/client';
import { PrismaService } from './../src/prisma/prisma.service';
import { createUserAndLogin, graphql, runId } from './auth-helpers';

/**
 * Photos on status updates (#37): who may request upload URLs, the limits,
 * and that a status update only accepts keys its author requested.
 *
 * No file is actually uploaded: the API never touches the bytes, it only
 * signs URLs (computed locally) and checks keys, so this runs without the
 * object storage, as in CI.
 */
describe('Photos GraphQL API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const run = runId();
  const id = (name: string) => `e2e-${run}-${name}`;
  const ids = {
    lead: id('lead'),
    cleaner: id('cleaner'), // on the order's team
    bystander: id('bystander'), // planned on the vessel, not on the team
    unplanned: id('unplanned'), // not planned on the vessel this week
    teamLead: id('team-lead'),
    hr: id('hr'),
    vessel: id('vessel'),
  };

  type Gql = ReturnType<typeof graphql>;
  const as = {} as Record<
    'lead' | 'cleaner' | 'bystander' | 'unplanned' | 'teamLead' | 'hr',
    Gql
  >;
  let orderId: string;

  const jpeg = (sizeBytes = 2_000_000) => ({
    mimeType: 'image/jpeg',
    sizeBytes,
  });

  const requestUploads = (
    client: Gql,
    files: { mimeType: string; sizeBytes: number }[],
  ) =>
    client(
      `mutation ($input: RequestPhotoUploadsInput!) {
        requestPhotoUploads(input: $input) { storageKey url headers { name value } }
      }`,
      { input: { orderId, files } },
    );

  /** Requests uploads and returns their storage keys. */
  const keysFor = async (client: Gql, count: number) => {
    const response = await requestUploads(
      client,
      Array.from({ length: count }, () => jpeg()),
    );
    expect(response.body.errors).toBeUndefined();
    return (
      response.body.data.requestPhotoUploads as { storageKey: string }[]
    ).map((target) => target.storageKey);
  };

  const addStatusUpdate = (client: Gql, input: Record<string, unknown>) =>
    client(
      `mutation ($input: AddStatusUpdateInput!) {
        addStatusUpdate(input: $input) {
          history { note photos { id url mimeType } }
        }
      }`,
      { input: { orderId, status: 'PLANNED', ...input } },
    );

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const make = async (key: keyof typeof as, role: Role) => {
      as[key] = graphql(
        app,
        await createUserAndLogin(app, {
          id: ids[key],
          role,
          serviceTypes: ['CLEANING'],
        }),
      );
    };
    await make('lead', 'PROJECT_LEAD');
    await make('cleaner', 'WORKER');
    await make('bystander', 'WORKER');
    await make('unplanned', 'WORKER');
    await make('teamLead', 'TEAM_LEAD');
    await make('hr', 'HR');

    await prisma.vessel.create({
      data: {
        id: ids.vessel,
        name: 'E2E Photo Vessel',
        teamLeadId: ids.teamLead,
      },
    });
    // Workers only see vessels they're planned on this week or next.
    await prisma.crewAssignment.createMany({
      data: [ids.cleaner, ids.bystander].map((userId) => ({
        userId,
        vesselId: ids.vessel,
        weekStart: weekStartOf(new Date()),
      })),
    });

    const created = await as.lead(
      `mutation ($input: CreateOrderInput!) { createOrder(input: $input) { id } }`,
      {
        input: {
          title: 'E2E photo order',
          serviceType: 'CLEANING',
          shipyard: 'Elbe Werft',
          startDate: new Date().toISOString(),
          dueDate: new Date(Date.now() + 3 * 86_400_000).toISOString(),
          vesselId: ids.vessel,
          cleaning: { method: 'High-pressure water', surface: 'Hull' },
          teamIds: [ids.cleaner],
        },
      },
    );
    orderId = created.body.data.createOrder.id;
  });

  afterAll(async () => {
    // Deleting the order cascades to its history, photos and open uploads.
    await prisma.order.deleteMany({ where: { vesselId: ids.vessel } });
    await prisma.crewAssignment.deleteMany({ where: { vesselId: ids.vessel } });
    await prisma.vessel.delete({ where: { id: ids.vessel } });
    await prisma.user.deleteMany({ where: { id: { in: Object.values(ids) } } });
    await app.close();
  });

  describe('requestPhotoUploads', () => {
    it('gives the order’s team a signed upload URL per photo', async () => {
      const response = await requestUploads(as.cleaner, [jpeg(), jpeg()]);

      expect(response.body.errors).toBeUndefined();
      const targets = response.body.data.requestPhotoUploads;
      expect(targets).toHaveLength(2);
      for (const target of targets) {
        expect(target.storageKey).toMatch(
          new RegExp(`^orders/${orderId}/[0-9a-f-]{36}\\.jpg$`),
        );
        expect(target.url).toContain(target.storageKey);
        expect(target.url).toContain('X-Amz-Signature=');
        expect(target.headers).toEqual([
          { name: 'Content-Type', value: 'image/jpeg' },
        ]);
      }
      // Recorded for this user and order, so only they can attach them.
      const uploads = await prisma.photoUpload.findMany({
        where: {
          storageKey: {
            in: targets.map((t: { storageKey: string }) => t.storageKey),
          },
        },
      });
      expect(uploads.map((u) => [u.userId, u.orderId])).toEqual([
        [ids.cleaner, orderId],
        [ids.cleaner, orderId],
      ]);
    });

    it.each(['lead', 'teamLead'] as const)(
      'lets the %s add photos without being on the team',
      async (who) => {
        const response = await requestUploads(as[who], [jpeg()]);
        expect(response.body.errors).toBeUndefined();
      },
    );

    it('keeps HR out', async () => {
      const response = await requestUploads(as.hr, [jpeg()]);
      expect(response.body.errors[0].extensions.code).toBe('FORBIDDEN');
    });

    it('refuses a worker who sees the vessel but isn’t on the team', async () => {
      const response = await requestUploads(as.bystander, [jpeg()]);
      expect(response.body.errors[0].extensions.code).toBe('FORBIDDEN');
    });

    it('answers as if the order didn’t exist for a worker who can’t see it', async () => {
      const response = await requestUploads(as.unplanned, [jpeg()]);
      expect(response.body.errors[0].extensions.code).toBe('NOT_FOUND');
    });

    it('reports every limit that is broken at once, and records nothing', async () => {
      const before = await prisma.photoUpload.count({ where: { orderId } });

      const response = await requestUploads(as.cleaner, [
        jpeg(),
        { mimeType: 'application/pdf', sizeBytes: 1000 },
        jpeg(10 * 1024 * 1024 + 1),
        jpeg(10 * 1024 * 1024), // exactly 10 MB is fine
        jpeg(),
        jpeg(),
      ]);

      expect(response.body.data).toBeNull();
      expect(response.body.errors[0].extensions.validationErrors).toEqual([
        'Upload between 1 and 5 photos, got 6',
        'Photo 2: type application/pdf is not allowed (JPEG, PNG, WebP or HEIC only)',
        'Photo 3: larger than 10 MB',
      ]);
      expect(await prisma.photoUpload.count({ where: { orderId } })).toBe(
        before,
      );
    });

    it('refuses an empty list', async () => {
      const response = await requestUploads(as.cleaner, []);
      expect(response.body.errors[0].extensions.validationErrors).toEqual([
        'Upload between 1 and 5 photos, got 0',
      ]);
    });
  });

  describe('addStatusUpdate with photos', () => {
    it('attaches the uploads as photos with download URLs, each key only once', async () => {
      const keys = await keysFor(as.cleaner, 2);

      // Photos alone are enough for an update that keeps the status.
      const response = await addStatusUpdate(as.cleaner, { photoKeys: keys });

      expect(response.body.errors).toBeUndefined();
      const photos = response.body.data.addStatusUpdate.history.at(-1).photos;
      expect(photos).toHaveLength(2);
      keys.forEach((key, index) => {
        expect(photos[index].mimeType).toBe('image/jpeg');
        expect(photos[index].url).toContain(key);
        expect(photos[index].url).toContain('X-Amz-Signature=');
      });
      // The uploads have become photos.
      expect(
        await prisma.photoUpload.count({ where: { storageKey: { in: keys } } }),
      ).toBe(0);

      const again = await addStatusUpdate(as.cleaner, {
        note: 'Same photos again',
        photoKeys: [keys[0]],
      });
      expect(again.body.errors[0].extensions.validationErrors).toEqual([
        `Photo ${keys[0]}: not an upload of yours for this order`,
      ]);
    });

    it('refuses a key someone else requested, and keeps it for them', async () => {
      const [cleanersKey] = await keysFor(as.cleaner, 1);

      // The project lead may update the order, but didn't request this key.
      const response = await addStatusUpdate(as.lead, {
        note: 'Taking over his photo',
        photoKeys: [cleanersKey],
      });

      expect(response.body.errors[0].extensions.validationErrors).toEqual([
        `Photo ${cleanersKey}: not an upload of yours for this order`,
      ]);
      // Nothing was written, and the cleaner can still attach it.
      expect(
        await prisma.photo.count({ where: { storageKey: cleanersKey } }),
      ).toBe(0);
      const own = await addStatusUpdate(as.cleaner, {
        photoKeys: [cleanersKey],
      });
      expect(own.body.errors).toBeUndefined();
    });

    it('refuses a key requested for another order', async () => {
      const [key] = await keysFor(as.cleaner, 1);
      const other = await as.lead(
        `mutation ($input: CreateOrderInput!) { createOrder(input: $input) { id } }`,
        {
          input: {
            title: 'E2E other photo order',
            serviceType: 'CLEANING',
            shipyard: 'Elbe Werft',
            startDate: new Date().toISOString(),
            dueDate: new Date(Date.now() + 86_400_000).toISOString(),
            vesselId: ids.vessel,
            cleaning: { method: 'Brush', surface: 'Deck' },
            teamIds: [ids.cleaner],
          },
        },
      );

      const response = await as.cleaner(
        `mutation ($input: AddStatusUpdateInput!) { addStatusUpdate(input: $input) { id } }`,
        {
          input: {
            orderId: other.body.data.createOrder.id,
            status: 'PLANNED',
            photoKeys: [key],
          },
        },
      );

      expect(response.body.errors[0].extensions.validationErrors).toEqual([
        `Photo ${key}: not an upload of yours for this order`,
      ]);
    });

    it('reports photo problems together with the other violations', async () => {
      const [key] = await keysFor(as.cleaner, 1);

      const response = await addStatusUpdate(as.cleaner, {
        status: 'DONE', // skips IN_PROGRESS
        photoKeys: [key, key, 'orders/made-up.jpg'],
      });

      expect(response.body.errors[0].extensions.validationErrors).toEqual([
        'Cannot change status from PLANNED to DONE',
        `Photo ${key}: listed more than once`,
        'Photo orders/made-up.jpg: not an upload of yours for this order',
      ]);
    });
  });
});
