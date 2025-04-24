import { test, expect } from "@playwright/test";

test.describe("CSV Data Validator E2E", () => {
  test("should load the home page and display the app title", async ({
    page,
  }) => {
    await page.goto("http://localhost:3000/");
    await expect(page.locator("h1")).toContainText("CSV Data Validator");
  });

  test("should display the upload CSV button", async ({ page }) => {
    await page.goto("http://localhost:3000/");
    await expect(
      page.getByRole("button", { name: "Upload CSV" }),
    ).toBeVisible();
  });

  test("should display the schema dropdown", async ({ page }) => {
    await page.goto("http://localhost:3000/");
    await expect(page.getByText(/schema:/i)).toBeVisible();
  });

  test("should have the validate button disabled when no CSV is uploaded", async ({
    page,
  }) => {
    await page.goto("http://localhost:3000/");
    const validateButton = page.getByRole("button", { name: /validate data/i });
    await expect(validateButton).toBeDisabled();
  });

  test("should allow uploading a CSV and enable the validate button", async ({
    page,
  }) => {
    await page.goto("http://localhost:3000/");

    // Mock the API response for schema list for THIS test too
    await page.route("***/api/schemas", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          schemas: [{ name: "sample", filename: "sample.json" }],
        }),
      });
    });

    // Locate the hidden file input directly
    const fileInput = page.locator(
      'input[type="file"][accept=".csv, text/csv"]',
    );

    // Set the file directly on the input
    await fileInput.setInputFiles("public/fixtures/sample.csv");

    // --- ADDED Schema Selection ---
    const schemaDropdownTrigger = page.locator('button[role="combobox"]');
    await schemaDropdownTrigger.click();
    const schemaOption = page.locator('[role="option"]:has-text("sample")'); // Use text selector
    await schemaOption.waitFor({ state: "visible", timeout: 10000 });
    await schemaOption.click();
    // --- END ADDED Schema Selection ---

    const validateButton = page.getByRole("button", { name: /validate data/i });
    // Wait for button to be enabled after upload AND schema selection
    await expect(validateButton).toBeEnabled({ timeout: 10000 });
  });

  test("should validate CSV and display results", async ({ page }) => {
    await page.goto("http://localhost:3000/");

    // Mock the API response for schema list
    await page.route("***/api/schemas", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          schemas: [{ name: "sample", filename: "sample.json" }],
        }), // Provide mock data
      });
    });

    // Locate the hidden file input directly
    const fileInput = page.locator(
      'input[type="file"][accept=".csv, text/csv"]',
    );

    // Set the file directly on the input
    await fileInput.setInputFiles("public/fixtures/sample.csv");

    // Select a schema
    const schemaDropdownTrigger = page.locator('button[role="combobox"]');
    await schemaDropdownTrigger.click();

    // Use a more specific locator based on role and text
    const schemaOption = page.locator('[role="option"]:has-text("sample")'); // CHANGED LOCATOR
    // Explicitly wait for the option to be visible and stable before clicking
    await schemaOption.waitFor({ state: "visible", timeout: 10000 });
    await schemaOption.click();

    // Validate
    const validateButton = page.getByRole("button", { name: /validate data/i });
    await expect(validateButton).toBeEnabled({ timeout: 5000 });
    await validateButton.click();

    // Wait for results section to update
    const resultsHeader = page.locator(
      '.CardHeader:has-text("Validation Results")',
    );
    await expect(resultsHeader).not.toContainText(/pending/i, {
      timeout: 15000,
    });
    await expect(resultsHeader).toBeVisible();

    // Check for specific result text
    await expect(
      page.locator('section:has-text("Validation Results")'),
    ).toContainText(/Errors/i, { timeout: 5000 });
  });
});
