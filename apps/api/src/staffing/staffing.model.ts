import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { User } from '../users/user.model';
import { Vessel } from '../vessels/vessel.model';

/**
 * What a vessel's team lead asked for, for one vessel and one week. The
 * team lead enters it himself; a project lead can too. `weekStart` and `requestedWorkers` are resolved in
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

  @Field(() => String, { nullable: true })
  note: string | null;

  @Field(() => User, {
    description: 'The team lead or project lead who entered or last changed it',
  })
  enteredBy: User;

  @Field()
  updatedAt: Date;
}
