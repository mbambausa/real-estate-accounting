// src/utils/csrf.ts
import { doubleCsrf } from 'csrf-csrf';
import type { APIContext } from 'astro';
import type { RuntimeEnv } from '../env.d';

// Define the shape of CSRF utilities returned by doubleCsrf
type CsrfUtils = {
  generateCsrfToken: (
    req: Request,
    res: Response,
    opts?: { overwrite?: boolean }
  ) => string;
  validateRequest: (req: Request, res: Response) => boolean;
};

let csrfUtilsInstance: CsrfUtils | null = null;

function getCsrfUtils(env: RuntimeEnv): CsrfUtils {
  if (csrfUtilsInstance) return csrfUtilsInstance;

  const secret =
    env.CSRF_SECRET && env.CSRF_SECRET.length >= 32
      ? env.CSRF_SECRET
      : (() => {
          const fallback =
            'unsafe-fallback-dev-secret-must-be-at-least-32-bytes-long';
          console.warn(
            `CSRF Setup Warning: Using fallback CSRF_SECRET. THIS IS INSECURE. Ensure CSRF_SECRET is properly set in your production environment.`
          );
          return fallback;
        })();

  const { generateCsrfToken, validateRequest } = doubleCsrf({
    getSecret: () => secret,
    getSessionIdentifier: (req: Request): string => {
      const isProd = env.ENVIRONMENT === 'production';
      const sessionCookieName = isProd
        ? "__Secure-authjs.session-token"
        : "authjs.session-token";

      const cookiesHeader = req.headers.get('cookie');
      if (cookiesHeader) {
        const cookies = cookiesHeader.split('; ');
        const sessionCookie = cookies.find(c => c.startsWith(`${sessionCookieName}=`));
        if (sessionCookie) {
          const sessionToken = sessionCookie.split('=')[1];
          if (sessionToken) {
            return sessionToken;
          }
        }
      }
      return "__csrf_no_session__";
    },
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

  csrfUtilsInstance = { generateCsrfToken, validateRequest };
  return csrfUtilsInstance;
}

export async function prepareCsrf(context: APIContext): Promise<string> {
  const env = context.locals.runtime?.env as RuntimeEnv | undefined;
  if (!env) {
    console.error('CSRF Prep: RuntimeEnv missing from context.locals.');
    throw new Error('Server configuration error for CSRF preparation.');
  }

  const { generateCsrfToken } = getCsrfUtils(env);
  const dummyRes = new Response();

  try {
    // Add error handling around the token generation
    const token = generateCsrfToken(context.request as Request, dummyRes, {
      overwrite: true,
    });

    const setCookieHeader = dummyRes.headers.get('set-cookie');
    if (setCookieHeader) {
      const parts = setCookieHeader.split(';').map(part => part.trim());
      const nameValuePair = parts[0].split('=');
      const cookieName = nameValuePair[0];
      let cookieValue = '';
      
      // Handle the case when the value might be encoded
      try {
        cookieValue = decodeURIComponent(nameValuePair[1]);
      } catch (e) {
        cookieValue = nameValuePair[1] || '';
      }

      const options: Record<string, any> = { 
        httpOnly: true, 
        secure: import.meta.env.PROD, 
        path: '/', 
        sameSite: 'lax' 
      };
      
      // Parse options from the set-cookie header
      parts.slice(1).forEach(part => {
        const [key, ...valParts] = part.split('=');
        const value = valParts.join('=');
        if (key.toLowerCase() === 'max-age') options.maxAge = parseInt(value, 10);
      });
      
      if (options.maxAge === undefined) options.maxAge = 60 * 60 * 2;

      // Set the cookie
      context.cookies.set(cookieName, cookieValue, options);
    }

    return token;
  } catch (error) {
    console.error('CSRF token generation error:', error);
    // Return a fallback token for development
    return 'csrf-dev-token-' + Math.random().toString(36).substring(2, 15);
  }
}

export async function validateRequestCsrf(
  context: APIContext
): Promise<boolean> {
  const env = context.locals.runtime?.env as RuntimeEnv | undefined;
  if (!env) {
    console.error('CSRF Valid: RuntimeEnv missing from context.locals.');
    return false;
  }

  try {
    const { validateRequest } = getCsrfUtils(env);
    const dummyRes = new Response();

    // In development, we might want to bypass CSRF validation
    if (env.ENVIRONMENT === 'development' && process.env.NODE_ENV === 'development') {
      const hasDevToken = context.request.headers.get('content-type')?.includes('form-data') && 
        new URL(context.request.url).searchParams.has('_csrf');
      
      if (hasDevToken) {
        console.warn('DEVELOPMENT MODE: Bypassing CSRF validation with development token');
        return true;
      }
    }

    const isValid = validateRequest(context.request as Request, dummyRes);
    if (!isValid) {
      console.warn(
        `CSRF token validation failed for: ${context.request.method} ${new URL(context.request.url).pathname}`
      );
    }
    return isValid;
  } catch (error) {
    console.error('Error during CSRF validation process:', error);
    
    // For development, we can allow requests to pass
    if (env.ENVIRONMENT === 'development' && process.env.NODE_ENV === 'development') {
      console.warn('DEVELOPMENT MODE: Allowing request despite CSRF validation error');
      return true;
    }
    
    return false;
  }
}
