// src/functions/api/entities/[id].ts
import type { APIContext } from 'astro';
import { createEntityService } from '@lib/services/entity-service';
import type { EntityInput } from '../../../types/entity'; // Use a relative path
import { AppError, ErrorCode, handleError } from '@utils/errors';
import { getCurrentUserId } from '@lib/auth';

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

    // Use our auth helper to get the current user's ID
    const userId = await getCurrentUserId(request, locals.runtime.env);
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
    return new Response(JSON.stringify({ error: appError.message, code: appError.code }), {
      status: appError.status,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * PUT /api/entities/[id]
 * 
 * Updates an existing entity.
 * Validates that the requesting user owns the entity.
 */
export async function PUT({ params, request, locals }: APIContext) {
  try {
    const entityId = params.id;
    if (!entityId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Entity ID is required in path.', 400);
    }

    // Use our auth helper to get the current user's ID
    const userId = await getCurrentUserId(request, locals.runtime.env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const entityData = await request.json() as Partial<EntityInput>;
    
    const entityService = createEntityService(locals.runtime.env.DB);
    const updatedEntity = await entityService.updateEntity(entityId, entityData, userId);
    
    return new Response(JSON.stringify(updatedEntity), {
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

    // Use our auth helper to get the current user's ID
    const userId = await getCurrentUserId(request, locals.runtime.env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const entityService = createEntityService(locals.runtime.env.DB);
    const success = await entityService.deleteEntity(entityId, userId);
    
    if (!success) {
      // Changed to SERVER_ERROR to match your ErrorCode enum
      throw new AppError(ErrorCode.SERVER_ERROR, 'Failed to delete entity.', 500);
    }
    
    return new Response(JSON.stringify({ message: 'Entity deleted successfully.' }), {
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