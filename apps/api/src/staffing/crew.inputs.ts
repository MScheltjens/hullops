import { Field, ID, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class PlanCrewMemberInput {
  @Field({ description: 'The Monday of the week, as 2026-10-26' })
  @IsString()
  weekStart: string;

  @Field(() => ID)
  @IsString()
  @IsNotEmpty()
  userId: string;

  @Field(() => ID)
  @IsString()
  @IsNotEmpty()
  vesselId: string;
}
