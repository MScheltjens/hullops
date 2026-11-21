import { Field, ObjectType } from '@nestjs/graphql';

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
