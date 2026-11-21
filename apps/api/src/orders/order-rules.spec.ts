import {
  canUpdateOrder,
  canWorkOn,
  isAllowedStatusChange,
  isOverdue,
  MAX_PHOTO_BYTES,
  splitOrderPage,
  validateOrderInput,
  validatePhotoUploads,
} from './order-rules';

describe('isOverdue', () => {
  // A fixed moment, so the tests give the same result on every day.
  const now = new Date('2026-10-04T12:00:00Z');
  const yesterday = new Date('2026-10-03T12:00:00Z');
  const tomorrow = new Date('2026-10-05T12:00:00Z');

  it('is overdue when the due date has passed and work is in progress', () => {
    const order = { dueDate: yesterday, status: 'IN_PROGRESS' as const };

    expect(isOverdue(order, now)).toBe(true);
  });

  it('is overdue when the due date has passed and work never started', () => {
    const order = { dueDate: yesterday, status: 'PLANNED' as const };

    expect(isOverdue(order, now)).toBe(true);
  });

  it('is not overdue when the due date is still ahead', () => {
    const order = { dueDate: tomorrow, status: 'IN_PROGRESS' as const };

    expect(isOverdue(order, now)).toBe(false);
  });

  it('is not overdue when the order is done, even after the due date', () => {
    const order = { dueDate: yesterday, status: 'DONE' as const };

    expect(isOverdue(order, now)).toBe(false);
  });

  it('is not overdue when the order is done before the due date', () => {
    const order = { dueDate: tomorrow, status: 'DONE' as const };

    expect(isOverdue(order, now)).toBe(false);
  });

  // Edge case: "due at 12:00" may still be finished at 12:00; it only
  // becomes overdue after that. Guards against `<` turning into `<=`.
  it('is not overdue at the exact moment it is due', () => {
    const order = { dueDate: now, status: 'IN_PROGRESS' as const };

    expect(isOverdue(order, now)).toBe(false);
  });

  it('uses the current time when no moment is given', () => {
    const longAgo = {
      dueDate: new Date('2000-01-01'),
      status: 'PLANNED' as const,
    };
    const farAhead = {
      dueDate: new Date('2999-01-01'),
      status: 'PLANNED' as const,
    };

    expect(isOverdue(longAgo)).toBe(true);
    expect(isOverdue(farAhead)).toBe(false);
  });
});

describe('isAllowedStatusChange', () => {
  it.each([
    ['PLANNED', 'PLANNED', true], // a note without a status change
    ['PLANNED', 'IN_PROGRESS', true],
    ['IN_PROGRESS', 'IN_PROGRESS', true],
    ['IN_PROGRESS', 'DONE', true],
    ['DONE', 'DONE', true],
    ['PLANNED', 'DONE', false], // skips "in progress"
    ['IN_PROGRESS', 'PLANNED', false], // backwards
    ['DONE', 'IN_PROGRESS', false], // a done order stays done
    ['DONE', 'PLANNED', false],
  ] as const)('%s → %s is allowed: %s', (from, to, allowed) => {
    expect(isAllowedStatusChange(from, to)).toBe(allowed);
  });
});

describe('canWorkOn', () => {
  it('allows someone who works in the service area', () => {
    expect(
      canWorkOn({ serviceTypes: ['CLEANING', 'PROTECTION'] }, 'PROTECTION'),
    ).toBe(true);
  });

  it('refuses someone who does not', () => {
    expect(canWorkOn({ serviceTypes: ['CLEANING'] }, 'PROTECTION')).toBe(false);
  });
});

