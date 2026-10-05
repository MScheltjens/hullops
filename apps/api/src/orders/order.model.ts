import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import {
  OrderStatus,
  ProtectionKind,
  ProtectionMaterial,
  ServiceType,
} from '../graphql/enums';
import { User } from '../users/user.model';
import { Vessel } from '../vessels/vessel.model';

@ObjectType()
export class CleaningDetails {
  @Field({ description: 'e.g. high-pressure water, abrasive blasting, manual' })
  method: string;

  @Field({ description: 'e.g. hull, deck, interior' })
  surface: string;
}

@ObjectType()
export class ProtectionDetails {
  @Field(() => ProtectionKind)
  kind: ProtectionKind;

  @Field(() => String, {
    nullable: true,
    description: 'What is protected, e.g. main engine',
  })
  protectedItem: string | null;

  @Field(() => [ProtectionMaterial])
  materials: ProtectionMaterial[];

  @Field(() => String, { nullable: true, description: 'Coatings only' })
  coatingProduct: string | null;

  @Field(() => Int, { nullable: true, description: 'Coatings only' })
  layers: number | null;

  @Field(() => Int, {
    nullable: true,
    description: 'Coatings only: target thickness in µm',
  })
  targetThicknessUm: number | null;
}

@ObjectType({ description: 'An entry in an order’s history' })
export class StatusUpdate {
  @Field(() => ID)
  id: string;

  @Field(() => OrderStatus, {
    description: 'The order’s status after this update',
  })
  status: OrderStatus;

  @Field(() => String, { nullable: true })
  note: string | null;

  @Field(() => User)
  author: User;

  @Field()
  createdAt: Date;
}

@ObjectType({
  description:
    'Free-text information on an order, passed on by the project lead',
})
export class OrderComment {
  @Field(() => ID)
  id: string;

  @Field()
  text: string;

  @Field(() => String, {
    nullable: true,
    description: 'Where it came from, e.g. "Lürssen, J. Meyer, by mail"',
  })
  source: string | null;

  @Field(() => User)
  author: User;

  @Field()
  createdAt: Date;
}

/**
 * A cleaning or protection job on a vessel. `team`, `history`, `comments` and `overdue`
 * are resolved in OrdersResolver: they're derived from the database record
 * rather than stored on it.
 */
@ObjectType()
export class Order {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field(() => String, { nullable: true })
  description: string | null;

  @Field(() => OrderStatus)
  status: OrderStatus;

  @Field(() => ServiceType)
  serviceType: ServiceType;

  @Field({ description: 'e.g. Blohm+Voss' })
  shipyard: string;

  @Field(() => String, { nullable: true, description: 'Berth or dock' })
  berth: string | null;

  @Field(() => Float, { nullable: true, description: 'Area in m²' })
  areaSqm: number | null;

  @Field()
  startDate: Date;

  @Field()
  dueDate: Date;

  @Field(() => Vessel)
  vessel: Vessel;

  @Field(() => User)
  createdBy: User;

  @Field(() => CleaningDetails, {
    nullable: true,
    description: 'Set on cleaning orders',
  })
  cleaningDetails: CleaningDetails | null;

  @Field(() => ProtectionDetails, {
    nullable: true,
    description: 'Set on protection orders',
  })
  protectionDetails: ProtectionDetails | null;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
