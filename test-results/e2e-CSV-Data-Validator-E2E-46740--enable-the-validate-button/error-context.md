# Test info

- Name: CSV Data Validator E2E >> should allow uploading a CSV and enable the validate button
- Location: /home/lefab/Documents/JSON_Schema_Validator/tests/e2e/e2e.spec.ts:31:3

# Error details

```
Error: Timed out 10000ms waiting for expect(locator).toBeEnabled()

Locator: getByRole('button', { name: /validate data/i })
Expected: enabled
Received: disabled
Call log:
  - expect.toBeEnabled with timeout 10000ms
  - waiting for getByRole('button', { name: /validate data/i })
    14 × locator resolved to <button disabled class="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-primary/90 h-9 rounded-md px-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">Validate Data</button>
       - unexpected value "disabled"

    at /home/lefab/Documents/JSON_Schema_Validator/tests/e2e/e2e.spec.ts:61:34
```

# Page snapshot

```yaml
- banner:
    - img "Company Logo"
    - text: "|"
    - heading "CSV Data Validator" [level=1]
    - button "Toggle theme":
        - img
        - text: Toggle theme
- text: "Schema:"
- combobox: sample
- button "Upload Schema":
    - img
    - text: Upload Schema
- button "Show Schema View"
- button "Validate Data" [disabled]
- img
- text: CSV Data (sample.csv)
- switch "Toggle automatic file download"
- text: Auto-save
- button [disabled]:
    - img
- button:
    - img
- button "Upload another CSV file":
    - img
- code:
    - textbox "Editor content"
- img
- text: Validation Results
- button [disabled]:
    - img
- text: Upload CSV and click Validate.
- region "Notifications (F8)":
    - list
- alert
- button "Open Next.js Dev Tools":
    - img
- button "Open issues overlay": 2 Issue
- button "Collapse issues badge":
    - img
- alert
- alert
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
   35 |
   36 |     // Mock the API response for schema list for THIS test too
   37 |     await page.route('***/api/schemas', route => {
   38 |       route.fulfill({
   39 |         status: 200,
   40 |         contentType: 'application/json',
   41 |         body: JSON.stringify({ schemas: [{ name: 'sample', filename: 'sample.json' }] }),
   42 |       });
   43 |     });
   44 |
   45 |     // Locate the hidden file input directly
   46 |     const fileInput = page.locator('input[type="file"][accept=".csv, text/csv"]');
   47 |
   48 |     // Set the file directly on the input
   49 |     await fileInput.setInputFiles("public/fixtures/sample.csv");
   50 |
   51 |     // --- ADDED Schema Selection ---
   52 |     const schemaDropdownTrigger = page.locator('button[role="combobox"]');
   53 |     await schemaDropdownTrigger.click();
   54 |     const schemaOption = page.locator('[role="option"]:has-text("sample")'); // Use text selector
   55 |     await schemaOption.waitFor({ state: "visible", timeout: 10000 });
   56 |     await schemaOption.click();
   57 |     // --- END ADDED Schema Selection ---
   58 |
   59 |     const validateButton = page.getByRole("button", { name: /validate data/i });
   60 |     // Wait for button to be enabled after upload AND schema selection
>  61 |     await expect(validateButton).toBeEnabled({ timeout: 10000 });
      |                                  ^ Error: Timed out 10000ms waiting for expect(locator).toBeEnabled()
   62 |   });
   63 |
   64 |   test("should validate CSV and display results", async ({ page }) => {
   65 |     await page.goto("http://localhost:3000/");
   66 |
   67 |     // Mock the API response for schema list
   68 |     await page.route('***/api/schemas', route => {
   69 |       route.fulfill({
   70 |         status: 200,
   71 |         contentType: 'application/json',
   72 |         body: JSON.stringify({ schemas: [{ name: 'sample', filename: 'sample.json' }] }), // Provide mock data
   73 |       });
   74 |     });
   75 |
   76 |     // Locate the hidden file input directly
   77 |     const fileInput = page.locator('input[type="file"][accept=".csv, text/csv"]');
   78 |
   79 |     // Set the file directly on the input
   80 |     await fileInput.setInputFiles("public/fixtures/sample.csv");
   81 |
   82 |     // Select a schema
   83 |     const schemaDropdownTrigger = page.locator('button[role="combobox"]');
   84 |     await schemaDropdownTrigger.click();
   85 |
   86 |     // Use a more specific locator based on role and text
   87 |     const schemaOption = page.locator('[role="option"]:has-text("sample")'); // CHANGED LOCATOR
   88 |     // Explicitly wait for the option to be visible and stable before clicking
   89 |     await schemaOption.waitFor({ state: "visible", timeout: 10000 });
   90 |     await schemaOption.click();
   91 |
   92 |     // Validate
   93 |     const validateButton = page.getByRole("button", { name: /validate data/i });
   94 |     await expect(validateButton).toBeEnabled({ timeout: 5000 });
   95 |     await validateButton.click();
   96 |
   97 |     // Wait for results section to update
   98 |     const resultsHeader = page.locator('.CardHeader:has-text("Validation Results")');
   99 |     await expect(resultsHeader).not.toContainText(/pending/i, { timeout: 15000 });
  100 |     await expect(resultsHeader).toBeVisible();
  101 |
  102 |     // Check for specific result text
  103 |     await expect(page.locator('section:has-text("Validation Results")')).toContainText(/Errors/i, { timeout: 5000 });
  104 |   });
  105 | });
  106 |
```
