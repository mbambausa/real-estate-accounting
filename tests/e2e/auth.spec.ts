// tests/e2e/auth.spec.ts
// No major structural changes needed. Consider unique test users per suite or consistent user.
import { test, expect } from '@playwright/test';

const TEST_USER_EMAIL = `authtest-${Date.now()}@example.com`;
const TEST_USER_PASSWORD = 'Password123!';
const TEST_USER_NAME = 'Auth Test User';

// Test the sign-up flow first to ensure the user exists for subsequent tests in this file
test.describe('Authentication Flows', () => {
  test('should allow a new user to sign up', async ({ page }) => {
    await page.goto('/auth/signup');
    await expect(page).toHaveTitle(/Sign Up|Register/); // Allow for "Sign Up" or "Register"
    
    await page.fill('input[name="name"]', TEST_USER_NAME);
    await page.fill('input[name="email"]', TEST_USER_EMAIL);
    await page.fill('input[name="password"]', TEST_USER_PASSWORD);
    await page.fill('input[name="confirm_password"]', TEST_USER_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Successful signup should redirect to signin, possibly with a success message
    await expect(page).toHaveURL(/\/auth\/signin(\?.*)?/, { timeout: 10000 }); // Allow for query params
    // Optional: Check for a success message if your signup page shows one upon redirect
    // await expect(page.locator('text=Account created successfully. Please sign in.')).toBeVisible();
  });

  test('should validate sign-up form fields for mismatched passwords', async ({ page }) => {
    await page.goto('/auth/signup');
    
    await page.fill('input[name="name"]', 'Mismatch User');
    // Use a different email to avoid conflict if the previous test ran and this one runs in parallel or retries
    await page.fill('input[name="email"]', `mismatch-${Date.now()}@example.com`);
    await page.fill('input[name="password"]', 'password123');
    await page.fill('input[name="confirm_password"]', 'differentPassword');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/\/auth\/signup/); // Should remain on signup page
    // Check for a specific validation error message related to password mismatch.
    // This depends on your frontend validation implementation.
    // Example:
    // await expect(page.locator('text=Passwords do not match')).toBeVisible();
    // For now, checking for a generic error alert as in the original test
    await expect(page.locator('div[role="alert"][class*="bg-red-100"]')).toBeVisible();
  });

  test('should allow an existing user to sign in and then sign out', async ({ page }) => {
    // Sign In
    await page.goto('/auth/signin');
    await expect(page).toHaveTitle(/Sign In/);
    
    await page.fill('input[name="email"]', TEST_USER_EMAIL); // Use the user created in the signup test
    await page.fill('input[name="password"]', TEST_USER_PASSWORD);
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 10000 });
    await expect(page.locator('h1')).toContainText(/Welcome back|Dashboard/); // Check for dashboard content

    // Sign Out (assuming signout button is in AppLayout, or a direct navigation)
    // If SignoutButton.astro is used in layout:
    const signoutButtonForm = page.locator('form[action*="/api/auth/signout"]');
    if (await signoutButtonForm.count() > 0) {
        await signoutButtonForm.locator('button[type="submit"]').click();
    } else {
        // Fallback to direct navigation if button not found (e.g. testing /auth/signout page directly)
        await page.goto('/auth/signout'); // This page should present a confirmation form
        await page.click('button[type="submit"]:has-text("Sign Out")'); // Assuming /auth/signout page has this
    }
    
    await expect(page).toHaveURL(/\/auth\/signin(\?.*)?/, { timeout: 10000 }); // Redirected to sign-in
    // Optional: Check for a "Signed out successfully" message if applicable
  });

  test('should show error for invalid sign-in credentials', async ({ page }) => {
    await page.goto('/auth/signin');
    await page.fill('input[name="email"]', TEST_USER_EMAIL); // Valid email
    await page.fill('input[name="password"]', 'WrongPassword123!'); // Invalid password
    await page.click('button[type="submit"]');

    // Should remain on signin page or redirect to signin with error
    await expect(page).toHaveURL(/\/auth\/signin(\?error=CredentialsSignin.*)?/);
    // Check for error message. SigninForm.astro displays error prop.
    await expect(page.locator('div[role="alert"]:has-text("Incorrect email or password")')).toBeVisible();
  });
});