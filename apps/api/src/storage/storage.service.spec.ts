import { StorageService } from './storage.service';

/**
 * No S3 mock needed: signing a URL is computed locally from the credentials,
 * so the real SDK runs with dummy settings and never touches the network.
 * We read the signed URL back with `new URL()` and check its query params.
 */
describe('StorageService', () => {
  const settings: Record<string, string> = {
    S3_ENDPOINT: 'http://localhost:9000',
    S3_REGION: 'auto',
    S3_BUCKET: 'photos',
    S3_ACCESS_KEY_ID: 'test-key',
    S3_SECRET_ACCESS_KEY: 'test-secret',
  };
  const config = { get: (key: string) => settings[key] };
  const service = new StorageService(config as never);

  describe('createDownloadUrl', () => {
    it('signs a GET for the key in the bucket, valid for 5 minutes', async () => {
      const url = new URL(await service.createDownloadUrl('orders/1/a.jpg'));

      // Path style (forcePathStyle): endpoint/bucket/key
      expect(url.origin).toBe('http://localhost:9000');
      expect(url.pathname).toBe('/photos/orders/1/a.jpg');
      expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
      expect(url.searchParams.get('X-Amz-Signature')).toBeTruthy();
    });
  });

  describe('createUploadUrl', () => {
    it('signs content-type and content-length, so the storage enforces them', async () => {
      const { url } = await service.createUploadUrl(
        'orders/1/a.jpg',
        'image/jpeg',
        3_000_000,
      );

      // A ';'-separated list, e.g. "content-length;content-type;host"
      const signed = new URL(url).searchParams
        .get('X-Amz-SignedHeaders')
        ?.split(';');
      expect(signed).toEqual(
        expect.arrayContaining(['content-type', 'content-length']),
      );
    });

    it('returns the Content-Type header the browser must send', async () => {
      const { headers } = await service.createUploadUrl(
        'orders/1/a.jpg',
        'image/jpeg',
        3_000_000,
      );

      expect(headers).toEqual({ 'Content-Type': 'image/jpeg' });
    });

    it.each([0, -1, 1.5, Number.NaN])(
      'throws for the size %p',
      async (sizeBytes) => {
        // async: the error arrives as a rejected Promise, hence `.rejects`
        await expect(
          service.createUploadUrl('orders/1/a.jpg', 'image/jpeg', sizeBytes),
        ).rejects.toThrow('sizeBytes must be a positive whole number');
      },
    );
  });
});
