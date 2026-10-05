import {
  Args,
  ID,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth-context';
import { User } from '../users/user.model';
import {
  AddOrderCommentInput,
  AddStatusUpdateInput,
  CreateOrderInput,
  OrdersArgs,
} from './order.inputs';
import { Order, OrderComment, StatusUpdate } from './order.model';
import { isOverdue } from './order-rules';
import { OrdersService, type OrderWithRelations } from './orders.service';

@Resolver(() => Order)
export class OrdersResolver {
  constructor(private readonly ordersService: OrdersService) {}

  @Query(() => [Order], {
    description: 'Sorted by due date, most urgent first',
  })
  orders(@Args() args: OrdersArgs) {
    return this.ordersService.findAll(args);
  }

  // Returns null rather than an error when the id is unknown.
  @Query(() => Order, { nullable: true })
  order(@Args('id', { type: () => ID }) id: string) {
    return this.ordersService.findOne(id);
  }

  @Roles('PROJECT_LEAD')
  @Mutation(() => Order)
  createOrder(
    @Args('input') input: CreateOrderInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ordersService.create(input, user);
  }

  @Mutation(() => Order, {
    description: 'Add a note, or move the order one step forward',
  })
  addStatusUpdate(
    @Args('input') input: AddStatusUpdateInput,
    @CurrentUser() user: AuthUser,
  ) {
    // Who may update is checked in the service: it depends on the order's team.
    return this.ordersService.addStatusUpdate(input, user);
  }

  @Roles('PROJECT_LEAD')
  @Mutation(() => Order, {
    description: 'Add information from the shipyard that has no field of its own',
  })
  addOrderComment(
    @Args('input') input: AddOrderCommentInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ordersService.addComment(input, user);
  }

  @Roles('PROJECT_LEAD')
  @Mutation(() => Order)
  assignTeamMember(
    @Args('orderId', { type: () => ID }) orderId: string,
    @Args('userId', { type: () => ID }) userId: string,
  ) {
    return this.ordersService.assignTeamMember(orderId, userId);
  }

  @Roles('PROJECT_LEAD')
  @Mutation(() => Order)
  removeTeamMember(
    @Args('orderId', { type: () => ID }) orderId: string,
    @Args('userId', { type: () => ID }) userId: string,
  ) {
    return this.ordersService.removeTeamMember(orderId, userId);
  }

  // The fields below aren't columns on the order; they're derived from the
  // loaded record (see ORDER_INCLUDE), so they cost no extra queries.

  @ResolveField(() => [User], { description: 'People working on the order' })
  team(@Parent() order: OrderWithRelations) {
    return order.assignments.map((assignment) => assignment.user);
  }

  @ResolveField(() => [StatusUpdate], { description: 'Oldest first' })
  history(@Parent() order: OrderWithRelations) {
    return order.statusUpdates;
  }

  @ResolveField(() => [OrderComment], { description: 'Oldest first' })
  comments(@Parent() order: OrderWithRelations) {
    return order.comments;
  }

  @ResolveField(() => Int, {
    description: 'Number of comments, so lists can show it without loading them',
  })
  commentCount(@Parent() order: OrderWithRelations) {
    return order.comments.length;
  }

  @ResolveField(() => Boolean, {
    description: 'Due date has passed and the order is not done',
  })
  overdue(@Parent() order: OrderWithRelations) {
    return isOverdue(order);
  }
}
