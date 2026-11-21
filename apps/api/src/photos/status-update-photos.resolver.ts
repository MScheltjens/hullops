import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import type { Photo as PhotoRecord } from '../generated/prisma/client';
import { StatusUpdate } from '../orders/order.model';
import { StorageService } from '../storage/storage.service';
import { Photo } from './photo.model';

/**
 * Adds `photos` to StatusUpdate. It lives here rather than in the orders
 * module because it needs the StorageService.
 *
 * No permission check: a status update is only reachable through its order,
 * and the order queries already filter by what the user may see.
 */
@Resolver(() => StatusUpdate)
export class StatusUpdatePhotosResolver {
  constructor(private readonly storage: StorageService) {}

  @ResolveField(() => [Photo], { description: 'Oldest first' })
  photos(@Parent() update: { photos?: PhotoRecord[] }): Promise<Photo[]> {
    // Loaded together with the history (see ORDER_INCLUDE), so this costs no
    // query. If it's missing, loading and fields have drifted apart: fail
    // loudly instead of showing an update without its photos.
    if (update.photos === undefined) {
      throw new Error('StatusUpdate.photos was asked for but not loaded');
    }
    // Signing is computed locally, without a call to the storage, so a
    // history with many photos stays fast.
    return Promise.all(
      update.photos.map(async (photo) => ({
        id: photo.id,
        mimeType: photo.mimeType,
        createdAt: photo.createdAt,
        url: await this.storage.createDownloadUrl(photo.storageKey),
      })),
    );
  }
}
