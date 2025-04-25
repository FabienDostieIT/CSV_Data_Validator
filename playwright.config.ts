import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true, // Run tests in parallel
  forbidOnly: !!process.env.CI, // Fail if test.only is left in code in CI
  retries: process.env.CI ? 2 : 0, // Retry on failure in CI
  workers: process.env.CI ? 1 : undefined, // Limit workers in CI
  reporter: "html", // Reporter to use
  use: {
    baseURL: "http://localhost:3000", // Base URL for actions like page.goto()
    trace: "on-first-retry", // Record trace only when retrying a failed test
  },
  webServer: {
    command: "pnpm start", // Command to start the dev server
    url: "http://localhost:3000", // URL to wait for
    reuseExistingServer: !process.env.CI, // Reuse server locally, start fresh in CI
    timeout: 120 * 1000, // Increase timeout for server start
  },
  // Optional: Configure projects for major browsers
  // projects: [ { name: 'chromium', use: { ...devices['Desktop Chrome'] } } ],
});
