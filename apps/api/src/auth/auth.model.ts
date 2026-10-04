import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { User } from '../users/user.model';

@InputType()
export class LoginInput {
  @Field()
  @IsEmail()
  @MaxLength(254)
  email: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  // Long enough for any real password, short enough that nobody can make
  // the server hash megabytes of input.
  @MaxLength(200)
  password: string;
}

@ObjectType()
export class AuthPayload {
  @Field({
    description:
      'Send as "Authorization: Bearer <accessToken>" with every request',
  })
  accessToken: string;

  @Field({ description: 'After this moment, log in again' })
  expiresAt: Date;

  @Field(() => User)
  user: User;
}
