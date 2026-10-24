import { z } from 'zod';

/**
 * The environment variables the API reads, checked once at startup.
 * A missing or malformed value stops the app with a message that names the
 * variable, instead of failing later with an unrelated-looking error
 * (e.g. Prisma trying to connect to "undefined").
 */
const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    DATABASE_URL: z
      .string()
      .regex(
        /^postgres(ql)?:\/\//,
        'must be a postgresql:// connection string',
      ),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    // Signs login tokens. Anyone who knows it can forge a token for any user,
    // so it must be long, random and secret. Generate one with:
    //   node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
    JWT_SECRET: z.string().min(32, 'must be at least 32 characters'),
    // How long a login lasts; default: one working day.
    JWT_EXPIRES_IN_HOURS: z.coerce.number().positive().default(8),
    // Comma-separated list of origins allowed to call the API from a browser.
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:3000')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    // Creates the first administrator when the API starts and no admin exists
    // yet (see AdminBootstrapService). Set both or neither. Without them an
    // empty database has nobody who can create users.
    ADMIN_EMAIL: z.string().email().optional(),
    ADMIN_PASSWORD: z
      .string()
      .min(12, 'must be at least 12 characters')
      .optional(),
  })
  .refine((env) => Boolean(env.ADMIN_EMAIL) === Boolean(env.ADMIN_PASSWORD), {
    message: 'ADMIN_EMAIL and ADMIN_PASSWORD must be set together',
    path: ['ADMIN_EMAIL'],
  });

export type Env = z.infer<typeof envSchema>;

/** Used as ConfigModule's `validate` hook. Throws if the environment is invalid. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}
