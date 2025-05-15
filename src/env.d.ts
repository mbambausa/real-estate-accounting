// src/env.d.ts
/// <reference types="astro/client" />
/// <reference types="@astrojs/cloudflare" />

// Import Cloudflare types directly
import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import type { Session, User } from '@auth/core/types';

// Define session data structure from database
export interface DbSessionData {
  id: string;
  session_token: string;
  user_id: string;
  expires: number; // Unix timestamp in seconds
}

// Define user data structure from database
export interface DbUserData {
  id: string;
  name: string | null;
  email: string;
  password_hash: string;
}

// Export RuntimeEnv for explicit imports
export interface RuntimeEnv {
  DB: D1Database;
  AUTH_SECRET: string;
  SESSION?: KVNamespace;
}

// Explicitly augment App.Locals for Astro
declare global {
  namespace App {
    interface Locals {
      // Auth.js session and user objects
      session: Session | null;
      user: User | null;
      
      // Cloudflare runtime
      runtime: {
        env: RuntimeEnv;
      };
    }
  }
}