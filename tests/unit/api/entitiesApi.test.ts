// tests/unit/api/entitiesApi.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIContext } from 'astro';
import { GET as getAllEntities, POST as createEntity } from '../../../src/functions/api/entities/index';
import { GET as getEntityById, PUT as updateEntityById, DELETE as deleteEntityById } from '../../../src/functions/api/entities/[id]';
import { AppError, ErrorCode } from '../../../src/utils/errors';
import type { RuntimeEnv } from '../../../src/env.d';
import type { EntityInput, Entity as AppEntity } from '../../../src/types/entity';
import type { DbEntity } from '../../../src/db/schema';
import * as zodSchemasModule from '../../../src/functions/api/utils/zodSchemas'; // For typing the mock

const mockEntityService = {
  getAllEntities: vi.fn(),
  getEntityById: vi.fn(),
  createEntity: vi.fn(),
  updateEntity: vi.fn(),
  deleteEntity: vi.fn(),
};

vi.mock('@lib/services/entity-service', () => ({
  createEntityService: vi.fn(() => mockEntityService),
}));

const mockValidateRequestBody = vi.fn();
// Corrected vi.mock for zodSchemas
vi.mock('@functions/api/utils/zodSchemas', async () => {
    const actualModule = await vi.importActual<typeof import('../../../src/functions/api/utils/zodSchemas')>('../../../src/functions/api/utils/zodSchemas');
    return {
      ...actualModule,
      validateRequestBody: mockValidateRequestBody,
    };
});

const testUserId = 'test-user-id-456';
const mockRuntimeEnv: Partial<RuntimeEnv> = {
  DB: {} as any,
};

// Helper to create an AppEntity mock (services return AppEntity which has boolean values)
const createAppEntityMock = (
    data: Partial<AppEntity> & { id: string; name: string; }
): AppEntity => {
    return {
        id: data.id,
        name: data.name,
        user_id: testUserId,
        legal_name: data.legal_name ?? null,
        ein: data.ein ?? null,
        address: data.address ?? null,
        legal_address: data.legal_address ?? null,
        business_type: data.business_type ?? 'llc',
        parent_id: data.parent_id ?? null,
        is_active: data.is_active ?? true,
        allows_sub_entities: data.allows_sub_entities ?? false,
        created_at: data.created_at ?? Math.floor(Date.now() / 1000),
        updated_at: data.updated_at ?? Math.floor(Date.now() / 1000)
    };
};

const createMockApiContext = (
  method: string = 'GET',
  body: any = null,
  params: Record<string, string | undefined> = {},
  user: { id: string; role?: string; email?: string; name?: string } | null = { id: testUserId }
): APIContext => {
  const requestUrl = `http://localhost/api/entities${params.id ? `/${params.id}` : ''}`;
  const request = new Request(requestUrl, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    request,
    params,
    locals: {
      user: user,
      session: user ? { user: user, expires: '' } : null,
      runtime: {
        env: mockRuntimeEnv as RuntimeEnv,
        ctx: {} as any,
        cf: {} as any,
      },
    },
    cookies: { get: vi.fn(), set: vi.fn(), delete: vi.fn(), has: vi.fn(), getAll: vi.fn(), serialize: vi.fn()},
    redirect: vi.fn(),
    url: new URL(requestUrl),
    clientAddress: '127.0.0.1',
    site: new URL('http://localhost'),
    generator: 'Astro vX.Y.Z',
    props: {},
    slots: { has: vi.fn(), render: vi.fn() },
  } as unknown as APIContext;
};


