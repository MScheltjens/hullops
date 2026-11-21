import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { PhotosResolver } from './photos.resolver';
import { PhotosService } from './photos.service';
import { StatusUpdatePhotosResolver } from './status-update-photos.resolver';

/** Uploading photos for status updates (#37). */
@Module({
  imports: [StorageModule],
  providers: [PhotosResolver, PhotosService, StatusUpdatePhotosResolver],
  exports: [PhotosService],
})
export class PhotosModule {}
