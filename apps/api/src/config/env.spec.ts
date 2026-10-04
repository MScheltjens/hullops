import { validateEnv } from './env';

const DATABASE_URL = 'postgresql://hullops:hullops@localhost:5432/hullops';
const JWT_SECRET = 'a-test-secret-that-is-long-enough-1234';
const required = { DATABASE_URL, JWT_SECRET };

describe('validateEnv', () => {
  it('fills in defaults for optional variables', () => {
    expect(validateEnv(required)).toEqual({
      NODE_ENV: 'development',
      DATABASE_URL,
      PORT: 4000,
      JWT_SECRET,
      JWT_EXPIRES_IN_HOURS: 8,
      CORS_ORIGINS: ['http://localhost:3000'],
    });
  });

  it('converts PORT to a number and splits CORS_ORIGINS', () => {
    const env = validateEnv({
      ...required,
      PORT: '8080',
      CORS_ORIGINS: 'https://hullops.app, https://admin.hullops.app',
    });
    expect(env.PORT).toBe(8080);
    expect(env.CORS_ORIGINS).toEqual([
      'https://hullops.app',
      'https://admin.hullops.app',
    ]);
  });

  it('fails with a message naming a missing DATABASE_URL', () => {
    expect(() => validateEnv({ JWT_SECRET })).toThrow(/DATABASE_URL/);
  });

  it('rejects a non-Postgres DATABASE_URL', () => {
    expect(() =>
      validateEnv({ ...required, DATABASE_URL: 'mysql://localhost/x' }),
    ).toThrow(/postgresql:\/\//);
  });

  it('rejects an invalid PORT', () => {
    expect(() => validateEnv({ ...required, PORT: 'abc' })).toThrow(/PORT/);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => validateEnv({ ...required, NODE_ENV: 'staging' })).toThrow(
      /NODE_ENV/,
    );
  });

  it('requires a JWT secret of at least 32 characters', () => {
    expect(() => validateEnv({ DATABASE_URL })).toThrow(/JWT_SECRET/);
    expect(() =>
      validateEnv({ DATABASE_URL, JWT_SECRET: 'too-short' }),
    ).toThrow(/at least 32 characters/);
  });
});
