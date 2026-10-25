import { validateStaffingRequest } from './staffing-rules';

describe('validateStaffingRequest', () => {
  const valid = {
    weekStart: '2026-10-26',
    workersNeeded: 6,
    requestedWorkerIds: ['a', 'b'],
  };

  it('accepts a valid request', () => {
    expect(validateStaffingRequest(valid)).toEqual([]);
  });

  it('accepts as many named workers as the total', () => {
    expect(validateStaffingRequest({ ...valid, workersNeeded: 2 })).toEqual([]);
  });

  it('rejects more workers by name than the total', () => {
    expect(validateStaffingRequest({ ...valid, workersNeeded: 1 })).toEqual([
      '2 workers are requested by name, but only 1 are needed in total',
    ]);
  });

  it('counts a worker named twice once', () => {
    expect(
      validateStaffingRequest({
        ...valid,
        workersNeeded: 1,
        requestedWorkerIds: ['a', 'a'],
      }),
    ).toEqual([]);
  });

  it('rejects a week that does not start on a Monday', () => {
    expect(
      validateStaffingRequest({ ...valid, weekStart: '2026-10-27' }),
    ).toEqual(['weekStart must be a Monday']);
  });

  it('rejects a malformed or impossible date', () => {
    for (const weekStart of ['next week', '2026-02-31']) {
      expect(validateStaffingRequest({ ...valid, weekStart })).toEqual([
        'weekStart must be a date like 2026-10-26',
      ]);
    }
  });

  it('reports every problem at once', () => {
    expect(
      validateStaffingRequest({
        weekStart: '2026-10-27',
        workersNeeded: 0,
        requestedWorkerIds: ['a'],
      }),
    ).toHaveLength(2);
  });
});
