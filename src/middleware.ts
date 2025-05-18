// src/middleware.ts
import { defineMiddleware } from 'astro:middleware';
import type { APIContext } from 'astro';
import { Auth } from '@auth/core';
import { getAuthConfig } from './lib/auth';
import { prepareCsrf, validateRequestCsrf } from './utils/csrf';
import type { AppUser } from './lib/auth';
import type { Session as AuthJsSession } from '@auth/core/types';
import type { RuntimeEnv } from './env.d';

export const onRequest = defineMiddleware(async (context: APIContext, next) => {
  const { request, locals, url, redirect } = context;
  const method = request.method;

  // Ensure runtime env is available
  const runtimeEnv = locals.runtime?.env as RuntimeEnv | undefined;
  if (!runtimeEnv) {
    console.error('FATAL: Runtime environment not available in middleware.');
    return new Response('Server configuration error.', { status: 500 });
  }

  // Delegate auth API routes directly to Auth.js
  if (url.pathname.startsWith('/api/auth/')) {
    return Auth(request, getAuthConfig(runtimeEnv));
  }

  // Skip static assets
  const skipPaths = ['/assets/', '/_image', '/favicon.svg', '/manifest.webmanifest'];
  const isStaticAsset =
    skipPaths.some(p => url.pathname.startsWith(p)) ||
    (url.pathname.includes('.') && !url.pathname.endsWith('.astro') && !url.pathname.endsWith('.html'));

  if (isStaticAsset) {
    return next();
  }

  // Authenticate and populate session & user
  try {
    const authResult = await Auth(request, getAuthConfig(runtimeEnv));
    if (authResult instanceof Response) {
      return authResult;
    }
    const session = authResult as AuthJsSession | null;
    locals.session = session;
    locals.user = session?.user as AppUser ?? null;
  } catch (error: any) {
    console.error('Error in auth middleware processing session:', error);
    locals.session = null;
    locals.user = null;

    // Redirect on critical config errors
    if (
      error.name === 'MissingSecretError' ||
      error.name === 'MissingAdapterError' ||
      error.message?.includes('CSRF_SECRET')
    ) {
      const errorUrl = new URL('/auth/error', url.origin);
      errorUrl.searchParams.set('auth_error_code', 'critical_config_error');
      return redirect(errorUrl.toString(), 307);
    }
  }

  // CSRF protection for state-changing requests
  const stateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'];
  if (stateChanging.includes(method)) {
    const valid = await validateRequestCsrf(context);
    if (!valid) {
      console.warn(`CSRF validation failed for ${method} ${url.pathname}`);
      if (url.pathname.startsWith('/api/')) {
        return new Response(JSON.stringify({ error: 'Invalid CSRF token' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const errorUrl = new URL('/auth/error', url.origin);
      errorUrl.searchParams.set('auth_error_code', 'csrf_validation_failed');
      return redirect(errorUrl.toString(), 307);
    }
  } else if (method === 'GET' && request.headers.get('accept')?.includes('text/html') && !url.pathname.startsWith('/api/')) {
    try {
      locals.csrfToken = await prepareCsrf(context);
    } catch (e) {
      console.error('Error preparing CSRF token in middleware:', e);
    }
  }

  // Redirect unauthenticated users from protected routes
  const protectedPattern = /^\/app(\/.*)?$/;
  if (protectedPattern.test(url.pathname) && !locals.user) {
    const callback = encodeURIComponent(url.pathname + url.search);
    const signInUrl = new URL('/auth/signin', url.origin);
    signInUrl.searchParams.set('callbackUrl', callback);
    return redirect(signInUrl.toString(), 307);
  }

  // Redirect authenticated users away from public auth pages
  const publicAuthPattern = /^\/auth\/(signin|signup|forgot-password|reset-password)(\/.*)?$/;
  if (publicAuthPattern.test(url.pathname) && locals.user) {
    const dashboardUrl = new URL('/app/dashboard', url.origin);
    return redirect(dashboardUrl.toString(), 307);
  }

  // Proceed to the next middleware or route
  const response = await next();

  // Add Vary header for CSRF token on HTML GET responses
  if (
    method === 'GET' &&
    locals.csrfToken &&
    response.headers.get('content-type')?.includes('text/html')
  ) {
    response.headers.append('Vary', 'Cookie');
  }

  return response;
});
