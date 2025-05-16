// src/functions/api/auth/[...auth].ts
import { Auth, type AuthConfig } from "@auth/core";
import type {
  Account,
  Profile,
  User as AuthCoreUserType,
  Session as AuthCoreSessionType
} from "@auth/core/types";
import type { AdapterUser } from "@auth/core/adapters";
import type { JWT } from "@auth/core/jwt";
import { D1Adapter } from "@auth/d1-adapter";
import GitHub from "@auth/core/providers/github";
import Credentials from "@auth/core/providers/credentials";
import type { APIContext } from "astro";
import { verify } from "@node-rs/argon2";
import type { RuntimeEnv } from "../../../env";

/**
 * Creates the authentication options for Auth.js
 * Exported for use in tests and other areas of the application
 */
export function createAppAuthOptions(env: RuntimeEnv): AuthConfig {
  if (!env.DB) {
    throw new Error("D1 Database (DB) binding not available in environment.");
  }
  if (!env.AUTH_SECRET) {
    throw new Error("AUTH_SECRET not defined in environment.");
  }

  return {
    adapter: D1Adapter(env.DB),
    providers: [
      GitHub({
        clientId: env.GITHUB_CLIENT_ID || "",
        clientSecret: env.GITHUB_CLIENT_SECRET || "",
      }),
      Credentials({
        name: "Credentials",
        credentials: {
          email: { label: "Email", type: "text" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials, request) {
          if (!credentials?.email || !credentials.password) return null;
          const email = String(credentials.email).toLowerCase();
          const password = String(credentials.password);

          try {
            const existingUser = await env.DB
              .prepare(
                "SELECT id, password_hash, email, name FROM users WHERE email = ? LIMIT 1"
              )
              .bind(email)
              .first<{
                id: string;
                password_hash: string;
                email: string;
                name?: string | null;
              }>();

            if (!existingUser?.password_hash) return null;

            // Verify the password
            const valid = await verify(
              existingUser.password_hash,
              password
            );
            if (!valid) return null;

            return {
              id: existingUser.id,
              email: existingUser.email,
              name: existingUser.name ?? undefined,
            };
          } catch (err) {
            console.error("Auth error:", err);
            return null;
          }
        },
      }),
    ],
    secret: env.AUTH_SECRET,
    session: { strategy: "database" },
    pages: { 
      signIn: "/auth/signin",
      signOut: "/auth/signout",
      error: "/auth/error",
      verifyRequest: "/auth/verify-request",
    },
    callbacks: {
      async session({
        session,
        token,
        user,
      }: {
        session: AuthCoreSessionType;
        token: JWT;
        user?: AdapterUser;
      }) {
        if (session.user) {
          session.user.id = token.sub || user?.id || session.user.id;
        }
        return session;
      },
      async jwt({
        token,
        user,
      }: {
        token: JWT;
        user?: AdapterUser | AuthCoreUserType;
      }) {
        if (user) {
          token.sub = user.id;
        }
        return token;
      },
    },
    debug: process.env.NODE_ENV === "development",
    trustHost: true,
  };
}

/**
 * GET handler for Auth.js
 */
export async function GET(context: APIContext) {
  return Auth(context.request, createAppAuthOptions(context.locals.runtime.env));
}

/**
 * POST handler for Auth.js
 */
export async function POST(context: APIContext) {
  return Auth(context.request, createAppAuthOptions(context.locals.runtime.env));
}