// src/functions/api/entities/index.ts
import type { APIContext } from 'astro';
import { createEntityService } from '@lib/services/entity-service';
import type { EntityInput } from '../../../types/entity';
import { AppError, ErrorCode, handleError } from '@utils/errors';
import { entityInputSchema, validateRequestBody } from '../utils/zodSchemas';

/**
 * GET /api/entities
 * 
 * Retrieves all entities owned by the current user.
 * Results are filtered by user ownership for multi-tenant security.
 */
export async function GET({ request, locals }: APIContext) {
  try {
    const userId = locals.user?.id;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const entityService = createEntityService(locals.runtime.env.DB);
    const entities = await entityService.getAllEntities(userId);

    return new Response(
      JSON.stringify(entities),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const appError = handleError(error);
    return new Response(
      JSON.stringify({ error: appError.message, code: appError.code }),
      { status: appError.status, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * POST /api/entities
 * 
 * Creates a new entity owned by the current user.
 * Validates required fields and ensures data is properly associated with the user.
 */
export async function POST({ request, locals }: APIContext) {
  try {
    const userId = locals.user?.id;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate the incoming payload against our Zod schema
    const validatedEntityData = await validateRequestBody(request, entityInputSchema);

    const entityService = createEntityService(locals.runtime.env.DB);
    const newEntity = await entityService.createEntity(validatedEntityData as EntityInput, userId);

    return new Response(
      JSON.stringify(newEntity),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const appError = handleError(error);
    const payload: Record<string, unknown> = {
      error: appError.message,
      code: appError.code,
    };
    // Include validation details if present
    if ((appError as any).details) {
      payload.details = (appError as any).details;
    }
    return new Response(
      JSON.stringify(payload),
      { status: appError.status, headers: { 'Content-Type': 'application/json' } }
    );
  }
}