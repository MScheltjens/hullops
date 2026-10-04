# HullOps Web

The frontend of [HullOps](../../README.md), built with Next.js 16 (App Router), React 19, Tailwind CSS v4 and next-intl.

> **Status:** login and a read-only order overview. Creating and updating orders, order details and vessels come next (see the [roadmap](../../README.md#roadmap)).

## Development

The web app needs the [API](../api/README.md) running (on port 4000 by default).

```bash
cp .env.example .env.local   # optional: only needed if the API isn't on localhost:4000
pnpm dev                     # http://localhost:3000
pnpm build                   # production build
pnpm typecheck               # types, including translation completeness
pnpm lint                    # ESLint
```

Log in with a demo user from the API seed, e.g. `lena.hoffmann@hullops.example` (German) or `tom.dejong@hullops.example` (English); the password is `hullops-dev`.

| Variable | Default | Description |
|---|---|---|
| `API_URL` | `http://localhost:4000/graphql` | The GraphQL API. Only used on the server. |

## How it works

### Login and sessions

- **Login** is a Server Action ([`src/app/login/actions.ts`](src/app/login/actions.ts)). It calls the API's `login` mutation and stores the token in an **httpOnly cookie**: the browser sends it automatically, but JavaScript in the page can't read it, so an injected script can't steal it.
- **[`src/proxy.ts`](src/proxy.ts)** (Next.js 16's name for middleware) sends visitors without a session cookie to `/login`. It only checks that the cookie exists.
- **[`src/lib/dal.ts`](src/lib/dal.ts)**, the data access layer, does the real check: `getCurrentUser()` asks the API who the token belongs to, at most once per request. Pages call `requireUser()`, and API requests go through `apiAsUser()`. An expired or invalid session leads back to the login page.

This split follows the Next.js authentication guide: a cheap optimistic check in the proxy, and real authorization in the DAL.

### Data

Pages are Server Components that fetch from the API on the server ([`src/lib/api.ts`](src/lib/api.ts)), with the user's token. The browser never sees the token or talks to the API directly. Nothing is cached, because data is per user and changes constantly.

Filters on the order overview live in the URL (`/orders?status=PLANNED&overdue=true`), so filtered views can be bookmarked and shared.

### Languages

The app is in **English** (default) and **German**, via [next-intl](https://next-intl.dev):

- **The language comes from the user,** not the URL: it's the user's `locale` setting in the API, which they change with the EN/DE switch in the header. Before login, the browser's preferred language is used. See [`src/i18n/request.ts`](src/i18n/request.ts).
- **Translations** are in [`messages/en.json`](messages/en.json) and [`messages/de.json`](messages/de.json). Shipyard terms belong here, not in the API.
- **Keys are type-checked:** a typo in `t("orders.titel")` is a compile error, and [`messages.check.ts`](src/i18n/messages.check.ts) fails the build if German is missing a key that English has.
- **Dates** are formatted per language in the `Europe/Berlin` time zone.

## Structure

```
apps/web/
├── messages/              translations (en, de)
└── src/
    ├── proxy.ts           redirect to /login without a session cookie
    ├── i18n/              language selection and translation checks
    ├── lib/               API client, session cookie, data access layer
    └── app/
        ├── layout.tsx     root layout: language, translations provider
        ├── login/         login page, form and Server Actions
        └── (app)/         pages that need login, with the shared header
            └── orders/    order overview
```

## Next.js 16

This version has breaking changes compared with older Next.js releases. Before writing Next.js code, read [`AGENTS.md`](AGENTS.md) and the docs bundled in `node_modules/next/dist/docs/`.
