// src/middleware.ts
import type { MiddlewareHandler } from "astro";
import { parse } from "cookie";

export const onRequest: MiddlewareHandler = async (context, next) => {
  try {
    // Pull env from Cloudflare runtime bindings
    const env = context.locals.runtime.env;

    const cookies = parse(context.request.headers.get("cookie") || "");
    const sessionCookieName = "authjs.session-token";
    const secureSessionCookieName = "__Secure-authjs.session-token";
    const sessionToken =
      cookies[sessionCookieName] ||
      cookies[secureSessionCookieName] ||
      cookies["next-auth.session-token"] ||
      cookies["__session"];

    // Reset any existing locals
    context.locals.user = null;
    context.locals.session = null;

    if (sessionToken && env.DB) {
      const db = env.DB;
      const now = Math.floor(Date.now() / 1000);

      const sessionData = await db
        .prepare(
          "SELECT userId, expires FROM sessions WHERE sessionToken = ? AND expires > ?"
        )
        .bind(sessionToken, now)
        .first<{ userId: string; expires: number }>();

      if (sessionData) {
        const userRow = await db
          .prepare("SELECT id, name, email FROM users WHERE id = ?")
          .bind(sessionData.userId)
          .first<{
            id: string;
            name: string | null;
            email: string | null;
          }>();

        if (userRow) {
          context.locals.user = {
            id: userRow.id,
            name: userRow.name,
            email: userRow.email,
          };
          context.locals.session = {
            user: context.locals.user,
            expires: new Date(sessionData.expires * 1000).toISOString(),
          };
        }
      }
    }
  } catch (error) {
    console.error("Error in auth middleware:", error);
    context.locals.user = null;
    context.locals.session = null;
  }

  const protectedRoutes = /^\/app\/.*/;
  const url = new URL(context.request.url);

  if (protectedRoutes.test(url.pathname) && !context.locals.session) {
    const callbackUrl = encodeURIComponent(url.pathname + url.search);
    return context.redirect(`/auth/signin?callbackUrl=${callbackUrl}`);
  }

  return next();
};
