import { removeNonSeedRecords } from './demo-reset';

describe('removeNonSeedRecords', () => {
  const calls: { model: string; args: unknown }[] = [];
  const model = (name: string) => ({
    deleteMany: (args: unknown) => {
      calls.push({ model: name, args });
      return Promise.resolve({ count: 0 });
    },
  });
  const tx = {
    order: model('order'),
    staffingRequest: model('staffingRequest'),
    vessel: model('vessel'),
    user: model('user'),
  } as unknown as Parameters<typeof removeNonSeedRecords>[0];

  beforeAll(() => removeNonSeedRecords(tx, ['lena@hullops.example']));

  it('deletes orders and requests before the users and vessels they use', () => {
    expect(calls.map((call) => call.model)).toEqual([
      'order',
      'staffingRequest',
      'vessel',
      'user',
    ]);
  });

  it("keeps the seed's own vessels and users", () => {
    expect(calls.find((call) => call.model === 'vessel')?.args).toEqual({
      where: { NOT: { id: { startsWith: 'seed-' } } },
    });
    expect(calls.find((call) => call.model === 'user')?.args).toEqual({
      where: { email: { notIn: ['lena@hullops.example'] } },
    });
  });
});
