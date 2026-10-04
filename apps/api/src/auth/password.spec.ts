import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  let hash: string;

  beforeAll(async () => {
    hash = await hashPassword('correct horse battery staple');
  });

  it('stores the algorithm, parameters, salt and hash', () => {
    expect(hash).toMatch(
      /^scrypt\$131072\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/,
    );
  });

  it('never stores the password itself', () => {
    expect(hash).not.toContain('correct horse');
  });

  it('accepts the right password', async () => {
    await expect(
      verifyPassword('correct horse battery staple', hash),
    ).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    await expect(
      verifyPassword('Correct horse battery staple', hash),
    ).resolves.toBe(false);
  });

  it('uses a fresh salt for every hash', async () => {
    const second = await hashPassword('correct horse battery staple');
    expect(second).not.toBe(hash);
  });

  it.each([
    '',
    'not-a-hash',
    'bcrypt$10$8$1$c2FsdA==$aGFzaA==',
    'scrypt$abc$8$1$c2FsdA==$aGFzaA==',
    'scrypt$131072$8$1$c2FsdA==$',
  ])('rejects the malformed stored hash %p', async (stored) => {
    await expect(verifyPassword('anything', stored)).resolves.toBe(false);
  });
});
