# HullOps Web

The frontend of [HullOps](../../README.md), built with Next.js 16 (App Router), React 19, Tailwind CSS v4 and next-intl.

> **Status:** login, the order overview and details (status updates, comments, team), creating orders, vessels, weekly planning with the crew plan, user management and photos on status updates, in English and German (see the [roadmap](../../README.md#roadmap)).

## Development

The web app needs the [API](../api/README.md) running (on port 4000 by default).

```bash
cp .env.example .env.local   # optional: only needed if the API isn't on localhost:4000
pnpm dev                     # http://localhost:3000
pnpm build                   # production build
pnpm typecheck               # types, including translation completeness
pnpm lint                    # ESLint
pnpm test                    # unit tests (Vitest)
pnpm test:e2e                # browser tests (Playwright), see Testing
```

Log in with a demo user from the API seed, e.g. `lena.hoffmann@hullops.example` (German) or `tom.dejong@hullops.example` (English); the password is `hullops-dev`.

| Variable | Default | Description |
|---|---|---|
| `API_URL` | `http://localhost:4000/graphql` | The GraphQL API. Only used on the server. |

## How it works

### Login and sessions

- **Login** is a Server Action ([`src/app/login/actions.ts`](src/app/login/actions.ts)). It calls the API's `login` mutation and stores the token in an **httpOnly cookie**: the browser sends it automatically, but JavaScript in the page can't read it, so an injected script can't steal it.
- **[`src/proxy.ts`](src/proxy.ts)** (Next.js 16's name for middleware) sends visitors without a session cookie to `/login`. It only checks that the cookie exists.
- **[`src/lib/server/dal.ts`](src/lib/server/dal.ts)**, the data access layer, does the real check: `getCurrentUser()` asks the API who the token belongs to, at most once per request. Pages call `requireUser()`, and API requests go through `apiAsUser()`. An expired or invalid session leads back to the login page.

This split follows the Next.js authentication guide: a cheap optimistic check in the proxy, and real authorization in the DAL.

### Data

Pages are Server Components that fetch from the API on the server ([`src/lib/server/api.ts`](src/lib/server/api.ts)), with the user's token. The browser never sees the token or talks to the API directly. Nothing is cached, because data is per user and changes constantly.

**Photos are the exception:** the browser uploads them straight to object storage, with signed URLs it gets from the API through a Server Action (`requestPhotoUploads`), and the status update then sends only their keys. Photos are checked against the API's limits and scaled down to JPEGs of at most 2000 px in the browser first ([`src/lib/photos.ts`](src/lib/photos.ts), [`src/lib/photo-upload.ts`](src/lib/photo-upload.ts)), so they don't travel through this server on slow yard connections. The bucket needs a CORS rule for that (see [DEPLOYMENT.md](../../DEPLOYMENT.md)).

Filters on the order overview live in the URL (`/orders?status=PLANNED&overdue=true`), so filtered views can be bookmarked and shared.

### Languages

The app is in **English** (default) and **German**, via [next-intl](https://next-intl.dev):

- **The language comes from the user,** not the URL: it's the user's `locale` setting in the API, which they change with the EN/DE switch in the header. Before login, the browser's preferred language is used. See [`src/i18n/request.ts`](src/i18n/request.ts).
- **Translations** are in [`messages/en.json`](messages/en.json) and [`messages/de.json`](messages/de.json). Shipyard terms belong here, not in the API.
- **Keys are type-checked:** a key that doesn't exist, such as a misspelled `t("orders.titel")` instead of `t("orders.title")`, is a compile error, and [`messages.check.ts`](src/i18n/messages.check.ts) fails the build if German is missing a key that English has.
- **Dates** are formatted per language in the `Europe/Berlin` time zone.

## Testing

- **Unit tests** (`src/**/*.spec.ts`, Vitest) test pure logic such as the photo checks.
- **Browser tests** ([`e2e/`](e2e/), Playwright, `*.e2e.ts`) run the real app. [`playwright.config.ts`](playwright.config.ts) starts the API on port 4100 and a production build of this app on 3100, against their own `hullops_e2e` database, which `pnpm --filter api prepare:browser-db` resets to the demo seed before every run. Your dev servers can keep running.
  - Install the browser once: `pnpm exec playwright install chromium`.
  - A setup project logs in as project lead, team lead and worker and saves each session; a test starts logged in with `test.use({ storageState: authFile("projectLead") })` ([`e2e/auth.ts`](e2e/auth.ts)).
  - The tests use a mobile Chromium, because the app is mostly used on phones. Add `--headed` to watch, and open the report of a failed run with `pnpm exec playwright show-report`.

## Structure

```
apps/web/
├── e2e/                   browser tests (Playwright)
├── messages/              translations (en, de)
└── src/
    ├── proxy.ts           redirect to /login without a session cookie
    ├── i18n/              language selection and translation checks
    ├── lib/               API client, session cookie, data access layer
    └── app/
        ├── layout.tsx     root layout: language, translations provider
        ├── login/         login page, form and Server Actions
        └── (app)/         pages that need login, with the shared header
            ├── orders/    order overview, details with status updates and photos, new order
            ├── vessels/   vessels
            ├── planning/  weekly staffing and crew plan
            └── admin/     user management
```

## Next.js 16

This version has breaking changes compared with older Next.js releases. Before writing Next.js code, read [`AGENTS.md`](AGENTS.md) and the docs bundled in `node_modules/next/dist/docs/`.
