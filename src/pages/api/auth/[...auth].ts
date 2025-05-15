// src/pages/api/auth/[...auth].ts
import type { APIRoute, APIContext } from 'astro';
import { Auth, type AuthConfig } from '@auth/core';
import CredentialsProvider from '@auth/core/providers/credentials';
import { D1Adapter } from '@auth/d1-adapter';
import { verify as argonVerify } from '@node-rs/argon2';
import type { RuntimeEnv } from '../../../env.d';

// Type for the context, ensuring App.Locals (which includes runtime.env) is used
type AuthHandlerContext = APIContext;

export const GET: APIRoute = async (context: AuthHandlerContext) =>
  handleAuth(context.request, context.locals);

export const POST: APIRoute = async (context: AuthHandlerContext) =>
  handleAuth(context.request, context.locals);

async function handleAuth(request: Request, locals: App.Locals) {
  const env = locals.runtime?.env;

  if (!env?.DB) {
    console.error("[Auth API Route] D1 Database (DB) binding not found in locals.runtime.env.");
    return new Response("Internal Server Error: DB configuration missing.", { status: 500 });
  }
  if (!env?.AUTH_SECRET) {
    console.error("[Auth API Route] AUTH_SECRET not found in locals.runtime.env.");
    return new Response("Internal Server Error: Auth secret configuration missing.", { status: 500 });
  }

  const runtimeEnv = env as RuntimeEnv;

  const authOptions: AuthConfig = {
    providers: [
      CredentialsProvider({
        name: 'Credentials',
        credentials: {
          email: { label: 'Email', type: 'email', placeholder: 'your@email.com' },
          password: { label: 'Password', type: 'password' },
        },
        async authorize(credentials) {
          // Type guard for credentials
          if (
            !credentials ||
            typeof credentials.email !== 'string' || // Check type directly
            typeof credentials.password !== 'string' // Check type directly
          ) {
            console.warn('[Auth Authorize] Invalid credentials format or missing fields.');
            return null;
          }

          const db = runtimeEnv.DB;
          let userRow: { id: string; email: string; name: string | null; password_hash: string; } | null = null;

          try {
            userRow = await db
              .prepare('SELECT id, email, name, password_hash FROM users WHERE email = ? LIMIT 1')
              .bind(credentials.email) // Now type-safe
              .first();
          } catch (e: any) {
            console.error('[Auth Authorize] Database error fetching user:', e.message, e.cause);
            return null;
          }

          if (!userRow || !userRow.password_hash) {
            console.log(`[Auth Authorize] User not found or password_hash missing for email: ${credentials.email}`);
            return null;
          }

          const isValidPassword = await argonVerify(userRow.password_hash, credentials.password); // Now type-safe

          if (!isValidPassword) {
            console.log(`[Auth Authorize] Invalid password for user: ${credentials.email}`);
            return null;
          }
          return { id: userRow.id, email: userRow.email, name: userRow.name };
        },
      }),
    ],
    adapter: D1Adapter(runtimeEnv.DB),
    session: { strategy: 'database' },
    pages: { signIn: '/auth/signin' },
    secret: runtimeEnv.AUTH_SECRET,
    callbacks: {
      async session({ session, user }) {
        if (session.user && user?.id) {
          (session.user as any).id = user.id;
        }
        return session;
      },
    },
  };
  return Auth(request, authOptions);
}

// Exporting this for testing purposes
export const createAppAuthOptions = (envForTest: RuntimeEnv): AuthConfig => {
  const options: AuthConfig = {
    providers: [
      CredentialsProvider({
        name: 'Credentials',
        // Define credentials structure for proper typing of the 'credentials' param in authorize
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(credentials) {
          // Type guard for credentials
          if (!credentials || typeof credentials.email !== 'string' || typeof credentials.password !== 'string') {
            return null;
          }
          const db = envForTest.DB;
          const userRow: { id: string; email: string; name: string | null; password_hash: string; } | null = await db.prepare('SELECT id, email, name, password_hash FROM users WHERE email = ? LIMIT 1').bind(credentials.email).first();
          if (!userRow || !userRow.password_hash) return null;
          const isValid = await argonVerify(userRow.password_hash, credentials.password);
          if (!isValid) return null;
          return { id: userRow.id, email: userRow.email, name: userRow.name };
        }
      })
    ],
    adapter: D1Adapter(envForTest.DB),
    secret: envForTest.AUTH_SECRET,
    session: { strategy: 'database' },
    pages: { signIn: '/auth/signin' },
    callbacks: { /* ... */ }
  };
  return options;
};
