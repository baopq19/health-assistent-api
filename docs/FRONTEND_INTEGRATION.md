# Frontend Integration Guide (Health Assistant API)

This is the “copy/paste” guide for integrating the frontend with the backend.

## Base URLs

- **Dev API**: `http://127.0.0.1:3000`
- **tRPC**: `/trpc`
- **Health**: `GET /healthz`

## Auth model (cookies)

The API uses **WorkOS AuthKit sessions via HTTP-only cookies**.

- **Browser**: every request must include cookies (`credentials: "include"`).
- **CORS**: enabled with credentials; the backend accepts any origin in dev.

If a session is refreshed server-side, the backend returns a `Set-Cookie` header; browsers handle this automatically when `credentials: "include"` is set.

## “Am I logged in?”

Call `auth.getSession` (public). If `user` is `null`, the user is not authenticated yet.

## Recommended client setup (tRPC)

If you’re using `@trpc/client` directly, you can call procedures over HTTP with a single base URL.

Example (minimal, framework-agnostic):

```ts
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "<backend>/src/router"; // or import from shared package if you have one

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: "http://127.0.0.1:3000/trpc",
      fetch(url, options) {
        return fetch(url, { ...options, credentials: "include" });
      },
    }),
  ],
});
```

Notes:
- If you **don’t** have shared types, you can still call the raw endpoint with `fetch` (see examples in `docs/FRONTEND_HANDOFF_CHAT_DASHBOARD.md`).
- If you use React Query + `@trpc/react-query`, the key requirement is still the same: make sure `credentials: "include"` is set on the link.

## Current procedure map

- **Auth**
  - `auth.getSession` (public)
  - `auth.registerDeviceToken` (authed)
  - `auth.unregisterDeviceToken` (authed)
- **User**
  - `user.getProfile` (authed)
  - `user.updateProfile` (authed)
  - `user.getNotificationPreferences` (authed)
  - `user.updateNotificationPreferences` (authed)
- **Chat**
  - `chat.createThread` (authed)
  - `chat.listThreads` (authed, cursor pagination)
  - `chat.getThread` (authed)
  - `chat.sendMessage` (authed, synchronous AI reply)
- **Dashboard**
  - `dashboard.getHome` (authed)

For Chat + Dashboard shapes and example calls, see `docs/FRONTEND_HANDOFF_CHAT_DASHBOARD.md`.

## Error handling expectations

- **Not logged in**: tRPC error code `UNAUTHORIZED` → treat as “redirect to login / show login screen”.
- **AI misconfigured**: `chat.sendMessage` can return `PRECONDITION_FAILED` if `GOOGLE_GENAI_API_KEY` is missing on the backend.

## Local dev checklist (backend)

Backend reads env vars from `.env`. See `.env.example` for the full list.

- **Server**: `PORT` (default 3000)
- **DB**: `DATABASE_URL`
- **Auth**: WorkOS variables (`WORKOS_*`)
- **Chat AI**: `GOOGLE_GENAI_API_KEY`

