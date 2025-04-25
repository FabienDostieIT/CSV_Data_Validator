import {
  test,
  expect,
  type Page,
  type Locator,
  type Route,
} from "@playwright/test";

test.describe("CSV Data Validator E2E", () => {
  // Helper function to set up API route mocking for all tests
  const setupApiMocks = async (page: Page) => {
    // Mock schemas list response
    await page.route("**/api/schemas", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          schemas: ["sample.json"],
        }),
      });
    });

    // Mock individual schema content response
    await page.route("**/api/schemas/sample*", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          content: {
            $schema: "http://json-schema.org/draft-07/schema#",
            title: "Sample Schema",
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
            },
          },
        }),
      });
    });

    // Mock schema documentation generation
    await page.route("**/api/generate-schema-doc", async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          markdown: "# Sample Schema Documentation",
        }),
      });
    });
  };

  test("should load the home page and display the app title", async ({
    page,
  }: {
    page: Page;
  }) => {
    await page.goto("http://localhost:3000/");
    await expect(page.locator("h1")).toContainText("CSV Data Validator");
  });

  test("should display the upload CSV button", async ({
    page,
  }: {
    page: Page;
  }) => {
    await page.goto("http://localhost:3000/");
    await expect(
      page.getByRole("button").filter({ hasText: "Upload CSV" }),
    ).toBeVisible();
  });

  test("should display the schema dropdown", async ({
    page,
  }: {
    page: Page;
  }) => {
    await page.goto("http://localhost:3000/");
    await expect(page.getByText(/schema:/i)).toBeVisible();
  });

  test("should have the validate button disabled when no CSV is uploaded", async ({
    page,
  }: {
    page: Page;
  }) => {
    await page.goto("http://localhost:3000/");
    const validateButton: Locator = page.getByRole("button", {
      name: /validate data/i,
    });
    await expect(validateButton).toBeDisabled();
  });

  test(
    "should allow uploading a CSV and enable the validate button",
    async ({ page }: { page: Page }) => {
      await setupApiMocks(page);

      // Visit the home page
      await page.goto("http://localhost:3000/");

      // Wait for the main component to render and use a more specific selector
      await page.waitForSelector('button:has-text("Upload CSV")', {
        state: "visible",
      });

      // Use a simpler approach - directly trigger the file input without clicking the button
      const fileInput: Locator = page.locator(
        'input[type="file"][accept=".csv, text/csv"]',
      );
      await expect(fileInput).toBeAttached();

      // Set the file directly on the input
      await fileInput.setInputFiles("public/fixtures/sample.csv");

      // Wait for file to be processed (initial wait)
      await page.waitForTimeout(2000);

      // Wait for the mocked schema list API call to complete
      await page.waitForResponse("**/api/schemas", { timeout: 30000 });

      // Wait for the dropdown trigger to be visible
      const dropdownTrigger = page.locator('[role="combobox"]');
      await dropdownTrigger.waitFor({ state: "visible", timeout: 5000 });

      // Try opening the dropdown
      await dropdownTrigger.click();

      // Check if the first option becomes visible
      const optionLocator = page.locator('[role="option"]', { hasText: "sample.json" });
      await expect(optionLocator).toBeVisible({ timeout: 10000 });
      await optionLocator.click();

      // Now check if the validate button becomes enabled
      const validateButton: Locator = page.getByRole('button', { name: /validate data/i });

      // Implicitly check enablement by attempting to click later.
      await expect(validateButton).toBeEnabled({ timeout: 10000 });

      // We will click this button in the next test step if this test passes
    },
    { timeout: 30000 },
  );

  test(
    "should validate CSV and display results",
    async ({ page }: { page: Page }) => {
      await setupApiMocks(page);

      // Visit the home page
      await page.goto("http://localhost:3000/");

      // Wait for the main component to render and use a more specific selector
      await page.waitForSelector('button:has-text("Upload CSV")', {
        state: "visible",
      });

      // Use a simpler approach - directly trigger the file input without clicking the button
      const fileInput: Locator = page.locator(
        'input[type="file"][accept=".csv, text/csv"]',
      );
      await expect(fileInput).toBeAttached();

      // Set the file directly on the input
      await fileInput.setInputFiles("public/fixtures/sample.csv");

      // Wait for file to be processed (initial wait)
      await page.waitForTimeout(2000);

      // Wait for the mocked schema list API call to complete
      await page.waitForResponse("**/api/schemas", { timeout: 30000 });

      // Wait for the dropdown trigger to be visible
      const dropdownTrigger = page.locator('[role="combobox"]');
      await dropdownTrigger.waitFor({ state: "visible", timeout: 5000 });

      // Try opening the dropdown
      await dropdownTrigger.click();

      // Check if the first option becomes visible
      const optionLocator = page.locator('[role="option"]', { hasText: "sample.json" });
      await expect(optionLocator).toBeVisible({ timeout: 10000 });
      await optionLocator.click();

      // Now check if the validate button becomes enabled
      const validateButton: Locator = page.getByRole('button', { name: /validate data/i });

      // Implicitly check enablement by attempting to click later.
      await expect(validateButton).toBeEnabled({ timeout: 10000 });

      // Ensure button is correctly typed before clicking
      const validateButton: Locator = page.getByRole("button", {
        name: /validate data/i,
      });

      // Add explicit visibility check before clicking
      await expect(validateButton).toBeVisible();
      // Click the validate button
      await validateButton.click();

      // Wait for the validation results to appear
      await page.waitForSelector("text=Validation Results", { timeout: 5000 });

      // Check that validation results are displayed
      const resultsHeading: Locator = page.getByText("Validation Results");
      await expect(resultsHeading).toBeVisible();
    },
    { timeout: 30000 },
  );
});
