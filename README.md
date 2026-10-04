# HullOps

[![CI](https://github.com/MScheltjens/hullops/actions/workflows/ci.yml/badge.svg)](https://github.com/MScheltjens/hullops/actions/workflows/ci.yml)

HullOps is a planning tool for subcontractors who work on shipyards. Project leads plan cleaning and protection jobs on vessels, put a team on each job, and follow its progress until it's done.

> **Status:** early development. The API has a database layer, a GraphQL setup and vessel management. Orders, users and the web frontend are next (see [Roadmap](#roadmap)).

## The domain

Subcontractors on a shipyard do two kinds of work, which can run at the same time on the same vessel:

- **Cleaning**: e.g. high-pressure cleaning of a hull, or cleaning a deck or interior.
- **Protection**: shielding parts of the ship while other trades work nearby. There are four kinds:
  - **Enclosure**: e.g. wooden boxes built around machines.
  - **Covering**: e.g. foil or tarpaulins.
  - **Floor protection**: protects the deck or floor.
  - **Coating**: has a target layer thickness.

Protection uses materials such as OSB (standard or fire-resistant), Proplex (3 mm or HD), and glass fiber fabric ("Mahlglas"), which protects against fire and welding sparks.

Each job is an **order** for one vessel. An order moves from `PLANNED` to `IN_PROGRESS` to `DONE`, has a team of workers, and keeps a history of status updates with photos. An order is **overdue** when its due date has passed and it isn't done yet.

## Tech stack

| Part | Technology |
|---|---|
| API ([`apps/api`](apps/api)) | NestJS, GraphQL (Apollo, code-first), Prisma 7, PostgreSQL 16 |
| Web ([`apps/web`](apps/web)) | Next.js 16 (App Router), React 19, Tailwind CSS v4 |
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
- http://localhost:3000: the web app

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

## Roadmap

- [x] Monorepo, CI, data model
- [x] Prisma + GraphQL setup, vessel management
- [x] Orders: create with cleaning or protection details, status flow, team assignment, overdue flag
- [x] Seed data for demos
- [ ] Authentication and roles (project lead / worker)
- [ ] Web frontend: order overview, planning, order details
- [ ] Status updates with photo uploads
