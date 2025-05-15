// tests/unit/auth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';

// Corrected path: src/pages/api/auth/[...auth].ts
import { createAppAuthOptions } from '../../src/pages/api/auth/[...auth]';
import type { RuntimeEnv } from '../../src/env.d';
import type { D1Database } from '@cloudflare/workers-types';

// --- Mock D1 Database ---
const mockD1 = {
  prepare: vi.fn().mockReturnThis(),
  bind: vi.fn().mockReturnThis(),
  first: vi.fn(),
  run: vi.fn(),
  all: vi.fn(),
};

// --- Mock Runtime Environment ---
const mockTestRuntimeEnv: RuntimeEnv = {
  DB: mockD1 as unknown as D1Database,
  AUTH_SECRET: 'test-secret-for-unit-tests-longer-than-32-chars',
};

describe('Authentication Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockD1.first.mockReset();
  });

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
      const isInvalid = await argonVerify(hashedPassword, 'wrongPassword');
      expect(isInvalid).toBe(false);
    });
  });

  describe('CredentialsProvider authorize function (from createAppAuthOptions)', () => {
    const authOptions = createAppAuthOptions(mockTestRuntimeEnv);
    const credentialsProvider = authOptions.providers.find(
  (p: any) => p.id === 'credentials' || (typeof p === 'function' && p.id === 'credentials')
);

    if (!credentialsProvider || !('authorize' in credentialsProvider) || typeof credentialsProvider.authorize !== 'function') {
      throw new Error('CredentialsProvider or its authorize method is not defined correctly in test setup.');
    }
    const authorizeFn = credentialsProvider.authorize;

    it('should return user object for valid credentials', async () => {
      const plainPassword = 'password123';
      const hashedPassword = await argonHash(plainPassword);
      const mockUserRecord = {
        id: 'user-valid-123',
        email: 'valid@example.com',
        password_hash: hashedPassword,
        name: 'Valid User',
      };
      mockD1.first.mockResolvedValue(mockUserRecord);
      const requestMock = new Request("http://localhost/api/auth/callback/credentials");
      const result = await authorizeFn({ email: 'valid@example.com', password: plainPassword }, requestMock);
      expect(mockD1.prepare).toHaveBeenCalledWith('SELECT id, email, name, password_hash FROM users WHERE email = ? LIMIT 1');
      expect(mockD1.bind).toHaveBeenCalledWith('valid@example.com');
      expect(result).toEqual({ id: 'user-valid-123', email: 'valid@example.com', name: 'Valid User' });
    });

    it('should return null if user is not found', async () => {
      mockD1.first.mockResolvedValue(null);
      const requestMock = new Request("http://localhost/api/auth/callback/credentials");
      const result = await authorizeFn({ email: 'notfound@example.com', password: 'password123' }, requestMock);
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
      };
      mockD1.first.mockResolvedValue(mockUserRecord);
      const requestMock = new Request("http://localhost/api/auth/callback/credentials");
      const result = await authorizeFn({ email: 'wrongpass@example.com', password: 'incorrectPassword' }, requestMock);
      expect(result).toBeNull();
    });

    it('should return null if user record does not have a password_hash', async () => {
      const mockUserRecordNoHash = { id: 'user-nohash-123', email: 'nohash@example.com', name: 'No Hash User' };
      mockD1.first.mockResolvedValue(mockUserRecordNoHash as any);
      const requestMock = new Request("http://localhost/api/auth/callback/credentials");
      const result = await authorizeFn({ email: 'nohash@example.com', password: 'password123' }, requestMock);
      expect(result).toBeNull();
    });

    // Test for malformed credentials
    it('should return null if credentials object has non-string email or password', async () => {
      const requestMock = new Request("http://localhost/api/auth/callback/credentials");
      const resultEmail = await authorizeFn({ email: 123, password: 'password123' } as any, requestMock);
      expect(resultEmail).toBeNull(); // This should now be a valid error if authorize expects strings
      
      const resultPassword = await authorizeFn({ email: 'test@example.com', password: 123 } as any, requestMock);
      expect(resultPassword).toBeNull(); // This should now be a valid error
    });
    
    it('should return null if credentials object is null or missing email/password', async () => {
        const requestMock = new Request("http://localhost/api/auth/callback/credentials");
        const resultNull = await authorizeFn(null as any, requestMock);
        expect(resultNull).toBeNull();

        const resultMissingEmail = await authorizeFn({ password: 'password123'} as any, requestMock);
        expect(resultMissingEmail).toBeNull();

        const resultMissingPassword = await authorizeFn({ email: 'test@example.com'} as any, requestMock);
        expect(resultMissingPassword).toBeNull();
    });

    it('should return null if D1 query fails', async () => {
        mockD1.first.mockRejectedValue(new Error("D1 Database error simulation"));
        const requestMock = new Request("http://localhost/api/auth/callback/credentials");
        const result = await authorizeFn({ email: 'dberror@example.com', password: 'password123' }, requestMock);
        expect(result).toBeNull(); 
    });
  });
});
