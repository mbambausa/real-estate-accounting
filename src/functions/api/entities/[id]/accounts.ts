// src/functions/api/entities/[id]/accounts.ts
import type { APIContext } from 'astro';
import { createEntityService } from '@lib/services/entity-service';
import { createEntityAccountService } from '@lib/services/entity-account-service';
import { AppError, ErrorCode, handleError } from '@utils/errors';
import { z } from 'zod';
import {
  entityAccountInputSchema,
  validateRequestBody,
} from '../../utils/zodSchemas';

// Schema for creation omitting entity_id (path param)
const createEntityAccountSchema = entityAccountInputSchema.omit({ entity_id: true });

/**
 * GET /api/entities/[id]/accounts
 *
 * Retrieves all accounts linked to a specific entity.
 * Ensures the requesting user owns the entity.
 */
export async function GET({ params, request, locals }: APIContext) {
  try {
    const entityId = params.id;
    if (!entityId) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Entity ID is required in path.',
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

    const entityAccountService = createEntityAccountService(
      locals.runtime.env.DB
    );
    const accounts = await entityAccountService.getAccountsForEntity(
      entityId,
      userId
    );

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
 * POST /api/entities/[id]/accounts
 *
 * Links an account from the Chart of Accounts to a specific entity.
 * Validates entity ownership and account existence.
 */
export async function POST({ params, request, locals }: APIContext) {
  try {
    const entityIdFromPath = params.id;
    if (!entityIdFromPath) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Entity ID is required in path.',
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

    // Validate request body against Zod schema
    const validated = await validateRequestBody(
      request,
      createEntityAccountSchema
    );

    const entityAccountLinkData = {
      entity_id: entityIdFromPath,
      account_id: validated.account_id,
      custom_name: validated.custom_name,
      is_active: validated.is_active,
      recovery_type: validated.recovery_type,
      recovery_percentage: validated.recovery_percentage,
    };

    const entityAccountService = createEntityAccountService(
      locals.runtime.env.DB
    );
    const newLink = await entityAccountService.createEntityAccount(
      entityAccountLinkData,
      userId
    );

    return new Response(JSON.stringify(newLink), {
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
    return new Response(
      JSON.stringify(payload),
      { status: appError.status, headers: { 'Content-Type': 'application/json' } }
    );
  }
}