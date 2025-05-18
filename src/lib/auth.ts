// src/lib/auth.ts
import { D1Adapter } from "@auth/d1-adapter";
import Credentials from "@auth/core/providers/credentials";
import type { AuthConfig, User as AuthJsUser } from "@auth/core/types";
import type { RuntimeEnv } from "../env.d";
import { verifyPassword as verifyArgon2Password } from "./passwordUtils";

// Type augmentation for AdapterUser to include role property
declare module "@auth/core/adapters" {
  interface AdapterUser {
    role?: string;
  }
}

// Your application‐specific User shape
export interface AppUser extends AuthJsUser {
  id: string;
  role?: string;
}

export const getAuthConfig = (runtimeEnv: RuntimeEnv): AuthConfig => {
  if (!runtimeEnv?.DB || !runtimeEnv.AUTH_SECRET) {
    console.error(
      "FATAL: Missing DB or AUTH_SECRET in runtimeEnv for Auth.js configuration."
    );
    throw new Error(
      "Auth configuration is missing necessary environment variables."
    );
  }

  return {
    adapter: D1Adapter(runtimeEnv.DB),
    secret: runtimeEnv.AUTH_SECRET,

    providers: [
      Credentials({
        id: "credentials",
        name: "Email & Password",
        credentials: {
          email: { label: "Email", type: "email", placeholder: "you@example.com" },
          password: { label: "Password", type: "password" }
        },
        async authorize(credentials): Promise<AppUser | null> {
          if (
            !credentials ||
            typeof credentials.email !== "string" ||
            typeof credentials.password !== "string"
          ) {
            console.warn("Authorize(): invalid credentials format.");
            return null;
          }

          const { email, password } = credentials;
          try {
            const userRecord = await runtimeEnv.DB.prepare(
              `SELECT id, email, name, password_hash, role
               FROM users
               WHERE email = ?1
               LIMIT 1`
            )
            .bind(email)
            .first<{
              id: string;
              email: string;
              name?: string;
              password_hash: string;
              role?: string;
            }>();

            if (!userRecord) {
              console.log(`Authorize(): no user found for ${email}`);
              return null;
            }

            const isValid = await verifyArgon2Password(
              userRecord.password_hash,
              password
            );
            if (!isValid) {
              console.log(`Authorize(): invalid password for ${email}`);
              return null;
            }

            return {
              id: userRecord.id,
              email: userRecord.email,
              name: userRecord.name ?? undefined,
              role: userRecord.role ?? "user",
            };
          } catch (err) {
            console.error("Authorize() error:", err);
            return null;
          }
        },
      }),
      // add other providers (GitHub, Google, etc.) here as needed
    ],

    session: {
      strategy: "jwt",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    },

    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          token.userId = user.id;
          // Safer access to role property using type guard
          if ('role' in user && user.role) {
            token.role = user.role;
          }
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user) {
          // Using type assertion after assigning to avoid direct property access errors
          session.user.id = token.userId as string;
          if (token.role) {
            // Using optional chaining and type assertion for safety
            session.user.role = token.role as string;
          }
        }
        return session;
      },
    },

    pages: {
      signIn: "/auth/signin",
      signOut: "/auth/signout",
      error: "/auth/error",
    },

    debug: runtimeEnv.ENVIRONMENT === "development",
  };
};