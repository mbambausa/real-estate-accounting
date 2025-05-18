// tests/unit/auth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';

// Corrected import to test getAuthConfig from the lib file
import { getAuthConfig } from '../../src/lib/auth';
import type { AuthConfig } from "@auth/core/types"; // For casting authConfig
import type { CredentialsConfig, CredentialInput } from '@auth/core/providers/credentials'; // For provider type
import type { RuntimeEnv } from '../../src/env.d';
import type { D1Database } from '@cloudflare/workers-types';
import type { User, Awaitable } from '@auth/core/types'; // For authorize return type & Request type for authorize

// --- Mock D1 Database ---
const mockD1Prepare = vi.fn();
const mockD1Bind = vi.fn();
const mockD1First = vi.fn();

const mockD1AdapterUserMethods = { // For D1Adapter if its methods were called directly
  // ...
};

const mockD1 = {
  prepare: mockD1Prepare.mockReturnThis(),
  bind: mockD1Bind.mockReturnThis(),
  first: mockD1First,
  // ... other D1 methods if needed by adapter directly
};

const mockTestRuntimeEnv: RuntimeEnv = {
  DB: mockD1 as unknown as D1Database,
  SESSION: {} as any, // Mock KVNamespace
  REPORTS_CACHE: {} as any, // Mock KVNamespace
  DOCUMENTS: {} as any, // Mock R2Bucket
  ENVIRONMENT: 'test',
  AUTH_SECRET: 'test-secret-for-unit-tests-longer-than-32-chars',
  CSRF_SECRET: 'test-csrf-secret-for-unit-tests',
  // GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are optional in RuntimeEnv
};

