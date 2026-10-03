import { Field, Float, InputType } from '@nestjs/graphql';
import {
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { IsImoNumber } from './imo-number';

@InputType()
export class CreateVesselInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @Field(() => String, {
    nullable: true,
    description: '7 digits, without the "IMO" prefix',
  })
  @IsOptional()
  @IsImoNumber()
  imoNumber?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  vesselType?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsPositive()
  lengthM?: number;
}
