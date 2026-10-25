import { carryOver } from './carry-over';

describe('carryOver', () => {
  const everyone = new Set(['anna', 'tom', 'piotr', 'sofia', 'mehmet']);

  // The pattern for every test: arrange (the data), act (call the function),
  // assert (check one thing about the result).
  it('plans the same total and the same named workers as last week', () => {
    const planned = carryOver({
      previousWeek: [
        { vesselId: 'v1', workersNeeded: 10, workerIds: ['piotr', 'sofia'] },
      ],
      vesselsWithRequest: new Set(),
      availableWorkerIds: everyone,
    });

    expect(planned).toEqual([
      { vesselId: 'v1', workersNeeded: 10, workerIds: ['piotr', 'sofia'] },
    ]);
  });

  // The rules come from docs/ux.md, under "Planning that mostly happens by
  // itself".
  it('leaves out workers who are not available, but keeps the total', () => {
    const planned = carryOver({
      previousWeek: [
        {
          vesselId: 'v1',
          workersNeeded: 10,
          workerIds: ['piotr', 'sofia', 'mehmet'],
        },
      ],
      vesselsWithRequest: new Set(),
      availableWorkerIds: new Set(['piotr', 'mehmet']), // sofia is away
    });

    expect(planned).toEqual([
      { vesselId: 'v1', workersNeeded: 10, workerIds: ['piotr', 'mehmet'] },
    ]);
  });

  it('does not touch a vessel that already has a request this week', () => {
    const planned = carryOver({
      previousWeek: [
        { vesselId: 'v1', workersNeeded: 4, workerIds: ['anna'] },
        { vesselId: 'v2', workersNeeded: 6, workerIds: ['tom'] },
      ],
      vesselsWithRequest: new Set(['v1']), // already entered by hand
      availableWorkerIds: everyone,
    });

    expect(planned).toEqual([
      { vesselId: 'v2', workersNeeded: 6, workerIds: ['tom'] },
    ]);
  });

  it('plans nothing when there was no request last week', () => {
    const planned = carryOver({
      previousWeek: [],
      vesselsWithRequest: new Set(),
      availableWorkerIds: everyone,
    });

    expect(planned).toEqual([]);
  });

  it("keeps the order of last week's requests and of the names", () => {
    const planned = carryOver({
      previousWeek: [
        { vesselId: 'v2', workersNeeded: 3, workerIds: ['sofia', 'anna'] },
        { vesselId: 'v1', workersNeeded: 2, workerIds: ['tom', 'piotr'] },
      ],
      vesselsWithRequest: new Set(),
      availableWorkerIds: everyone,
    });

    expect(planned.map((request) => request.vesselId)).toEqual(['v2', 'v1']);
    expect(planned[0].workerIds).toEqual(['sofia', 'anna']);
    expect(planned[1].workerIds).toEqual(['tom', 'piotr']);
  });

  it('does not change the data it was given', () => {
    const previousWeek = [
      { vesselId: 'v1', workersNeeded: 5, workerIds: ['anna', 'tom'] },
    ];
    const snapshot = structuredClone(previousWeek);

    const planned = carryOver({
      previousWeek,
      vesselsWithRequest: new Set(),
      availableWorkerIds: new Set(['tom']), // anna is away
    });

    expect(previousWeek).toEqual(snapshot);
    // The result has its own arrays, so changing it can't touch last week.
    expect(planned[0].workerIds).not.toBe(previousWeek[0].workerIds);
  });
});
