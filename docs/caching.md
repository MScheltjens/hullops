# Caching

HullOps caches very little on purpose. A plan that shows yesterday's crew is worse than a page that takes 30 ms longer, so anything about people, orders and plans is fetched fresh. This page says what is cached, what is not, and why. It was checked against the running app, not assumed (see "How to check it").

## What is cached, and what is not

| What | Cached? | How | Why |
|---|---|---|---|
| Pages (HTML) | **No** | `private, no-cache, no-store` | They differ per user and role, and must be current. Every page reads the session cookie, so Next.js renders it on each request. |
| API data, fetched by the web app | **No** | `cache: "no-store"` in [`api.ts`](../apps/web/src/lib/api.ts) | Explicit, though Next.js doesn't cache `fetch` by default in the model this project uses (Cache Components is off in `next.config.ts`). |
| API answers to browsers | **No** | `Cache-Control: no-store` | Same reason. |
| JavaScript and CSS | **One year** | `public, max-age=31536000, immutable` | The file name contains a hash that changes with the content, so a long cache can never serve old code. |
| Icons and the manifest | **A day / an hour** | `max-age=86400` and `max-age=3600` in `next.config.ts` | They rarely change and are fetched on every visit, which costs a request on a slow connection. A change is picked up within that time. |
| The logged-in user, in the API | **No** | One indexed query per request | So that deactivating a user or changing a role takes effect at once, not when their login expires. |
| The browser's "Router Cache" (visited pages) | **Not for these pages** | Next.js 15+ default of 0 seconds for dynamic pages | Back and forward buttons restore the previous view; everything else is fetched again. |

There is no Redis, no response cache in the API and no service worker, so nothing sits between a change and the next page view.

## Why `revalidatePath` appears so often

It looks like a sign that things are cached; it is the opposite. After a Server Action (placing a comment, saving a request) the page the user is looking at has to show the change. `revalidatePath` tells Next.js to refresh it. It costs nothing and makes the update appear without a manual reload.

## When to cache more, and the rule

Possible, but only for data that is the same for everyone and tolerates being a little old (for example a list of vessel types). Never cache anything per user at a CDN, and never cache plans or orders. If it is ever added, it should be tagged and invalidated when the data changes (`revalidateTag`), with a short fallback time.

## How to check it

1. Run the app locally (see the README) and open an order page as a project lead.
2. Change the order **outside the web app**, straight in the API: send the `addOrderComment` mutation with the project lead's token.
3. Reload the order page. The new comment must be there at once, and again on every request after.

With the response headers (`curl -D - -o /dev/null <url>`) you can see the `Cache-Control` of each kind of file in the table above.

## Deploying: two services, two speeds

The web app (Vercel) and the API (Railway) deploy separately, and Vercel is usually finished first. For a few minutes the new web app can talk to the old API. Make changes to the API so that old and new code both work (add a field first, remove the old one in a later release), and run the API deploy first when a change needs both.
