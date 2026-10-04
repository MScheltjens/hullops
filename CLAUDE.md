# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

HullOps is a planning tool for subcontractors working on shipyards. It's a portfolio project, so prefer clear, well-structured code over clever shortcuts, and explain non-obvious decisions.

**Domain:**
- Two service types: **cleaning** and **protection**. Protection can run at the same time as cleaning.
- Protection kinds: **enclosure** (e.g. wooden boxes around machines), **covering**, **floor protection**, **coating**.
- Materials: OSB standard, OSB fire-resistant, Proplex 3mm, Proplex HD, glass fiber fabric (used against fire and welding sparks).
- Languages: the app will be in English (default) and German; it is mainly used in Germany. Keep the API language-neutral: enum values are codes, and user-facing labels (e.g. German shipyard terms like "Schweißschutzdecke") belong in the frontend translations, not in the backend.

## Stack

pnpm 12 monorepo (`apps/*`), Node 24.

- `apps/api`: NestJS (CommonJS), GraphQL, Prisma 7, PostgreSQL (via the root `docker-compose.yml`)
- `apps/web`: Next.js 16 App Router, TypeScript, Tailwind CSS v4. This Next.js version has breaking changes compared with older ones, so read `apps/web/AGENTS.md` and the docs in `apps/web/node_modules/next/dist/docs/` before writing Next.js code.

## Rules

- Always use pnpm, never npm or yarn.
- Code, comments and enum values are in English.
- Never commit `.env` files or secrets.
- Change the schema only through `prisma migrate dev`. Never edit migration files.
- Write tests for new backend logic.
- Use Context7 for up-to-date docs on Prisma 7 and Next.js 16.

## Commands

```bash
pnpm install
docker compose up -d db                 # Postgres 16 (user/pass/db: hullops)
pnpm -r lint                            # api: oxlint --type-aware; web: eslint
pnpm --filter api typecheck             # tsc over src, tests and prisma/ (Jest and nest build skip test types)
pnpm -r test
pnpm -r build
pnpm --filter api start:dev             # API on :4000 (or $PORT)
pnpm --filter web dev                   # web on :3000

# API tests use ESM Jest, so always run them through the package scripts
pnpm --filter api test -- src/app.controller.spec.ts   # single file
pnpm --filter api test -- -t "should return"           # by test name
pnpm --filter api test:e2e               # uses <db>_test (e.g. hullops_test), created and migrated automatically

# Prisma (from apps/api)
pnpm exec prisma migrate dev --name <name>
pnpm exec prisma generate
pnpm exec prisma db seed                # demo data (prisma/seed-data.ts); password for all seed users: hullops-dev
```

CI (`.github/workflows/ci.yml`) runs install → `prisma generate` → `prisma migrate deploy` → lint → test → build against a Postgres service.

## Prisma 7 notes

- The config file is `apps/api/prisma7.config.ts`, not the default name. It loads `DATABASE_URL` from `apps/api/.env`, so the `datasource` block in the schema has no `url`.
- The generator is `prisma-client` with output to `apps/api/src/generated/prisma` (gitignored; inside `src` so the Nest build, which compiles only `src`, includes it). Import the client from there, not from `@prisma/client`. Regenerate after cloning or after any schema change.
- Prisma 7 needs a driver adapter (e.g. `@prisma/adapter-pg`) to connect at runtime.
- Prisma agent skills are vendored in `apps/api/.claude/skills/`.

## Auth (`apps/api/src/auth/`)

- A global `AuthGuard` requires a JWT (`Authorization: Bearer …`) on every endpoint. Mark open endpoints with `@Public()`, restrict roles with `@Roles('PROJECT_LEAD')`, and get the user with `@CurrentUser()` (all in `auth-context.ts`).
- `PrismaService` omits `User.passwordHash` by default; only the login query asks for it with `omit: { passwordHash: false }`. Never add it to a GraphQL type.
- e2e tests log in through `test/auth-helpers.ts` (`createUserAndLogin`, `graphql(app, token)`).

## Data model (`apps/api/prisma/schema.prisma`)

- `Order` is the central entity. It belongs to a `Vessel` and a creating `User`, and has a `serviceType` and a `status` (`PLANNED` → `IN_PROGRESS` → `DONE`).
- Service-specific 1:1 details: `CleaningDetails` or `ProtectionDetails` (holds the kind, the materials list, and fields that apply only to coatings). The database doesn't check that these match `serviceType`, so application code must.
- `OrderAssignment`: the team on an order (User ↔ Order). `User.role` is `PROJECT_LEAD` or `WORKER`.
- `StatusUpdate`: the order's history log, with optional `Photo`s (stored by object-storage key).
- "Overdue" (`dueDate < now && status != DONE`) is computed when needed, never stored.
