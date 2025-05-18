// src/lib/passwordUtils.ts
import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2";

/**
 * Hashes a plaintext password using Argon2.
 * The salt and parameters are automatically handled by the Argon2 library
 * and are included in the output hash string.
 *
 * @param password The plaintext password to hash.
 * @returns A promise that resolves to the Argon2 hash string.
 * @throws Throws an error if hashing fails.
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password) {
    // Added a check for empty password to prevent potential issues with the hashing library.
    console.error("hashPassword: Password cannot be empty.");
    throw new Error("Password cannot be empty.");
  }
  try {
    // Default options for @node-rs/argon2 are generally secure.
    // You can pass options here if needed, e.g., { memoryCost: 19456, timeCost: 2, parallelism: 1 }
    const hashedPassword = await argon2Hash(password);
    return hashedPassword;
  } catch (error: unknown) {
    console.error("Error hashing password with Argon2:", error);
    // Provide a more generic error message to the caller but log specifics.
    if (error instanceof Error) {
      // Log specific error message if available, but throw a generic one.
      throw new Error(`Password hashing failed due to an internal error: ${error.message}`);
    }
    throw new Error("Password hashing failed due to an unexpected internal error.");
  }
}

/**
 * Verifies a plaintext password against a stored Argon2 hash.
 *
 * @param storedHash The Argon2 hash string retrieved from the database.
 * @param password The plaintext password to verify.
 * @returns A promise that resolves to true if the password matches the hash, false otherwise.
 */
export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  if (!storedHash || !password) {
    // It's important that this function doesn't throw an error for an empty password
    // if the `authorize` function in Auth.js relies on it returning false for such cases.
    // However, the `authorize` function should ideally perform its own checks for empty credentials first.
    console.warn("verifyPassword called with empty storedHash or password. Verification will fail.");
    return false;
  }
  try {
    // The `verify` function from @node-rs/argon2 is expected to:
    // - Return `true` if the password matches the hash.
    // - Throw an error if the password does NOT match, or if the hash is invalid/malformed,
    //   or if there's another operational error.
    // It does not typically return `false` on mismatch; it throws.
    await argon2Verify(storedHash, password);
    return true; // If argon2Verify does not throw, the password is valid.
  } catch (error: unknown) {
    // Any error caught here (including mismatch errors from argon2Verify) means verification failed.
    // Log for debugging, but return false to the caller.
    // Avoid exposing specific error details that could help attackers (e.g., "invalid hash format" vs "mismatch").
    if (error instanceof Error && error.message.includes("ERR_ARGON2_VERIFY_MISMATCH")) {
        // This specific error message is from some Argon2 libraries indicating a mismatch.
        // For @node-rs/argon2, it might be a generic error message for mismatch.
        console.info("Password verification failed: Mismatch.");
    } else {
        console.warn("Password verification failed (could be invalid hash, parameters, or operational error):", error instanceof Error ? error.message : error);
    }
    return false; 
  }
}