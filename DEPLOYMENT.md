# Deployment

HullOps is two services and a database:

| Part | What | Suggested host |
|---|---|---|
| Web (`apps/web`) | Next.js | Vercel (set the project's root directory to `apps/web`) |
| API (`apps/api`) | NestJS in a container (`apps/api/Dockerfile`) | Railway or Fly.io |
| Database | PostgreSQL 16 | The host's managed Postgres, or Neon |

The web app talks to the API **from its server** (Server Components and
Server Actions), never from the browser. So the API must be reachable from the
web host, but CORS doesn't come into play.

## 1. Database

Create a PostgreSQL database and copy its connection string
(`postgresql://user:password@host:5432/dbname`).

## 2. API

Build from the repository root (the pnpm workspace lives there):

```bash
docker build -f apps/api/Dockerfile -t hullops-api .
```

Most hosts build the image themselves from the Dockerfile path
`apps/api/Dockerfile` with the repository root as context.

**Railway:** [railway.json](railway.json) already tells it to use that
Dockerfile and to check `/health`, so "Deploy from GitHub repo" needs no
build settings. Without it Railway doesn't find a Dockerfile in the root and
falls back to its automatic builder, which fails on this monorepo
(`ERR_PNPM_OUTDATED_LOCKFILE`). Keep the service's Root Directory at the
repository root.

Environment variables:

| Variable | Value |
|---|---|
| `DATABASE_URL` | the connection string from step 1 |
| `JWT_SECRET` | at least 32 random characters: `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"` |
| `NODE_ENV` | `production` (the Dockerfile sets it; this turns off GraphiQL and introspection) |
| `PORT` | usually set by the host; defaults to 4000 |
| `CORS_ORIGINS` | the web app's URL; only needed if a browser ever calls the API directly (a future native or client-side app) |

On start the container applies pending migrations (`prisma migrate deploy`)
and then starts the API. Point the host's health check at `GET /health`
(200 when the database answers, 503 when not).

### Demo data (optional)

For a public demo, load the sample data once. The seed script refuses to run
with `NODE_ENV=production` (which the container has), so run it from your own
machine against the database's **public** connection string (on Railway: the
Postgres service, variable `DATABASE_PUBLIC_URL`; the internal address only
works inside Railway):

```bash
cd apps/api
DATABASE_URL="<public connection string>" pnpm exec prisma db seed
```

It is safe to run again: it only replaces its own `seed-…` records. Don't
commit the connection string, and don't paste it into chats or issues.

Every seeded user has the password `hullops-dev`, which is public in this
repository. Only seed a database that holds no real data, and never reuse
those accounts for anything else.

## 3. Web

On Vercel: import the repository, set the root directory to `apps/web`, and add:

| Variable | Value |
|---|---|
| `API_URL` | the API's public GraphQL URL, e.g. `https://hullops-api.example.com/graphql` |

The session cookie is `secure` in production, so the site must be served over
HTTPS (Vercel does this).

## 4. Install on a phone (PWA)

Open the web app's HTTPS URL on a phone and use "Add to Home Screen" (iOS
Safari: Share → Add to Home Screen; Android Chrome: the install prompt or the
menu). This needs HTTPS, so it can't be tried on `http://localhost` from a
phone.

## Not covered yet

- **The Docker image is untested.** The steps in the Dockerfile (install,
  generate, build, migrate on an empty database, start in production mode,
  health check) were run outside Docker; building the image itself was not.
- **No CI/CD.** Deploys are triggered by the host (a push to `main`); CI only
  checks the code.
- **Sessions last 8 hours** (`JWT_EXPIRES_IN_HOURS`), with no refresh token.
