import { validate } from 'class-validator';
import { IsImoNumber, isValidImoNumber } from './imo-number';

describe('isValidImoNumber', () => {
  it.each(['9074729', '9321483', '8814275'])('accepts %s', (imo) => {
    expect(isValidImoNumber(imo)).toBe(true);
  });

  it('rejects a wrong check digit', () => {
    expect(isValidImoNumber('9074728')).toBe(false);
  });

  it.each(['', '907472', '90747290', 'IMO 9074729', '907472a'])(
    'rejects the malformed value %p',
    (value) => {
      expect(isValidImoNumber(value)).toBe(false);
    },
  );
});

describe('@IsImoNumber', () => {
  class Target {
    @IsImoNumber()
    imo: unknown;
  }

  const errorsFor = async (imo: unknown) => {
    const target = new Target();
    target.imo = imo;
    return validate(target);
  };

  it('passes a valid IMO number', async () => {
    expect(await errorsFor('9074729')).toHaveLength(0);
  });

  it('fails an invalid one with a readable message', async () => {
    const [error] = await errorsFor('1234568');
    expect(error.constraints).toEqual({
      isImoNumber: 'imo must be a valid 7-digit IMO number',
    });
  });

  it('fails non-strings', async () => {
    expect(await errorsFor(9074729)).toHaveLength(1);
  });
});
