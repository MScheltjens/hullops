import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';

/** Signed upload and download URLs for photos. Import it where they're needed (#37). */
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
