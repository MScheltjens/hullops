import { registerDecorator, ValidationOptions } from 'class-validator';

/**
 * An IMO number identifies a ship for its whole life. It has seven digits, and
 * the last one is a check digit: multiply the first six digits by 7, 6, 5, 4,
 * 3 and 2, add the products, and the last digit of the sum must equal the
 * seventh digit. Example: 9074729 → 9·7 + 0·6 + 7·5 + 4·4 + 7·3 + 2·2 = 139 → 9.
 *
 * The number is often written with an "IMO " prefix, which callers should
 * strip before validating; we store the bare seven digits.
 */
export function isValidImoNumber(value: string): boolean {
  if (!/^\d{7}$/.test(value)) {
    return false;
  }
  const digits = value.split('').map(Number);
  const sum = digits
    .slice(0, 6)
    .reduce((acc, digit, i) => acc + digit * (7 - i), 0);
  return sum % 10 === digits[6];
}

export function IsImoNumber(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyName) => {
    registerDecorator({
      name: 'isImoNumber',
      target: target.constructor,
      propertyName: propertyName as string,
      options: {
        message: '$property must be a valid 7-digit IMO number',
        ...options,
      },
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && isValidImoNumber(value),
      },
    });
  };
}
