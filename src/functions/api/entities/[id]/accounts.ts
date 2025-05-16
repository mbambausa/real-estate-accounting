// src/functions/api/entities/[id]/accounts.ts
import type { APIContext } from 'astro';
// EntityService is needed to validate entity ownership before fetching/modifying its accounts
import { createEntityService } from '@lib/services/entity-service'; 
import { createEntityAccountService } from '@lib/services/entity-account-service';
// Use the input type defined in EntityAccountService
import type { EntityAccountInput } from '@lib/services/entity-account-service'; 
import { AppError, ErrorCode, handleError } from '@utils/errors';
import { getCurrentUserId } from '@lib/auth';

// Define the expected structure of the request body
interface EntityAccountRequestBody {
  account_id: string;
  custom_name?: string | null;
  is_active?: boolean;
  recovery_type?: string | null;
  recovery_percentage?: number | null;
}

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

    // Create the entity account service
    const entityAccountService = createEntityAccountService(locals.runtime.env.DB);
    // Get accounts for the entity, with user ID for ownership verification
    const accounts = await entityAccountService.getAccountsForEntity(entityId, userId);
    
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
 * POST /api/entities/[id]/accounts
 * 
 * Links an account from the Chart of Accounts to a specific entity.
 * Validates entity ownership and account existence.
 */
export async function POST({ params, request, locals }: APIContext) {
  try {
    const entityIdFromPath = params.id;
    if (!entityIdFromPath) {
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

    // Add type assertion to request.json() to define structure
    const requestBody = await request.json() as EntityAccountRequestBody;
    
    // Construct the input for the service, ensuring entity_id from path is used.
    // The service expects `account_id` (UUID of chart_of_accounts record), not `account_code`.
    const entityAccountLinkData: EntityAccountInput = {
      entity_id: entityIdFromPath,
      account_id: requestBody.account_id, // CRITICAL: Expect account_id (UUID) from client
      custom_name: requestBody.custom_name,
      is_active: requestBody.is_active,
      recovery_type: requestBody.recovery_type,
      recovery_percentage: requestBody.recovery_percentage,
    };
    
    if (!entityAccountLinkData.account_id) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, 'Account ID (account_id) is required in request body.', 400);
    }
    
    const entityAccountService = createEntityAccountService(locals.runtime.env.DB);
    // Pass userId to ensure proper ownership verification in the service
    const newEntityAccountLink = await entityAccountService.createEntityAccount(entityAccountLinkData, userId);
    
    return new Response(JSON.stringify(newEntityAccountLink), {
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