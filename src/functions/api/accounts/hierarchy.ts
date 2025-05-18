// src/functions/api/accounts/hierarchy.ts
import type { APIContext } from 'astro';
import { createAccountService } from '@lib/services/account-service';
import { handleError } from '@utils/errors';

/**
 * GET /api/accounts/hierarchy
 * 
 * Retrieves a hierarchical view of the chart of accounts for the current user.
 * Used to display the accounts in a tree-like structure in the UI.
 */
export async function GET({ request, locals }: APIContext) {
  try {
    // Access user ID directly from locals
    const userId = locals.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const accountService = createAccountService(locals.runtime.env.DB);
    // Pass userId to getAccountHierarchy
    const accountHierarchy = await accountService.getAccountHierarchy(userId);
    
    return new Response(JSON.stringify(accountHierarchy), {
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