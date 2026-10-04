import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

/**
 * Password hashing with scrypt, which is built into Node, so there's no
 * native dependency to compile. scrypt is deliberately slow and
 * memory-hungry, which makes brute-forcing stolen hashes expensive.
 *
 * Parameters follow the OWASP Password Storage Cheat Sheet
 * (N=2^17, r=8, p=1). They're stored inside each hash, so they can be raised
 * later without breaking existing passwords.
 *
 * Stored format: scrypt$<N>$<r>$<p>$<salt, base64>$<hash, base64>
 */
const N = 2 ** 17;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

// Node's scrypt takes a callback whose options overload promisify can't infer.
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keyLength: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

// scrypt needs about 128·N·r bytes; Node's default limit (32 MB) is too low
// for N=2^17, so allow twice what's needed.
const maxmemFor = (n: number, r: number) => 2 * 128 * n * r;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const hash = await scryptAsync(password, salt, KEY_LENGTH, {
    N,
    r: R,
    p: P,
    maxmem: maxmemFor(N, R),
  });
  return [
    'scrypt',
    N,
    R,
    P,
    salt.toString('base64'),
    hash.toString('base64'),
  ].join('$');
}

/** Returns false for a wrong password and for a malformed stored hash. */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false;
  }
  const [n, r, p] = parts.slice(1, 4).map(Number);
  const salt = Buffer.from(parts[4], 'base64');
  const expected = Buffer.from(parts[5], 'base64');
  if (![n, r, p].every(Number.isInteger) || expected.length === 0) {
    return false;
  }
  const actual = await scryptAsync(password, salt, expected.length, {
    N: n,
    r,
    p,
    maxmem: maxmemFor(n, r),
  });
  // Constant-time comparison, so response timing doesn't reveal how many
  // bytes of the hash matched.
  return timingSafeEqual(actual, expected);
}
