import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth-context';
import { Role, ServiceType } from '../graphql/enums';
import {
  CreateUserInput,
  ResetPasswordInput,
  UpdateUserInput,
} from './user.inputs';
import { User } from './user.model';
import { UsersService } from './users.service';

@Resolver(() => User)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => [User], {
    description:
      'Active users. Administrators and HR can include deactivated ones.',
  })
  users(
    @CurrentUser() actor: AuthUser,
    @Args('role', { type: () => Role, nullable: true }) role?: Role,
    @Args('serviceType', { type: () => ServiceType, nullable: true })
    serviceType?: ServiceType,
    @Args('includeInactive', { type: () => Boolean, defaultValue: false })
    includeInactive = false,
  ) {
    return this.usersService.findAll(
      { role, serviceType, includeInactive },
      actor,
    );
  }

  @Roles('ADMIN', 'HR')
  @Mutation(() => User)
  createUser(
    @Args('input') input: CreateUserInput,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.usersService.create(input, actor);
  }

  @Roles('ADMIN', 'HR')
  @Mutation(() => User, {
    description: 'Change a name, role or service areas. Not your own role.',
  })
  updateUser(
    @Args('input') input: UpdateUserInput,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.usersService.update(input, actor);
  }

  @Roles('ADMIN', 'HR')
  @Mutation(() => User, {
    description: 'Deactivate or reactivate a user. Not yourself.',
  })
  setUserActive(
    @Args('userId', { type: () => ID }) userId: string,
    @Args('active') active: boolean,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.usersService.setActive(userId, active, actor);
  }

  @Roles('ADMIN', 'HR')
  @Mutation(() => User)
  resetUserPassword(
    @Args('input') input: ResetPasswordInput,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.usersService.resetPassword(input, actor);
  }
}
