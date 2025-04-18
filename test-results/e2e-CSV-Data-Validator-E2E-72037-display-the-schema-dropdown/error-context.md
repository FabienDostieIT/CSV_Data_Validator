# Test info

- Name: CSV Data Validator E2E >> should display the schema dropdown
- Location: /home/lefab/Documents/JSON_Schema_Validator/tests/e2e/e2e.spec.ts:14:3

# Error details

```
Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
Call log:
  - navigating to "http://localhost:3000/", waiting until "load"

    at /home/lefab/Documents/JSON_Schema_Validator/tests/e2e/e2e.spec.ts:15:16
```

# Test source

```ts
   1 | import { test, expect } from '@playwright/test';
   2 |
   3 | test.describe('CSV Data Validator E2E', () => {
   4 |   test('should load the home page and display the app title', async ({ page }) => {
   5 |     await page.goto('http://localhost:3000/');
   6 |     await expect(page.locator('h1')).toContainText('CSV Data Validator');
   7 |   });
   8 |
   9 |   test('should display the upload CSV button', async ({ page }) => {
  10 |     await page.goto('http://localhost:3000/');
  11 |     await expect(page.getByRole('button', { name: /upload/i })).toBeVisible();
  12 |   });
  13 |
  14 |   test('should display the schema dropdown', async ({ page }) => {
> 15 |     await page.goto('http://localhost:3000/');
     |                ^ Error: page.goto: net::ERR_ABORTED; maybe frame was detached?
  16 |     await expect(page.getByText(/schema:/i)).toBeVisible();
  17 |   });
  18 |
  19 |   test('should have the validate button disabled when no CSV is uploaded', async ({ page }) => {
  20 |     await page.goto('http://localhost:3000/');
  21 |     const validateButton = page.getByRole('button', { name: /validate data/i });
  22 |     await expect(validateButton).toBeDisabled();
  23 |   });
  24 |
  25 |   test('should allow uploading a CSV and enable the validate button', async ({ page }) => {
  26 |     await page.goto('http://localhost:3000/');
  27 |     const fileChooserPromise = page.waitForEvent('filechooser');
  28 |     await page.getByRole('button', { name: /upload/i }).click();
  29 |     const fileChooser = await fileChooserPromise;
  30 |     await fileChooser.setFiles('public/fixtures/sample.csv');
  31 |     const validateButton = page.getByRole('button', { name: /validate data/i });
  32 |     await expect(validateButton).toBeEnabled();
  33 |   });
  34 |
  35 |   test('should validate CSV and display results', async ({ page }) => {
  36 |     await page.goto('http://localhost:3000/');
  37 |     const fileChooserPromise = page.waitForEvent('filechooser');
  38 |     await page.getByRole('button', { name: /upload/i }).click();
  39 |     const fileChooser = await fileChooserPromise;
  40 |     await fileChooser.setFiles('public/fixtures/sample.csv');
  41 |     // Select a schema if needed (assumes at least one is present)
  42 |     const schemaDropdown = page.getByText(/schema:/i);
  43 |     await schemaDropdown.click();
  44 |     const schemaOption = page.locator('.radix-select-item').first();
  45 |     await schemaOption.click();
  46 |     // Validate
  47 |     const validateButton = page.getByRole('button', { name: /validate data/i });
  48 |     await validateButton.click();
  49 |     // Wait for results
  50 |     await expect(page.getByText(/validation results/i)).toBeVisible();
  51 |     // Optionally check for error/warning icons or messages
  52 |   });
  53 | });
```