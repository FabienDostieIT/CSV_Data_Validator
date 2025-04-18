# Test info

- Name: CSV Data Validator E2E >> should validate CSV and display results
- Location: /home/lefab/Documents/JSON_Schema_Validator/tests/e2e/e2e.spec.ts:43:3

# Error details

```
Error: page.waitForEvent: Test timeout of 30000ms exceeded.
=========================== logs ===========================
waiting for event "filechooser"
============================================================
    at /home/lefab/Documents/JSON_Schema_Validator/tests/e2e/e2e.spec.ts:45:37
```

# Page snapshot

```yaml
- banner:
  - img "Company Logo"
  - text: "|"
  - heading "CSV Data Validator" [level=1]
  - button [disabled]:
    - img
- text: "Schema:"
- combobox [disabled]: Loading...
- button "Upload Schema":
  - img
  - text: Upload Schema
- button "Show Schema View" [disabled]
- button "Validate Data" [disabled]
- img
- text: CSV Data
- button [disabled]:
  - img
- button "Upload CSV":
  - img
  - text: Upload CSV
- text: Loading...
- img
- text: Validation Results
- button [disabled]:
  - img
- text: Upload CSV and click Validate.
- region "Notifications (F8)":
  - list
```

# Test source

```ts
   1 | import { test, expect } from "@playwright/test";
   2 |
   3 | test.describe("CSV Data Validator E2E", () => {
   4 |   test("should load the home page and display the app title", async ({
   5 |     page,
   6 |   }) => {
   7 |     await page.goto("http://localhost:3000/");
   8 |     await expect(page.locator("h1")).toContainText("CSV Data Validator");
   9 |   });
  10 |
  11 |   test("should display the upload CSV button", async ({ page }) => {
  12 |     await page.goto("http://localhost:3000/");
  13 |     await expect(
  14 |       page.getByRole("button", { name: "Upload CSV" }),
  15 |     ).toBeVisible();
  16 |   });
  17 |
  18 |   test("should display the schema dropdown", async ({ page }) => {
  19 |     await page.goto("http://localhost:3000/");
  20 |     await expect(page.getByText(/schema:/i)).toBeVisible();
  21 |   });
  22 |
  23 |   test("should have the validate button disabled when no CSV is uploaded", async ({
  24 |     page,
  25 |   }) => {
  26 |     await page.goto("http://localhost:3000/");
  27 |     const validateButton = page.getByRole("button", { name: /validate data/i });
  28 |     await expect(validateButton).toBeDisabled();
  29 |   });
  30 |
  31 |   test("should allow uploading a CSV and enable the validate button", async ({
  32 |     page,
  33 |   }) => {
  34 |     await page.goto("http://localhost:3000/");
  35 |     const fileChooserPromise = page.waitForEvent("filechooser");
  36 |     await page.getByRole("button", { name: "Upload CSV" }).click();
  37 |     const fileChooser = await fileChooserPromise;
  38 |     await fileChooser.setFiles("public/fixtures/sample.csv");
  39 |     const validateButton = page.getByRole("button", { name: /validate data/i });
  40 |     await expect(validateButton).toBeEnabled();
  41 |   });
  42 |
  43 |   test("should validate CSV and display results", async ({ page }) => {
  44 |     await page.goto("http://localhost:3000/");
> 45 |     const fileChooserPromise = page.waitForEvent("filechooser");
     |                                     ^ Error: page.waitForEvent: Test timeout of 30000ms exceeded.
  46 |     await page.getByRole("button", { name: "Upload CSV" }).click();
  47 |     const fileChooser = await fileChooserPromise;
  48 |     await fileChooser.setFiles("public/fixtures/sample.csv");
  49 |     // Select a schema if needed (assumes at least one is present)
  50 |     const schemaDropdown = page.getByText(/schema:/i);
  51 |     await schemaDropdown.click();
  52 |     const schemaOption = page.locator(".radix-select-item").first();
  53 |     await schemaOption.click();
  54 |     // Validate
  55 |     const validateButton = page.getByRole("button", { name: /validate data/i });
  56 |     await validateButton.click();
  57 |     // Wait for results
  58 |     await expect(page.getByText(/validation results/i)).toBeVisible();
  59 |     // Optionally check for error/warning icons or messages
  60 |   });
  61 | });
  62 |
```