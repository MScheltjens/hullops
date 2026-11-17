import {
  Args,
  ID,
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
import type { Vessel as VesselRecord } from '../generated/prisma/client';
import { User } from '../users/user.model';
import { CreateVesselInput } from './create-vessel.input';
import { Vessel } from './vessel.model';
import { VesselsService } from './vessels.service';

@Resolver(() => Vessel)
export class VesselsResolver {
  constructor(private readonly vesselsService: VesselsService) {}

  @Roles(...WORK_ROLES)
  @Query(() => [Vessel])
  vessels(@CurrentUser() user: AuthUser) {
    return this.vesselsService.findAll(user);
  }

  @Roles(...WORK_ROLES)
  // Returns null rather than an error when the id is unknown or the vessel
  // isn't one this user may see.
  @Query(() => Vessel, { nullable: true })
  vessel(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.vesselsService.findOne(id, user);
  }

  @Roles('PROJECT_LEAD')
  @Mutation(() => Vessel)
  createVessel(@Args('input') input: CreateVesselInput) {
    return this.vesselsService.create(input);
  }

  @Roles('PROJECT_LEAD')
  @Mutation(() => Vessel, {
    description:
      'Choose the team lead responsible for a vessel, or pass no user to clear it',
  })
  setVesselTeamLead(
    @Args('vesselId', { type: () => ID }) vesselId: string,
    @Args('userId', { type: () => ID, nullable: true }) userId?: string,
  ) {
    return this.vesselsService.setTeamLead(vesselId, userId ?? null);
  }

  // Loaded together with the vessel in the lists below, but an order's
  // vessel comes without it, so look it up when it's missing.
  @ResolveField(() => User, { nullable: true })
  teamLead(@Parent() vessel: VesselRecord & { teamLead?: User | null }) {
    if (vessel.teamLead !== undefined) return vessel.teamLead;
    return vessel.teamLeadId
      ? this.vesselsService.findTeamLead(vessel.teamLeadId)
      : null;
  }
}