describe('Entities API Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/entities', () => {
    it('should return 401 if user is not authenticated', async () => {
      const context = createMockApiContext('GET', null, {}, null);
      const response = await getAllEntities(context);
      expect(response.status).toBe(401);
      const json = await response.json() as { error: string };
      expect(json.error).toBe('Unauthorized');
    });

    it('should return 200 and list of entities', async () => {
      // Create AppEntity objects directly
      const mockEntities = [
        createAppEntityMock({ id: '1', name: 'Entity 1', legal_name: 'E1 LLC' })
      ];

      mockEntityService.getAllEntities.mockResolvedValue(mockEntities);
      const context = createMockApiContext();
      
      const response = await getAllEntities(context);
      expect(response.status).toBe(200);
      const json = await response.json() as AppEntity[];
      expect(json).toEqual(mockEntities);
      expect(mockEntityService.getAllEntities).toHaveBeenCalledWith(testUserId);
    });
  });

  describe('POST /api/entities', () => {
    const entityInput: EntityInput = { 
      name: 'New Entity', 
      legal_name: 'NewCo LLC', 
      business_type: 'llc', 
      is_active: true, 
      allows_sub_entities: false 
    };
    
    // Create AppEntity directly with createAppEntityMock
    const createdEntity = createAppEntityMock({ 
      id: 'new-ent-id', 
      name: entityInput.name,
      legal_name: entityInput.legal_name,
      business_type: entityInput.business_type,
      is_active: entityInput.is_active,
      allows_sub_entities: entityInput.allows_sub_entities
    });

    it('should return 401 if user is not authenticated', async () => {
      const context = createMockApiContext('POST', entityInput, {}, null);
      const response = await createEntity(context);
      expect(response.status).toBe(401);
      const json = await response.json() as { error: string };
      expect(json.error).toBe('Unauthorized');
    });

    it('should return 201 and created entity for valid data', async () => {
      mockValidateRequestBody.mockResolvedValue(entityInput);
      mockEntityService.createEntity.mockResolvedValue(createdEntity);
      const context = createMockApiContext('POST', entityInput);

      const response = await createEntity(context);
      expect(mockValidateRequestBody).toHaveBeenCalledWith(context.request, zodSchemasModule.entityInputSchema);
      expect(mockEntityService.createEntity).toHaveBeenCalledWith(entityInput, testUserId);
      expect(response.status).toBe(201);
      const json = await response.json() as AppEntity;
      expect(json).toEqual(createdEntity);
    });
  });

  describe('GET /api/entities/[id]', () => {
    const entityId = 'ent-test-id';
    it('should return 401 if unauthenticated', async () => {
      const context = createMockApiContext('GET', null, { id: entityId }, null);
      const response = await getEntityById(context);
      expect(response.status).toBe(401);
      const json = await response.json() as { error: string };
      expect(json.error).toBe('Unauthorized');
    });

    it('should return 200 and the entity if found', async () => {
        const mockEntity = createAppEntityMock({ id: entityId, name: 'Test Entity' });
        mockEntityService.getEntityById.mockResolvedValue(mockEntity);
        const context = createMockApiContext('GET', null, { id: entityId });
        
        const response = await getEntityById(context);
        expect(response.status).toBe(200);
        const json = await response.json() as AppEntity;
        expect(json).toEqual(mockEntity);
        expect(mockEntityService.getEntityById).toHaveBeenCalledWith(entityId, testUserId);
    });

    it('should return 404 if entity not found', async () => {
        mockEntityService.getEntityById.mockResolvedValue(null);
        const context = createMockApiContext('GET', null, { id: 'not-found-id' });
        const response = await getEntityById(context);
        expect(response.status).toBe(404);
        const json = await response.json() as { error: string };
        expect(json.error).toBe('Entity not found or access denied.');
    });
  });

  describe('PUT /api/entities/[id]', () => {
    const entityId = 'ent-to-update';
    const updateData: Partial<EntityInput> = { name: 'Updated Name' };
    
    // Create AppEntity directly with createAppEntityMock
    const updatedEntity = createAppEntityMock({ 
      id: entityId, 
      name: 'Updated Name'
    });

    it('should return 200 and updated entity', async () => {
        mockValidateRequestBody.mockResolvedValue(updateData);
        mockEntityService.updateEntity.mockResolvedValue(updatedEntity);
        const context = createMockApiContext('PUT', updateData, { id: entityId });
        
        const response = await updateEntityById(context);
        expect(response.status).toBe(200);
        const json = await response.json() as AppEntity;
        expect(json).toEqual(updatedEntity);
        expect(mockValidateRequestBody).toHaveBeenCalledWith(context.request, zodSchemasModule.partialEntityInputSchema);
        expect(mockEntityService.updateEntity).toHaveBeenCalledWith(entityId, updateData, testUserId);
    });
  });

  describe('DELETE /api/entities/[id]', () => {
    const entityId = 'ent-to-delete';
    it('should return 200 on successful deletion', async () => {
        mockEntityService.deleteEntity.mockResolvedValue(true);
        const context = createMockApiContext('DELETE', null, { id: entityId });

        const response = await deleteEntityById(context);
        expect(response.status).toBe(200);
        const json = await response.json() as { message: string };
        expect(json).toEqual({ message: 'Entity deleted successfully.' });
        expect(mockEntityService.deleteEntity).toHaveBeenCalledWith(entityId, testUserId);
    });

    it('should return 500 if delete service returns false', async () => {
        mockEntityService.deleteEntity.mockResolvedValue(false);
        const context = createMockApiContext('DELETE', null, { id: entityId });
        const response = await deleteEntityById(context);
        expect(response.status).toBe(500);
        const json = await response.json() as { error: string };
        expect(json.error).toBe('Failed to delete entity.');
    });
  });
});