describe('canUpdateOrder', () => {
  // An order on Heinz's vessel, with only the worker Ali on its team. Each
  // case changes just the field it's about.
  const order = {
    assignments: [{ userId: 'ali' }],
    vessel: { teamLeadId: 'heinz' },
  };

  it('allows project leads on every order', () => {
    expect(canUpdateOrder({ id: 'lena', role: 'PROJECT_LEAD' }, order)).toBe(
      true,
    );
  });

  it("allows the order's team", () => {
    expect(canUpdateOrder({ id: 'ali', role: 'WORKER' }, order)).toBe(true);
  });

  it("allows the vessel's team lead, even when he isn't on the team", () => {
    expect(canUpdateOrder({ id: 'heinz', role: 'TEAM_LEAD' }, order)).toBe(
      true,
    );
  });

  it("refuses a team lead on another vessel's order", () => {
    expect(canUpdateOrder({ id: 'ute', role: 'TEAM_LEAD' }, order)).toBe(false);
  });

  it('refuses a team lead when the vessel has no team lead', () => {
    expect(
      canUpdateOrder(
        { id: 'heinz', role: 'TEAM_LEAD' },
        { ...order, vessel: { teamLeadId: null } },
      ),
    ).toBe(false);
  });

  it('refuses a vessel lead whose role is no longer TEAM_LEAD', () => {
    expect(canUpdateOrder({ id: 'heinz', role: 'WORKER' }, order)).toBe(false);
  });

  it('refuses workers and admins who are not on the team', () => {
    for (const role of ['WORKER', 'ADMIN'] as const) {
      expect(canUpdateOrder({ id: 'max', role }, order)).toBe(false);
    }
  });
});

describe('validateOrderInput', () => {
  const dates = {
    startDate: new Date('2026-10-04'),
    dueDate: new Date('2026-10-10'),
  };
  const cleaning = { method: 'High-pressure water', surface: 'Hull' };
  const enclosure = { kind: 'ENCLOSURE' as const };

  it('accepts a cleaning order with cleaning details', () => {
    expect(
      validateOrderInput({ serviceType: 'CLEANING', ...dates, cleaning }),
    ).toEqual([]);
  });

  it('accepts a protection order with protection details', () => {
    expect(
      validateOrderInput({
        serviceType: 'PROTECTION',
        ...dates,
        protection: enclosure,
      }),
    ).toEqual([]);
  });

  it('accepts coating fields on a coating', () => {
    const coating = {
      kind: 'COATING' as const,
      coatingProduct: 'Antifouling',
      layers: 2,
      targetThicknessUm: 250,
    };
    expect(
      validateOrderInput({
        serviceType: 'PROTECTION',
        ...dates,
        protection: coating,
      }),
    ).toEqual([]);
  });

  it('requires details that match the service type', () => {
    expect(validateOrderInput({ serviceType: 'CLEANING', ...dates })).toEqual([
      'A cleaning order needs cleaning details',
    ]);
    expect(validateOrderInput({ serviceType: 'PROTECTION', ...dates })).toEqual(
      ['A protection order needs protection details'],
    );
  });

  it('rejects details of the other service type', () => {
    expect(
      validateOrderInput({
        serviceType: 'CLEANING',
        ...dates,
        cleaning,
        protection: enclosure,
      }),
    ).toEqual(['A cleaning order cannot have protection details']);
    expect(
      validateOrderInput({
        serviceType: 'PROTECTION',
        ...dates,
        cleaning,
        protection: enclosure,
      }),
    ).toEqual(['A protection order cannot have cleaning details']);
  });

  it('rejects coating fields on other kinds of protection', () => {
    expect(
      validateOrderInput({
        serviceType: 'PROTECTION',
        ...dates,
        protection: { kind: 'FLOOR', layers: 2 },
      }),
    ).toEqual([
      'coatingProduct, layers and targetThicknessUm only apply to coatings',
    ]);
  });

  it('allows an order that starts and is due on the same moment', () => {
    const sameMoment = new Date('2026-10-04');
    expect(
      validateOrderInput({
        serviceType: 'CLEANING',
        startDate: sameMoment,
        dueDate: sameMoment,
        cleaning,
      }),
    ).toEqual([]);
  });

  it('rejects a start date after the due date', () => {
    expect(
      validateOrderInput({
        serviceType: 'CLEANING',
        startDate: dates.dueDate,
        dueDate: dates.startDate,
        cleaning,
      }),
    ).toEqual(['startDate must not be after dueDate']);
  });

  it('reports every problem at once', () => {
    expect(
      validateOrderInput({
        serviceType: 'CLEANING',
        startDate: dates.dueDate,
        dueDate: dates.startDate,
      }),
    ).toHaveLength(2);
  });
});

