// tests/unit/entity.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntityService, createEntityService } from '../../src/lib/services/entity-service';
import type { EntityInput, Entity } from '../../src/types/entity';
import type { DbEntity } from '../../src/db/schema';
import { AppError, ErrorCode } from '../../src/utils/errors';
import type { D1Database } from '@cloudflare/workers-types';

// Mock the Database wrapper from '@/db/db'
// We will mock its methods: query, queryOne, execute
const mockDbQuery = vi.fn();
const mockDbQueryOne = vi.fn();
const mockDbExecute = vi.fn();

vi.mock('@db/db', () => ({
  createDbClient: vi.fn(() => ({
    query: mockDbQuery,
    queryOne: mockDbQueryOne,
    execute: mockDbExecute,
    // batch: vi.fn(), // Add if EntityService uses batch
    // d1Instance: {} // Add if EntityService uses d1Instance
  })),
  // Export other things if needed by the service, though unlikely for EntityService
}));

// Mock D1Database type for constructor
const mockD1Instance = {} as D1Database;


describe('EntityService', () => {
  let entityService: EntityService;
  const testUserId = 'user-test-123';
  const now = Math.floor(Date.now() / 1000);

  beforeEach(() => {
    vi.clearAllMocks(); // Clear mocks before each test
    entityService = createEntityService(mockD1Instance); // Create a new service instance
  });

  describe('getAllEntities', () => {
    it('should return all entities for a user', async () => {
      const mockDbEntities: DbEntity[] = [
        { id: 'ent-1', user_id: testUserId, name: 'Entity 1', created_at: now, updated_at: now },
        { id: 'ent-2', user_id: testUserId, name: 'Entity 2', created_at: now, updated_at: now },
      ];
      mockDbQuery.mockResolvedValue(mockDbEntities);

      const result = await entityService.getAllEntities(testUserId);

      expect(mockDbQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, user_id, name, legal_name, ein, address, legal_address, business_type, parent_id, created_at, updated_at FROM entities WHERE user_id = ? ORDER BY name'),
        [testUserId]
      );
      expect(result).toEqual(mockDbEntities.map(e => ({...e}))); // Simple map for now
      expect(result.length).toBe(2);
    });

    it('should throw AppError if database query fails', async () => {
      mockDbQuery.mockRejectedValue(new Error('DB query failed'));
      await expect(entityService.getAllEntities(testUserId))
        .rejects.toThrow(AppError);
      await expect(entityService.getAllEntities(testUserId))
        .rejects.toMatchObject({ code: ErrorCode.DATABASE_ERROR });
    });
  });

  describe('getEntityById', () => {
    it('should return an entity if found for the user', async () => {
      const mockDbEntity: DbEntity = { id: 'ent-1', user_id: testUserId, name: 'Entity 1', created_at: now, updated_at: now };
      mockDbQueryOne.mockResolvedValue(mockDbEntity);

      const result = await entityService.getEntityById('ent-1', testUserId);

      expect(mockDbQueryOne).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, user_id, name, legal_name, ein, address, legal_address, business_type, parent_id, created_at, updated_at FROM entities WHERE id = ? AND user_id = ?'),
        ['ent-1', testUserId]
      );
      expect(result).toEqual({...mockDbEntity});
    });

    it('should return null if entity not found', async () => {
      mockDbQueryOne.mockResolvedValue(null);
      const result = await entityService.getEntityById('ent-nonexistent', testUserId);
      expect(result).toBeNull();
    });
  });

  describe('createEntity', () => {
    const entityInput: EntityInput = { name: 'New Entity', business_type: 'llc' };
    const createdDbEntity: DbEntity = { 
      id: expect.any(String), // crypto.randomUUID() will generate this
      user_id: testUserId, 
      name: 'New Entity', 
      business_type: 'llc',
      created_at: expect.any(Number), 
      updated_at: expect.any(Number) 
    };

    it('should create and return a new entity', async () => {
      mockDbExecute.mockResolvedValue({ success: true, meta: { changes: 1 } });
      // Mock the subsequent getEntityById call which happens after creation
      mockDbQueryOne.mockImplementation((sql, params) => {
        // Check if it's the getEntityById call
        if (sql.includes('WHERE id = ? AND user_id = ?') && params && params.length === 2 && params[1] === testUserId) {
          return Promise.resolve({ ...createdDbEntity, id: params[0] as string }); // Return the entity with the generated ID
        }
        return Promise.resolve(null);
      });
      // Mock getEntityById for parent check (no parent in this case)
      // No, createEntity calls this.getEntityById, so we mock the underlying db.queryOne for that
      // For parent_id validation, if entityInput.parent_id is provided:
      // mockDbQueryOne.mockResolvedValueOnce(null or mockParentEntity) for parent check

      const result = await entityService.createEntity(entityInput, testUserId);

      expect(mockDbExecute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO entities'),
        expect.arrayContaining([testUserId, 'New Entity', 'llc'])
      );
      expect(result.name).toBe(entityInput.name);
      expect(result.user_id).toBe(testUserId);
      expect(result.id).toEqual(expect.any(String)); // UUID
    });

    it('should throw validation error if parent entity does not exist', async () => {
      const inputWithParent: EntityInput = { ...entityInput, parent_id: 'parent-nonexistent' };
      // Mock getEntityById (which createEntity calls for parent validation) to return null
      mockDbQueryOne.mockResolvedValue(null); // For the parent check

      await expect(entityService.createEntity(inputWithParent, testUserId))
        .rejects.toThrow(AppError);
      await expect(entityService.createEntity(inputWithParent, testUserId))
        .rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR, message: expect.stringContaining('Parent entity does not exist') });
    });
     it('should throw AppError if database execute fails', async () => {
      mockDbExecute.mockResolvedValue({ success: false, error: 'DB insert failed' });
       await expect(entityService.createEntity(entityInput, testUserId))
        .rejects.toThrow(AppError);
      await expect(entityService.createEntity(entityInput, testUserId))
        .rejects.toMatchObject({ code: ErrorCode.DATABASE_ERROR, message: 'DB insert failed' });
    });
  });

  describe('updateEntity', () => {
    const entityId = 'ent-to-update';
    const existingDbEntity: DbEntity = { id: entityId, user_id: testUserId, name: 'Old Name', created_at: now, updated_at: now };
    const updateData: Partial<EntityInput> = { name: 'Updated Name', business_type: 'corporation' };
    
    it('should update and return the entity', async () => {
      // 1. Mock for getEntityById (initial fetch of existing entity)
      mockDbQueryOne.mockResolvedValueOnce(existingDbEntity); 
      // 2. Mock for db.execute (the UPDATE statement)
      mockDbExecute.mockResolvedValue({ success: true, meta: { changes: 1 } });
      // 3. Mock for getEntityById (fetching the updated entity)
      mockDbQueryOne.mockResolvedValueOnce({ 
          ...existingDbEntity, 
          name: 'Updated Name', 
          business_type: 'corporation', 
          updated_at: expect.any(Number) 
      });

      const result = await entityService.updateEntity(entityId, updateData, testUserId);

      expect(mockDbQueryOne).toHaveBeenCalledWith(expect.stringContaining('WHERE id = ? AND user_id = ?'), [entityId, testUserId]);
      expect(mockDbExecute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE entities SET name = ?, business_type = ?, updated_at = ? WHERE id = ? AND user_id = ?'),
        ['Updated Name', 'corporation', expect.any(Number), entityId, testUserId]
      );
      expect(result.name).toBe('Updated Name');
      expect(result.business_type).toBe('corporation');
    });

    it('should throw NOT_FOUND if entity to update does not exist', async () => {
      mockDbQueryOne.mockResolvedValue(null); // For initial getEntityById
      await expect(entityService.updateEntity(entityId, updateData, testUserId))
        .rejects.toThrow(AppError);
      await expect(entityService.updateEntity(entityId, updateData, testUserId))
        .rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
    });

    it('should throw VALIDATION_ERROR for circular parent reference', async () => {
      const parentId = 'parent-1';
      const childId = 'child-1';
      const grandChildId = 'grandchild-1';

      const parent: DbEntity = { id: parentId, user_id: testUserId, name: 'Parent', parent_id: null, created_at: now, updated_at: now };
      const child: DbEntity = { id: childId, user_id: testUserId, name: 'Child', parent_id: parentId, created_at: now, updated_at: now };
      // Grandchild is not explicitly needed for this specific update test on 'parent'

      // 1. Initial getEntityById for 'parent' (the one being updated)
      mockDbQueryOne.mockResolvedValueOnce(parent); 
      // 2. When checking the new parent_id ('childId'), getEntityById for 'childId'
      mockDbQueryOne.mockResolvedValueOnce(child); 
      // 3. When traversing up from 'childId', its parent is 'parentId'
      //    getEntityById for 'parentId' (which is the entity being updated)
      mockDbQueryOne.mockResolvedValueOnce(parent); 
      
      await expect(entityService.updateEntity(parentId, { parent_id: childId }, testUserId))
        .rejects.toThrow(AppError);
      await expect(entityService.updateEntity(parentId, { parent_id: childId }, testUserId))
        .rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR, message: 'Circular parent-child relationship detected.' });
    });
  });

  describe('deleteEntity', () => {
    const entityId = 'ent-to-delete';
    const existingDbEntity: DbEntity = { id: entityId, user_id: testUserId, name: 'To Delete', created_at: now, updated_at: now };

    it('should delete an entity successfully', async () => {
      mockDbQueryOne.mockResolvedValueOnce(existingDbEntity); // For initial getEntityById
      mockDbQuery.mockResolvedValueOnce([]); // For getChildEntities (no children)
      mockDbExecute.mockResolvedValue({ success: true, meta: { changes: 1 } }); // For DELETE

      const result = await entityService.deleteEntity(entityId, testUserId);
      expect(result).toBe(true);
      expect(mockDbExecute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM entities WHERE id = ? AND user_id = ?'),
        [entityId, testUserId]
      );
    });

    it('should throw VALIDATION_ERROR if entity has child entities', async () => {
      mockDbQueryOne.mockResolvedValueOnce(existingDbEntity); // For initial getEntityById
      mockDbQuery.mockResolvedValueOnce([{ id: 'child-1', user_id: testUserId, name: 'Child', parent_id: entityId, created_at: now, updated_at: now }]); // Has children

      await expect(entityService.deleteEntity(entityId, testUserId))
        .rejects.toThrow(AppError);
      await expect(entityService.deleteEntity(entityId, testUserId))
        .rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR, message: expect.stringContaining('Cannot delete entity with child entities') });
    });
  });
});

