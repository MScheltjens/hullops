import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';

/** Download links are signed on every page load, so they can be short-lived:
 *  a forwarded link stops working after a few minutes. */
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

/** The browser starts uploading right after it asks for the URL, so a few
 *  minutes is enough, even on a slow yard network. */
const UPLOAD_URL_TTL_SECONDS = 5 * 60;

/** What the browser needs to upload one file: send a PUT to `url` with
 *  exactly these headers, or the storage rejects it. */
export interface SignedUpload {
  url: string;
  headers: { 'Content-Type': string };
}

/**
 * Signs short-lived URLs for the private photo bucket, so the browser uploads
 * and downloads directly and files never pass through the API. Works with any
 * S3-compatible store (see docs/adr/0001-object-storage.md).
 */
@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(configService: ConfigService<Env, true>) {
    this.bucket = configService.get('S3_BUCKET', { infer: true });
    // Opens no connection: the SDK only talks to the network when a command
    // is sent, and signing a URL is computed locally.
    this.client = new S3Client({
      endpoint: configService.get('S3_ENDPOINT', { infer: true }),
      region: configService.get('S3_REGION', { infer: true }),
      credentials: {
        accessKeyId: configService.get('S3_ACCESS_KEY_ID', { infer: true }),
        secretAccessKey: configService.get('S3_SECRET_ACCESS_KEY', {
          infer: true,
        }),
      },
      // endpoint/bucket/key instead of bucket.endpoint/key: R2 accepts both,
      // and a bucket subdomain of localhost doesn't resolve for RustFS.
      forcePathStyle: true,
    });
  }

  async createDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, {
      expiresIn: DOWNLOAD_URL_TTL_SECONDS,
    });
  }

  /**
   * Signs a PUT for exactly this type and size. The storage rejects an upload
   * whose Content-Type or Content-Length differs, so the limits the caller
   * checked (e.g. the photo rules) can't be bypassed from the browser.
   */
  async createUploadUrl(
    key: string,
    mimeType: string,
    sizeBytes: number,
  ): Promise<SignedUpload> {
    // A programming error in the caller, not user input: the caller validates
    // what the user sent before asking for a URL.
    if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) {
      throw new Error(
        `sizeBytes must be a positive whole number, got ${sizeBytes}`,
      );
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
      ContentLength: sizeBytes,
    });

    const url = await getSignedUrl(this.client, command, {
      expiresIn: UPLOAD_URL_TTL_SECONDS,
      // By default only the host is signed. Signing these two makes the
      // storage enforce the size and type.
      signableHeaders: new Set(['content-type', 'content-length']),
    });

    return { url, headers: { 'Content-Type': mimeType } };
  }
}
