// src/lib/services/entity-service.ts
import type { D1Database } from '@cloudflare/workers-types';
import { Database, createDbClient } from '@db/db';
import type { DbExecuteResult } from '@db/db';
import type { DbEntity } from '@db/schema';
import type { Entity, EntityInput } from '../../types/entity';
import { AppError, ErrorCode } from '@utils/errors';

// Helper function to convert DbEntity to Entity (if they differ, e.g. for date formats)
// For now, they are structurally similar after D1 schema update (timestamps are numbers)
function mapDbEntityToEntity(dbEntity: DbEntity): Entity {
  return dbEntity as Entity;
}

function mapDbEntitiesToEntities(dbEntities: DbEntity[]): Entity[] {
  return dbEntities.map(mapDbEntityToEntity);
}

export class EntityService {
  private db: Database;

  constructor(d1: D1Database) {
    this.db = createDbClient(d1);
  }

  /**
   * Get all entities for a user.
   * @param userId The ID of the user.
   * @returns A promise that resolves to an array of Entity objects.
   */
  async getAllEntities(userId: string): Promise<Entity[]> {
    const sql = `
      SELECT id, user_id, name, legal_name, ein, address, legal_address, 
             business_type, parent_id, created_at, updated_at
      FROM entities
      WHERE user_id = ?
      ORDER BY name
    `;
    try {
      const dbEntities = await this.db.query<DbEntity>(sql, [userId]);
      return mapDbEntitiesToEntities(dbEntities);
    } catch (error: unknown) {
      console.error('EntityService.getAllEntities error:', error);
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to retrieve entities.', 500, error);
    }
  }

  /**
   * Get an entity by its ID, ensuring it belongs to the specified user.
   * @param id The ID of the entity.
   * @param userId The ID of the user.
   * @returns A promise that resolves to an Entity object or null if not found.
   */
  async getEntityById(id: string, userId: string): Promise<Entity | null> {
    const sql = `
      SELECT id, user_id, name, legal_name, ein, address, legal_address, 
             business_type, parent_id, created_at, updated_at
      FROM entities
      WHERE id = ? AND user_id = ?
    `;
    try {
      const dbEntity = await this.db.queryOne<DbEntity>(sql, [id, userId]);
      return dbEntity ? mapDbEntityToEntity(dbEntity) : null;
    } catch (error: unknown) {
      console.error('EntityService.getEntityById error:', error);
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to retrieve entity.', 500, error);
    }
  }

  /**
   * Get child entities for a parent entity, ensuring they belong to the specified user.
   * @param parentId The ID of the parent entity.
   * @param userId The ID of the user.
   * @returns A promise that resolves to an array of Entity objects.
   */
  async getChildEntities(parentId: string, userId: string): Promise<Entity[]> {
    const sql = `
      SELECT id, user_id, name, legal_name, ein, address, legal_address, 
             business_type, parent_id, created_at, updated_at
      FROM entities
      WHERE parent_id = ? AND user_id = ?
      ORDER BY name
    `;
    try {
      const dbEntities = await this.db.query<DbEntity>(sql, [parentId, userId]);
      return mapDbEntitiesToEntities(dbEntities);
    } catch (error: unknown) {
      console.error('EntityService.getChildEntities error:', error);
      throw new AppError(ErrorCode.DATABASE_ERROR, 'Failed to retrieve child entities.', 500, error);
    }
  }

