import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "./lib/session-cookie";

/**
 * A quick first check before any page renders: visitors without a session
 * cookie go straight to the login page.
 *
 * This only checks that a cookie exists, not that it's valid; that happens
 * in the data access layer (src/lib/dal.ts), which asks the API. The Next.js
 * docs recommend exactly this split: proxy for cheap, optimistic redirects,
 * the DAL for real authorization.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Everything except the login page, Next.js internals, static files and
  // the PWA manifest and icons: the browser fetches those without a session,
  // and a redirect to /login would break installing the app.
  matcher: [
    "/((?!login|_next/static|_next/image|favicon.ico|manifest.webmanifest|apple-icon.png|icons/).*)",
  ],
};
