import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import {
  CurrentUser,
  Roles,
  WORK_ROLES,
  type AuthUser,
} from '../auth/auth-context';
import { User } from '../users/user.model';
import { SaveStaffingRequestInput } from './staffing.inputs';
import { StaffingRequest } from './staffing.model';
import {
  StaffingService,
  type StaffingRequestWithRelations,
} from './staffing.service';
import { formatDateOnly } from './week';

@Resolver(() => StaffingRequest)
export class StaffingResolver {
  constructor(private readonly staffingService: StaffingService) {}

  @Roles(...WORK_ROLES)
  @Query(() => [StaffingRequest], {
    description: 'The staffing requests of one week, given as its Monday',
  })
  staffingRequests(@Args('weekStart') weekStart: string) {
    return this.staffingService.findForWeek(weekStart);
  }

  @Roles('PROJECT_LEAD', 'TEAM_LEAD')
  @Mutation(() => StaffingRequest, {
    description:
      "Enter or replace what a vessel's team lead asked for, for one vessel and week. A team lead can only do this for his own vessels.",
  })
  saveStaffingRequest(
    @Args('input') input: SaveStaffingRequestInput,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.staffingService.save(input, actor);
  }

  // Derived from the loaded record (see STAFFING_INCLUDE): no extra queries.

  @ResolveField(() => String)
  weekStart(@Parent() request: StaffingRequestWithRelations) {
    return formatDateOnly(request.weekStart);
  }

  @ResolveField(() => [User])
  requestedWorkers(@Parent() request: StaffingRequestWithRelations) {
    return request.requestedWorkers.map((entry) => entry.user);
  }
}
