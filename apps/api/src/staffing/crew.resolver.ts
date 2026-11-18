import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth-context';
import { PlanCrewMemberInput } from './crew.inputs';
import { CrewAssignment } from './crew.model';
import { CrewService, type CrewAssignmentWithRelations } from './crew.service';
import { formatDateOnly } from './week';

@Resolver(() => CrewAssignment)
export class CrewResolver {
  constructor(private readonly crewService: CrewService) {}

  @Roles('ADMIN', 'PROJECT_LEAD', 'TEAM_LEAD')
  @Query(() => [CrewAssignment], {
    description:
      'Which worker is on which vessel in one week, given as its Monday. A team lead sees only his own vessels.',
  })
  crewPlan(
    @Args('weekStart') weekStart: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.crewService.findForWeek(weekStart, actor);
  }

  @Roles('PROJECT_LEAD')
  @Mutation(() => CrewAssignment, {
    description:
      'Put a worker on a vessel for one week. A worker already planned that week is moved.',
  })
  planCrewMember(
    @Args('input') input: PlanCrewMemberInput,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.crewService.plan(input, actor);
  }

  @Roles('PROJECT_LEAD')
  @Mutation(() => Boolean, {
    description:
      'Take a worker off the plan for one week. False if he was not planned.',
  })
  unplanCrewMember(
    @Args('weekStart') weekStart: string,
    @Args('userId', { type: () => ID }) userId: string,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.crewService.unplan(weekStart, userId, actor);
  }

  @ResolveField(() => String)
  weekStart(@Parent() assignment: CrewAssignmentWithRelations) {
    return formatDateOnly(assignment.weekStart);
  }
}
