import { Field, Float, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Vessel {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field(() => String, { nullable: true, description: '7-digit IMO number' })
  imoNumber: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Free text, e.g. yacht or container ship',
  })
  vesselType: string | null;

  @Field(() => Float, { nullable: true, description: 'Length in meters' })
  lengthM: number | null;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
