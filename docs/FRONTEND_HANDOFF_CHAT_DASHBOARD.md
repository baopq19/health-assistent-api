# Frontend Handoff — Chat + Dashboard (Health Assistant API)

This doc describes how the frontend should call the current API for:
- **User ↔ AI chat** (threads + messages)
- **Dashboard home** (recent threads now; `AiAdvice` later)

Base URL (dev): `http://127.0.0.1:3000`  
tRPC endpoint: `POST /trpc/<path>` (also supports GET for queries, but POST recommended)
Health check: `GET /healthz` → `{ ok: true }`

## Authentication (required for chat/dashboard)

All `chat.*`, `dashboard.*`, and most `user.*` + `auth.*` endpoints require an authenticated session.

This API expects **WorkOS AuthKit session cookies** to be sent with requests.
- Ensure your HTTP client includes cookies: `credentials: "include"` (fetch) / `withCredentials: true` (axios).
- CORS is configured with `origin: true` + `credentials: true` (any origin allowed, cookies enabled).

Cookie refresh:
- The backend may refresh the session and return a `Set-Cookie` header on any request (handled in `createContext`).
- In the browser, the cookie is stored automatically; you just need `credentials: "include"`.

Session introspection:
- `auth.getSession` is **public** and returns `{ user: null }` if not logged in.

## Procedures

### `auth.getSession` (query, public)

**Input**: none  
**Output**:
- `user`: `null | { id: string; email: string; firstName: string | null; lastName: string | null }`
- `workos.organizationId`: `string | null`

### `chat.createThread` (mutation, authed)

**Input** (optional):
- `title?: string` (1..200)

**Output**:
- `{ thread }`

Thread shape (selected fields):
- `id: string`
- `title: string | null`
- `lastMessageAt: string | null` (ISO)
- `lastMessagePreview: string | null`
- `createdAt: string` (ISO)
- `updatedAt: string` (ISO)

### `chat.listThreads` (query, authed)

**Input** (optional):
- `limit?: number` (1..50, default 20)
- `cursor?: string` (thread id)

**Output**:
- `threads: Thread[]`
- `nextCursor: string | null`

Pagination:
- Pass `cursor=nextCursor` to fetch the next page.

### `chat.getThread` (query, authed)

**Input**:
- `threadId: string`
- `messageLimit?: number` (1..100, default 50)

**Output**:
- `{ thread }` where `thread.messages` is ordered **oldest → newest**

Message shape:
- `id: string`
- `role: "USER" | "ASSISTANT" | "SYSTEM"`
- `content: string`
- `model: string | null` (present on assistant messages)
- `createdAt: string` (ISO)

### `chat.sendMessage` (mutation, authed, sync AI reply)

Creates a USER message, generates an ASSISTANT reply (Gemini), stores it, and updates the thread preview.

**Input**:
- `threadId?: string` (omit to start a new thread)
- `content: string` (1..16000)

**Output**:
- `{ thread, userMessage, assistantMessage }`

Notes:
- This is synchronous; the request latency includes the AI call.

### `dashboard.getHome` (query, authed)

**Input** (optional):
- `threadsLimit?: number` (1..20, default 5)

**Output**:
- `recentThreads: Thread[]` (same selected fields as list)
- `recentAiAdvice: []` (placeholder; will be populated once `AiAdvice` is implemented in Phase 4)

## Example calls

### Fetch `auth.getSession` (browser)

```ts
await fetch("http://127.0.0.1:3000/trpc/auth.getSession", {
  method: "POST",
  credentials: "include",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({}),
}).then(r => r.json());
```

### Send a chat message (browser)

```ts
await fetch("http://127.0.0.1:3000/trpc/chat.sendMessage", {
  method: "POST",
  credentials: "include",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    threadId: undefined,
    content: "I have a headache and mild fever. What should I do?",
  }),
}).then(r => r.json());
```

### Load dashboard home

```ts
await fetch("http://127.0.0.1:3000/trpc/dashboard.getHome", {
  method: "POST",
  credentials: "include",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ threadsLimit: 5 }),
}).then(r => r.json());
```

## Common error shapes
- Unauthenticated calls to authed procedures return a tRPC error with code `UNAUTHORIZED`.
- Missing Gemini API key returns `PRECONDITION_FAILED` from `chat.sendMessage`.

Typical tRPC error envelope (Fastify adapter):
- Errors come back as JSON with an `error` object containing `code` and `message`.
- For debugging, inspect the response body and the HTTP status; treat `UNAUTHORIZED` as “show login”.

## Env vars relevant to these features (backend)
- WorkOS AuthKit session:
  - `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, `WORKOS_REDIRECT_URI`, `WORKOS_COOKIE_PASSWORD`
- Gemini chat:
  - `GOOGLE_GENAI_API_KEY`
