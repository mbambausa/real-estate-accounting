// tests/e2e/entity.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Entity Management', () => {
  const testEntity = {
    legal_name: 'Test Property LLC',
    ein: '12-3456789',
    address: '123 Test Street, Test City, TS 12345',
    business_type: 'LLC'
  };

  test.beforeEach(async ({ page }) => {
    // Log in first
    await page.goto('/auth/signin');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Verify we are logged in
    await expect(page).toHaveURL(/\/app\/dashboard/);
  });

  test('should navigate to entities page', async ({ page }) => {
    await page.goto('/app/entities');
    
    await expect(page).toHaveURL('/app/entities');
    await expect(page.locator('h1')).toContainText('Real Estate Entities');
  });

  test('should create a new entity', async ({ page }) => {
    await page.goto('/app/entities/new');
    
    // Fill in the form
    await page.fill('input[name="legal_name"]', testEntity.legal_name);
    await page.fill('input[name="ein"]', testEntity.ein);
    await page.fill('textarea[name="address"]', testEntity.address);
    await page.selectOption('select[name="business_type"]', testEntity.business_type);
    
    // Submit the form
    await page.click('button[type="submit"]');
    
    // Verify we're redirected to the entities list
    await expect(page).toHaveURL('/app/entities');
    
    // Verify the new entity appears in the list
    await expect(page.locator(`text=${testEntity.legal_name}`)).toBeVisible();
    await expect(page.locator(`text=${testEntity.business_type}`)).toBeVisible();
  });

  test('should validate entity form', async ({ page }) => {
    await page.goto('/app/entities/new');
    
    // Submit without required fields
    await page.click('button[type="submit"]');
    
    // Verify error messages
    await expect(page.locator('text=Legal name is required')).toBeVisible();
    await expect(page.locator('text=Business type is required')).toBeVisible();
    
    // Fill in EIN with invalid format
    await page.fill('input[name="legal_name"]', 'Invalid EIN Test');
    await page.fill('input[name="ein"]', '123-45-6789'); // Invalid format (should be XX-XXXXXXX)
    await page.selectOption('select[name="business_type"]', 'LLC');
    await page.click('button[type="submit"]');
    
    // Verify error message for EIN
    await expect(page.locator('text=Invalid EIN format')).toBeVisible();
  });

  test('should view entity details', async ({ page }) => {
    // First create an entity to view
    await test.step('Create entity', async () => {
      await page.goto('/app/entities/new');
      await page.fill('input[name="legal_name"]', testEntity.legal_name);
      await page.fill('input[name="ein"]', testEntity.ein);
      await page.fill('textarea[name="address"]', testEntity.address);
      await page.selectOption('select[name="business_type"]', testEntity.business_type);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL('/app/entities');
    });
    
    // Now view the entity details
    await page.click(`a:has-text("${testEntity.legal_name}")`);
    
    // Verify entity details are displayed
    await expect(page.locator('h1')).toContainText(testEntity.legal_name);
    await expect(page.locator(`text=${testEntity.ein}`)).toBeVisible();
    await expect(page.locator(`text=${testEntity.address}`)).toBeVisible();
    await expect(page.locator(`text=${testEntity.business_type}`)).toBeVisible();
  });

  test('should edit an entity', async ({ page }) => {
    // First create an entity to edit
    await test.step('Create entity', async () => {
      await page.goto('/app/entities/new');
      await page.fill('input[name="legal_name"]', testEntity.legal_name);
      await page.fill('input[name="ein"]', testEntity.ein);
      await page.fill('textarea[name="address"]', testEntity.address);
      await page.selectOption('select[name="business_type"]', testEntity.business_type);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL('/app/entities');
    });
    
    // Go to the entity details page
    await page.click(`a:has-text("${testEntity.legal_name}")`);
    
    // Click the edit button
    await page.click('text=Edit');
    
    // Update the entity legal name
    const updatedName = 'Updated Test Property LLC';
    await page.fill('input[name="legal_name"]', updatedName);
    
    // Submit the form
    await page.click('button[type="submit"]');
    
    // Verify we're redirected to the entity details page
    await expect(page.locator('h1')).toContainText(updatedName);
    
    // Go back to entities list and verify the updated name appears
    await page.goto('/app/entities');
    await expect(page.locator(`text=${updatedName}`)).toBeVisible();
  });

  test('should delete an entity', async ({ page }) => {
    // First create an entity to delete
    const deleteEntity = {
      legal_name: 'Entity to Delete',
      ein: '98-7654321',
      address: '987 Delete Lane, Delete City, DC 98765',
      business_type: 'LLC'
    };
    
    await test.step('Create entity to delete', async () => {
      await page.goto('/app/entities/new');
      await page.fill('input[name="legal_name"]', deleteEntity.legal_name);
      await page.fill('input[name="ein"]', deleteEntity.ein);
      await page.fill('textarea[name="address"]', deleteEntity.address);
      await page.selectOption('select[name="business_type"]', deleteEntity.business_type);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL('/app/entities');
    });
    
    // Go to the entity details page
    await page.click(`a:has-text("${deleteEntity.legal_name}")`);
    
    // Click the delete button
    await page.click('text=Delete');
    
    // Confirm deletion in the modal
    await page.click('button:has-text("Confirm")');
    
    // Verify we're redirected to the entities list
    await expect(page).toHaveURL('/app/entities');
    
    // Verify the entity is no longer in the list
    await expect(page.locator(`text=${deleteEntity.legal_name}`)).not.toBeVisible();
  });

  test('should search entities by name', async ({ page }) => {
    await page.goto('/app/entities');
    
    // Search by entity name
    await page.fill('input[placeholder="Search entities"]', testEntity.legal_name);
    
    // Verify our test entity is visible
    await expect(page.locator(`text=${testEntity.legal_name}`)).toBeVisible();
    
    // Search by a non-existent entity
    await page.fill('input[placeholder="Search entities"]', 'NonExistentEntity');
    
    // Verify our test entity is not visible
    await expect(page.locator(`text=${testEntity.legal_name}`)).not.toBeVisible();
    await expect(page.locator('text=No entities found')).toBeVisible();
  });

  test('should filter entities by business type', async ({ page }) => {
    await page.goto('/app/entities');
    
    // Filter by LLC
    await page.selectOption('select[data-filter="businessType"]', 'LLC');
    
    // Verify our test entity is visible (it's an LLC)
    await expect(page.locator(`text=${testEntity.legal_name}`)).toBeVisible();
    
    // Filter by CORPORATION
    await page.selectOption('select[data-filter="businessType"]', 'CORPORATION');
    
    // Verify our test entity is not visible
    await expect(page.locator(`text=${testEntity.legal_name}`)).not.toBeVisible();
  });

  test('should handle entity selector component', async ({ page }) => {
    // Go to a page with entity selector (e.g., transaction entry)
    await page.goto('/app/transactions/new');
    
    // Verify the entity selector is present
    await expect(page.locator('text=Select Entity')).toBeVisible();
    
    // Open the entity selector
    await page.click('text=Select Entity');
    
    // Verify our test entity appears in the dropdown
    await expect(page.locator(`text=${testEntity.legal_name}`)).toBeVisible();
    
    // Select our test entity
    await page.click(`text=${testEntity.legal_name}`);
    
    // Verify it's selected - FIX: Use direct RegExp instead of expect.stringMatching()
    await expect(page.locator('input[name="entity_id"]')).toHaveValue(/ent_/);
  });
});

