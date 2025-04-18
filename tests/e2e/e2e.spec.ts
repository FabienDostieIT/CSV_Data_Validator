import { test, expect } from '@playwright/test';

test.describe('CSV Data Validator E2E', () => {
  test('should load the home page and display the app title', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    await expect(page.locator('h1')).toContainText('CSV Data Validator');
  });

  test('should display the upload CSV button', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    await expect(page.getByRole('button', { name: /upload/i })).toBeVisible();
  });

  test('should display the schema dropdown', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    await expect(page.getByText(/schema:/i)).toBeVisible();
  });

  test('should have the validate button disabled when no CSV is uploaded', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    const validateButton = page.getByRole('button', { name: /validate data/i });
    await expect(validateButton).toBeDisabled();
  });

  test('should allow uploading a CSV and enable the validate button', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /upload/i }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles('public/fixtures/sample.csv');
    const validateButton = page.getByRole('button', { name: /validate data/i });
    await expect(validateButton).toBeEnabled();
  });

  test('should validate CSV and display results', async ({ page }) => {
    await page.goto('http://localhost:3000/');
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /upload/i }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles('public/fixtures/sample.csv');
    // Select a schema if needed (assumes at least one is present)
    const schemaDropdown = page.getByText(/schema:/i);
    await schemaDropdown.click();
    const schemaOption = page.locator('.radix-select-item').first();
    await schemaOption.click();
    // Validate
    const validateButton = page.getByRole('button', { name: /validate data/i });
    await validateButton.click();
    // Wait for results
    await expect(page.getByText(/validation results/i)).toBeVisible();
    // Optionally check for error/warning icons or messages
  });
});