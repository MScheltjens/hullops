import { Args, Query, Resolver } from '@nestjs/graphql';
import { Role, ServiceType } from '../graphql/enums';
import { User } from './user.model';
import { UsersService } from './users.service';

@Resolver(() => User)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => [User])
  users(
    @Args('role', { type: () => Role, nullable: true }) role?: Role,
    @Args('serviceType', { type: () => ServiceType, nullable: true })
    serviceType?: ServiceType,
  ) {
    return this.usersService.findAll({ role, serviceType });
  }
}
