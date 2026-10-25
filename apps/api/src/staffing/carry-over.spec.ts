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

  // Your turn: turn each todo into a test, one at a time. See the rules in
  // docs/ux.md, under "Planning that mostly happens by itself".
  it.todo('leaves out workers who are not available, but keeps the total');
  it.todo('does not touch a vessel that already has a request this week');
  it.todo('plans nothing when there was no request last week');
  it.todo("keeps the order of last week's requests and of the names");
  it.todo('does not change the data it was given');
});
