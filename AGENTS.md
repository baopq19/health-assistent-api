## Learned User Preferences

- Prefer Prisma guidance aligned with the latest Prisma 7 docs, especially around `prisma.config.ts` and `PrismaClient` constructor config (adapter vs Accelerate).
- Prefer README instructions that are “first time clone” friendly (prereqs, one-time setup, then run/dev commands).
- New to Prisma; value clear mental models for relations (join tables like user↔product purchases/subscriptions) and how schema splitting works.

## Learned Workspace Facts

- Workspace `health-assistant-api` is a Bun + TypeScript (ESM) backend.
- Stack includes Fastify, tRPC, Prisma 7, and PostgreSQL (via `docker compose`).
- Prisma Migrate is configured via `prisma.config.ts`; connection URLs are not stored in `prisma/schema.prisma`.
