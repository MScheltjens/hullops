import { formatDateOnly, isMonday, parseDateOnly } from './week';

describe('parseDateOnly', () => {
  it('parses a date as midnight UTC', () => {
    expect(parseDateOnly('2026-10-26')?.toISOString()).toBe(
      '2026-10-26T00:00:00.000Z',
    );
  });

  it.each(['', '2026-10', '26-10-2026', '2026-10-26T00:00:00Z', 'tomorrow'])(
    'rejects the wrong format %p',
    (value) => {
      expect(parseDateOnly(value)).toBeNull();
    },
  );

  it.each(['2026-02-31', '2026-13-01', '2026-00-10', '2026-04-31'])(
    'rejects the date that does not exist %p',
    (value) => {
      expect(parseDateOnly(value)).toBeNull();
    },
  );

  it('accepts 29 February only in a leap year', () => {
    expect(parseDateOnly('2028-02-29')).not.toBeNull();
    expect(parseDateOnly('2026-02-29')).toBeNull();
  });
});

describe('isMonday', () => {
  it('is true for a Monday and false for other days', () => {
    expect(isMonday(new Date('2026-10-26T00:00:00Z'))).toBe(true);
    expect(isMonday(new Date('2026-10-25T00:00:00Z'))).toBe(false); // Sunday
    expect(isMonday(new Date('2026-10-27T00:00:00Z'))).toBe(false); // Tuesday
  });
});

describe('formatDateOnly', () => {
  it('writes the date as YYYY-MM-DD', () => {
    expect(formatDateOnly(new Date('2026-10-26T00:00:00Z'))).toBe('2026-10-26');
  });
});
