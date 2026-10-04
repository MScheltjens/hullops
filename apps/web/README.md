# HullOps Web

The frontend of [HullOps](../../README.md), built with Next.js 16 (App Router), React 19 and Tailwind CSS v4.

> **Status:** not started yet. This is still the `create-next-app` starter page. Development begins once the API's order endpoints exist (see the [roadmap](../../README.md#roadmap)).

## Planned features

- **Order overview:** all orders, filterable by vessel, service type and status, with overdue orders highlighted
- **Planning:** create orders with cleaning or protection details and assign the team
- **Order details:** status history with photos, for project leads and workers
- **Vessels:** list and add vessels

The app will talk to the [HullOps API](../api/README.md) over GraphQL.

## Development

```bash
pnpm dev     # http://localhost:3000
pnpm build   # production build
pnpm start   # serve the production build
pnpm lint    # ESLint
```

The API runs on port 4000 by default, so both apps can run together. From the repository root, `pnpm dev` starts both.

## Next.js 16

This version has breaking changes compared with older Next.js releases. Before writing Next.js code, read [`AGENTS.md`](AGENTS.md) and the docs bundled in `node_modules/next/dist/docs/`.

## Structure

```
apps/web/
├── src/app/       App Router: layouts, pages and route handlers
│   ├── layout.tsx root layout
│   ├── page.tsx   home page
│   └── globals.css Tailwind entry point
└── public/        static files
```
