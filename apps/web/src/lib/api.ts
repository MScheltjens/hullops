import "server-only";

/**
 * Talks to the HullOps GraphQL API. Server-only: requests carry the user's
 * token, which never reaches the browser.
 */

const API_URL = process.env.API_URL ?? "http://localhost:4000/graphql";

/** An error returned by the API, with its machine-readable code. */
export class ApiError extends Error {
  constructor(
    message: string,
    /** e.g. UNAUTHENTICATED, FORBIDDEN, BAD_REQUEST (see the API README). */
    readonly code: string,
    /** Each failed rule, for BAD_REQUEST validation errors. */
    readonly validationErrors: string[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface GraphqlResponse<T> {
  data?: T;
  errors?: {
    message: string;
    extensions?: { code?: string; validationErrors?: string[] };
  }[];
}

export async function graphqlRequest<T>(
  query: string,
  variables: Record<string, unknown> = {},
  token?: string,
): Promise<T> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
    // Data is per user and changes constantly; never cache it.
    cache: "no-store",
  });

  const body = (await response.json()) as GraphqlResponse<T>;
  const [error] = body.errors ?? [];
  if (error) {
    throw new ApiError(
      error.message,
      error.extensions?.code ?? "UNKNOWN",
      error.extensions?.validationErrors,
    );
  }
  if (!body.data) {
    throw new ApiError(`Unexpected API response (${response.status})`, "UNKNOWN");
  }
  return body.data;
}
