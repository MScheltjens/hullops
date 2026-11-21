import { Args, Mutation, Resolver } from '@nestjs/graphql';
import {
  CurrentUser,
  Roles,
  WORK_ROLES,
  type AuthUser,
} from '../auth/auth-context';
import { RequestPhotoUploadsInput } from './photo.inputs';
import { PhotoUploadTarget } from './photo.model';
import { PhotosService } from './photos.service';

@Resolver()
export class PhotosResolver {
  constructor(private readonly photosService: PhotosService) {}

  // WORK_ROLES keeps HR out up front; who of them may add photos to this
  // order depends on its team, so the service checks the rest.
  @Roles(...WORK_ROLES)
  @Mutation(() => [PhotoUploadTarget], {
    description:
      'Step 1 of adding photos: get upload URLs for 1–5 photos, then pass the storage keys to addStatusUpdate',
  })
  requestPhotoUploads(
    @Args('input') input: RequestPhotoUploadsInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.photosService.requestUploads(input, user);
  }
}
