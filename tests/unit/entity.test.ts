// tests/unit/entity.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntityService, createEntityService } from '../../src/lib/services/entity-service';
import type { EntityInput, Entity } from '../../src/types/entity'; // App-level Entity
import type { DbEntity } from '../../src/db/schema'; // DB-level Entity
import { AppError, ErrorCode } from '../../src/utils/errors';
import type { D1Database } from '@cloudflare/workers-types';

const mockDbQuery = vi.fn();
const mockDbQueryOne = vi.fn();
const mockDbExecute = vi.fn();

vi.mock('@db/db', () => ({
  createDbClient: vi.fn(() => ({
    query: mockDbQuery,
    queryOne: mockDbQueryOne,
    execute: mockDbExecute,
  })),
}));

const mockD1Instance = {} as D1Database;

describe('EntityService', () => {
  let entityService: EntityService;
  const testUserId = 'user-test-123';
  const now = Math.floor(Date.now() / 1000);

  // Helper to create a complete mock DbEntity with defaults for nullable fields
  const createMockDbEntity = (overrides: Partial<DbEntity> & { id: string; user_id: string; name: string; }): DbEntity => {
    return {
      legal_name: null,
      ein: null,
      address: null,
      legal_address: null,
      business_type: null,
      parent_id: null,
      is_active: 1, // Default to active
      allows_sub_entities: 0, // Default to not allowing
      created_at: now,
      updated_at: now,
      ...overrides,
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    entityService = createEntityService(mockD1Instance);
  });

  describe('getAllEntities', () => {
    it('should return all entities for a user, mapped to Entity type', async () => {
      const mockDbEntitiesData: Array<Partial<DbEntity> & { id: string; user_id: string; name: string; }> = [
        { id: 'ent-1', user_id: testUserId, name: 'Entity 1', is_active: 1, allows_sub_entities: 0 },
        { id: 'ent-2', user_id: testUserId, name: 'Entity 2', is_active: 0, allows_sub_entities: 1 },
      ];
      const mockDbEntities = mockDbEntitiesData.map(e => createMockDbEntity(e));
      mockDbQuery.mockResolvedValue(mockDbEntities);

      const result = await entityService.getAllEntities(testUserId);

      expect(mockDbQuery).toHaveBeenCalledWith(
        // Using a general matcher for the SQL string as field order might vary
        expect.stringMatching(/SELECT .* FROM entities WHERE user_id = \? ORDER BY name/i),
        [testUserId]
      );
      expect(result.length).toBe(2);
      // Check for mapped boolean values
      expect(result[0]).toEqual(expect.objectContaining({ id: 'ent-1', name: 'Entity 1', is_active: true, allows_sub_entities: false }));
      expect(result[1]).toEqual(expect.objectContaining({ id: 'ent-2', name: 'Entity 2', is_active: false, allows_sub_entities: true }));
    });

    // ... (other tests in getAllEntities)
  });

  describe('getEntityById', () => {
    it('should return a mapped entity if found for the user', async () => {
      const mockDbEntityData: Partial<DbEntity> & { id: string; user_id: string; name: string; } = 
        { id: 'ent-1', user_id: testUserId, name: 'Entity 1', is_active: 1, allows_sub_entities: 1 };
      const mockDbEntity = createMockDbEntity(mockDbEntityData);
      mockDbQueryOne.mockResolvedValue(mockDbEntity);

      const result = await entityService.getEntityById('ent-1', testUserId);
      expect(result).toEqual(expect.objectContaining({ id: 'ent-1', name: 'Entity 1', is_active: true, allows_sub_entities: true }));
    });
    // ... (other tests in getEntityById)
  });

  describe('createEntity', () => {
    const entityInput: EntityInput = { name: 'New Entity Name', legal_name: 'New Entity LLC', business_type: 'llc', is_active: true, allows_sub_entities: false };
    
    it('should create and return a new mapped entity', async () => {
      mockDbExecute.mockResolvedValue({ success: true, meta: { changes: 1 } });
      
      // This mock is for the getEntityById call *after* successful creation
      mockDbQueryOne.mockImplementation(async (sql, params) => {
        const newId = params[0] as string; // Assuming ID is the first param in getEntityById
        return createMockDbEntity({
            id: newId,
            user_id: testUserId,
            name: entityInput.name,
            legal_name: entityInput.legal_name,
            business_type: entityInput.business_type,
            is_active: entityInput.is_active ? 1 : 0,
            allows_sub_entities: entityInput.allows_sub_entities ? 1 : 0,
        });
      });

      const result = await entityService.createEntity(entityInput, testUserId);

      expect(mockDbExecute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO entities'),
        expect.arrayContaining([
          expect.any(String), // id
          testUserId,
          entityInput.name,
          entityInput.legal_name,
          // ... other fields from entityInput correctly mapped to DB values (e.g., booleans to 0/1)
          entityInput.is_active ? 1 : 0,
          entityInput.allows_sub_entities ? 1 : 0,
        ])
      );
      expect(result.name).toBe(entityInput.name);
      expect(result.is_active).toBe(true); // Check mapped boolean
      expect(result.id).toEqual(expect.any(String));
    });
    // ... (other tests in createEntity, ensure mockDbQueryOne for parent check uses createMockDbEntity or null)
  });

  describe('updateEntity', () => {
    const entityId = 'ent-to-update';
    const existingDbEntityData: Partial<DbEntity> & { id: string; user_id: string; name: string; } = { 
        id: entityId, user_id: testUserId, name: 'Old Name', legal_name: 'Old Legal', is_active: 1, allows_sub_entities: 0 
    };
    const mockExistingDbEntity = createMockDbEntity(existingDbEntityData);
    const updateData: Partial<EntityInput> = { name: 'Updated Name', legal_name: 'Updated Legal LLC', is_active: false };
    
    it('should update and return the mapped entity', async () => {
      mockDbQueryOne.mockResolvedValueOnce(mockExistingDbEntity); // Initial fetch
      mockDbExecute.mockResolvedValue({ success: true, meta: { changes: 1 } });
      mockDbQueryOne.mockResolvedValueOnce(createMockDbEntity({ // Fetch after update
          ...existingDbEntityData,
          name: 'Updated Name',
          legal_name: 'Updated Legal LLC',
          is_active: 0, // from updateData.is_active: false
          updated_at: expect.any(Number) 
      }));

      const result = await entityService.updateEntity(entityId, updateData, testUserId);
      expect(mockDbExecute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE entities SET name = ?, legal_name = ?, is_active = ?, updated_at = ? WHERE id = ? AND user_id = ?'),
        ['Updated Name', 'Updated Legal LLC', 0, expect.any(Number), entityId, testUserId]
      );
      expect(result.name).toBe('Updated Name');
      expect(result.is_active).toBe(false); // Check mapped boolean
    });
    // ... (other tests in updateEntity, ensure mockDbQueryOne for parent checks uses createMockDbEntity or null)

    it('should throw VALIDATION_ERROR for circular parent reference', async () => {
      const parentId = 'parent-1';
      const childId = 'child-1';

      const parentData: Partial<DbEntity> & { id: string; user_id: string; name: string; } = { id: parentId, user_id: testUserId, name: 'Parent', parent_id: null };
      const childData: Partial<DbEntity> & { id: string; user_id: string; name: string; } = { id: childId, user_id: testUserId, name: 'Child', parent_id: parentId };
      
      const mockParentDb = createMockDbEntity(parentData);
      const mockChildDb = createMockDbEntity(childData);

      // 1. Initial getEntityById for 'parent' (the one being updated)
      mockDbQueryOne.mockResolvedValueOnce(mockParentDb); 
      // 2. When checking the new parent_id ('childId'), getEntityById for 'childId'
      mockDbQueryOne.mockResolvedValueOnce(mockChildDb); 
      // 3. When traversing up from 'childId', its parent is 'parentId'
      //    getEntityById for 'parentId' (which is the entity being updated)
      mockDbQueryOne.mockResolvedValueOnce(mockParentDb); 
      
      // The service's updateEntity now has a more complex circular check.
      // This mock setup might need adjustment based on the exact calls made by checkCircularDependency.
      // For now, assuming it correctly makes these three getEntityById calls via db.queryOne
      await expect(entityService.updateEntity(parentId, { parent_id: childId }, testUserId))
        .rejects.toThrow(new AppError(ErrorCode.VALIDATION_ERROR, 'Circular parent-child relationship detected. An entity cannot be its own ancestor.'));
    });
  });

  describe('deleteEntity', () => {
    const entityId = 'ent-to-delete';
    const existingDbEntityData: Partial<DbEntity> & { id: string; user_id: string; name: string; } = { 
        id: entityId, user_id: testUserId, name: 'To Delete' 
    };
    const mockExistingDbEntity = createMockDbEntity(existingDbEntityData);

    it('should delete an entity successfully', async () => {
      mockDbQueryOne.mockResolvedValueOnce(mockExistingDbEntity); 
      mockDbQuery.mockResolvedValueOnce([]); // For getChildEntities (no children)
      mockDbExecute.mockResolvedValue({ success: true, meta: { changes: 1 } });

      const result = await entityService.deleteEntity(entityId, testUserId);
      expect(result).toBe(true);
    });

    it('should throw VALIDATION_ERROR if entity has child entities', async () => {
      mockDbQueryOne.mockResolvedValueOnce(mockExistingDbEntity); 
      mockDbQuery.mockResolvedValueOnce([createMockDbEntity({ id: 'child-1', user_id: testUserId, name: 'Child', parent_id: entityId })]); // Has children

      await expect(entityService.deleteEntity(entityId, testUserId))
        .rejects.toThrow(new AppError(ErrorCode.VALIDATION_ERROR, 'Cannot delete entity with child entities. Reassign or remove children first.'));
    });
  });
});