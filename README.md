# HullOps

[![CI](https://github.com/MScheltjens/hullops/actions/workflows/ci.yml/badge.svg)](https://github.com/MScheltjens/hullops/actions/workflows/ci.yml)

HullOps is a planning tool for subcontractors who work on shipyards. Project leads plan cleaning and protection jobs on vessels, put a team on each job, and follow its progress until it's done.

**Live demo:** https://hullops.vercel.app (demo data only; log in with a seeded demo user, see [Getting started](#getting-started)). Meant for a phone: open it there and add it to the home screen.

> **Status:** in development. The API covers vessels, orders, teams, comments and login with roles. The web app, in English and German, has login, the order overview, order details with status updates, comments and team management, and creating orders. It is mobile first and installable as a PWA (see [Roadmap](#roadmap)).

## The domain

Subcontractors on a shipyard do two kinds of work, which can run at the same time on the same vessel:

- **Cleaning**: e.g. high-pressure cleaning of a hull, or cleaning a deck or interior.
- **Protection**: shielding parts of the ship while other trades work nearby. There are four kinds:
  - **Enclosure**: e.g. wooden boxes built around machines.
  - **Covering**: e.g. foil or tarpaulins.
  - **Floor protection**: protects the deck or floor.
  - **Coating**: has a target layer thickness.

Protection uses materials such as OSB (standard or fire-resistant), Proplex (3 mm or HD), and glass fiber fabric, which protects against fire and welding sparks.

Each job is an **order** for one vessel. An order moves from `PLANNED` to `IN_PROGRESS` to `DONE`, has a team of workers, and keeps a history of status updates with photos. An order is **overdue** when its due date has passed and it isn't done yet.

## Why it is built this way

HullOps comes from a real way of working. On the yard, planning and all communication run through WhatsApp, and Crewmeister holds working hours and leave. The goal is to move the **planning** out of chat threads into one place, and keep WhatsApp for what is genuinely live. The choices below follow from that.

**Who uses it, and why there are four roles**

| Role | Who | Why it exists |
|---|---|---|
| Project lead | The office | Plans orders, passes on what the shipyard tells them, manages teams, and invoices the customer. |
| Team lead (*Vorarbeiter*) | On the yard, one per vessel | Knows what his vessel needs, so he asks for workers for the coming week himself, including by name. |
| Worker | On the yard | Reads the plan and updates the status of his orders. |
| HR | Office | Hires people, so creates workers, team leads and project leads (recording absence is planned). Cannot create or touch administrators or other HR, and sees no orders, vessels or staffing. |
| Administrator | Technical | Manages accounts. Reads everything but doesn't run the work, so responsibilities stay separate. |

The shipyard's own people (the customer's side) have **no login**. The project lead enters what they say as free-text comments, so the app doesn't need accounts for other companies and stays single-tenant.

**Decisions and their reasons**

- **Mobile first, installable as a PWA.** Most use is on a phone on the yard: big tap targets, cards instead of wide tables, and "add to home screen" instead of an app store. There is no service worker because there is no offline mode.
- **Workers can be requested by name.** Keeping the same people on the same vessel is better than rotating them, so the weekly request carries names, is prefilled from the week before, and warns when one worker is asked for by two vessels.
- **The API is language-neutral.** It sends codes (`CLEANING`, `IN_PROGRESS`) and the web app translates them, English and German, because it is mainly used in Germany.
- **Validation lives in the API.** The web forms only reshape input; the API checks every rule and reports all violations at once. Repeating the rules in the browser would let the two drift apart.
- **The login token never reaches the browser.** Pages render on the server and call the API with the token from an httpOnly cookie.
- **Rights are checked where the data is.** The pages hide what you may not do, but the API and the Server Actions enforce it. Deactivating a user cuts off their existing token at once.
- **Computed, not stored:** "overdue" is worked out when needed, so it can't go stale.
- **Demo data is public on purpose.** The seeded users share one published password, and the seeded administrator can lock the others out. That is fine for a demo (re-seeding restores it) and is documented in [DEPLOYMENT.md](DEPLOYMENT.md); anything real starts without the seed.

**More detail:** [docs/ux.md](docs/ux.md) describes who uses the app, the bar it is held to (any new user can use it after an hour of explanation) and the main flows with sketches. [docs/caching.md](docs/caching.md) says what is cached, what is not and why.

**Planned: leave and sickness from Crewmeister**

Workers have a profile in both systems, and you can't plan someone who is on leave. The plan is a small "availability" model in HullOps that the planning page uses (unavailable workers are marked, and a request by name for someone absent gives a warning), fed by interchangeable sources behind one interface: a demo source with sample data, and a Crewmeister source using its V3 absence API.

- **Not wired to a live Crewmeister account in the public demo**: Crewmeister's developer portal describes no sandbox (developers use the same production API as the apps), so it would need a real account with real employee data.
- **Only "unavailable" is stored, never the reason.** Sick leave is health data, and a planner needs to know *that* someone is away, not *why*.
- **A local copy, not live calls.** A sync writes absences into HullOps' own database, so the planning stays fast and keeps working when Crewmeister is slow or down.
- **Profiles are matched on email**, with an overview of who is and isn't linked.

This is not built yet; see the [Roadmap](#roadmap).

## Tech stack

| Part | Technology |
|---|---|
| API ([`apps/api`](apps/api)) | NestJS, GraphQL (Apollo, code-first), Prisma 7, PostgreSQL 16 |
| Web ([`apps/web`](apps/web)) | Next.js 16 (App Router, Server Actions), React 19, Tailwind CSS v4, next-intl (English/German) |
| Tooling | pnpm workspaces, TypeScript, Jest, oxlint / ESLint, GitHub Actions |

## Getting started

You need **Node 24**, **pnpm 12** and **Docker**.

```bash
pnpm install                              # install all workspaces
docker compose up -d db                   # start Postgres 16 on :5432

cp apps/api/.env.example apps/api/.env    # point the API at that database
cd apps/api
pnpm exec prisma migrate deploy           # create the tables
pnpm exec prisma generate                 # generate the typed database client
pnpm exec prisma db seed                  # optional: demo users, vessels and orders
cd ../..

pnpm dev                                  # API on :4000, web on :3000
```

Then open:

- http://localhost:4000/graphql: GraphiQL, to explore and try the API
- http://localhost:3000: the web app. Log in with a demo user from the seed, e.g. `lena.hoffmann@hullops.example` (password `hullops-dev`).

## Editor setup

The repo includes settings for VS Code and Cursor in [`.vscode/`](.vscode). When you open the project, the editor suggests the recommended extensions:

- **Language support:** Prisma, GraphQL, Tailwind CSS
- **Linting and formatting:** ESLint for the web app, Oxc (oxlint) for the API, and Prettier, which formats on save
- **Jest:** reruns the API's unit tests for the files you save and shows ✓ and ✗ next to each test
- **Tooling:** Docker containers, GitHub Actions, `.env` highlighting

[`graphql.config.yml`](graphql.config.yml) points the GraphQL extension at the API's generated schema, so queries get autocomplete and validation.

## Repository layout

```
hullops/
├── apps/
│   ├── api/            NestJS GraphQL API and the Prisma schema; see apps/api/README.md
│   └── web/            Next.js frontend; see apps/web/README.md
├── .github/workflows/  CI
├── .vscode/            editor settings and recommended extensions
└── docker-compose.yml  local Postgres
```

## Common commands

Run these from the repository root:

```bash
pnpm dev                     # run API and web in parallel
pnpm -r lint                 # lint all apps
pnpm -r test                 # unit tests
pnpm --filter api test:e2e   # API end-to-end tests (use their own hullops_test database)
pnpm -r build                # production builds
```

## CI

Every push to `main` and every pull request runs [the CI workflow](.github/workflows/ci.yml) against a throwaway Postgres container. It installs dependencies, generates the Prisma client, applies migrations, then runs lint, unit tests, API end-to-end tests and builds.

## Deployment

The web app goes on Vercel, the API runs as a container (see [apps/api/Dockerfile](apps/api/Dockerfile)) next to a managed PostgreSQL. Steps, environment variables and caveats are in [DEPLOYMENT.md](DEPLOYMENT.md).

## Roadmap

- [x] Monorepo, CI, data model
- [x] Prisma + GraphQL setup, vessel management
- [x] Orders: create with cleaning or protection details, status flow, team assignment, overdue flag
- [x] Seed data for demos
- [x] Authentication and roles (project lead / worker / administrator)
- [x] Administrator: add users, change names, roles and service areas, reset passwords, deactivate and reactivate (`admin@hullops.example` in the demo data)
- [x] Web: login, order overview, English and German
- [x] Web: create orders, order details with comments, status updates and team assignment
- [x] Mobile first, installable as a PWA
- [x] Deployment: web on Vercel, API and PostgreSQL on Railway
- [ ] Web: vessel management
- [x] Weekly staffing: the foreman's request per vessel and week, with workers asked for by name (prefilled from the week before, with a warning when one worker is asked for by two vessels), entered by the project lead
- [x] Web: vessel management (project leads add vessels; everyone can see them)
- [ ] Availability (leave and sickness) in the planning, with a demo source and a Crewmeister source
- [ ] Status updates with photo uploads
