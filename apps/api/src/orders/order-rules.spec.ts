import {
  canWorkOn,
  isAllowedStatusChange,
  isOverdue,
  validateOrderInput,
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
