// src/middleware.ts
import { defineMiddleware } from "astro:middleware";
import { parse } from "cookie";
import type { RuntimeEnv } from "./env.d";
import type { User, Session } from "@auth/core/types";

export const onRequest = defineMiddleware(async (context, next) => {
  try {
    const env = context.locals.runtime?.env as RuntimeEnv | undefined;
    const cookies = parse(context.request.headers.get("cookie") || "");
    
    // Look for auth-related session token
    const sessionToken = cookies["__session"] || cookies["next-auth.session-token"] || "";
    
    if (sessionToken && env?.DB) {
      // Try to retrieve the session from the database
      const db = env.DB;
      const sessionData = await db
        .prepare("SELECT * FROM sessions WHERE session_token = ? AND expires > ?")
        .bind(sessionToken, Math.floor(Date.now() / 1000))
        .first();
      
      if (sessionData) {
        // If we found a valid session, fetch the associated user
        const userId = sessionData.user_id as string; // Explicitly cast to string
        const userData = await db
          .prepare("SELECT id, name, email FROM users WHERE id = ?")
          .bind(userId)
          .first();
        
        if (userData) {
          // Create properly typed user object with null fallbacks for optional fields
          const user: User = {
            id: userData.id as string,
            name: (userData.name as string | null) ?? null,
            email: (userData.email as string | null) ?? null
          };
          
          // Populate context.locals with the session and user data
          const expiryTime = (sessionData.expires as number) * 1000;
          context.locals.session = {
            user,
            expires: new Date(expiryTime).toISOString()
          } as Session;
          context.locals.user = user;
        }
      }
    }
  } catch (error) {
    console.error("Error in auth middleware:", error);
  }
  
  // Check for protected routes
  const protectedRoutes = /^\/app\/.*/;
  const url = new URL(context.request.url);

  if (protectedRoutes.test(url.pathname)) {
    if (!context.locals.session) {
      // User is not authenticated, redirect to sign-in page
      return context.redirect("/auth/signin");
    }
    // User is authenticated, allow access
  }

  // Continue to the next middleware or route handler
  return next();
});