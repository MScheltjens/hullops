import { Field, Float, ID, ObjectType } from '@nestjs/graphql';
import { User } from '../users/user.model';

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

  @Field(() => User, {
    nullable: true,
    description: 'The team lead responsible for this vessel on the yard',
  })
  teamLead: User | null;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
