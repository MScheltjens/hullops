import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AuthUser } from '../auth/auth-context';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { photoStorageKey, PhotosService } from './photos.service';

const db = {
  order: { findFirst: jest.fn() },
  photoUpload: { createMany: jest.fn() },
};
const storage = {
  createUploadUrl: jest.fn(),
};

const makeUser = (id: string, role: AuthUser['role']): AuthUser => ({
  id,
  name: id,
  role,
  serviceTypes: ['CLEANING'],
  email: `${id}@hullops.example`,
  locale: 'EN',
  active: true,
  createdAt: new Date(0),
  updatedAt: new Date(0),
});
const worker = makeUser('worker-1', 'WORKER');
const otherWorker = makeUser('worker-2', 'WORKER');

const order = {
  id: 'order-1',
  assignments: [{ userId: worker.id }],
  vessel: { teamLeadId: null },
};
const jpeg = { mimeType: 'image/jpeg', sizeBytes: 1000 };

describe('PhotosService.requestUploads', () => {
  let service: PhotosService;

  beforeEach(async () => {
    jest.resetAllMocks();
    storage.createUploadUrl.mockImplementation((key: string, type: string) =>
      Promise.resolve({
        url: `https://storage.example/${key}?signed`,
        headers: { 'Content-Type': type },
      }),
    );
    const moduleRef = await Test.createTestingModule({
      providers: [
        PhotosService,
        { provide: PrismaService, useValue: db },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();
    service = moduleRef.get(PhotosService);
  });

  it('records each upload for the user and order and returns a signed URL per photo', async () => {
    db.order.findFirst.mockResolvedValue(order);

    const targets = await service.requestUploads(
      {
        orderId: 'order-1',
        files: [jpeg, { mimeType: 'image/png', sizeBytes: 2000 }],
      },
      worker,
    );

    const [recorded] = db.photoUpload.createMany.mock.calls[0] as [
      { data: { storageKey: string; userId: string; orderId: string }[] },
    ];
    expect(recorded.data).toHaveLength(2);
    expect(recorded.data[0]).toMatchObject({
      userId: worker.id,
      orderId: 'order-1',
      mimeType: 'image/jpeg',
      sizeBytes: 1000,
    });
    // The keys handed out are exactly the ones recorded.
    expect(targets.map((t) => t.storageKey)).toEqual(
      recorded.data.map((u) => u.storageKey),
    );
    expect(targets[1].headers).toEqual([
      { name: 'Content-Type', value: 'image/png' },
    ]);
    expect(storage.createUploadUrl).toHaveBeenCalledWith(
      targets[1].storageKey,
      'image/png',
      2000,
    );
  });

  it('looks the order up only among the vessels the user may see', async () => {
    db.order.findFirst.mockResolvedValue(null);

    await expect(
      service.requestUploads({ orderId: 'order-1', files: [jpeg] }, worker),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(db.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'order-1',
          vessel: expect.anything(),
        }),
      }),
    );
  });

  it('refuses a worker who is not on the order’s team', async () => {
    db.order.findFirst.mockResolvedValue(order);

    await expect(
      service.requestUploads(
        { orderId: 'order-1', files: [jpeg] },
        otherWorker,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.photoUpload.createMany).not.toHaveBeenCalled();
  });

  it('reports every invalid file at once and records nothing', async () => {
    db.order.findFirst.mockResolvedValue(order);

    const result = service.requestUploads(
      {
        orderId: 'order-1',
        files: [{ mimeType: 'application/pdf', sizeBytes: 0 }],
      },
      worker,
    );

    await expect(result).rejects.toBeInstanceOf(BadRequestException);
    await expect(result).rejects.toMatchObject({
      response: {
        message: [
          expect.stringContaining('application/pdf'),
          expect.stringContaining('size'),
        ],
      },
    });
    expect(db.photoUpload.createMany).not.toHaveBeenCalled();
    expect(storage.createUploadUrl).not.toHaveBeenCalled();
  });
});

describe('photoStorageKey', () => {
  it('groups keys by order and uses the type’s extension', () => {
    expect(photoStorageKey('order-1', 'image/jpeg')).toMatch(
      /^orders\/order-1\/[0-9a-f-]{36}\.jpg$/,
    );
  });

  it('never gives two uploads the same key', () => {
    expect(photoStorageKey('o', 'image/png')).not.toBe(
      photoStorageKey('o', 'image/png'),
    );
  });
});
