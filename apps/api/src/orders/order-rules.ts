import type {
  OrderStatus,
  ProtectionKind,
  Role,
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

/**
 * Who may post a status update (a note or the next status) on an order:
 * project leads on every order, the order's team, and the team lead of the
 * order's vessel, because he runs the work there even on orders whose team
 * he isn't on. Admins don't run the work, so they aren't included.
 */
export function canUpdateOrder(
  user: { id: string; role: Role },
  order: {
    assignments: readonly { userId: string }[];
    vessel: { teamLeadId: string | null };
  },
): boolean {
  if (user.role === 'PROJECT_LEAD') return true;
  if (order.assignments.some((a) => a.userId === user.id)) return true;
  return user.role === 'TEAM_LEAD' && order.vessel.teamLeadId === user.id;
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

export interface PageRange {
  skip: number;
  take: number;
}

/**
 * Lists show open orders first and done orders after them. Prisma can't sort
 * on "is this order done", so those are two queries, and one page of the list
 * can span both. This works out which part of each group the page covers.
 */
export function splitOrderPage(
  skip: number,
  take: number,
  openCount: number,
): { open: PageRange; done: PageRange } {
  const openTake = Math.min(take, Math.max(openCount - skip, 0));
  return {
    open: { skip, take: openTake },
    done: { skip: Math.max(skip - openCount, 0), take: take - openTake },
  };
}

export const MAX_PHOTOS_PER_UPDATE = 5;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * What phones and cameras produce. iPhones save HEIC, but browsers report it
 * as either image/heic or image/heif depending on the device, so both count.
 */
export const ALLOWED_PHOTO_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

export interface PhotoToValidate {
  mimeType: string;
  sizeBytes: number;
}

/**
 * Checks the photos a user wants to upload for one status update. Returns
 * every violation, like validateOrderInput, and names each file by its
 * position (counting from 1), so the client can point at the wrong one.
 */
export function validatePhotoUploads(
  files: readonly PhotoToValidate[],
): string[] {
  const errors: string[] = [];

  if (files.length < 1 || files.length > MAX_PHOTOS_PER_UPDATE) {
    errors.push(
      `Upload between 1 and ${MAX_PHOTOS_PER_UPDATE} photos, got ${files.length}`,
    );
  }

  const maxMegabytes = MAX_PHOTO_BYTES / (1024 * 1024);
  for (const [index, file] of files.entries()) {
    const label = `Photo ${index + 1}`;

    if (!ALLOWED_PHOTO_TYPES.includes(file.mimeType)) {
      errors.push(
        `${label}: type ${file.mimeType} is not allowed (JPEG, PNG, WebP or HEIC only)`,
      );
    }
    // Checked here as user input, so the client gets a validation error
    // instead of the StorageService's programming error (a 500).
    if (!Number.isInteger(file.sizeBytes) || file.sizeBytes <= 0) {
      errors.push(`${label}: size must be a positive whole number of bytes`);
    } else if (file.sizeBytes > MAX_PHOTO_BYTES) {
      errors.push(`${label}: larger than ${maxMegabytes} MB`);
    }
  }

  return errors;
}
