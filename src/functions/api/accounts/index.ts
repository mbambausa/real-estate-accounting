// src/functions/api/accounts/index.ts
import type { APIContext } from 'astro';
import { createAccountService } from '@lib/services/account-service';
import type { ChartOfAccountInput } from '@lib/services/account-service';
import { AppError, ErrorCode, handleError } from '@utils/errors';
import { getCurrentUserId } from '@lib/auth';

/**
 * GET /api/accounts
 * 
 * Retrieves all chart of accounts entries for the current user.
 * Results are filtered by user ownership for multi-tenant security.
 */
export async function GET({ request, locals }: APIContext) {
  try {
    // Use our auth helper to get the current user ID
    const userId = await getCurrentUserId(request, locals.runtime.env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const accountService = createAccountService(locals.runtime.env.DB);
    // Pass userId to getAllAccounts for proper data isolation
    const accounts = await accountService.getAllAccounts(userId);
    
    return new Response(JSON.stringify(accounts), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: unknown) {
    const appError = handleError(error);
    return new Response(JSON.stringify({ error: appError.message, code: appError.code }), {
      status: appError.status,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /api/accounts
 * 
 * Creates a new chart of accounts entry for the current user.
 * Validates required fields and ensures data is properly associated with the user.
 */
export async function POST({ request, locals }: APIContext) {
  try {
    // Use our auth helper to get the current user ID
    const userId = await getCurrentUserId(request, locals.runtime.env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const accountData = await request.json() as ChartOfAccountInput;
    
    // Validate required fields
    if (!accountData.code || !accountData.name || !accountData.type) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR, 
        'Account code, name, and type are required.', 
        400
      );
    }
    
    const accountService = createAccountService(locals.runtime.env.DB);
    // Pass userId to createAccount for proper data ownership
    const newAccount = await accountService.createAccount(accountData, userId);
    
    return new Response(JSON.stringify(newAccount), {
      status: 201, // Created
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: unknown) {
    const appError = handleError(error);
    return new Response(JSON.stringify({ error: appError.message, code: appError.code }), {
      status: appError.status,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}