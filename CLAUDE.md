# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
bun run dev          # Start dev server with file watching (http://127.0.0.1:3000)

# Build & production
bun run build        # Bundle to dist/ (Bun target)
bun run start        # Run built dist/index.js

# Database
bun run db:migrate   # Create and apply migrations (append -- --name <migration_name>)
bun run db:push      # Sync schema without creating a migration file
bun run db:generate  # Regenerate Prisma client after schema changes
bun run db:studio    # Open Prisma Studio GUI

# Infrastructure
docker compose up -d    # Start PostgreSQL container
docker compose down     # Stop PostgreSQL container
```

No test or lint scripts are configured yet.

### First-time setup

```bash
bun install
cp .env.example .env   # then fill in required values
docker compose up -d
bun run db:migrate -- --name init
bun run db:generate
bun run dev
```

Health endpoints: `GET /healthz` and `GET /trpc/health?input=%7B%7D`

## Architecture

### Stack

| Layer | Technology |
|-------|-----------|
| Runtime / package manager | Bun |
| HTTP server | Fastify 5 |
| API layer | tRPC 11 (mounted at `/trpc`) |
| Validation | Zod 4 |
| Auth | WorkOS AuthKit (cookie-based sessions) |
| ORM | Prisma 7 with `@prisma/adapter-pg` |
| Database | PostgreSQL 16 (Docker) |
| AI | Google Gemini (`@google/genai`) |

### Request lifecycle

```
HTTP request
  → Fastify
    → Auth routes (/auth/login, /auth/callback, /auth/logout) handled directly in src/index.ts
    → tRPC plugin → createContext (src/serverContext.ts)
        → WorkOS session extracted from cookie
        → User upserted into DB on every authenticated request
        → { prisma, userId, workosAuth } injected into procedure context
    → Router procedure (src/routers/)
```

### tRPC procedures

- `publicProcedure` — no auth required
- `authedProcedure` — throws UNAUTHORIZED if no session; defined in `src/trpc.ts`

All routers are aggregated in `src/router.ts` and the `AppRouter` type is exported from there for use by clients.

### Prisma 7 conventions

Prisma 7 separates connection config from the schema file:

- **`prisma/schema.prisma`** — models and enums only; no `datasource` connection URL
- **`prisma/prisma.config.ts`** — migrate connection config
- **`src/db/prisma.ts`** — runtime: `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`

Always follow this pattern when adding new Prisma features. Do not add connection URLs to `schema.prisma`.

### Data model overview

- **User** — central identity, keyed by `workosUserId`
- **ChatThread / ChatMessage** — conversation history per user; roles: `USER` | `ASSISTANT`
- **Product / UserProduct** — billing (subscriptions + one-time purchases)
- **DeviceToken / NotificationSettings** — push notification infrastructure (planned)
- All child models cascade-delete when the parent User is deleted

### AI chat flow (`src/ai/chatService.ts`)

1. Fetch all prior messages for the thread from DB
2. Send conversation history + new user message to Gemini
3. Persist the assistant reply to `ChatMessage`
4. Model and prompt are controlled by env vars (`GEMINI_ADVICE_MODEL`, etc.)

### Environment variables

Required for local development (see `.env.example` for full list):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `WORKOS_CLIENT_ID` | WorkOS application client ID |
| `WORKOS_API_KEY` | WorkOS secret key |
| `WORKOS_REDIRECT_URI` | OAuth callback URL |
| `WORKOS_COOKIE_PASSWORD` | Cookie encryption secret (32+ chars) |
| `GOOGLE_GENAI_API_KEY` | Gemini API key (required for chat) |

Planned-but-not-yet-active groups: R2 file storage, Resend email, FCM push notifications, job scheduler.
