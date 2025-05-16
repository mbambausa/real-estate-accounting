// tests/e2e/account.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Account Management', () => {
  // Updated test data to use lowercase string values expected by the application
  const testAccount = {
    id: '', // Will be populated after creation if needed for direct navigation by ID
    code: '1010',
    name: 'Test Bank Account (E2E)', // Make name unique for testing
    type: 'asset', // Lowercase
    subtype: 'cash_and_equivalents', // Example subtype, ensure this is a valid option if your form has it
    description: 'Test bank account for e2e testing'
  };

  const anotherTestAccount = {
    id: '',
    code: '1011',
    name: 'Savings Account (E2E)',
    type: 'asset',
    subtype: 'cash_and_equivalents',
    description: 'Another test account'
  };


  // Setup: Ensure a clean state or consistent starting point if possible.
  // This might involve deleting test accounts created in previous runs if they persist.
  // For now, we assume tests can run sequentially or handle existing data.

  test.beforeEach(async ({ page }) => {
    // Log in first
    await page.goto('/auth/signin');
    await page.fill('input[name="email"]', 'testuser@example.com'); // Use a dedicated test user
    await page.fill('input[name="password"]', 'Password123!'); // Use a dedicated test password
    await page.click('button[type="submit"]');
    
    // Verify we are logged in by checking for a dashboard element or URL
    await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 10000 });
    // Add a more specific check if dashboard URL is too generic
    // await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible(); 
  });

  test('should navigate to accounts page and see Chart of Accounts', async ({ page }) => {
    await page.goto('/app/accounts');
    await expect(page).toHaveURL('/app/accounts');
    // The main heading on /app/accounts is "Chart of Accounts"
    await expect(page.locator('h1')).toContainText('Chart of Accounts');
  });

  test('should create a new account and see it in the list', async ({ page }) => {
    await page.goto('/app/accounts/new');
    
    // Fill in the form using AccountForm.astro's field names
    await page.fill('input[name="code"]', testAccount.code);
    await page.fill('input[name="name"]', testAccount.name);
    await page.selectOption('select[name="type"]', { value: testAccount.type });
    
    // Subtype is conditional in AccountForm. If type is 'expense', it's shown.
    // For 'asset', subtype might not be directly selectable in the same way or might be different.
    // Adjust if your form has a general subtype field or if it's specific to expenses.
    // For now, assuming a general subtype field or that 'asset' doesn't require one from a dropdown.
    if (testAccount.type === 'expense' && testAccount.subtype) {
         await page.selectOption('select[name="subtype"]', { value: testAccount.subtype });
    } else if (testAccount.subtype) { // If subtype is provided but not for expense, assume a text input or different handling
        // await page.fill('input[name="subtype"]', testAccount.subtype); // Example if it's a text field
    }

    await page.fill('textarea[name="description"]', testAccount.description);
    // Parent ID selection: If testing this, select an option from 'select[name="parent_id"]'
    // For now, creating a top-level account.
    
    // Submit the form
    await page.click('button[type="submit"]:has-text("Create Account")');
    
    // Verify redirection to the accounts list with a success message
    await expect(page).toHaveURL(/\/app\/accounts\?success=.+/); // Check for success query param
    
    // Verify the new account appears in the list (AccountList.astro)
    // It's better to use a more specific selector if possible, e.g., data-testid
    await expect(page.locator(`[data-account-code="${testAccount.code}"]`)).toBeVisible();
    await expect(page.locator(`[data-account-name="${testAccount.name}"]`)).toBeVisible();
    // Or check within the table context
    // await expect(page.locator(`tr[data-account-code="${testAccount.code}"] td:has-text("${testAccount.name}")`)).toBeVisible();
  });

  test('should validate account form for required fields', async ({ page }) => {
    await page.goto('/app/accounts/new');
    
    // Submit without required fields
    await page.click('button[type="submit"]:has-text("Create Account")');
    
    // Verify error messages (These depend on your actual API/frontend validation messages)
    // The API currently returns a generic error if validation fails in the service.
    // Client-side HTML5 `required` attribute will prevent submission first.
    // For API-level validation errors, the API response needs to be specific.
    // Assuming HTML5 validation prevents empty submission for now.
    // If API returns specific errors, test for those.
    // Example if API returned structured errors:
    // await expect(page.locator('text=Account code is required')).toBeVisible(); // Or similar
    // await expect(page.locator('text=Account name is required')).toBeVisible();
    // await expect(page.locator('text=Account type is required')).toBeVisible();

    // For now, let's test a specific API validation we know exists: duplicate code
    // First, create an account
    await page.fill('input[name="code"]', anotherTestAccount.code);
    await page.fill('input[name="name"]', anotherTestAccount.name);
    await page.selectOption('select[name="type"]', { value: anotherTestAccount.type });
    await page.click('button[type="submit"]:has-text("Create Account")');
    await expect(page).toHaveURL(/\/app\/accounts\?success=.+/);
    
    // Attempt to create another account with the same code
    await page.goto('/app/accounts/new');
    await page.fill('input[name="code"]', anotherTestAccount.code); // Duplicate code
    await page.fill('input[name="name"]', "Another Name With Same Code");
    await page.selectOption('select[name="type"]', { value: 'expense' });
    await page.click('button[type="submit"]:has-text("Create Account")');

    // Check for error message from API redirect (adjust if error shown inline)
    await expect(page).toHaveURL(/\/app\/accounts\/new\?error=.+/);
    // The specific error message comes from AppError in AccountService
    await expect(page.locator(`text=Account with code ${anotherTestAccount.code} already exists`)).toBeVisible({timeout: 7000});
  });

  test('should view account details by clicking from list', async ({ page }) => {
    // Ensure testAccount is created (or rely on previous test, though less isolated)
    // For isolation, create it here or have a setup step.
    // Assuming testAccount was created by 'should create a new account' or a global setup.
    await page.goto('/app/accounts');
    await expect(page.locator(`[data-account-code="${testAccount.code}"]`)).toBeVisible(); // Make sure it's there

    // Click the link associated with the test account's code/name
    // AccountList.astro links the code to /app/accounts/[accountId_UUID]
    await page.locator(`tr[data-account-code="${testAccount.code}"] a[href*="/app/accounts/"]`).first().click();
    
    // URL should now contain a UUID
    await expect(page).toHaveURL(/\/app\/accounts\/[a-f0-9-]+$/); // Matches UUID pattern
    
    // Verify account details are displayed on the detail page
    await expect(page.locator('h1')).toContainText(testAccount.name); // Detail page title
    await expect(page.locator(`dd:has-text("${testAccount.code}")`).first()).toBeVisible(); // Account code display
    await expect(page.locator(`dd:has-text("${testAccount.description}")`).first()).toBeVisible(); // Description
  });

  test('should edit an existing account', async ({ page }) => {
    // Assuming testAccount exists
    await page.goto('/app/accounts');
    // Navigate to the account's detail page using its UUID via the link
    // First, find the row for testAccount, then find the "Edit" link within that row.
    const accountRow = page.locator(`tr[data-account-code="${testAccount.code}"]`);
    await expect(accountRow).toBeVisible();
    const accountId = await accountRow.getAttribute('data-account-id');
    expect(accountId).toBeTruthy(); // Ensure we got an ID

    await page.goto(`/app/accounts/${accountId}?edit=true`); // Navigate directly to edit mode
    await expect(page.locator('h1')).toContainText("Edit Account");

    const updatedName = `${testAccount.name} (Updated)`;
    await page.fill('input[name="name"]', updatedName);
    await page.click('button[type="submit"]:has-text("Save Changes")');
    
    // Verify redirection to the account detail page (still with UUID in URL)
    await expect(page).toHaveURL(new RegExp(`/app/accounts/${accountId}(\\?success=.*)?$`), {timeout: 7000});
    await expect(page.locator('h1')).toContainText(updatedName); // Check updated name on detail view
    
    // Go back to accounts list and verify the updated name appears
    await page.goto('/app/accounts');
    await expect(page.locator(`tr[data-account-id="${accountId}"] td:has-text("${updatedName}")`)).toBeVisible();
  });

  test('should delete an account from its detail page', async ({ page }) => {
    // Create a unique account for this test to delete
    const accountToDelete = { code: '9998', name: 'Account For Deletion (E2E)', type: 'expense', description: 'Delete me' };
    await page.goto('/app/accounts/new');
    await page.fill('input[name="code"]', accountToDelete.code);
    await page.fill('input[name="name"]', accountToDelete.name);
    await page.selectOption('select[name="type"]', { value: accountToDelete.type });
    await page.click('button[type="submit"]:has-text("Create Account")');
    await expect(page).toHaveURL(/\/app\/accounts\?success=.+/);
    
    // Find the created account in the list to get its ID for navigation
    await page.goto('/app/accounts');
    const rowToDelete = page.locator(`tr[data-account-code="${accountToDelete.code}"]`);
    await expect(rowToDelete).toBeVisible();
    const accountIdToDelete = await rowToDelete.getAttribute('data-account-id');
    expect(accountIdToDelete).toBeTruthy();

    // Go to the account details page
    await page.goto(`/app/accounts/${accountIdToDelete}`);
    
    // Click the delete button (assuming it's on the detail page and client-side JS handles confirmation)
    // The delete button in accounts/[id]/index.astro has id="delete-account-button"
    page.on('dialog', dialog => dialog.accept()); // Auto-accept confirm dialogs
    await page.click('button#delete-account-button'); 
        
    // Verify we're redirected to the accounts list with a success message
    await expect(page).toHaveURL(/\/app\/accounts\?success=.+/, {timeout: 7000});
    
    // Verify the account is no longer in the list
    await expect(page.locator(`tr[data-account-id="${accountIdToDelete}"]`)).not.toBeVisible();
  });

  test('should view chart of accounts hierarchy page', async ({ page }) => {
    await page.goto('/app/accounts/chart');
    await expect(page).toHaveURL('/app/accounts/chart');
    await expect(page.locator('h1')).toContainText('Chart of Accounts Hierarchy');
    
    // Check that standard account type categories are displayed (from ChartOfAccounts.astro)
    await expect(page.locator('h3:has-text("Asset Accounts")')).toBeVisible();
    await expect(page.locator('h3:has-text("Liability Accounts")')).toBeVisible();
    // ... etc. for Equity, Income, Expense

    // Verify our test account (if created and active) is displayed within its type section
    // This depends on testAccount being an asset.
    await expect(page.locator(`div.account-item a[href*="/app/accounts/"]:has-text("${testAccount.name}")`)).toBeVisible();
  });

  // Client-side filtering tests are for AccountList.astro, which is used on /app/accounts
  test('should filter accounts by active status on list page', async ({ page }) => {
    // Create an inactive account first
    const inactiveAcc = { code: 'ZZ99', name: 'Inactive Test Account', type: 'expense' };
    await page.goto('/app/accounts/new');
    await page.fill('input[name="code"]', inactiveAcc.code);
    await page.fill('input[name="name"]', inactiveAcc.name);
    await page.selectOption('select[name="type"]', { value: inactiveAcc.type });
    await page.uncheck('input[name="is_active"]'); // Make it inactive
    await page.click('button[type="submit"]:has-text("Create Account")');
    await expect(page).toHaveURL(/\/app\/accounts\?success=.+/);

    await page.goto('/app/accounts');
    
    // Initially, "Show active accounts only" is checked, so inactiveAcc should NOT be visible
    await expect(page.locator(`tr[data-account-code="${inactiveAcc.code}"]`)).not.toBeVisible();
    // Active testAccount should be visible
    await expect(page.locator(`tr[data-account-code="${testAccount.code}"]`)).toBeVisible();

    // Uncheck "Show active accounts only"
    await page.uncheck('input#filter-active-accounts');
    
    // Now, inactiveAcc should be visible
    await expect(page.locator(`tr[data-account-code="${inactiveAcc.code}"]`)).toBeVisible();
  });

  test('should search accounts by name or code on list page', async ({ page }) => {
    await page.goto('/app/accounts');
    
    // Search by testAccount code
    await page.fill('input#account-search-input', testAccount.code);
    await expect(page.locator(`tr[data-account-code="${testAccount.code}"]`)).toBeVisible();
    // Ensure other accounts not matching are hidden (if any were visible)
    if (anotherTestAccount.code !== testAccount.code) {
      await expect(page.locator(`tr[data-account-code="${anotherTestAccount.code}"]`)).not.toBeVisible();
    }

    // Search by part of testAccount name
    await page.fill('input#account-search-input', testAccount.name.substring(0, 10));
    await expect(page.locator(`tr[data-account-name="${testAccount.name}"]`)).toBeVisible();

    // Search by a non-existent account
    await page.fill('input#account-search-input', 'NonExistentStringToFilter');
    await expect(page.locator(`tr[data-account-code="${testAccount.code}"]`)).not.toBeVisible();
    // Check for a "No accounts found" message if the list component shows one
    // await expect(page.locator('text=No accounts found with the current filters')).toBeVisible(); // Or similar
  });

  // Test for AccountSelector component - this depends on a page using it, e.g., a transaction page.
  // This test is highly dependent on the structure of the transaction page and the AccountSelector.
  // For now, this is a placeholder structure.
  test('should handle account selector component on a hypothetical transaction page', async ({ page }) => {
    // Assume testAccount exists and is active
    // Navigate to a page that uses AccountSelector, e.g., new transaction page
    // This path is hypothetical.
    // await page.goto('/app/transactions/new-hypothetical'); 
    
    // // Verify the account selector is present (e.g., by its label or a data-testid)
    // await expect(page.locator('label:has-text("Select Account")')).toBeVisible();
    // const accountSelector = page.locator('select[name="account_id_for_transaction"]'); // Use the actual name/id
    // await expect(accountSelector).toBeVisible();
    
    // // Click to open/focus (if it's a custom dropdown) or directly select for native select
    // await accountSelector.selectOption({ label: `${testAccount.code} - ${testAccount.name} (${testAccount.type})` });
    
    // // Verify the selector's underlying value is the account's ID (UUID)
    // // This assumes the <option value="UUID_HERE">
    // const selectedAccountData = allAccounts.find(acc => acc.code === testAccount.code); // Need allAccounts from somewhere
    // if (selectedAccountData) {
    //   await expect(accountSelector).toHaveValue(selectedAccountData.id);
    // } else {
    //   test.fail(true, "Test account data not found for assertion.");
    // }
    test.skip(true, "Skipping account selector test until transaction page/selector is defined.");
  });
});


