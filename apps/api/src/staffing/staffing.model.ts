import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { User } from '../users/user.model';
import { Vessel } from '../vessels/vessel.model';

/**
 * What a shipyard foreman asked for, for one vessel and one week. The
 * project lead enters it. `weekStart` and `requestedWorkers` are resolved in
 * StaffingResolver.
 */
@ObjectType()
export class StaffingRequest {
  @Field(() => ID)
  id: string;

  @Field({ description: 'The Monday of the week, as 2026-10-26' })
  weekStart: string;

  @Field(() => Vessel)
  vessel: Vessel;

  @Field(() => Int, {
    description: 'Workers needed in total, including those asked for by name',
  })
  workersNeeded: number;

  @Field(() => Int, {
    nullable: true,
    description: 'How many actually worked, filled in afterwards',
  })
  workersActual: number | null;

  @Field(() => [User], { description: 'Asked for by name' })
  requestedWorkers: User[];

  @Field(() => String, { nullable: true, description: "The foreman's name" })
  reportedBy: string | null;

  @Field(() => String, { nullable: true })
  note: string | null;

  @Field(() => User, { description: 'Who entered or last changed it' })
  enteredBy: User;

  @Field()
  updatedAt: Date;
}
