import { Field, ObjectType } from '@nestjs/graphql';
import { User } from '../users/user.model';
import { Vessel } from '../vessels/vessel.model';

/**
 * The project lead's plan: one worker on one vessel for one week. It decides
 * which vessel the worker sees in the app, and which workers the vessel's
 * team lead can give tasks to. `weekStart` is resolved in CrewResolver.
 */
@ObjectType()
export class CrewAssignment {
  @Field({ description: 'The Monday of the week, as 2026-10-26' })
  weekStart: string;

  @Field(() => User)
  user: User;

  @Field(() => Vessel)
  vessel: Vessel;
}