  /**
   * Create a new entity for a user.
   * @param entityData The data for the new entity.
   * @param userId The ID of the user creating the entity.
   * @returns A promise that resolves to the newly created Entity object.
   */
  async createEntity(entityData: EntityInput, userId: string): Promise<Entity> {
    // Validate parent entity if provided
    if (entityData.parent_id) {
      const parentExists = await this.getEntityById(entityData.parent_id, userId);
      if (!parentExists) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Parent entity does not exist or does not belong to the user.',
          400
        );
      }
    }

    const entityId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000); // Unix timestamp in seconds

    const sql = `
      INSERT INTO entities (
        id, user_id, name, legal_name, ein, address, legal_address, 
        business_type, parent_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      entityId, userId, entityData.name, entityData.legal_name || null,
      entityData.ein || null, entityData.address || null, entityData.legal_address || null,
      entityData.business_type || null, entityData.parent_id || null, now, now
    ];

    try {
      const result: DbExecuteResult = await this.db.execute(sql, params);
      if (!result.success) {
        throw new AppError(ErrorCode.DATABASE_ERROR, result.error || 'Failed to create entity.', 500);
      }

      // D1's last_row_id is not reliable for UUIDs. Fetch the new entity by its generated ID.
      const newEntity = await this.getEntityById(entityId, userId);
      if (!newEntity) {
        // This case should ideally not happen if insert was successful and ID is correct
        throw new AppError(ErrorCode.DATABASE_ERROR, 'Entity was created but could not be retrieved.', 500);
      }
      return newEntity;
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      console.error('EntityService.createEntity error:', error);
      throw new AppError(ErrorCode.DATABASE_ERROR, 'An unexpected error occurred while creating the entity.', 500, error);
    }
  }

  /**
   * Update an existing entity.
   * @param id The ID of the entity to update.
   * @param entityData The partial data to update the entity with.
   * @param userId The ID of the user who owns the entity.
   * @returns A promise that resolves to the updated Entity object.
   */
  async updateEntity(id: string, entityData: Partial<EntityInput>, userId: string): Promise<Entity> {
    const existingEntity = await this.getEntityById(id, userId);
    if (!existingEntity) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Entity not found or access denied.', 404);
    }

    // Validate parent entity if provided and changed
    if (entityData.parent_id && entityData.parent_id !== existingEntity.parent_id) {
      if (entityData.parent_id === id) { // Prevent self-parenting
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'An entity cannot be its own parent.', 400);
      }
      const parentExists = await this.getEntityById(entityData.parent_id, userId);
      if (!parentExists) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, 'Parent entity does not exist or does not belong to the user.', 400);
      }
      // More sophisticated circular dependency check (traversing up the parent chain)
      // Explicitly type currentParentId to allow null, as it will be assigned null
      // when traversing up to a root parent.
      // entityData.parent_id is known to be a string here due to the outer if condition.
      let currentParentId: string | null = entityData.parent_id;
      const visited = new Set<string>();
      while (currentParentId) {
        if (currentParentId === id) {
          throw new AppError(ErrorCode.VALIDATION_ERROR, 'Circular parent-child relationship detected.', 400);
        }
        if (visited.has(currentParentId)) break;
        visited.add(currentParentId);
        const parent = await this.getEntityById(currentParentId, userId);
        currentParentId = parent?.parent_id || null;
      }
    }

    // COMPLETE REWRITE OF THIS SECTION - build SQL manually to avoid TS errors
    const updates: string[] = [];
    const values: any[] = [];
    
    // Handle each field explicitly to avoid type issues
    if (entityData.name !== undefined) {
      updates.push("name = ?");
      values.push(entityData.name);
    }
    
    if (entityData.legal_name !== undefined) {
      updates.push("legal_name = ?");
      values.push(entityData.legal_name);
    }
    
    if (entityData.ein !== undefined) {
      updates.push("ein = ?");
      values.push(entityData.ein);
    }
    
    if (entityData.address !== undefined) {
      updates.push("address = ?");
      values.push(entityData.address);
    }
    
    if (entityData.legal_address !== undefined) {
      updates.push("legal_address = ?");
      values.push(entityData.legal_address);
    }
    
    if (entityData.business_type !== undefined) {
      updates.push("business_type = ?");
      values.push(entityData.business_type);
    }
    
    if (entityData.parent_id !== undefined) {
      updates.push("parent_id = ?");
      values.push(entityData.parent_id); // This can be null
    }
    
    // Add timestamp
    const now = Math.floor(Date.now() / 1000);
    updates.push("updated_at = ?");
    values.push(now);

    if (updates.length === 0) {
      return existingEntity; // No changes to apply
    }

    const sql = `
      UPDATE entities
      SET ${updates.join(', ')}
      WHERE id = ? AND user_id = ?
    `;
    const params = [...values, id, userId];

    try {
      const result: DbExecuteResult = await this.db.execute(sql, params);
      if (!result.success) {
        throw new AppError(ErrorCode.DATABASE_ERROR, result.error || 'Failed to update entity.', 500);
      }

      const updatedEntity = await this.getEntityById(id, userId);
      if (!updatedEntity) {
        throw new AppError(ErrorCode.DATABASE_ERROR, 'Entity was updated but could not be retrieved.', 500);
      }
      return updatedEntity;
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      console.error('EntityService.updateEntity error:', error);
      throw new AppError(ErrorCode.DATABASE_ERROR, 'An unexpected error occurred while updating the entity.', 500, error);
    }
  }

  /**
   * Delete an entity.
   * @param id The ID of the entity to delete.
   * @param userId The ID of the user who owns the entity.
   * @returns A promise that resolves to true if deletion was successful.
   */
  async deleteEntity(id: string, userId: string): Promise<boolean> {
    const entity = await this.getEntityById(id, userId);
    if (!entity) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Entity not found or access denied.', 404);
    }

    // Check for child entities
    const childEntities = await this.getChildEntities(id, userId);
    if (childEntities.length > 0) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Cannot delete entity with child entities. Remove or reassign child entities first.',
        400
      );
    }

    // TODO: Check for related transactions, entity_accounts, etc.
    // For now, we proceed with deletion. Add checks as other services are built.

    const sql = `DELETE FROM entities WHERE id = ? AND user_id = ?`;
    try {
      const result: DbExecuteResult = await this.db.execute(sql, [id, userId]);
      if (!result.success) {
        throw new AppError(ErrorCode.DATABASE_ERROR, result.error || 'Failed to delete entity.', 500);
      }
      // D1's `changes` meta property indicates rows affected.
      return (result.meta?.changes ?? 0) > 0;
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      console.error('EntityService.deleteEntity error:', error);
      throw new AppError(ErrorCode.DATABASE_ERROR, 'An unexpected error occurred while deleting the entity.', 500, error);
    }
  }
}

/**
 * Factory function to create an instance of EntityService.
 * @param d1 The D1Database instance.
 * @returns A new EntityService instance.
 */
export function createEntityService(d1: D1Database): EntityService {
  return new EntityService(d1);
}