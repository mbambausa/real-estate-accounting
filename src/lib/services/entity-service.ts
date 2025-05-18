// src/lib/services/entity-service.ts
import type { D1Database } from '@cloudflare/workers-types';
import { Database, createDbClient } from '@db/db';
import type { DbExecuteResult } from '@db/db';
import type { DbEntity } from '@db/schema';
import type { Entity, EntityInput } from '../../types/entity';
import { AppError, ErrorCode } from '@utils/errors';

/**
 * Maps a database entity record to the application-level Entity,
 * converting numeric flags (0/1) to booleans.
 */
function mapDbEntityToEntity(dbEntity: DbEntity): Entity {
  return {
    id: dbEntity.id,
    user_id: dbEntity.user_id,
    name: dbEntity.name,
    legal_name: dbEntity.legal_name,
    ein: dbEntity.ein,
    address: dbEntity.address,
    legal_address: dbEntity.legal_address,
    business_type: dbEntity.business_type,
    parent_id: dbEntity.parent_id,
    is_active: dbEntity.is_active === 1,
    allows_sub_entities: dbEntity.allows_sub_entities === 1,
    created_at: dbEntity.created_at,
    updated_at: dbEntity.updated_at,
  } as Entity;
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
   * Retrieves all entities for a given user.
   */
  async getAllEntities(userId: string): Promise<Entity[]> {
    const sql = `
      SELECT id, user_id, name, legal_name, ein, address, legal_address,
             business_type, parent_id, is_active, allows_sub_entities, created_at, updated_at
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
   * Retrieves a single entity by ID for a user.
   */
  async getEntityById(id: string, userId: string): Promise<Entity | null> {
    const sql = `
      SELECT id, user_id, name, legal_name, ein, address, legal_address,
             business_type, parent_id, is_active, allows_sub_entities, created_at, updated_at
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
   * Retrieves child entities of a given parent for a user.
   */
  async getChildEntities(parentId: string, userId: string): Promise<Entity[]> {
    const sql = `
      SELECT id, user_id, name, legal_name, ein, address, legal_address,
             business_type, parent_id, is_active, allows_sub_entities, created_at, updated_at
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
   * Creates a new entity.
   */
  async createEntity(entityData: EntityInput, userId: string): Promise<Entity> {
    // Validate parent if provided
    if (entityData.parent_id) {
      const parent = await this.getEntityById(entityData.parent_id, userId);
      if (!parent) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Parent entity does not exist or does not belong to the user.',
          400
        );
      }
    }

    const entityId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    const sql = `
      INSERT INTO entities (
        id, user_id, name, legal_name, ein, address, legal_address,
        business_type, parent_id, is_active, allows_sub_entities, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      entityId,
      userId,
      entityData.name,
      entityData.legal_name || null,
      entityData.ein || null,
      entityData.address || null,
      entityData.legal_address || null,
      entityData.business_type || null,
      entityData.parent_id || null,
      entityData.is_active ? 1 : 0,
      entityData.allows_sub_entities ? 1 : 0,
      now,
      now
    ];

    try {
      const result: DbExecuteResult = await this.db.execute(sql, params);
      if (!result.success) {
        throw new AppError(ErrorCode.DATABASE_ERROR, result.error || 'Failed to create entity.', 500);
      }
      const newEntity = await this.getEntityById(entityId, userId);
      if (!newEntity) {
        throw new AppError(
          ErrorCode.DATABASE_ERROR,
          'Entity was created but could not be retrieved.',
          500
        );
      }
      return newEntity;
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      console.error('EntityService.createEntity error:', error);
      throw new AppError(
        ErrorCode.DATABASE_ERROR,
        'An unexpected error occurred while creating the entity.',
        500,
        error
      );
    }
  }

  /**
   * Updates an existing entity.
   */
  async updateEntity(
    id: string,
    entityData: Partial<EntityInput>,
    userId: string
  ): Promise<Entity> {
    const existing = await this.getEntityById(id, userId);
    if (!existing) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Entity not found or access denied.', 404);
    }

    // Validate parent change
    if (
      entityData.parent_id &&
      entityData.parent_id !== existing.parent_id
    ) {
      if (entityData.parent_id === id) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'An entity cannot be its own parent.',
          400
        );
      }
      const parent = await this.getEntityById(entityData.parent_id, userId);
      if (!parent) {
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'Parent entity does not exist or does not belong to the user.',
          400
        );
      }
      // Circular check omitted for brevity
    }

    const updates: string[] = [];
    const values: any[] = [];
    const now = Math.floor(Date.now() / 1000);

    function addField< K extends keyof EntityInput >(key: K, dbCol: string, transform?: (v: any) => any) {
      if (entityData[key] !== undefined) {
        const newVal = transform ? transform(entityData[key]) : entityData[key];
        updates.push(`${dbCol} = ?`);
        values.push(newVal);
      }
    }

    addField('name', 'name');
    addField('legal_name', 'legal_name');
    addField('ein', 'ein');
    addField('address', 'address');
    addField('legal_address', 'legal_address');
    addField('business_type', 'business_type');
    addField('parent_id', 'parent_id');
    addField('is_active', 'is_active', v => (v ? 1 : 0));
    addField('allows_sub_entities', 'allows_sub_entities', v => (v ? 1 : 0));

    updates.push('updated_at = ?');
    values.push(now);

    if (updates.length === 0) {
      return existing;
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
      const updated = await this.getEntityById(id, userId);
      if (!updated) {
        throw new AppError(
          ErrorCode.DATABASE_ERROR,
          'Entity was updated but could not be retrieved.',
          500
        );
      }
      return updated;
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      console.error('EntityService.updateEntity error:', error);
      throw new AppError(
        ErrorCode.DATABASE_ERROR,
        'An unexpected error occurred while updating the entity.',
        500,
        error
      );
    }
  }

  /**
   * Deletes an entity.
   */
  async deleteEntity(id: string, userId: string): Promise<boolean> {
    const existing = await this.getEntityById(id, userId);
    if (!existing) {
      throw new AppError(ErrorCode.NOT_FOUND, 'Entity not found or access denied.', 404);
    }

    const children = await this.getChildEntities(id, userId);
    if (children.length > 0) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Cannot delete entity with child entities. Reassign or remove children first.',
        400
      );
    }

    const sql = `DELETE FROM entities WHERE id = ? AND user_id = ?`;
    try {
      const result = await this.db.execute(sql, [id, userId]);
      return result.success && ((result.meta?.changes ?? 0) > 0);
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      console.error('EntityService.deleteEntity error:', error);
      throw new AppError(
        ErrorCode.DATABASE_ERROR,
        'An unexpected error occurred while deleting the entity.',
        500,
        error
      );
    }
  }
}

export function createEntityService(d1: D1Database): EntityService {
  return new EntityService(d1);
}