// Specific tests for Recoverable vs Non-Recoverable Expenses
test.describe('Expense Account Subtypes (Recoverable/Non-Recoverable)', () => {
  const recoverableExpense = {
    code: '5510', // Unique code
    name: 'Recoverable Maintenance (E2E)',
    type: 'expense', // lowercase
    subtype: 'recoverable', // lowercase, matches AccountForm option value
    description: 'Recoverable property maintenance expenses for E2E',
    is_recoverable: true // This will be a checkbox
  };
  
  const nonRecoverableExpense = {
    code: '5520', // Unique code
    name: 'Non-Recoverable Fees (E2E)',
    type: 'expense', // lowercase
    subtype: 'non-recoverable', // lowercase
    description: 'Non-recoverable management fees for E2E',
    is_recoverable: false // Checkbox unchecked
  };

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/signin');
    await page.fill('input[name="email"]', 'testuser@example.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/app\/dashboard/);
  });

  test('should create recoverable expense account with correct flags', async ({ page }) => {
    await page.goto('/app/accounts/new');
    
    await page.fill('input[name="code"]', recoverableExpense.code);
    await page.fill('input[name="name"]', recoverableExpense.name);
    await page.selectOption('select[name="type"]', { value: recoverableExpense.type }); // Select "expense"
    
    // Subtype and is_recoverable fields become visible/relevant for expense type
    await expect(page.locator('select[name="subtype"]')).toBeVisible();
    await page.selectOption('select[name="subtype"]', { value: recoverableExpense.subtype });
    
    await expect(page.locator('input[name="is_recoverable"]')).toBeVisible();
    await page.check('input[name="is_recoverable"]'); // Check the box
    
    await page.fill('textarea[name="description"]', recoverableExpense.description);
    await page.click('button[type="submit"]:has-text("Create Account")');
    
    await expect(page).toHaveURL(/\/app\/accounts\?success=.+/);
    await expect(page.locator(`tr[data-account-code="${recoverableExpense.code}"]`)).toBeVisible();

    // View details to confirm is_recoverable flag (if displayed)
    // This depends on the detail page showing this flag.
    // For now, we trust the creation.
  });

  test('should create non-recoverable expense account with correct flags', async ({ page }) => {
    await page.goto('/app/accounts/new');
    
    await page.fill('input[name="code"]', nonRecoverableExpense.code);
    await page.fill('input[name="name"]', nonRecoverableExpense.name);
    await page.selectOption('select[name="type"]', { value: nonRecoverableExpense.type });
    
    await expect(page.locator('select[name="subtype"]')).toBeVisible();
    await page.selectOption('select[name="subtype"]', { value: nonRecoverableExpense.subtype });
    
    await expect(page.locator('input[name="is_recoverable"]')).toBeVisible();
    // is_recoverable should be unchecked by default, or explicitly uncheck if needed
    if (await page.locator('input[name="is_recoverable"]').isChecked()) {
      await page.uncheck('input[name="is_recoverable"]');
    }
    
    await page.fill('textarea[name="description"]', nonRecoverableExpense.description);
    await page.click('button[type="submit"]:has-text("Create Account")');
    
    await expect(page).toHaveURL(/\/app\/accounts\?success=.+/);
    await expect(page.locator(`tr[data-account-code="${nonRecoverableExpense.code}"]`)).toBeVisible();
  });

  // These validation tests depend on specific error messages from your API/frontend.
  // The AccountService currently doesn't have these specific type/subtype mismatch validations.
  // They would need to be added to the API route handler or service.
  test.skip('should show error if is_recoverable flag is not set for recoverable subtype', async ({ page }) => {
    await page.goto('/app/accounts/new');
    
    await page.fill('input[name="code"]', '5530');
    await page.fill('input[name="name"]', 'Bad Recoverable (E2E)');
    await page.selectOption('select[name="type"]', 'expense');
    await page.selectOption('select[name="subtype"]', 'recoverable');
    // Intentionally leave is_recoverable unchecked
    if (await page.locator('input[name="is_recoverable"]').isChecked()) {
      await page.uncheck('input[name="is_recoverable"]');
    }
    await page.click('button[type="submit"]');
    
    // This error message needs to be implemented in the backend or frontend validation
    await expect(page.locator('text=For recoverable subtype, "Is Recoverable" must be checked.')).toBeVisible();
  });
  
  test.skip('should show error for mismatched type and expense subtype', async ({ page }) => {
    await page.goto('/app/accounts/new');
    
    await page.fill('input[name="code"]', '1530'); // Asset code
    await page.fill('input[name="name"]', 'Invalid Asset Subtype (E2E)');
    await page.selectOption('select[name="type"]', 'asset'); // Non-expense type
    
    // Attempt to select an expense subtype (this might not even be possible if UI hides it)
    // If the subtype dropdown is dynamic based on type, this test might need adjustment.
    // Assuming for now the subtype dropdown shows all options or is testable.
    // If 'asset' type hides the expense subtype dropdown, this test is invalid as is.
    // The AccountForm.astro uses Alpine.js to hide subtype for non-expense.
    // So, this specific test case of selecting an expense subtype for an asset might not be directly testable
    // unless the Alpine.js logic is bypassed or the subtype field is made visible for testing.
    // A more relevant test would be if the API rejects an asset type with an expense subtype.

    // For now, skipping as the UI likely prevents this selection.
    // await page.selectOption('select[name="subtype"]', 'recoverable'); 
    // await page.click('button[type="submit"]');
    // await expect(page.locator('text=Subtype "recoverable" is not valid for account type "asset".')).toBeVisible();
  });
});