// --- Basic Structure for EntityAccountService Tests (Consider moving to a separate file) ---
// import { EntityAccountService, createEntityAccountService } from '../../src/lib/services/entity-account-service';
// import { createAccountService } from '../../src/lib/services/account-service'; // Mock this

// vi.mock('../../src/lib/services/account-service', () => ({
//   createAccountService: vi.fn(() => ({
//     getAccountById: vi.fn(),
//     getAllAccounts: vi.fn(),
//   }))
// }));
// vi.mock('../../src/lib/services/entity-service', () => ({ // Already mocked if in same file, else mock it
//   createEntityService: vi.fn(() => ({
//     getEntityById: vi.fn(),
//   }))
// }));


// describe('EntityAccountService', () => {
//   let entityAccountService: EntityAccountService;
//   let mockEntityServiceInstance;
//   let mockAccountServiceInstance;
//   const testUserId = 'user-test-123';

//   beforeEach(() => {
//     vi.clearAllMocks();
//     // Re-create service instances with fresh mocks if needed
//     // entityAccountService = createEntityAccountService(mockD1Instance);
//     // mockEntityServiceInstance = createEntityService(mockD1Instance); // Get the mocked instance
//     // mockAccountServiceInstance = createAccountService(mockD1Instance); // Get the mocked instance
//   });

//   // Example test (needs full mocking of dependencies)
//   it.todo('should link an account to an entity', async () => {
//     // Mock entityService.getEntityById to return an entity
//     // Mock accountService.getAccountById to return an account
//     // Mock db.queryOne for checking existing link (return null)
//     // Mock db.execute for the INSERT
//     // Mock db.queryOne for fetching the newly created link
//     // ... then call entityAccountService.createEntityAccount(...) and assert
//   });
// });
