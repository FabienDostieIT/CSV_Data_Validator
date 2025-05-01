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
    console.log("Setting up API mocks...");
    // Mock schemas list response - Updated Endpoint
    await page.route("**/api/list-schemas", async (route: Route) => {
      console.log("Intercepted /api/list-schemas");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          schemas: ["event.json", "place.json"], // Ensure this matches expected schema names
        }),
      });
    });

    // Mock individual schema content response for event - Updated Endpoint
    await page.route("**/api/get-schema/event*", async (route: Route) => {
      console.log("Intercepted /api/get-schema/event*");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          content: {
            $schema: "http://json-schema.org/draft-07/schema#",
            title: "Event Schema", // Use a distinct title for clarity
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              date: { type: "string", format: "date" },
            },
            required: ["id", "name", "date"],
          },
        }),
      });
    });

    // Mock individual schema content response for place - Added Mock
    await page.route("**/api/get-schema/place*", async (route: Route) => {
      console.log("Intercepted /api/get-schema/place*");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          content: {
            $schema: "http://json-schema.org/draft-07/schema#",
            title: "Place Schema", // Use a distinct title for clarity
            type: "object",
            properties: {
              placeId: { type: "string" },
              address: { type: "string" },
              city: { type: "string" },
            },
            required: ["placeId", "address"],
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
    // Check initial state of validate button
    const validateButton: Locator = page.getByRole("button", {
      name: /validate data/i,
    });
    await expect(validateButton).toBeDisabled();
  });

  // Test 1: Select Schema
  test("should be able to select a schema from the dropdown", async ({
    page,
  }) => {
    page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
    await setupApiMocks(page);
    await page.goto("http://localhost:3000/");

    // Wait for API and dropdown
    await page.waitForResponse("**/api/list-schemas");
    const dropdownTrigger = page.locator('[role="combobox"]');
    await dropdownTrigger.waitFor({ state: "visible", timeout: 5000 });
    await dropdownTrigger.click();

    // Select the schema
    const optionLocator = page.locator('[role="option"]', {
      hasText: "event.json",
    });
    await expect(optionLocator).toBeVisible({ timeout: 10000 });
    await optionLocator.click();

    // Verify selection reflected (e.g., dropdown text changes)
    await expect(dropdownTrigger).toHaveText("event.json");
  });

  // Test 2: Enable Validate Button
  test("should enable validate button after schema selection and CSV upload", async ({
    page,
  }) => {
    page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
    await setupApiMocks(page);
    await page.goto("http://localhost:3000/");

    // --- Select Schema ---
    await page.waitForResponse("**/api/list-schemas");
    const dropdownTrigger = page.locator('[role="combobox"]');
    await dropdownTrigger.waitFor({ state: "visible", timeout: 5000 });
    await dropdownTrigger.click();
    const optionLocator = page.locator('[role="option"]', {
      hasText: "event.json",
    });
    await expect(optionLocator).toBeVisible({ timeout: 10000 });
    await optionLocator.click();
    await expect(dropdownTrigger).toHaveText("event.json"); // Verify schema selected

    // --- Upload CSV ---
    const fileInput: Locator = page.locator(
      'input[type="file"][accept=".csv, text/csv"]',
    );
    await expect(fileInput).toBeAttached();
    await fileInput.setInputFiles("public/fixtures/sample.csv");
    // Optionally, add a small wait if file processing is async
    await page.waitForTimeout(500);

    // --- Check Button State ---
    const validateButton: Locator = page.getByRole("button", {
      name: /validate data/i,
    });
    await expect(validateButton).toBeEnabled({ timeout: 20000 });
  });

  // Test 3: Validate and Display Results
  test("should validate CSV and display results", async ({ page }) => {
    page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
    await setupApiMocks(page);
    await page.goto("http://localhost:3000/");

    // --- Select Schema ---
    await page.waitForResponse("**/api/list-schemas");
    const dropdownTrigger = page.locator('[role="combobox"]');
    await dropdownTrigger.waitFor({ state: "visible", timeout: 5000 });
    await dropdownTrigger.click();
    const optionLocator = page.locator('[role="option"]', {
      hasText: "event.json",
    });
    await expect(optionLocator).toBeVisible({ timeout: 10000 });
    await optionLocator.click();

    // --- Upload CSV ---
    const fileInput: Locator = page.locator(
      'input[type="file"][accept=".csv, text/csv"]',
    );
    await expect(fileInput).toBeAttached();
    await fileInput.setInputFiles("public/fixtures/sample.csv");
    await page.waitForTimeout(500); // Small wait after upload

    // --- Click Validate ---
    const validateButton: Locator = page.getByRole("button", {
      name: /validate data/i,
    });
    await expect(validateButton).toBeEnabled({ timeout: 20000 });
    await expect(validateButton).toBeVisible();
    await validateButton.click();

    // --- Check Results ---
    await page.waitForSelector("text=Validation Results", { timeout: 5000 });
    const resultsHeading: Locator = page.getByText("Validation Results");
    await expect(resultsHeading).toBeVisible();
  });
});
