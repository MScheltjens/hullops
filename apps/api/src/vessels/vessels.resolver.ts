import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CreateVesselInput } from './create-vessel.input';
import { Vessel } from './vessel.model';
import { VesselsService } from './vessels.service';

@Resolver(() => Vessel)
export class VesselsResolver {
  constructor(private readonly vesselsService: VesselsService) {}

  @Query(() => [Vessel])
  vessels() {
    return this.vesselsService.findAll();
  }

  // Returns null rather than an error when the id is unknown.
  @Query(() => Vessel, { nullable: true })
  vessel(@Args('id', { type: () => ID }) id: string) {
    return this.vesselsService.findOne(id);
  }

  @Mutation(() => Vessel)
  createVessel(@Args('input') input: CreateVesselInput) {
    return this.vesselsService.create(input);
  }
}
