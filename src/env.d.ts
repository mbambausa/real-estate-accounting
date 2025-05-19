// src/env.d.ts
/// <reference types="astro/client" />
/// <reference types="@astrojs/cloudflare" />

import type { User as AuthJsUser, Session as AuthJsSession } from '@auth/core/types';
import type {
  D1Database,
  KVNamespace,
  R2Bucket,
  ExecutionContext as CfExecutionContext,
  IncomingRequestCfProperties as CfIncomingRequestCfProperties
} from '@cloudflare/workers-types';
import type { AppUser } from './lib/auth';

export interface RuntimeEnv {
  DB: D1Database;
  SESSION: KVNamespace;
  REPORTS_CACHE: KVNamespace;
  DOCUMENTS: R2Bucket;
  ENVIRONMENT: string;
  AUTH_URL?: string;
  AUTH_SECRET: string;
  CSRF_SECRET: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  // …other vars as needed
}

export interface CfPagesExecutionContext extends CfExecutionContext {}
export interface CfPagesIncomingRequestCfProperties extends CfIncomingRequestCfProperties {}

declare global {
  namespace App {
    interface Locals extends Astro.Locals {
      runtime: {
        env: RuntimeEnv;
        ctx: CfPagesExecutionContext;
        cf?: CfPagesIncomingRequestCfProperties;
      };
      user: AppUser | null;
      session: AuthJsSession | null;
      csrfToken?: string;
    }
  }
}