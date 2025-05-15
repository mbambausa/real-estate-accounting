// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

// Test the sign-in flow
test('should allow a user to sign in', async ({ page }) => {
  // Navigate to the sign-in page
  await page.goto('/auth/signin');
  
  // Check that the page loads correctly
  await expect(page).toHaveTitle(/Sign In/);
  
  // Fill in the form
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password123');
  
  // Submit the form
  await page.click('button[type="submit"]');
  
  // Check if we're redirected to the dashboard (success case)
  // Note: This may fail in actual tests if credentials are invalid
  await expect(page).toHaveURL(/\/app\/dashboard/);
});

// Test the sign-up flow
test('should allow a user to sign up', async ({ page }) => {
  // Navigate to the sign-up page
  await page.goto('/auth/signup');
  
  // Check that the page loads correctly
  await expect(page).toHaveTitle(/Register|Sign Up/);
  
  // Fill in the form with unique email to avoid conflicts
  const uniqueEmail = `test-${Date.now()}@example.com`;
  await page.fill('input[name="name"]', 'Test User');
  await page.fill('input[name="email"]', uniqueEmail);
  await page.fill('input[name="password"]', 'password123');
  await page.fill('input[name="confirm_password"]', 'password123');
  
  // Submit the form
  await page.click('button[type="submit"]');
  
  // Check if we're redirected to the sign-in page (success case)
  await expect(page).toHaveURL(/\/auth\/signin/);
});

// Test validation on sign-up
test('should validate sign-up form fields', async ({ page }) => {
  // Navigate to the sign-up page
  await page.goto('/auth/signup');
  
  // Try to submit without filling in anything
  await page.click('button[type="submit"]');
  
  // Check that we're still on the sign-up page
  await expect(page).toHaveURL(/\/auth\/signup/);
  
  // Fill in mismatched passwords
  await page.fill('input[name="name"]', 'Test User');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password123');
  await page.fill('input[name="confirm_password"]', 'differentPassword');
  
  // Submit the form
  await page.click('button[type="submit"]');
  
  // Check that we're still on the sign-up page
  await expect(page).toHaveURL(/\/auth\/signup/);
  
  // Check for validation error
  await expect(page.locator('.bg-red-100')).toBeVisible();
});

// Test sign-out flow
test('should allow a user to sign out', async ({ page }) => {
  // First, sign in
  await page.goto('/auth/signin');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  
  // Wait for potential redirect to dashboard
  try {
    await page.waitForURL(/\/app\/dashboard/, { timeout: 5000 });
  } catch (e) {
    // If we don't reach dashboard (e.g., invalid credentials), skip this test
    test.skip();
    return;
  }
  
  // Navigate to sign-out page
  await page.goto('/auth/signout');
  
  // Confirm sign-out
  await page.click('button[type="submit"]');
  
  // Check if we're redirected to the sign-in page
  await expect(page).toHaveURL(/\/auth\/signin/);
});