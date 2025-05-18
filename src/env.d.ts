// src/env.d.ts
/// <reference types="astro/client" />
/// <reference types="@astrojs/cloudflare" />

// Make sure these types are correctly imported based on where you define/export AppUser
// For now, assuming AppUser might be defined in 'src/lib/auth' as previously discussed.
// If AppUser is globally available or defined within AuthJsUser augmentation, adjust as needed.
import type { User as AuthJsUser, Session as AuthJsSession } from '@auth/core/types';
import type { D1Database, KVNamespace, R2Bucket, ExecutionContext as CfExecutionContext, IncomingRequestCfProperties as CfIncomingRequestCfProperties } from '@cloudflare/workers-types';
import type { AppUser } from './lib/auth'; // Assuming AppUser (with id, role) is exported from here

export interface RuntimeEnv {
  DB: D1Database;
  SESSION: KVNamespace; // Potentially for csrf-csrf if configured, or other custom session data
  REPORTS_CACHE: KVNamespace;
  DOCUMENTS: R2Bucket;
  ENVIRONMENT: string;
  AUTH_SECRET: string;
  CSRF_SECRET: string;
  // Add OAuth provider client IDs/secrets if you use them
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  // Add other environment variables your application might need
}

// Define Cloudflare's ExecutionContext and IncomingRequestCfProperties if not globally available
// from @astrojs/cloudflare types. Astro's adapter usually provides these.
// If @astrojs/cloudflare already makes these types available on locals.runtime,
// you might not need to redefine them here. However, explicit definition is safe.
export interface CfPagesExecutionContext extends CfExecutionContext {}
export interface CfPagesIncomingRequestCfProperties extends CfIncomingRequestCfProperties {}


declare global {
  namespace App {
    interface Locals extends Astro.Locals { // Extend Astro.Locals
      runtime: {
        env: RuntimeEnv;
        // Astro's Cloudflare adapter usually populates ctx and cf
        ctx: CfPagesExecutionContext; 
        cf?: CfPagesIncomingRequestCfProperties;
      };
      // Use your custom AppUser type here for better type safety with roles etc.
      user: AppUser | null; 
      session: AuthJsSession | null; // Auth.js Session object
      csrfToken?: string; // Set by middleware for GET requests rendering forms
    }
  }
}