// src/functions/api/entities/index.ts
import type { APIContext } from 'astro';
import { createEntityService } from '@lib/services/entity-service';
import type { EntityInput } from '../../../types/entity'; // Fixed import path
import { AppError, ErrorCode, handleError } from '@utils/errors';
import { getCurrentUserId } from '@lib/auth';

/**
 * GET /api/entities
 * 
 * Retrieves all entities owned by the current user.
 * Results are filtered by user ownership for multi-tenant security.
 */
export async function GET({ request, locals }: APIContext) {
  try {
    // Use our auth helper to get the current user's ID
    const userId = await getCurrentUserId(request, locals.runtime.env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const entityService = createEntityService(locals.runtime.env.DB);
    const entities = await entityService.getAllEntities(userId);
    
    return new Response(JSON.stringify(entities), {
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
 * POST /api/entities
 * 
 * Creates a new entity owned by the current user.
 * Validates required fields and ensures data is properly associated with the user.
 */
export async function POST({ request, locals }: APIContext) {
  try {
    // Use our auth helper to get the current user's ID
    const userId = await getCurrentUserId(request, locals.runtime.env);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const entityData = await request.json() as EntityInput;
    
    if (!entityData.name) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR, 
        'Entity name is required.', 
        400
      );
    }
    
    const entityService = createEntityService(locals.runtime.env.DB);
    const newEntity = await entityService.createEntity(entityData, userId);
    
    return new Response(JSON.stringify(newEntity), {
      status: 201, // Correct status code for resource creation
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