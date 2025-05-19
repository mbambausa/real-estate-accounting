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

  const runtimeEnv = locals.runtime?.env as RuntimeEnv | undefined;
  if (!runtimeEnv) {
    console.error('FATAL: Runtime environment not available in middleware.');
    return new Response('Server configuration error.', { status: 500 });
  }

  // Auth.js API route handling
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

  // Session retrieval for all other requests - MODIFIED APPROACH
  try {
    const authConfig = getAuthConfig(runtimeEnv);
    const sessionUrl = new URL('/api/auth/session', request.url);
    const sessionRequest = new Request(sessionUrl.toString(), {
      method: 'GET',
      headers: request.headers
    });

    const authResult = await Auth(sessionRequest, authConfig);
    if (authResult instanceof Response) {
      if (authResult.status === 200) {
        try {
          const sessionData = await authResult.json();
          locals.session = sessionData as AuthJsSession;
          if (locals.session) {
            const typedSession = locals.session as AuthJsSession;
            locals.user = (typedSession.user as AppUser) ?? null;
          } else {
            locals.user = null;
          }
        } catch {
          locals.session = null;
          locals.user = null;
        }
      } else {
        locals.session = null;
        locals.user = null;
      }
    } else {
      locals.session = authResult as AuthJsSession;
      if (locals.session) {
        const typedSession = locals.session as AuthJsSession;
        locals.user = (typedSession.user as AppUser) ?? null;
      } else {
        locals.user = null;
      }
    }
  } catch (error: any) {
    console.error(`Error in auth middleware processing session for ${url.pathname}:`, error);
    locals.session = null;
    locals.user = null;

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
    if (!url.pathname.startsWith('/api/auth/')) {
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
        errorUrl.searchParams.set('error_code', 'CSRF_VALIDATION_FAILED');
        return redirect(errorUrl.toString(), 307);
      }
    }
  } else if (
    method === 'GET' &&
    request.headers.get('accept')?.includes('text/html') &&
    !url.pathname.startsWith('/api/')
  ) {
    try {
      locals.csrfToken = await prepareCsrf(context);
    } catch (e) {
      console.error('Error preparing CSRF token in middleware:', e);
      if (runtimeEnv.ENVIRONMENT === 'development') {
        locals.csrfToken = 'dev-csrf-token-' + Date.now();
        console.warn('Using fallback CSRF token for development');
      }
    }
  }

  // Redirect unauthenticated users from protected routes
  const protectedPattern = /^\/app(\/.*)?$/;
  if (protectedPattern.test(url.pathname) && !locals.user) {
    const callbackUrl = encodeURIComponent(url.pathname + url.search);
    const signInUrl = new URL('/auth/signin', url.origin);
    signInUrl.searchParams.set('callbackUrl', callbackUrl);
    return redirect(signInUrl.toString(), 307);
  }

  // Redirect authenticated users away from public auth pages
  const publicAuthPattern = /^\/auth\/(signin|signup)(\/.*)?$/;
  if (publicAuthPattern.test(url.pathname) && locals.user) {
    const dashboardUrl = new URL('/app/dashboard', url.origin);
    return redirect(dashboardUrl.toString(), 307);
  }

  const response = await next();

  if (
    method === 'GET' &&
    locals.csrfToken &&
    response.headers.get('content-type')?.includes('text/html')
  ) {
    response.headers.append('Vary', 'Cookie');
  }

  return response;
});
