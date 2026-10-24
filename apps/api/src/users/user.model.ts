import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Locale, Role, ServiceType } from '../graphql/enums';

/**
 * A user as the API shows it. Only decorated fields reach GraphQL, so the
 * password hash stored on the database record is never exposed.
 */
@ObjectType()
export class User {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  email: string;

  @Field(() => Role)
  role: Role;

  @Field(() => [ServiceType], {
    description: 'Service areas this person can work in',
  })
  serviceTypes: ServiceType[];

  @Field(() => Locale)
  locale: Locale;

  @Field({
    description: "A deactivated user can't log in or use the API",
  })
  active: boolean;
}
