import type {
  OrderStatus,
  ProtectionKind,
  ServiceType,
} from '../generated/prisma/client';

/**
 * Business rules for orders, as plain functions: no database and no Nest,
 * so they're easy to test and to reuse.
 */

/**
 * An order is overdue when its due date has passed and it isn't done yet.
 * This is computed whenever it's needed, never stored, so it can't go stale.
 *
 * `now` is a parameter (defaulting to the current time) so tests can pick
 * the moment they check against, instead of depending on the clock.
 */
export function isOverdue(
  order: { dueDate: Date; status: OrderStatus },
  now: Date = new Date(),
): boolean {
  return order.dueDate < now && order.status !== 'DONE';
}

/** The order in which an order's status moves. */
export const STATUS_FLOW: readonly OrderStatus[] = [
  'PLANNED',
  'IN_PROGRESS',
  'DONE',
];

/**
 * A status may stay the same (a note without a status change) or move one
 * step forward. Skipping a step or going back is not allowed: an order can't
 * be done without having been worked on, and a done order stays done.
 */
export function isAllowedStatusChange(
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  const step = STATUS_FLOW.indexOf(to) - STATUS_FLOW.indexOf(from);
  return step === 0 || step === 1;
}

/** Whether someone may work on an order of the given service type. */
export function canWorkOn(
  user: { serviceTypes: readonly ServiceType[] },
  serviceType: ServiceType,
): boolean {
  return user.serviceTypes.includes(serviceType);
}

export interface OrderInputToValidate {
  serviceType: ServiceType;
  startDate: Date;
  dueDate: Date;
  cleaning?: object | null;
  protection?: {
    kind: ProtectionKind;
    coatingProduct?: string | null;
    layers?: number | null;
    targetThicknessUm?: number | null;
  } | null;
}

/**
 * Rules that span several fields of a new order, so they can't be expressed
 * as decorators on a single field. The database doesn't enforce them (see
 * schema.prisma), so this is the only place they're checked.
 *
 * Returns every violation instead of stopping at the first, so the client can
 * show them all at once.
 */
export function validateOrderInput(input: OrderInputToValidate): string[] {
  const errors: string[] = [];
  const { serviceType, cleaning, protection } = input;

  if (serviceType === 'CLEANING') {
    if (!cleaning) errors.push('A cleaning order needs cleaning details');
    if (protection)
      errors.push('A cleaning order cannot have protection details');
  } else {
    if (!protection) errors.push('A protection order needs protection details');
    if (cleaning)
      errors.push('A protection order cannot have cleaning details');
  }

  if (protection && protection.kind !== 'COATING') {
    const coatingFields = [
      protection.coatingProduct,
      protection.layers,
      protection.targetThicknessUm,
    ];
    if (coatingFields.some((value) => value !== undefined && value !== null)) {
      errors.push(
        'coatingProduct, layers and targetThicknessUm only apply to coatings',
      );
    }
  }

  if (input.startDate > input.dueDate) {
    errors.push('startDate must not be after dueDate');
  }

  return errors;
}
