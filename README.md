# health-assistant-api

## First time setup (fresh clone)

### Prereqs

- Bun installed (`bun --version`)
- Docker Desktop running (`docker --version`)

### 1) Install dependencies

```bash
bun install
```

### 2) Configure environment variables

Copy/update `.env` (already committed in this repo) and ensure `DATABASE_URL` matches your local Postgres.

Default local value:

```bash
DATABASE_URL="postgresql://myuser:mypassword@localhost:5432/mydb"
```

### 3) Start Postgres

```bash
docker compose up -d
```

### 4) Create tables (migrations) + generate client

```bash
bun run db:migrate -- --name init
bun run db:generate
```

## Run (dev)

```bash
bun run dev
```

Server listens on `http://127.0.0.1:3000` by default.

### Quick checks

- `GET /healthz`
- tRPC query `health` via GET:
  - `http://127.0.0.1:3000/trpc/health?input=%7B%7D`

PowerShell:

```powershell
(Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000/healthz).Content
(Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:3000/trpc/health?input=%7B%7D').Content
```

## Common commands

- **DB**: `docker compose down` (stop), `docker compose up -d` (start)
- **Migrations**: `bun run db:migrate`
- **Prisma Studio**: `bun run db:studio`

