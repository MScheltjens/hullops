import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class HttpHeader {
  @Field()
  name: string;

  @Field()
  value: string;
}

@ObjectType({
  description:
    'Where to upload one photo. PUT the file to url with exactly these headers, then pass storageKey to addStatusUpdate.',
})
export class PhotoUploadTarget {
  @Field()
  storageKey: string;

  @Field({ description: 'Signed, valid for a few minutes' })
  url: string;

  @Field(() => [HttpHeader])
  headers: HttpHeader[];
}

@ObjectType({ description: 'A photo attached to a status update' })
export class Photo {
  @Field(() => ID)
  id: string;

  @Field({
    description:
      'Signed download link, valid for a few minutes: fetch it when showing the photo, don’t store it',
  })
  url: string;

  @Field()
  mimeType: string;

  @Field()
  createdAt: Date;
}
