// src/lib/auth.ts
import { Auth, type AuthConfig } from '@auth/core';
import type { Session, User } from '@auth/core/types';
import { D1Adapter } from '@auth/d1-adapter';
import type { RuntimeEnv } from '../env.d';

/**
 * Get the adapter for Auth.js using D1
 */
export const getAdapter = (env: RuntimeEnv) => {
  return D1Adapter(env.DB);
};

/**
 * Helper function to get the current session from a request.
 * This creates a clean abstraction over Auth.js's internals.
 */
export async function getSession(request: Request, env: RuntimeEnv): Promise<Session | null> {
  try {
    // Create a fake request to the auth API route that requests the session
    const sessionUrl = new URL(request.url);
    sessionUrl.pathname = '/api/auth/session';
    
    // Clone the request to maintain headers (including cookies)
    const sessionRequest = new Request(sessionUrl.toString(), {
      method: 'GET',
      headers: request.headers
    });
    
    // Create auth options with the proper environment
    const authOptions: AuthConfig = {
      trustHost: true,
      secret: env.AUTH_SECRET,
      session: { strategy: 'database' },
      providers: [], // Add empty providers array to satisfy AuthConfig requirement
      adapter: D1Adapter(env.DB)
    };
    
    // Call Auth.js directly
    const response = await Auth(sessionRequest, authOptions);
    
    // Parse the response to get the session
    if (response.status === 200) {
      const data = await response.json();
      return data as Session;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
}

/**
 * Helper function to check if a request is authenticated
 */
export async function isAuthenticated(request: Request, env: RuntimeEnv): Promise<boolean> {
  const session = await getSession(request, env);
  return !!session?.user;
}

/**
 * Helper function to get the current user ID from a session
 * Returns null if not authenticated
 */
export async function getCurrentUserId(request: Request, env: RuntimeEnv): Promise<string | null> {
  const session = await getSession(request, env);
  return session?.user?.id || null;
}

/**
 * Helper function to get the current user from a session
 * Returns null if not authenticated
 */
export async function getCurrentUser(request: Request, env: RuntimeEnv): Promise<User | null> {
  const session = await getSession(request, env);
  return session?.user || null;
}

/**
 * Create a redirect response for authentication
 */
export function createAuthRedirect(redirectTo: string, error?: string): Response {
  const url = new URL('/auth/signin', 'http://localhost');
  url.searchParams.set('redirect', redirectTo);
  
  if (error) {
    url.searchParams.set('error', error);
  }
  
  return new Response(null, {
    status: 302,
    headers: {
      Location: url.pathname + url.search
    }
  });
}

/**
 * Middleware function to ensure a route is authenticated
 */
export async function requireAuth(
  request: Request, 
  env: RuntimeEnv, 
  redirectOnFailure = true
): Promise<{ userId: string } | Response | null> {
  const session = await getSession(request, env);
  
  if (!session?.user?.id) {
    if (redirectOnFailure) {
      const url = new URL(request.url);
      return createAuthRedirect(url.pathname + url.search, 'Unauthorized');
    }
    return null;
  }
  
  return { userId: session.user.id };
}