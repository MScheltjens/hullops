import { Field, ID, InputType } from '@nestjs/graphql';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsString,
} from 'class-validator';

@InputType()
export class PlanCrewMembersInput {
  @Field({ description: 'The Monday of the week, as 2026-10-26' })
  @IsString()
  weekStart: string;

  @Field(() => ID)
  @IsString()
  @IsNotEmpty()
  vesselId: string;

  @Field(() => [ID], {
    description: 'The workers to put on the vessel; one tap can plan several',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsString({ each: true })
  userIds: string[];
}
