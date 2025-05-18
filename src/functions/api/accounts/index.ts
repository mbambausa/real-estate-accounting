// src/functions/api/accounts/index.ts
import type { APIContext } from 'astro';
import { createAccountService } from '@lib/services/account-service';
import type { ChartOfAccountInput } from '@lib/services/account-service';
import { AppError, ErrorCode, handleError } from '@utils/errors';
import { chartOfAccountInputSchema, validateRequestBody } from '../utils/zodSchemas';

/**
 * GET /api/accounts
 * 
 * Retrieves all chart of accounts entries for the current user.
 */
export async function GET({ request, locals }: APIContext) {
  try {
    const userId = locals.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const accountService = createAccountService(locals.runtime.env.DB);
    const accounts = await accountService.getAllAccounts(userId);

    return new Response(JSON.stringify(accounts), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const appError = handleError(error);
    return new Response(
      JSON.stringify({ error: appError.message, code: appError.code }),
      { status: appError.status, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * POST /api/accounts
 * 
 * Creates a new chart of accounts entry for the current user.
 * Validates the request body against our Zod schema.
 */
export async function POST({ request, locals }: APIContext) {
  try {
    const userId = locals.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate payload
    const validatedData = await validateRequestBody(request, chartOfAccountInputSchema);
    const accountData = validatedData as ChartOfAccountInput;

    const accountService = createAccountService(locals.runtime.env.DB);
    const newAccount = await accountService.createAccount(accountData, userId);

    return new Response(JSON.stringify(newAccount), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const appError = handleError(error);
    const payload: Record<string, unknown> = {
      error: appError.message,
      code: appError.code,
    };
    if ((appError as any).details) {
      payload.details = (appError as any).details;
    }
    return new Response(JSON.stringify(payload), {
      status: appError.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}