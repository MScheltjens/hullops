import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-context';
import { canUpdateOrder, validatePhotoUploads } from '../orders/order-rules';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { visibleVesselsWhere } from '../vessels/vessel-scope';
import type { RequestPhotoUploadsInput } from './photo.inputs';
import type { PhotoUploadTarget } from './photo.model';

/** File extension per allowed type, so a downloaded photo opens correctly. */
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

/**
 * Object key for a new photo. Grouped by order, so one order's files can be
 * found (or cleaned up) in the bucket; the random part makes it impossible
 * to guess another key and keeps two uploads from overwriting each other.
 */
export function photoStorageKey(orderId: string, mimeType: string): string {
  return `orders/${orderId}/${randomUUID()}.${EXTENSIONS[mimeType]}`;
}

@Injectable()
export class PhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Hands out signed upload URLs for the photos of one coming status update.
   * Only who may post that update may upload (canUpdateOrder), and every key
   * is recorded as a PhotoUpload for this user and order: addStatusUpdate
   * accepts no other keys.
   */
  async requestUploads(
    input: RequestPhotoUploadsInput,
    actor: AuthUser,
    now = new Date(),
  ): Promise<PhotoUploadTarget[]> {
    // An order on a vessel the user can't see looks the same as a missing
    // one, so the error doesn't reveal that it exists.
    const order = await this.prisma.order.findFirst({
      where: { id: input.orderId, vessel: visibleVesselsWhere(actor, now) },
      include: { assignments: true, vessel: true },
    });
    if (!order) {
      throw new NotFoundException(`Order ${input.orderId} not found`);
    }
    if (!canUpdateOrder(actor, order)) {
      throw new ForbiddenException(
        'Only the order’s team, project leads and the vessel’s team lead can add photos',
      );
    }
    const errors = validatePhotoUploads(input.files);
    if (errors.length > 0) throw new BadRequestException(errors);

    const uploads = input.files.map((file) => ({
      storageKey: photoStorageKey(order.id, file.mimeType),
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      orderId: order.id,
      userId: actor.id,
    }));
    // Recorded before signing: a URL is only handed out for a key the
    // database knows, so every file in the bucket can be traced to a user.
    await this.prisma.photoUpload.createMany({ data: uploads });

    return Promise.all(
      uploads.map(async ({ storageKey, mimeType, sizeBytes }) => {
        const signed = await this.storage.createUploadUrl(
          storageKey,
          mimeType,
          sizeBytes,
        );
        return {
          storageKey,
          url: signed.url,
          headers: Object.entries(signed.headers).map(([name, value]) => ({
            name,
            value,
          })),
        };
      }),
    );
  }
}
