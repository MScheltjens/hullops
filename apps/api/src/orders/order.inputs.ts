import { ArgsType, Field, Float, ID, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  OrderStatus,
  ProtectionKind,
  ProtectionMaterial,
  ServiceType,
} from '../graphql/enums';

@InputType()
export class CleaningDetailsInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  method: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  surface: string;
}

@InputType()
export class ProtectionDetailsInput {
  @Field(() => ProtectionKind)
  @IsEnum(ProtectionKind)
  kind: ProtectionKind;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  protectedItem?: string;

  @Field(() => [ProtectionMaterial], { defaultValue: [] })
  @IsArray()
  @ArrayUnique()
  @IsEnum(ProtectionMaterial, { each: true })
  materials: ProtectionMaterial[];

  @Field(() => String, { nullable: true, description: 'Coatings only' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  coatingProduct?: string;

  @Field(() => Int, { nullable: true, description: 'Coatings only' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  layers?: number;

  @Field(() => Int, {
    nullable: true,
    description: 'Coatings only: target thickness in µm',
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  targetThicknessUm?: number;
}

/**
 * Rules that involve several fields (details must match serviceType,
 * start ≤ due, …) are checked in order-rules.ts.
 */
@InputType()
export class CreateOrderInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @Field(() => ServiceType)
  @IsEnum(ServiceType)
  serviceType: ServiceType;

  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  shipyard: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  berth?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsPositive()
  areaSqm?: number;

  @Field()
  @IsDate()
  startDate: Date;

  @Field()
  @IsDate()
  dueDate: Date;

  @Field(() => ID)
  @IsString()
  @IsNotEmpty()
  vesselId: string;

  // Nested inputs need @ValidateNested and @Type, or their own rules are
  // skipped: @Type tells the validator which class to check them against.
  @Field(() => CleaningDetailsInput, {
    nullable: true,
    description: 'Required for cleaning orders',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CleaningDetailsInput)
  cleaning?: CleaningDetailsInput;

  @Field(() => ProtectionDetailsInput, {
    nullable: true,
    description: 'Required for protection orders',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProtectionDetailsInput)
  protection?: ProtectionDetailsInput;

  @Field(() => [ID], { defaultValue: [], description: 'Initial team' })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  teamIds: string[];
}

@InputType()
export class AddStatusUpdateInput {
  @Field(() => ID)
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @Field(() => OrderStatus, {
    description:
      'The new status: the current one (to add a note) or the next step',
  })
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

/** Filters and paging for the `orders` query. */
@ArgsType()
export class OrdersArgs {
  @Field(() => OrderStatus, { nullable: true })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @Field(() => ServiceType, { nullable: true })
  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  vesselId?: string;

  @Field(() => Boolean, {
    nullable: true,
    description: 'true: only overdue orders; false: only orders on time',
  })
  @IsOptional()
  @IsBoolean()
  overdue?: boolean;

  @Field(() => Int, { defaultValue: 0 })
  @IsInt()
  @Min(0)
  skip: number;

  @Field(() => Int, { defaultValue: 50, description: 'At most 100' })
  @IsInt()
  @Min(1)
  @Max(100)
  take: number;
}
