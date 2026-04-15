import { configure, createAuthService, CookieSessionStorage } from "@workos/authkit-session";

function parseCookieHeader(cookieHeader: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rawVal] = part.trim().split("=");
    if (!rawKey) continue;
    const key = rawKey;
    const value = rawVal.join("=");
    if (!value) continue;
    out[key] = decodeURIComponent(value);
  }
  return out;
}

class FastifyCookieStorage extends CookieSessionStorage<Request, Response> {
  async getSession(request: Request): Promise<string | null> {
    const cookieHeader = request.headers.get("cookie");
    if (!cookieHeader) return null;
    return parseCookieHeader(cookieHeader)[this.cookieName] ?? null;
  }

  // For our API usage we don't need Response integration here; we persist refreshed cookies
  // manually in `createContext` where we have access to Fastify's reply object.
  protected override async applyHeaders(
    response: Response | undefined,
    headers: Record<string, string>,
  ): Promise<{ response: Response }> {
    const newResponse = response
      ? new Response(response.body, {
          status: response.status,
          headers: new Headers(response.headers),
        })
      : new Response();

    for (const [key, value] of Object.entries(headers)) {
      newResponse.headers.append(key, value);
    }

    return { response: newResponse };
  }
}

configure(key => process.env[key]);

export const authService = createAuthService({
  sessionStorageFactory: config => new FastifyCookieStorage(config),
});

