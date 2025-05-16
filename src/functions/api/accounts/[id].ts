// src/functions/api/accounts/[id].ts
import type { APIContext } from 'astro';
import { createAccountService } from '@lib/services/account-service';
import type { ChartOfAccountInput } from '@lib/services/account-service';
import { AppError, ErrorCode, handleError } from '@utils/errors';
import { getCurrentUserId } from '@lib/auth';

export async function GET({ params, request, locals }: APIContext) {
  try {
    const accountId = params.id;
    if (!accountId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Account ID is required in path.', 400);
    }

    // Use our new helper function
    const userId = await getCurrentUserId(request, locals.runtime.env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const accountService = createAccountService(locals.runtime.env.DB);
    const account = await accountService.getAccountById(accountId, userId);
    
    if (!account) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Account not found or access denied.', 404);
    }
    
    return new Response(JSON.stringify(account), {
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

export async function PUT({ params, request, locals }: APIContext) {
  try {
    const accountId = params.id;
    if (!accountId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Account ID is required in path.', 400);
    }

    const userId = await getCurrentUserId(request, locals.runtime.env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const accountData = await request.json() as Partial<ChartOfAccountInput>;
    
    const accountService = createAccountService(locals.runtime.env.DB);
    const updatedAccount = await accountService.updateAccount(accountId, accountData, userId);
    
    return new Response(JSON.stringify(updatedAccount), {
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

export async function DELETE({ params, request, locals }: APIContext) {
  try {
    const accountId = params.id;
    if (!accountId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Account ID is required in path.', 400);
    }

    const userId = await getCurrentUserId(request, locals.runtime.env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const accountService = createAccountService(locals.runtime.env.DB);
    const success = await accountService.deleteAccount(accountId, userId);

    if (!success) {
      // Change OPERATION_FAILED to SERVER_ERROR which exists in ErrorCode enum
      throw new AppError(ErrorCode.SERVER_ERROR, 'Failed to delete account.', 500);
    }
    
    return new Response(JSON.stringify({ message: 'Account deleted successfully.' }), {
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