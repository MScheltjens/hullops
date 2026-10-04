import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./session-cookie";

/**
 * The login token lives in an httpOnly cookie: the browser sends it with
 * every request, but JavaScript in the page can't read it, so a script
 * injected into the page (XSS) can't steal it.
 */
export async function saveSession(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    // Only over https in production; local development runs on http.
    secure: process.env.NODE_ENV === "production",
    // Sent on normal navigation, not on cross-site form posts or requests.
    sameSite: "lax",
    path: "/",
    // Expires together with the token.
    expires: expiresAt,
  });
}

export async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
