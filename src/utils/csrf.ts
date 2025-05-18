// src/utils/csrf.ts
import { doubleCsrf } from 'csrf-csrf';
import type { APIContext } from 'astro';
import type { RuntimeEnv } from '../env.d';

type CsrfUtils = {
  generateCsrfToken: (
    req: Request,
    res: Response,
    opts?: { overwrite?: boolean }
  ) => string;
  validateRequest: (req: Request, res: Response) => boolean;
};

let csrfUtils: CsrfUtils | null = null;

function getCsrfUtils(env: RuntimeEnv): CsrfUtils {
  if (csrfUtils) return csrfUtils;

  const secret =
    env.CSRF_SECRET && env.CSRF_SECRET.length >= 32
      ? env.CSRF_SECRET
      : (() => {
          const fallback =
            'unsafe-fallback-dev-secret-must-be-at-least-32-bytes-long';
          console.warn(
            `Using fallback CSRF_SECRET for dev: ${fallback}. THIS IS INSECURE.`
          );
          return fallback;
        })();

  const { generateCsrfToken, validateRequest } = doubleCsrf({
    getSecret: () => secret,
    getSessionIdentifier: () => '', // TODO: replace with your session identifier logic
    cookieName: '__Host-csrf-secret',
    cookieOptions: {
      path: '/',
      secure: import.meta.env.PROD,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 2, // 2 hours
    },
    size: 32,
  });

  csrfUtils = { generateCsrfToken, validateRequest };
  return csrfUtils;
}

export async function prepareCsrf(context: APIContext): Promise<string> {
  const env = context.locals.runtime?.env as RuntimeEnv | undefined;
  if (!env) {
    console.error('CSRF Prep: RuntimeEnv missing.');
    throw new Error('Server configuration error for CSRF prep.');
  }

  const { generateCsrfToken } = getCsrfUtils(env);
  const dummyRes = new Response();
  const token = generateCsrfToken(context.request as Request, dummyRes, {
    overwrite: true,
  });

  const setCookie = dummyRes.headers.get('set-cookie');
  if (setCookie) {
    const [cookiePair] = setCookie.split(';');
    const [name, value] = cookiePair.split('=');
    context.cookies.set(name, decodeURIComponent(value), {
      path: '/',
      secure: import.meta.env.PROD,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 2,
    });
  }

  return token;
}

export async function validateRequestCsrf(
  context: APIContext
): Promise<boolean> {
  const env = context.locals.runtime?.env as RuntimeEnv | undefined;
  if (!env) {
    console.error('CSRF Valid: RuntimeEnv missing.');
    return false;
  }

  const { validateRequest } = getCsrfUtils(env);
  const dummyRes = new Response();

  try {
    const isValid = validateRequest(
      context.request as Request,
      dummyRes
    );
    if (!isValid) {
      console.warn(
        `CSRF token validation failed: ${context.request.method} ${context.url.pathname}`
      );
    }
    return isValid;
  } catch (error) {
    console.error('Error during CSRF validation:', error);
    return false;
  }
}