describe('Authentication Logic (getAuthConfig)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockD1First.mockReset();
    mockD1Prepare.mockClear();
    mockD1Bind.mockClear();
  });

  // Argon2 tests remain the same...
  describe('Password Hashing and Verification (Argon2)', () => {
    it('should hash a password and be able to verify it', async () => {
      const password = 'securePassword123';
      const hashedPassword = await argonHash(password);
      expect(hashedPassword).not.toBe(password);
      const isValid = await argonVerify(hashedPassword, password);
      expect(isValid).toBe(true);
    });

    it('should fail to verify an incorrect password', async () => {
      const password = 'securePassword123';
      const hashedPassword = await argonHash(password);
      // argonVerify throws on mismatch, so expect it to return false after catching.
      // The passwordUtils.verifyPassword catches and returns false.
      // If testing argonVerify directly:
      await expect(argonVerify(hashedPassword, 'wrongPassword')).rejects.toThrow();
      // Or if using your verifyPassword wrapper:
      // const { verifyPassword } = await import('../../src/lib/passwordUtils'); // if testing the wrapper
      // expect(await verifyPassword(hashedPassword, 'wrongPassword')).toBe(false);
    });
  });


  describe('CredentialsProvider authorize function (from getAuthConfig)', () => {
    const authConfig = getAuthConfig(mockTestRuntimeEnv);
    
    const credentialsProvider = authConfig.providers.find(
      (p: any) => p.id === 'credentials'
    ) as CredentialsConfig<Record<string, CredentialInput>> | undefined;


    it('should define CredentialsProvider with an authorize method', () => {
      expect(credentialsProvider).toBeDefined();
      expect(credentialsProvider?.authorize).toBeTypeOf('function');
    });
    
    // Conditional execution for further tests if authorizeFn is valid
    if (credentialsProvider && typeof credentialsProvider.authorize === 'function') {
      const authorizeFn = credentialsProvider.authorize;

      it('should return user object for valid credentials', async () => {
        const plainPassword = 'password123';
        const hashedPassword = await argonHash(plainPassword); // Hash it for the mock DB record
        const mockUserRecord = {
          id: 'user-valid-123',
          email: 'valid@example.com',
          password_hash: hashedPassword, // Store hashed password
          name: 'Valid User',
          role: 'user', // Include role as per getAuthConfig's SQL and AppUser
        };
        mockD1First.mockResolvedValue(mockUserRecord);
        // The authorize function in Auth.js v5 expects a Request object as its second argument.
        const dummyRequest = new Request("http://localhost/auth/callback/credentials", { method: "POST" });

        const result = await authorizeFn({ email: 'valid@example.com', password: plainPassword }, dummyRequest);
        
        expect(mockD1Prepare).toHaveBeenCalledWith(expect.stringContaining('SELECT id, email, name, password_hash, role FROM users'));
        expect(mockD1Bind).toHaveBeenCalledWith('valid@example.com');
        expect(result).toEqual({ 
          id: 'user-valid-123', 
          email: 'valid@example.com', 
          name: 'Valid User',
          role: 'user' // Ensure role is returned as per AppUser definition in getAuthConfig
        });
      });

      it('should return null if user is not found', async () => {
        mockD1First.mockResolvedValue(null);
        const dummyRequest = new Request("http://localhost/auth/callback/credentials", { method: "POST" });
        const result = await authorizeFn({ email: 'notfound@example.com', password: 'password123' }, dummyRequest);
        expect(result).toBeNull();
      });

      it('should return null for correct user but incorrect password', async () => {
        const plainPassword = 'password123';
        const hashedPassword = await argonHash(plainPassword);
        const mockUserRecord = {
          id: 'user-wrongpass-123',
          email: 'wrongpass@example.com',
          password_hash: hashedPassword,
          name: 'Wrong Pass User',
          role: 'user',
        };
        mockD1First.mockResolvedValue(mockUserRecord);
        const dummyRequest = new Request("http://localhost/auth/callback/credentials", { method: "POST" });
        const result = await authorizeFn({ email: 'wrongpass@example.com', password: 'incorrectPassword' }, dummyRequest);
        expect(result).toBeNull();
      });

      it('should return null if user record does not have a password_hash', async () => {
        // password_hash is non-nullable in the SELECT and DB schema generally
        const mockUserRecordNoHash = { id: 'user-nohash-123', email: 'nohash@example.com', name: 'No Hash User', role: 'user' };
        mockD1First.mockResolvedValue(mockUserRecordNoHash as any); // Cast to any if type complains
        const dummyRequest = new Request("http://localhost/auth/callback/credentials", { method: "POST" });
        const result = await authorizeFn({ email: 'nohash@example.com', password: 'password123' }, dummyRequest);
        expect(result).toBeNull(); // Because verifyPassword would fail with undefined hash
      });

      it('should return null if credentials object has non-string email or password', async () => {
        const dummyRequest = new Request("http://localhost/auth/callback/credentials", { method: "POST" });
        const resultEmail = await authorizeFn({ email: 123, password: 'password123' } as any, dummyRequest);
        expect(resultEmail).toBeNull();
        
        const resultPassword = await authorizeFn({ email: 'test@example.com', password: 123 } as any, dummyRequest);
        expect(resultPassword).toBeNull();
      });
      
      it('should return null if credentials object is null or missing email/password', async () => {
        const dummyRequest = new Request("http://localhost/auth/callback/credentials", { method: "POST" });
        const resultNull = await authorizeFn(null as any, dummyRequest);
        expect(resultNull).toBeNull();

        const resultMissingEmail = await authorizeFn({ password: 'password123'} as any, dummyRequest);
        expect(resultMissingEmail).toBeNull();

        const resultMissingPassword = await authorizeFn({ email: 'test@example.com'} as any, dummyRequest);
        expect(resultMissingPassword).toBeNull();
      });

      it('should return null if D1 query fails in authorize', async () => {
        mockD1First.mockRejectedValue(new Error("D1 Database error simulation"));
        const dummyRequest = new Request("http://localhost/auth/callback/credentials", { method: "POST" });
        const result = await authorizeFn({ email: 'dberror@example.com', password: 'password123' }, dummyRequest);
        expect(result).toBeNull(); 
      });
    } else {
      it.skip('CredentialsProvider.authorize tests skipped because provider or method is not found', () => {});
    }
  });
});