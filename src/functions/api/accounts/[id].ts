// src/functions/api/accounts/[id].ts
import type { APIContext } from 'astro';
import { createAccountService } from '@lib/services/account-service';
import { AppError, ErrorCode, handleError } from '@utils/errors';
import {
  partialChartOfAccountInputSchema,
  validateRequestBody,
} from '../utils/zodSchemas';

export async function GET({ params, locals }: APIContext) {
  try {
    const accountId = params.id;
    if (!accountId) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Account ID is required in path.',
        400
      );
    }

    const userId = locals.user?.id;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const accountService = createAccountService(locals.runtime.env.DB);
    const account = await accountService.getAccountById(accountId, userId);
    if (!account) {
      throw new AppError(
        ErrorCode.NOT_FOUND,
        'Account not found or access denied.',
        404
      );
    }

    return new Response(JSON.stringify(account), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const appError = handleError(err);
    return new Response(
      JSON.stringify({ error: appError.message, code: appError.code }),
      { status: appError.status, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function PUT({ params, request, locals }: APIContext) {
  try {
    const accountId = params.id;
    if (!accountId) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Account ID is required in path.',
        400
      );
    }

    const userId = locals.user?.id;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const validatedData = await validateRequestBody(
      request,
      partialChartOfAccountInputSchema
    );

    const accountService = createAccountService(locals.runtime.env.DB);
    const updated = await accountService.updateAccount(
      accountId,
      validatedData,
      userId
    );

    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const appError = handleError(err);
    const payload: Record<string, unknown> = {
      error: appError.message,
      code: appError.code,
    };
    if ((appError as any).details) {
      payload.details = (appError as any).details;
    }
    return new Response(
      JSON.stringify(payload),
      { status: appError.status, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function DELETE({ params, locals }: APIContext) {
  try {
    const accountId = params.id;
    if (!accountId) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Account ID is required in path.',
        400
      );
    }

    const userId = locals.user?.id;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const accountService = createAccountService(locals.runtime.env.DB);
    const success = await accountService.deleteAccount(accountId, userId);
    if (!success) {
      throw new AppError(
        ErrorCode.SERVER_ERROR,
        'Failed to delete account.',
        500
      );
    }

    return new Response(
      JSON.stringify({ message: 'Account deleted successfully.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const appError = handleError(err);
    return new Response(
      JSON.stringify({ error: appError.message, code: appError.code }),
      { status: appError.status, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
