// src/env.d.ts
/// <reference types="astro/client" />
/// <reference types="@astrojs/cloudflare" />

import type { D1Database, KVNamespace, R2Bucket } from '@cloudflare/workers-types';
import type { Session as AuthJsSession, User as AuthJsUser } from '@auth/core/types';

// src/env.d.ts
export interface RuntimeEnv {
  DB: D1Database;
  SESSION: KVNamespace;
  DOCUMENTS: R2Bucket;
  ENVIRONMENT: string;
  AUTH_SECRET: string;
  CSRF_SECRET: string;
  REPORTS_CACHE?: KVNamespace;
  GITHUB_CLIENT_ID: string; 
  GITHUB_CLIENT_SECRET: string;
}

declare global {
  namespace App {
    interface Locals {
      runtime: {
        env: RuntimeEnv;
        ctx: ExecutionContext;
        cf?: IncomingRequestCfProperties;
      };
      user: AuthJsUser | null;
      session: AuthJsSession | null;
    }
  }
}

// Additional types for Cloudflare
interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

interface IncomingRequestCfProperties {
  // CF properties like country, city, etc.
  country?: string;
  city?: string;
  continent?: string;
  latitude?: string;
  longitude?: string;
  timezone?: string;
  // Add others as needed
}