// tests/integration/entityCrud.test.ts
import { test, expect, type APIRequestContext } from '@playwright/test';
import type { EntityInput, Entity } from '../../src/types/entity'; // Adjust path as per your aliases or structure
import type { DbEntity } from '../../src/db/schema'; // For direct comparison if needed

const TEST_USER_EMAIL = 'integration-test-user@example.com';
const TEST_USER_PASSWORD = 'Password123!';
const TEST_USER_NAME = 'IntegrationUser';

let apiContext: APIRequestContext;
let createdEntityIds: string[] = []; // To store IDs of entities created during tests for cleanup

test.beforeAll(async ({ playwright, baseURL }) => {
  // Sign up a user once for the entire test file if not existing
  // This is a simplified signup, real app might need more robust handling or pre-seeded user
  const tempPage = await playwright.request.newContext();
  // Note: Signup endpoint might not exist or might be UI only.
  // If testing requires a pre-existing user, ensure that user is available in your test DB.
  // For now, assuming user exists for login.

  // Log in to get session cookies
  const loginPage = await playwright.request.newContext();
  const loginResponse = await loginPage.post(`${baseURL}/api/auth/callback/credentials`, {
    form: {
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
      // csrfToken and callbackUrl might be needed depending on Auth.js setup for direct API login
      // This direct API login is often tricky. A UI login and cookie transfer is more robust.
    },
    failOnStatusCode: false, // Allow checking response even if it fails
  });

  // More robust login: perform UI login and grab cookies
  const browser = await playwright.chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${baseURL}/auth/signin`);
  await page.fill('input[name="email"]', TEST_USER_EMAIL);
  await page.fill('input[name="password"]', TEST_USER_PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15000 });

  // Create a new API context with the authenticated state (cookies)
  apiContext = await playwright.request.newContext({
    baseURL: baseURL,
    storageState: await context.storageState(), // Use cookies from the UI login
  });
  await browser.close();

  // Fallback/alternative if direct API login worked or if you have another way to get an auth token/cookie
  // const cookies = loginResponse.headers()['set-cookie'];
  // if (!cookies || !loginResponse.ok()) {
  //   console.error("Failed to log in for integration tests. Status:", loginResponse.status(), await loginResponse.text());
  //   // Consider seeding a user and using their credentials
  //   throw new Error('Login failed, cannot proceed with integration tests for entities.');
  // }
  // apiContext = await playwright.request.newContext({
  //   baseURL: baseURL,
  //   extraHTTPHeaders: {
  //     'Cookie': cookies.join('; ') // This might need parsing and specific cookie names
  //   }
  // });
});

test.afterAll(async () => {
  // Cleanup: Delete all entities created during the tests
  if (apiContext && createdEntityIds.length > 0) {
    for (const entityId of createdEntityIds) {
      try {
        await apiContext.delete(`/api/entities/${entityId}`);
      } catch (error) {
        console.warn(`Failed to clean up entity ${entityId}:`, error);
      }
    }
  }
  if (apiContext) {
    await apiContext.dispose();
  }
});


test.describe('Entity API CRUD Operations', () => {
  const testEntityData: EntityInput = {
    name: 'Integration Test Entity',
    legal_name: 'Integration Test Entity LLC',
    business_type: 'llc',
    ein: '99-0000001',
    address: '123 Integration Test St',
    is_active: true,
    allows_sub_entities: false,
  };
  let currentTestEntityId: string | null = null;

  test('POST /api/entities - should create a new entity', async () => {
    const response = await apiContext.post('/api/entities', {
      data: testEntityData,
    });
    expect(response.ok(), `Failed to create entity: ${await response.text()}`).toBe(true);
    const entity: Entity = await response.json();
    expect(entity).toHaveProperty('id');
    expect(entity.name).toBe(testEntityData.name);
    expect(entity.legal_name).toBe(testEntityData.legal_name);
    expect(entity.business_type).toBe(testEntityData.business_type);
    expect(entity.is_active).toBe(testEntityData.is_active);
    currentTestEntityId = entity.id;
    createdEntityIds.push(entity.id);
  });

  test('GET /api/entities - should retrieve a list of entities', async () => {
    // Ensure at least one entity exists (created from previous test)
    expect(currentTestEntityId, "Entity ID should be set from create test").not.toBeNull();

    const response = await apiContext.get('/api/entities');
    expect(response.ok()).toBe(true);
    const entities: Entity[] = await response.json();
    expect(Array.isArray(entities)).toBe(true);
    expect(entities.length).toBeGreaterThanOrEqual(1);
    const foundEntity = entities.find(e => e.id === currentTestEntityId);
    expect(foundEntity).toBeDefined();
    expect(foundEntity?.name).toBe(testEntityData.name);
  });

  test('GET /api/entities/[id] - should retrieve a specific entity', async () => {
    expect(currentTestEntityId, "Entity ID must exist for this test").not.toBeNull();
    const response = await apiContext.get(`/api/entities/${currentTestEntityId}`);
    expect(response.ok(), `Failed to get entity: ${await response.text()}`).toBe(true);
    const entity: Entity = await response.json();
    expect(entity.id).toBe(currentTestEntityId);
    expect(entity.name).toBe(testEntityData.name);
  });

  test('PUT /api/entities/[id] - should update an existing entity', async () => {
    expect(currentTestEntityId, "Entity ID must exist for this test").not.toBeNull();
    const updatedData: Partial<EntityInput> = {
      name: 'Updated Integration Test Entity',
      address: '456 Updated Test Ave',
      is_active: false,
    };
    const response = await apiContext.put(`/api/entities/${currentTestEntityId}`, {
      data: updatedData,
    });
    expect(response.ok(), `Failed to update entity: ${await response.text()}`).toBe(true);
    const entity: Entity = await response.json();
    expect(entity.id).toBe(currentTestEntityId);
    expect(entity.name).toBe(updatedData.name);
    expect(entity.address).toBe(updatedData.address);
    expect(entity.is_active).toBe(updatedData.is_active);

    // Update testEntityData for subsequent tests if necessary, or verify original state
    testEntityData.name = updatedData.name!;
    testEntityData.address = updatedData.address;
    testEntityData.is_active = updatedData.is_active;
  });
  
  test('POST /api/entities - should return 400 for invalid data (e.g., missing name)', async () => {
    const invalidEntityData: Partial<EntityInput> = {
      // name is missing, which is required by Zod schema
      legal_name: "Test Invalid Data LLC",
      business_type: "llc",
    };
    const response = await apiContext.post('/api/entities', {
      data: invalidEntityData,
    });
    expect(response.status()).toBe(400);
    const errorResponse = await response.json();
    expect(errorResponse.error).toContain('Invalid request body');
    expect(errorResponse.details).toHaveProperty('name'); // Zod should report 'name' as an issue
  });

  test('DELETE /api/entities/[id] - should delete an entity', async () => {
    // Create a new entity specifically for this delete test to avoid impacting others
    const entityToDeleteData: EntityInput = { ...testEntityData, name: "Entity To Be Deleted", legal_name: "Entity To Be Deleted LLC", ein: "99-DELETE1" };
    const createResponse = await apiContext.post('/api/entities', { data: entityToDeleteData });
    expect(createResponse.ok()).toBe(true);
    const entityToDelete: Entity = await createResponse.json();
    const entityIdToDelete = entityToDelete.id;
    
    // Keep track of it for afterAll cleanup, even if test fails mid-way
    if (!createdEntityIds.includes(entityIdToDelete)) {
        createdEntityIds.push(entityIdToDelete);
    }

    const deleteResponse = await apiContext.delete(`/api/entities/${entityIdToDelete}`);
    expect(deleteResponse.ok(), `Failed to delete entity: ${await deleteResponse.text()}`).toBe(true);
    expect(deleteResponse.status()).toBe(200); // Or 204 if no content is returned

    // Verify it's gone
    const getResponse = await apiContext.get(`/api/entities/${entityIdToDelete}`);
    expect(getResponse.status()).toBe(404);

    // Remove from createdEntityIds as it's successfully deleted
    createdEntityIds = createdEntityIds.filter(id => id !== entityIdToDelete);
  });
});