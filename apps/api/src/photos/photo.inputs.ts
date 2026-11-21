import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

@InputType({ description: 'A photo the browser is about to upload' })
export class PhotoFileInput {
  @Field({ description: 'As the browser reports it, e.g. "image/jpeg"' })
  @IsString()
  @MaxLength(100)
  mimeType: string;

  @Field(() => Int)
  @IsInt()
  sizeBytes: number;
}

@InputType()
export class RequestPhotoUploadsInput {
  @Field(() => ID)
  @IsString()
  @IsNotEmpty()
  orderId: string;

  // No @ArrayMinSize/@ArrayMaxSize here: the count is checked together with
  // the types and sizes in validatePhotoUploads, so all violations come back
  // in one answer.
  @Field(() => [PhotoFileInput])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhotoFileInput)
  files: PhotoFileInput[];
}
