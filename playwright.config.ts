import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true, // Run tests in parallel
  forbidOnly: !!process.env.CI, // Fail if test.only is left in code in CI
  retries: process.env.CI ? 2 : 0, // Retry on failure in CI
  workers: process.env.CI ? 4 : undefined, // Limit workers in CI
  reporter: "html", // Reporter to use
  use: {
    baseURL: "http://127.0.0.1:3000/JSON_Schema_Validator", // Add basePath
    trace: "retain-on-failure", // Record trace if test fails
  },
  webServer: {
    command: "DEBUG=next:start pnpm start",
    reuseExistingServer: !process.env.CI, // Reuse server locally, start fresh in CI
    timeout: 240 * 1000, // Increase timeout for server start (4 minutes)
    port: 3000, // Check if port is open instead of polling URL
    stderr: "pipe", // Pipe server errors to Playwright process
    stdout: "pipe", // Pipe server output to Playwright process
  },
  // Optional: Configure projects for major browsers
  // projects: [ { name: 'chromium', use: { ...devices['Desktop Chrome'] } } ],
});
