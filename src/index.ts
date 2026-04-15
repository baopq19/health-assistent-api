import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import { appRouter } from "./router";
import { createContext } from "./serverContext";
import { authService } from "./auth/workosAuth";

const PORT = Number(process.env["PORT"] ?? 3000);
const HOST = process.env["HOST"] ?? "0.0.0.0";
const DEFAULT_AUTH_RETURN_TO = process.env["AUTH_RETURN_TO"] ?? process.env["FRONTEND_URL"] ?? "http://127.0.0.1:5173";

function toWebRequest(req: import("fastify").FastifyRequest): Request {
  const origin =
    req.headers["x-forwarded-proto"] && req.headers["x-forwarded-host"]
      ? `${req.headers["x-forwarded-proto"]}://${req.headers["x-forwarded-host"]}`
      : "http://localhost";

  const url = new URL(req.url, origin);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(","));
  }

  return new Request(url.toString(), { headers, method: req.method });
}

function encodeState(obj: unknown): string {
  const json = JSON.stringify(obj);
  const b64 = Buffer.from(json, "utf8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeState<T>(state: string | undefined): T | null {
  if (!state) return null;
  try {
    const b64 = state.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

function extractSetCookie(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (Array.isArray(value) && value.every(v => typeof v === "string")) return value.join(", ");
  return undefined;
}

function getSetCookieFromResult(result: unknown): string | undefined {
  const r = result as any;
  return (
    extractSetCookie(r?.headers?.["Set-Cookie"]) ??
    extractSetCookie(r?.headers?.["set-cookie"]) ??
    extractSetCookie(r?.response?.headers?.get?.("set-cookie")) ??
    extractSetCookie(r?.response?.headers?.get?.("Set-Cookie")) ??
    extractSetCookie(r?.response?.headers?.["set-cookie"]) ??
    extractSetCookie(r?.response?.headers?.["Set-Cookie"])
  );
}

const server = Fastify({
  logger: true,
});

await server.register(cors, {
  origin: true,
  credentials: true,
});

await server.get("/healthz", async () => ({ ok: true }));

// WorkOS AuthKit (cookie sessions)
// Frontend should redirect the browser to these routes.
server.get("/auth/login", async (req, res) => {
  const query = req.query as { returnTo?: string; screenHint?: string } | undefined;
  const returnTo = query?.returnTo ?? DEFAULT_AUTH_RETURN_TO;
  const screenHint = query?.screenHint;

  const state = encodeState({ returnTo });
  const signInUrl = await authService.getSignInUrl({
    state,
    ...(screenHint ? { screenHint } : {}),
  } as any);

  return res.redirect(signInUrl);
});

server.get("/auth/callback", async (req, res) => {
  const query = req.query as { code?: string; state?: string; error?: string; error_description?: string } | undefined;

  // If WorkOS sends an OAuth error, bounce back to the frontend.
  if (query?.error) {
    const stateData = decodeState<{ returnTo?: string }>(query.state);
    const returnTo = stateData?.returnTo ?? DEFAULT_AUTH_RETURN_TO;
    const url = new URL(returnTo);
    url.searchParams.set("auth_error", query.error);
    if (query.error_description) url.searchParams.set("auth_error_description", query.error_description);
    return res.redirect(url.toString());
  }

  const code = query?.code;
  if (!code) return res.status(400).send({ ok: false, error: "Missing `code` query param" });

  const webReq = toWebRequest(req);
  const result = await authService.handleCallback(webReq, undefined, { code, state: query?.state } as any);
  const setCookie = getSetCookieFromResult(result);
  if (setCookie) res.header("Set-Cookie", setCookie);

  const stateData = decodeState<{ returnTo?: string }>(query?.state);
  const returnTo = stateData?.returnTo ?? DEFAULT_AUTH_RETURN_TO;
  return res.redirect(returnTo);
});

server.get("/auth/logout", async (req, res) => {
  const query = req.query as { returnTo?: string } | undefined;
  const returnTo = query?.returnTo ?? DEFAULT_AUTH_RETURN_TO;

  const webReq = toWebRequest(req);
  const { auth } = await authService.withAuth(webReq);

  // Always clear our app session cookie (even if user isn't logged in).
  const cleared = await authService.clearSession(undefined as any);
  const clearCookie = getSetCookieFromResult(cleared);
  if (clearCookie) res.header("Set-Cookie", clearCookie);

  // If we have a WorkOS session, also end it at WorkOS (recommended).
  if ((auth as any)?.user && (auth as any)?.sessionId) {
    const signOut = await authService.signOut((auth as any).sessionId, { returnTo } as any);
    const logoutUrl = (signOut as any)?.logoutUrl as string | undefined;
    const clearCookieHeader = (signOut as any)?.clearCookieHeader as string | undefined;
    if (clearCookieHeader) res.header("Set-Cookie", clearCookieHeader);
    if (logoutUrl) return res.redirect(logoutUrl);
  }

  return res.redirect(returnTo);
});

await server.register(fastifyTRPCPlugin, {
  prefix: "/trpc",
  trpcOptions: {
    router: appRouter,
    createContext,
  },
});

await server.listen({ port: PORT, host: HOST });

