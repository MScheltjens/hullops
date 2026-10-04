import { registerEnumType } from '@nestjs/graphql';
import {
  Locale,
  OrderStatus,
  ProtectionKind,
  ProtectionMaterial,
  Role,
  ServiceType,
} from '../generated/prisma/client';

/**
 * Exposes the Prisma enums as GraphQL enums. Reusing Prisma's definitions
 * means the database, TypeScript and the API share one list of values.
 *
 * Registration is a side effect, so this file is imported by every model
 * that uses one of these enums.
 */
registerEnumType(Role, { name: 'Role' });
registerEnumType(Locale, {
  name: 'Locale',
  description: 'Language for text the server sends a user',
});
registerEnumType(ServiceType, {
  name: 'ServiceType',
  description: 'Cleaning or protection. Both can run on a vessel at once.',
});
registerEnumType(OrderStatus, {
  name: 'OrderStatus',
  description: 'Moves PLANNED → IN_PROGRESS → DONE, one step at a time.',
});
registerEnumType(ProtectionKind, { name: 'ProtectionKind' });
registerEnumType(ProtectionMaterial, {
  name: 'ProtectionMaterial',
  valuesMap: {
    GLASS_FIBER_FABRIC: {
      description:
        'Glass fiber fabric, protects against fire and welding sparks',
    },
  },
});

export {
  Locale,
  OrderStatus,
  ProtectionKind,
  ProtectionMaterial,
  Role,
  ServiceType,
};
