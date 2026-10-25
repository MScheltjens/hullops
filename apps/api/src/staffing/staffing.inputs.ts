import { Field, ID, InputType, Int } from '@nestjs/graphql';
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Rules that involve several fields (a Monday, named workers within the
 * total) are checked in staffing-rules.ts.
 */
@InputType()
export class SaveStaffingRequestInput {
  @Field(() => ID)
  @IsString()
  @IsNotEmpty()
  vesselId: string;

  @Field({ description: 'The Monday of the week, as 2026-10-26' })
  @IsString()
  weekStart: string;

  @Field(() => Int, {
    description: 'Workers needed in total, including those asked for by name',
  })
  @IsInt()
  @Min(0)
  @Max(500)
  workersNeeded: number;

  @Field(() => Int, {
    nullable: true,
    description: 'How many actually worked, filled in afterwards',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500)
  workersActual?: number;

  @Field(() => [ID], {
    defaultValue: [],
    description: 'Workers the foreman asked for by name',
  })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  requestedWorkerIds: string[];

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
