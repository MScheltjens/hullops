import { StorageService } from '../storage/storage.service';
import { StatusUpdatePhotosResolver } from './status-update-photos.resolver';

describe('StatusUpdatePhotosResolver.photos', () => {
  const storage = {
    createDownloadUrl: jest.fn((key: string) =>
      Promise.resolve(`https://storage.example/${key}?signed`),
    ),
  };
  const resolver = new StatusUpdatePhotosResolver(
    storage as unknown as StorageService,
  );

  it('signs a download URL for each photo, keeping their order', async () => {
    const createdAt = new Date('2026-11-21T10:00:00Z');
    const photos = await resolver.photos({
      photos: [
        {
          id: 'p1',
          storageKey: 'orders/o/a.jpg',
          mimeType: 'image/jpeg',
          createdAt,
          statusUpdateId: 's',
        },
        {
          id: 'p2',
          storageKey: 'orders/o/b.png',
          mimeType: 'image/png',
          createdAt,
          statusUpdateId: 's',
        },
      ],
    });

    expect(photos).toEqual([
      {
        id: 'p1',
        mimeType: 'image/jpeg',
        createdAt,
        url: 'https://storage.example/orders/o/a.jpg?signed',
      },
      {
        id: 'p2',
        mimeType: 'image/png',
        createdAt,
        url: 'https://storage.example/orders/o/b.png?signed',
      },
    ]);
  });

  it('never exposes the storage key', async () => {
    const [photo] = await resolver.photos({
      photos: [
        {
          id: 'p1',
          storageKey: 'orders/o/a.jpg',
          mimeType: 'image/jpeg',
          createdAt: new Date(0),
          statusUpdateId: 's',
        },
      ],
    });
    expect(photo).not.toHaveProperty('storageKey');
  });

  it('fails loudly when the photos were not loaded', () => {
    expect(() => resolver.photos({})).toThrow(
      'StatusUpdate.photos was asked for but not loaded',
    );
  });
});
