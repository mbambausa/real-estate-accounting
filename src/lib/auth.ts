// src/lib/auth.ts
// This file can be used for re-exporting types from Auth.js core
// or for defining helper functions related to authentication.

// Example: Re-exporting types for convenience
export type { Session, User } from '@auth/core/types';

// The main Auth.js instance and handlers are configured in auth.config.ts
// and typically accessed via auth-astro helpers (e.g., getSession, signIn, signOut)
// or potentially imported directly if auth-astro exposes them for server-side use.

// Example: You might define a helper to access the Auth.js instance if auth-astro exposes it
// import auth from 'auth-astro'; // Assuming auth-astro exports the instance for server-side
// export const getAuth = () => auth; // Example helper