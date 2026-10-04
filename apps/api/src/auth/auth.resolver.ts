import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Locale } from '../graphql/enums';
import { User } from '../users/user.model';
import { UsersService } from '../users/users.service';
import { CurrentUser, Public, type AuthUser } from './auth-context';
import { AuthPayload, LoginInput } from './auth.model';
import { AuthService } from './auth.service';

@Resolver()
export class AuthResolver {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @Mutation(() => AuthPayload)
  login(@Args('input') input: LoginInput) {
    return this.authService.login(input.email, input.password);
  }

  @Query(() => User, { description: 'The logged-in user' })
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Mutation(() => User, {
    description: 'Language for text the server sends you, such as emails',
  })
  setMyLocale(
    @CurrentUser() user: AuthUser,
    @Args('locale', { type: () => Locale }) locale: Locale,
  ) {
    return this.usersService.setLocale(user.id, locale);
  }
}