test.describe('Entity Hierarchy Management', () => {
  const parentEntity = {
    legal_name: 'Parent Holding LLC',
    ein: '11-1111111',
    address: '100 Parent Ave, Parent City, PC 10000',
    business_type: 'LLC'
  };
  
  const childEntity = {
    legal_name: 'Child Property LLC',
    ein: '22-2222222',
    address: '200 Child Street, Child City, CC 20000',
    business_type: 'LLC'
  };

  test.beforeEach(async ({ page }) => {
    // Log in
    await page.goto('/auth/signin');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Verify login
    await expect(page).toHaveURL(/\/app\/dashboard/);
    
    // Create parent entity if it doesn't exist
    await page.goto('/app/entities');
    if (await page.locator(`text=${parentEntity.legal_name}`).count() === 0) {
      await page.goto('/app/entities/new');
      await page.fill('input[name="legal_name"]', parentEntity.legal_name);
      await page.fill('input[name="ein"]', parentEntity.ein);
      await page.fill('textarea[name="address"]', parentEntity.address);
      await page.selectOption('select[name="business_type"]', parentEntity.business_type);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL('/app/entities');
    }
  });

  test('should create a child entity with a parent', async ({ page }) => {
    // Go to create entity page
    await page.goto('/app/entities/new');
    
    // Fill in the form
    await page.fill('input[name="legal_name"]', childEntity.legal_name);
    await page.fill('input[name="ein"]', childEntity.ein);
    await page.fill('textarea[name="address"]', childEntity.address);
    await page.selectOption('select[name="business_type"]', childEntity.business_type);
    
    // Select parent entity
    await page.click('button:has-text("Select Parent Entity")');
    await page.click(`text=${parentEntity.legal_name}`);
    
    // Submit the form
    await page.click('button[type="submit"]');
    
    // Verify we're redirected to the entities list
    await expect(page).toHaveURL('/app/entities');
    
    // Verify the new entity appears in the list
    await expect(page.locator(`text=${childEntity.legal_name}`)).toBeVisible();
    
    // View the entity details
    await page.click(`a:has-text("${childEntity.legal_name}")`);
    
    // Verify parent entity is displayed
    await expect(page.locator(`text=Parent Entity: ${parentEntity.legal_name}`)).toBeVisible();
  });

  test('should view parent entity with its children', async ({ page }) => {
    // Go to parent entity details
    await page.goto('/app/entities');
    await page.click(`a:has-text("${parentEntity.legal_name}")`);
    
    // Verify we can see the child entities section
    await expect(page.locator('h2:has-text("Child Entities")')).toBeVisible();
    
    // Verify the child entity is listed
    await expect(page.locator(`text=${childEntity.legal_name}`)).toBeVisible();
  });

  test('should change parent entity', async ({ page }) => {
    // First create a new potential parent entity
    const newParentEntity = {
      legal_name: 'New Parent LLC',
      ein: '33-3333333',
      business_type: 'LLC'
    };
    
    await test.step('Create new potential parent', async () => {
      await page.goto('/app/entities/new');
      await page.fill('input[name="legal_name"]', newParentEntity.legal_name);
      await page.fill('input[name="ein"]', newParentEntity.ein);
      await page.selectOption('select[name="business_type"]', newParentEntity.business_type);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL('/app/entities');
    });
    
    // Go to child entity details
    await page.click(`a:has-text("${childEntity.legal_name}")`);
    
    // Click edit button
    await page.click('text=Edit');
    
    // Change parent entity
    await page.click('button:has-text("Change Parent Entity")');
    await page.click(`text=${newParentEntity.legal_name}`);
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Verify the parent entity has been updated
    await expect(page.locator(`text=Parent Entity: ${newParentEntity.legal_name}`)).toBeVisible();
  });

  test('should prevent circular parent-child references', async ({ page }) => {
    // First create a multi-level hierarchy: Parent -> Child -> Grandchild
    const grandchildEntity = {
      legal_name: 'Grandchild Property LLC',
      ein: '44-4444444',
      business_type: 'LLC'
    };
    
    await test.step('Create grandchild entity', async () => {
      await page.goto('/app/entities/new');
      await page.fill('input[name="legal_name"]', grandchildEntity.legal_name);
      await page.fill('input[name="ein"]', grandchildEntity.ein);
      await page.selectOption('select[name="business_type"]', grandchildEntity.business_type);
      
      // Select child entity as parent
      await page.click('button:has-text("Select Parent Entity")');
      await page.click(`text=${childEntity.legal_name}`);
      
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL('/app/entities');
    });
    
    // Now try to make the grandchild the parent of the original parent (circular reference)
    await page.click(`a:has-text("${parentEntity.legal_name}")`);
    await page.click('text=Edit');
    
    // Try to set grandchild as parent
    await page.click('button:has-text("Select Parent Entity")');
    await page.click(`text=${grandchildEntity.legal_name}`);
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Verify error message
    await expect(page.locator('text=Circular reference detected')).toBeVisible();
  });

  test('should remove parent-child relationship', async ({ page }) => {
    // Go to child entity details
    await page.goto('/app/entities');
    await page.click(`a:has-text("${childEntity.legal_name}")`);
    
    // Click edit button
    await page.click('text=Edit');
    
    // Remove parent entity
    await page.click('button:has-text("Remove Parent")');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Verify the parent entity has been removed
    await expect(page.locator('text=Parent Entity:')).not.toBeVisible();
  });
});

