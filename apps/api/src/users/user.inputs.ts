import { Field, ID, InputType } from '@nestjs/graphql';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Locale, Role, ServiceType } from '../graphql/enums';
import { MIN_PASSWORD_LENGTH } from './user-rules';

@InputType()
export class CreateUserInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @Field()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @Field({
    description: `At least ${MIN_PASSWORD_LENGTH} characters. The user can't change it themselves yet, so an admin hands it over.`,
  })
  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  @MaxLength(200)
  password: string;

  @Field(() => Role)
  @IsEnum(Role)
  role: Role;

  @Field(() => [ServiceType], {
    defaultValue: [],
    description: 'Service areas this person can work in',
  })
  @IsArray()
  @ArrayUnique()
  @IsEnum(ServiceType, { each: true })
  serviceTypes: ServiceType[];

  @Field(() => Locale, { defaultValue: 'EN' })
  @IsEnum(Locale)
  locale: Locale;
}

@InputType()
export class UpdateUserInput {
  @Field(() => ID)
  @IsString()
  @IsNotEmpty()
  userId: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @Field(() => Role, { nullable: true })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @Field(() => [ServiceType], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(ServiceType, { each: true })
  serviceTypes?: ServiceType[];
}

@InputType()
export class ResetPasswordInput {
  @Field(() => ID)
  @IsString()
  @IsNotEmpty()
  userId: string;

  @Field()
  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  @MaxLength(200)
  password: string;
}
