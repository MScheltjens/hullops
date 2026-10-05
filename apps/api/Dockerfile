# syntax=docker/dockerfile:1
#
# The HullOps API as a container. Build from the repository root, because
# the pnpm workspace and its lockfile live there:
#
#   docker build -f apps/api/Dockerfile -t hullops-api .
#
# One stage on purpose: the image keeps the dev dependencies, because
# starting needs the Prisma CLI (to apply migrations) and, for a demo, the
# seed script (tsx). A leaner image would need `prisma` moved to
# dependencies and a separate migration job; not worth it at this size.

FROM node:24-slim

# OpenSSL: needed by Prisma's tooling. corepack provides the pnpm version
# from "packageManager" in the root package.json.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable

# Run as the unprivileged "node" user that the base image provides.
RUN mkdir /app && chown node:node /app
USER node
WORKDIR /app

# Dependencies first, so this layer is cached until a package.json changes.
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=node:node apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter api...

COPY --chown=node:node apps/api apps/api
WORKDIR /app/apps/api
# The Prisma client is generated into src/generated/prisma (gitignored), so it
# must exist before the Nest build compiles src.
RUN pnpm exec prisma generate && pnpm build

ENV NODE_ENV=production
EXPOSE 4000

# Platforms that check health (Fly.io, Railway, Kubernetes, …) can also use
# GET /health; this makes `docker ps` show it too.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Apply pending migrations, then start. With one instance that is safe; with
# several, run `prisma migrate deploy` once per release instead.
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/main"]