test.describe('Entity-Account Management', () => {
  const testEntity = {
    legal_name: 'Account Association Test LLC',
    ein: '55-5555555',
    business_type: 'LLC'
  };
  
  test.beforeEach(async ({ page }) => {
    // Log in
    await page.goto('/auth/signin');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Create test entity if it doesn't exist
    await page.goto('/app/entities');
    if (await page.locator(`text=${testEntity.legal_name}`).count() === 0) {
      await page.goto('/app/entities/new');
      await page.fill('input[name="legal_name"]', testEntity.legal_name);
      await page.fill('input[name="ein"]', testEntity.ein);
      await page.selectOption('select[name="business_type"]', testEntity.business_type);
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL('/app/entities');
    }
  });

  test('should view entity accounts tab', async ({ page }) => {
    // Go to entity details
    await page.goto('/app/entities');
    await page.click(`a:has-text("${testEntity.legal_name}")`);
    
    // Click on Accounts tab
    await page.click('text=Accounts');
    
    // Verify accounts tab is active
    await expect(page.locator('h2:has-text("Entity Accounts")')).toBeVisible();
  });

  test('should add accounts to entity', async ({ page }) => {
    // Go to entity accounts page
    await page.goto('/app/entities');
    await page.click(`a:has-text("${testEntity.legal_name}")`);
    await page.click('text=Accounts');
    
    // Click add account button
    await page.click('button:has-text("Add Account")');
    
    // Verify add account modal is displayed
    await expect(page.locator('h3:has-text("Add Account to Entity")')).toBeVisible();
    
    // Select an account type (Asset)
    await page.selectOption('select[name="account_type"]', 'ASSET');
    
    // Select an account (assuming Cash account exists in system chart of accounts)
    await page.click('text=Cash');
    
    // Add a custom name for this entity's instance of the account
    await page.fill('input[name="custom_name"]', 'Entity Cash Account');
    
    // Submit form
    await page.click('button:has-text("Add Account")');
    
    // Verify the account is added to the entity
    await expect(page.locator('text=Entity Cash Account')).toBeVisible();
  });

  test('should customize entity account', async ({ page }) => {
    // Go to entity accounts page
    await page.goto('/app/entities');
    await page.click(`a:has-text("${testEntity.legal_name}")`);
    await page.click('text=Accounts');
    
    // Click edit on the Cash account
    await page.click('text=Entity Cash Account >> button:has-text("Edit")');
    
    // Update custom name
    await page.fill('input[name="custom_name"]', 'Updated Cash Account');
    
    // Submit form
    await page.click('button:has-text("Save")');
    
    // Verify the account name is updated
    await expect(page.locator('text=Updated Cash Account')).toBeVisible();
  });

  test('should add recoverable expense account with recovery settings', async ({ page }) => {
    // Go to entity accounts page
    await page.goto('/app/entities');
    await page.click(`a:has-text("${testEntity.legal_name}")`);
    await page.click('text=Accounts');
    
    // Click add account button
    await page.click('button:has-text("Add Account")');
    
    // Select expense account type
    await page.selectOption('select[name="account_type"]', 'EXPENSE');
    
    // Select a recoverable expense account (assuming one exists in system chart of accounts)
    await page.click('text=Property Maintenance');
    
    // Add a custom name
    await page.fill('input[name="custom_name"]', 'Entity Maintenance');
    
    // Set recovery type and percentage
    await page.selectOption('select[name="recovery_type"]', 'PROPORTIONAL');
    await page.fill('input[name="recovery_percentage"]', '75');
    
    // Submit form
    await page.click('button:has-text("Add Account")');
    
    // Verify the account is added to the entity
    await expect(page.locator('text=Entity Maintenance')).toBeVisible();
    await expect(page.locator('text=Recoverable (75%)')).toBeVisible();
  });

  test('should remove account from entity', async ({ page }) => {
    // Go to entity accounts page
    await page.goto('/app/entities');
    await page.click(`a:has-text("${testEntity.legal_name}")`);
    await page.click('text=Accounts');
    
    // Click remove on an account
    await page.click('text=Updated Cash Account >> button:has-text("Remove")');
    
    // Confirm removal
    await page.click('button:has-text("Confirm")');
    
    // Verify the account is removed
    await expect(page.locator('text=Updated Cash Account')).not.toBeVisible();
  });

  test('should bulk add accounts to entity', async ({ page }) => {
    // Go to entity accounts page
    await page.goto('/app/entities');
    await page.click(`a:has-text("${testEntity.legal_name}")`);
    await page.click('text=Accounts');
    
    // Click bulk add accounts button
    await page.click('button:has-text("Bulk Add Accounts")');
    
    // Verify bulk add modal is displayed
    await expect(page.locator('h3:has-text("Bulk Add Accounts")')).toBeVisible();
    
    // Select account types to add
    await page.check('input[value="ASSET"]');
    await page.check('input[value="LIABILITY"]');
    
    // Submit form
    await page.click('button:has-text("Add Selected Account Types")');
    
    // Verify confirmation message
    await expect(page.locator('text=Accounts added successfully')).toBeVisible();
    
    // Verify multiple accounts are now visible - FIX: Use proper Playwright assertion pattern
    const rowCount = await page.locator('table tbody tr').count();
    expect(rowCount).toBeGreaterThan(3);
  });
});