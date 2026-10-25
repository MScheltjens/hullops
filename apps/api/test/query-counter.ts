import { Client } from 'pg';

/**
 * Counts the SQL statements the app sends to the database while `run` runs.
 * It wraps `pg`'s query method, the one Prisma's driver adapter uses, so it
 * sees every statement; transaction control (BEGIN, COMMIT, ROLLBACK) isn't
 * counted, only real queries.
 */
export async function countQueries<T>(
  run: () => Promise<T>,
): Promise<{ result: T; queries: string[] }> {
  const queries: string[] = [];
  const proto = Client.prototype as { query: (...args: unknown[]) => unknown };
  const original = proto.query;

  // `query` has many overloads; this wrapper only records the SQL text and
  // passes everything else through untouched.
  proto.query = function (this: Client, ...args: unknown[]) {
    const first = args[0];
    const text =
      typeof first === 'string'
        ? first
        : ((first as { text?: string } | undefined)?.text ?? '');
    if (!/^\s*(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)/i.test(text)) {
      queries.push(text.replace(/\s+/g, ' ').trim());
    }
    return original.apply(this, args);
  };

  try {
    const result = await run();
    return { result, queries };
  } finally {
    proto.query = original;
  }
}
