import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { ApiError, graphqlRequest } from "./api";
import { getSessionToken } from "./session";

/**
 * Data access layer: the one place that decides who is logged in. Pages and
 * Server Actions call these functions instead of reading the cookie
 * themselves (the pattern the Next.js authentication guide recommends).
 */

export type Locale = "EN" | "DE";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: "PROJECT_LEAD" | "WORKER";
  locale: Locale;
}

/**
 * The logged-in user, or null. The API checks the token, so an expired or
 * tampered cookie simply gives null. `cache` runs this at most once per
 * request, however many components ask.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = await getSessionToken();
  if (!token) return null;
  try {
    const { me } = await graphqlRequest<{ me: CurrentUser }>(
      "{ me { id name email role locale } }",
      {},
      token,
    );
    return me;
  } catch (error) {
    if (error instanceof ApiError && error.code === "UNAUTHENTICATED") {
      return null;
    }
    throw error;
  }
});

/** For pages and actions that need login: redirects to /login without one. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Runs an API request as the logged-in user. If the session has expired in
 * the meantime, the user is sent to the login page.
 */
export async function apiAsUser<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const token = await getSessionToken();
  if (!token) redirect("/login");
  try {
    return await graphqlRequest<T>(query, variables, token);
  } catch (error) {
    if (error instanceof ApiError && error.code === "UNAUTHENTICATED") {
      redirect("/login");
    }
    throw error;
  }
}
