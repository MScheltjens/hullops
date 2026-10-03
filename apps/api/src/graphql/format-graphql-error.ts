import type { GraphQLFormattedError } from 'graphql';

/**
 * Error codes for HTTP statuses that Nest exceptions carry. Nest only gives
 * some statuses a code of their own (e.g. 400 → BAD_REQUEST); everything else,
 * including a ConflictException (409), would otherwise reach the client as
 * INTERNAL_SERVER_ERROR. Clients branch on `extensions.code`, so it has to be
 * right.
 */
const CODE_BY_STATUS: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
};

/** The body of a Nest HttpException, which Nest puts in `extensions.originalError`. */
interface HttpExceptionBody {
  statusCode: number;
  message: string | string[];
}

function isHttpExceptionBody(value: unknown): value is HttpExceptionBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as HttpExceptionBody).statusCode === 'number'
  );
}

/**
 * Apollo `formatError` hook. It shapes every error the API returns:
 *
 * - HTTP exceptions get a code that matches their status (see CODE_BY_STATUS).
 * - ValidationPipe failures get the message "Validation failed" and list each
 *   failed constraint in `extensions.validationErrors`, instead of the generic
 *   "Bad Request Exception".
 * - `originalError` is dropped; whatever a client needs is now in `message`
 *   and `code`.
 * - In production, unexpected errors (not HTTP exceptions, e.g. a lost
 *   database connection) are reduced to "Internal server error" so internal
 *   details never reach the client.
 */
export function formatGraphqlError(
  formatted: GraphQLFormattedError,
  isProduction = process.env.NODE_ENV === 'production',
): GraphQLFormattedError {
  const { originalError, ...extensions } = formatted.extensions ?? {};

  if (isHttpExceptionBody(originalError)) {
    const code =
      CODE_BY_STATUS[originalError.statusCode] ?? extensions.code ?? 'ERROR';
    if (Array.isArray(originalError.message)) {
      return {
        ...formatted,
        message: 'Validation failed',
        extensions: {
          ...extensions,
          code,
          validationErrors: originalError.message,
        },
      };
    }
    return { ...formatted, extensions: { ...extensions, code } };
  }

  if (isProduction && extensions.code === 'INTERNAL_SERVER_ERROR') {
    return {
      message: 'Internal server error',
      locations: formatted.locations,
      path: formatted.path,
      extensions: { code: 'INTERNAL_SERVER_ERROR' },
    };
  }

  return { ...formatted, extensions };
}