describe('splitOrderPage', () => {
  it('stays in the open orders while the page fits', () => {
    expect(splitOrderPage(0, 5, 10)).toEqual({
      open: { skip: 0, take: 5 },
      done: { skip: 0, take: 0 },
    });
  });

  it('fills the rest of the page with done orders', () => {
    expect(splitOrderPage(8, 5, 10)).toEqual({
      open: { skip: 8, take: 2 },
      done: { skip: 0, take: 3 },
    });
  });

  it('skips into the done orders once past the open ones', () => {
    expect(splitOrderPage(12, 5, 10)).toEqual({
      open: { skip: 12, take: 0 },
      done: { skip: 2, take: 5 },
    });
  });

  it('handles a page ending exactly at the last open order', () => {
    expect(splitOrderPage(5, 5, 10)).toEqual({
      open: { skip: 5, take: 5 },
      done: { skip: 0, take: 0 },
    });
  });

  it('goes straight to done orders when nothing is open', () => {
    expect(splitOrderPage(0, 5, 0)).toEqual({
      open: { skip: 0, take: 0 },
      done: { skip: 0, take: 5 },
    });
  });
});

describe('validatePhotoUploads', () => {
  const jpeg = (sizeBytes = 1000) => ({ mimeType: 'image/jpeg', sizeBytes });

  it('accepts one photo', () => {
    expect(validatePhotoUploads([jpeg()])).toEqual([]);
  });

  it('accepts five photos of every allowed type', () => {
    const files = ['jpeg', 'png', 'webp', 'heic', 'heif'].map((type) => ({
      mimeType: `image/${type}`,
      sizeBytes: 1000,
    }));

    expect(validatePhotoUploads(files)).toEqual([]);
  });

  it('rejects an empty list', () => {
    expect(validatePhotoUploads([])).toEqual([
      'Upload between 1 and 5 photos, got 0',
    ]);
  });

  it('rejects six photos', () => {
    expect(
      validatePhotoUploads(Array.from({ length: 6 }, () => jpeg())),
    ).toEqual(['Upload between 1 and 5 photos, got 6']);
  });

  it('rejects a file that is not a photo', () => {
    expect(
      validatePhotoUploads([{ mimeType: 'application/pdf', sizeBytes: 1000 }]),
    ).toEqual([
      'Photo 1: type application/pdf is not allowed (JPEG, PNG, WebP or HEIC only)',
    ]);
  });

  it('accepts exactly 10 MB', () => {
    expect(validatePhotoUploads([jpeg(MAX_PHOTO_BYTES)])).toEqual([]);
  });

  it('rejects one byte more than 10 MB', () => {
    expect(validatePhotoUploads([jpeg(MAX_PHOTO_BYTES + 1)])).toEqual([
      'Photo 1: larger than 10 MB',
    ]);
  });

  it.each([0, -1, 1.5])('rejects a size of %p bytes', (sizeBytes) => {
    expect(validatePhotoUploads([jpeg(sizeBytes)])).toEqual([
      'Photo 1: size must be a positive whole number of bytes',
    ]);
  });

  it('reports every violation at once, naming each photo', () => {
    const files = [
      jpeg(),
      { mimeType: 'application/pdf', sizeBytes: MAX_PHOTO_BYTES + 1 },
      jpeg(),
      jpeg(),
      jpeg(0),
      jpeg(),
    ];

    expect(validatePhotoUploads(files)).toEqual([
      'Upload between 1 and 5 photos, got 6',
      'Photo 2: type application/pdf is not allowed (JPEG, PNG, WebP or HEIC only)',
      'Photo 2: larger than 10 MB',
      'Photo 5: size must be a positive whole number of bytes',
    ]);
  });
});
