// src/functions/api/entities/[id].ts
import type { APIContext } from 'astro';
import { createEntityService } from '@lib/services/entity-service';
import { validateRequestBody, partialEntityInputSchema } from '../utils/zodSchemas';
import type { EntityInput } from '../../../types/entity';
import { AppError, ErrorCode, handleError } from '@utils/errors';

/**
 * GET /api/entities/[id]
 * 
 * Retrieves a specific entity by ID.
 * Validates that the requesting user owns the entity.
 */
export async function GET({ params, request, locals }: APIContext) {
  try {
    const entityId = params.id;
    if (!entityId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Entity ID is required in path.', 400);
    }

    const userId = locals.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const entityService = createEntityService(locals.runtime.env.DB);
    const entity = await entityService.getEntityById(entityId, userId);

    if (!entity) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Entity not found or access denied.', 404);
    }

    return new Response(JSON.stringify(entity), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: unknown) {
    const appError = handleError(error);
    return new Response(
      JSON.stringify({ error: appError.message, code: appError.code }),
      {
        status: appError.status,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * PUT /api/entities/[id]
 * 
 * Updates an existing entity.
 * Validates that the requesting user owns the entity, and applies Zod schema to incoming data.
 */
export async function PUT({ params, request, locals }: APIContext) {
  try {
    const entityId = params.id;
    if (!entityId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Entity ID is required in path.', 400);
    }

    const userId = locals.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate and parse incoming body
    const validatedData = await validateRequestBody(request, partialEntityInputSchema);

    const entityService = createEntityService(locals.runtime.env.DB);
    const updatedEntity = await entityService.updateEntity(
      entityId,
      validatedData as EntityInput,
      userId
    );

    return new Response(JSON.stringify(updatedEntity), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
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
      {
        status: appError.status,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * DELETE /api/entities/[id]
 * 
 * Deletes an entity.
 * Validates that the requesting user owns the entity.
 */
export async function DELETE({ params, request, locals }: APIContext) {
  try {
    const entityId = params.id;
    if (!entityId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Entity ID is required in path.', 400);
    }

    const userId = locals.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const entityService = createEntityService(locals.runtime.env.DB);
    const success = await entityService.deleteEntity(entityId, userId);

    if (!success) {
      throw new AppError(ErrorCode.SERVER_ERROR, 'Failed to delete entity.', 500);
    }

    return new Response(
      JSON.stringify({ message: 'Entity deleted successfully.' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error: unknown) {
    const appError = handleError(error);
    return new Response(
      JSON.stringify({ error: appError.message, code: appError.code }),
      {
        status: appError.status,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}