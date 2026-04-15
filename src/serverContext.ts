import type { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "./db/prisma";
import { authService } from "./auth/workosAuth";
import type { TrpcContext } from "./trpc";

function toWebRequest(req: FastifyRequest): Request {
  const origin = req.headers["x-forwarded-proto"] && req.headers["x-forwarded-host"]
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

export async function createContext(opts: { req: FastifyRequest; res: FastifyReply }): Promise<TrpcContext> {
  const webReq = toWebRequest(opts.req);
  const { auth, refreshedSessionData } = await authService.withAuth(webReq);

  if (refreshedSessionData) {
    const { headers } = await authService.saveSession(undefined, refreshedSessionData);
    const setCookie = headers?.["Set-Cookie"];
    if (setCookie) opts.res.header("Set-Cookie", setCookie);
  }

  const internalUserId = auth.user
    ? (
        await prisma.user.upsert({
          where: { workosUserId: auth.user.id },
          update: {
            email: auth.user.email,
            name: [auth.user.firstName, auth.user.lastName].filter(Boolean).join(" ") || null,
          },
          create: {
            email: auth.user.email,
            name: [auth.user.firstName, auth.user.lastName].filter(Boolean).join(" ") || null,
            workosUserId: auth.user.id,
          },
          select: { id: true },
        })
      ).id
    : null;

  return {
    prisma,
    userId: internalUserId,
    workosAuth: auth,
  };
}

