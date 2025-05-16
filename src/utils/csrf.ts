// src/utils/csrf.ts
import Tokens from 'csrf'; // Changed from { Tokens }
import type { APIContext } from 'astro';
import type { RuntimeEnv } from '../env.d'; // Import RuntimeEnv

const tokens = new Tokens();

/**
 * Retrieves the CSRF secret from the environment.
 * Throws an error if the secret is not configured.
 */
function getCsrfSecret(env: RuntimeEnv): string {
  const secret = env.CSRF_SECRET;
  if (!secret) {
    console.error("CSRF_SECRET is not defined in environment variables.");
    // In a production environment, you might want to throw an error
    // to prevent the application from running with insecure CSRF protection.
    if (import.meta.env.PROD) {
      throw new Error("CSRF_SECRET is not configured. Application cannot start securely.");
    }
    // Fallback for local development if someone forgets to set it, though not recommended.
    return "unsafe-fallback-secret-dev-only";
  }
  return secret;
}

export function generateToken(env: RuntimeEnv): string {
  const secret = getCsrfSecret(env);
  return tokens.create(secret);
}

export function validateToken(token: string, env: RuntimeEnv): boolean {
  const secret = getCsrfSecret(env);
  if (!token) return false; // Ensure token is provided
  return tokens.verify(secret, token);
}

export function setCsrfCookie(context: APIContext): string {
  // The runtime environment is available on context.locals in Astro
  const env = context.locals.runtime.env;
  const token = generateToken(env); // Pass the env to generateToken

  context.cookies.set('csrf-token', token, {
    httpOnly: true,
    path: '/',
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    maxAge: 60 * 60 * 1, // 1 hour (e.g.)
  });
  return token;
}

/**
 * Middleware or helper to validate CSRF token from a request.
 * Typically used in API endpoints that handle form submissions or state-changing operations.
 *
 * @example
 * // In an Astro API endpoint (e.g., POST request)
 * import { validateRequestCsrf } from '@utils/csrf';
 *
 * export async function POST(context: APIContext) {
 * if (!validateRequestCsrf(context)) {
 * return new Response("Invalid CSRF token", { status: 403 });
 * }
 * // ... process request ...
 * }
 */
export function validateRequestCsrf(context: APIContext): boolean {
  const tokenFromHeader = context.request.headers.get('x-csrf-token');
  // Or, if you send it in the form body:
  // const formData = await context.request.formData();
  // const tokenFromForm = formData.get('_csrf') as string;

  const tokenToValidate = tokenFromHeader; // Choose based on how you send it

  if (!tokenToValidate) {
    console.warn('CSRF token not found in request.');
    return false;
  }
  const env = context.locals.runtime.env;
  return validateToken(tokenToValidate, env); // Pass env to validateToken
}