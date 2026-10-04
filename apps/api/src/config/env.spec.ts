import { validateEnv } from './env';

const DATABASE_URL = 'postgresql://hullops:hullops@localhost:5432/hullops';

describe('validateEnv', () => {
  it('fills in defaults for optional variables', () => {
    expect(validateEnv({ DATABASE_URL })).toEqual({
      NODE_ENV: 'development',
      DATABASE_URL,
      PORT: 4000,
      CORS_ORIGINS: ['http://localhost:3000'],
    });
  });

  it('converts PORT to a number and splits CORS_ORIGINS', () => {
    const env = validateEnv({
      DATABASE_URL,
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
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });

  it('rejects a non-Postgres DATABASE_URL', () => {
    expect(() => validateEnv({ DATABASE_URL: 'mysql://localhost/x' })).toThrow(
      /postgresql:\/\//,
    );
  });

  it('rejects an invalid PORT', () => {
    expect(() => validateEnv({ DATABASE_URL, PORT: 'abc' })).toThrow(/PORT/);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => validateEnv({ DATABASE_URL, NODE_ENV: 'staging' })).toThrow(
      /NODE_ENV/,
    );
  });
});
