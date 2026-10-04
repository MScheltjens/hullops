import { z } from 'zod';

/**
 * The environment variables the API reads, checked once at startup.
 * A missing or malformed value stops the app with a message that names the
 * variable, instead of failing later with an unrelated-looking error
 * (e.g. Prisma trying to connect to "undefined").
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\//, 'must be a postgresql:// connection string'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
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
