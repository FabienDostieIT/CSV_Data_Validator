import { test, expect, type Page, type Route } from '@playwright/test';
import { CSVValidatorPage } from './page-objects/csv-validator.page';
import path from 'path';

/**
 * E2E Tests for CSV Data Validator application
 * 
 * Tests follow the application flow described in systemPatterns.md:
 * 1. Schema Selection
 * 2. Schema Documentation
 * 3. CSV Upload & Parsing
 * 4. Validation
 * 5. Results Display
 * 6. Error Highlighting
 */
test.describe('CSV Data Validator Application', () => {
  let csvValidatorPage: CSVValidatorPage;
  
  // Setup: Run before each test
  test.beforeEach(async ({ page }) => {
    // Set up page object
    csvValidatorPage = new CSVValidatorPage(page);
    
    // Set up API mocks for consistent testing
    await setupApiMocks(page);
    
    // Navigate to application
    await csvValidatorPage.goto();
  });
  
  /**
   * Helper function to set up API route mocking
   */
  async function setupApiMocks(page: Page) {
    // Enable request logging for debugging
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    // Mock the schemas list endpoint
    await page.route('**/api/list-schemas', async (route: Route) => {
      console.log('Mocking /api/list-schemas');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          schemas: ['event.json', 'place.json']
        })
      });
    });
    
    // Mock individual schema content endpoints
    await page.route('**/api/get-schema/**', async (route: Route) => {
      const url = route.request().url();
      console.log(`Mocking schema request: ${url}`);
      
      // Create mock schema content based on the requested schema
      const schemaName = url.includes('event') ? 'event' : 'place';
      const mockSchema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        title: `${schemaName.charAt(0).toUpperCase() + schemaName.slice(1)} Schema`,
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: { 
            type: 'string',
            description: 'Unique identifier'
          },
          name: { 
            type: 'string',
            description: 'Name of the item'
          },
          description: { 
            type: 'string',
            description: 'Detailed description'
          },
          date: {
            type: 'string',
            format: 'date',
            description: 'Date in YYYY-MM-DD format'
          },
          price: {
            type: 'number',
            description: 'Price value (numeric only)'
          }
        }
      };
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          content: mockSchema
        })
      });
    });
    
    // Mock schema documentation generation
    await page.route('**/api/generate-schema-doc', async (route: Route) => {
      console.log('Mocking /api/generate-schema-doc');
      
      // Extract the schema from the request body
      const requestData = route.request().postDataJSON();
      const schemaTitle = requestData?.title || 'Schema';
      
      const mockMarkdown = `
# ${schemaTitle}

A schema for validating data.

## Properties

| Property | Type | Description | Required |
|----------|------|-------------|----------|
| id | string | Unique identifier | Yes |
| name | string | Name of the item | Yes |
| description | string | Detailed description | No |
| date | string | Date in YYYY-MM-DD format | No |
| price | number | Price value (numeric only) | No |
      `;
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          markdown: mockMarkdown
        })
      });
    });
  }
  
  /**
   * Test: Application loads with expected UI elements
   */
  test('should load with all required UI elements', async () => {
    // Verify page title
    await expect(csvValidatorPage.heading).toBeVisible();
    
    // Verify schema dropdown exists
    await expect(csvValidatorPage.schemaDropdownTrigger).toBeVisible();
    
    // Verify upload CSV button exists
    await expect(csvValidatorPage.uploadCsvButton).toBeVisible();
    
    // Verify validate button exists but is disabled
    await expect(csvValidatorPage.validateButton).toBeVisible();
    await expect(csvValidatorPage.validateButton).toBeDisabled();
    
    // Verify results panel exists but shows no results yet
    await expect(csvValidatorPage.resultsPanel).toBeVisible();
    await csvValidatorPage.resultsContain('Upload CSV and click Validate');
  });
  
  /**
   * Test 1: Schema dropdown population and selection
   */
  test('should populate and allow selection from schema dropdown', async () => {
    // Wait for schemas to load in dropdown
    await expect(csvValidatorPage.schemaDropdownTrigger).toBeEnabled();
    
    // Open dropdown and verify schemas are listed
    await csvValidatorPage.schemaDropdownTrigger.click();
    await expect(csvValidatorPage.schemaDropdownOptions.filter({ hasText: 'event' })).toBeVisible();
    await expect(csvValidatorPage.schemaDropdownOptions.filter({ hasText: 'place' })).toBeVisible();
    
    // Select a schema
    await csvValidatorPage.schemaDropdownOptions.filter({ hasText: 'event' }).click();
    
    // Verify selection is reflected in the dropdown text
    await expect(csvValidatorPage.schemaDropdownTrigger).toContainText('event');
    
    // Verify validate button is still disabled (no CSV uploaded yet)
    await expect(csvValidatorPage.validateButton).toBeDisabled();
  });
  
  /**
   * Test 2: Schema documentation panel toggle and content
   */
  test('should toggle schema documentation panel and display content', async () => {
    // First select a schema
    await csvValidatorPage.selectSchema('event');
    
    // Verify doc panel is initially hidden
    const isInitiallyVisible = await csvValidatorPage.isSchemaDocPanelVisible();
    expect(isInitiallyVisible).toBeFalsy();
    
    // Toggle panel and verify it becomes visible
    const isNowVisible = await csvValidatorPage.toggleSchemaDocPanel();
    expect(isNowVisible).toBeTruthy();
    
    // Verify documentation content is loaded
    const docPanel = csvValidatorPage.schemaDocPanel;
    await expect(docPanel.getByText('Event Schema')).toBeVisible();
    await expect(docPanel.getByText('Properties')).toBeVisible();
    await expect(docPanel.getByText('id')).toBeVisible();
    await expect(docPanel.getByText('name')).toBeVisible();
    
    // Toggle panel again and verify it's hidden
    const isStillVisible = await csvValidatorPage.toggleSchemaDocPanel();
    expect(isStillVisible).toBeFalsy();
  });
  
  /**
   * Test 3: CSV file upload functionality
   */
  test('should upload and display CSV file content', async () => {
    // First select a schema
    await csvValidatorPage.selectSchema('event');
    
    // Get the path to our sample CSV file
    const sampleCsvPath = path.join(process.cwd(), 'public/fixtures/sample.csv');
    
    // Upload the CSV
    await csvValidatorPage.uploadCsv(sampleCsvPath);
    
    // Verify CSV content is displayed in the editor
    // Since we can't directly check monaco editor content, we'll check if validate button becomes enabled
    await expect(csvValidatorPage.validateButton).toBeEnabled();
    
    // Check for visual cues that upload succeeded
    await expect(csvValidatorPage.page.getByText('sample.csv')).toBeVisible();
  });
  
  /**
   * Test 4: Validation button activation
   */
  test('should enable validation button only after schema selection and CSV upload', async () => {
    // Initially, validate button should be disabled
    await expect(csvValidatorPage.validateButton).toBeDisabled();
    
    // Select a schema, button should still be disabled
    await csvValidatorPage.selectSchema('event');
    await expect(csvValidatorPage.validateButton).toBeDisabled();
    
    // Upload CSV, button should become enabled
    const sampleCsvPath = path.join(process.cwd(), 'public/fixtures/sample.csv');
    await csvValidatorPage.uploadCsv(sampleCsvPath);
    
    // Now validate button should be enabled
    await expect(csvValidatorPage.validateButton).toBeEnabled();
  });
  
  /**
   * Test 5: Validation results display for valid CSV
   */
  test('should validate and display success for valid CSV', async () => {
    // Set up test with schema and valid CSV
    await csvValidatorPage.selectSchema('event');
    const sampleCsvPath = path.join(process.cwd(), 'public/fixtures/sample.csv');
    await csvValidatorPage.uploadCsv(sampleCsvPath);
    
    // Trigger validation
    await csvValidatorPage.validate();
    
    // Check for success message
    const status = await csvValidatorPage.getValidationStatus();
    expect(status).toBe('valid');
    
    // Results panel should show "Success: Data is valid!"
    await csvValidatorPage.resultsContain('Success: Data is valid!');
  });
  
  /**
   * Test 6: Validation results display for invalid CSV
   */
  test('should validate and display errors for invalid CSV', async () => {
    // Set up test with schema and invalid CSV
    await csvValidatorPage.selectSchema('event');
    const invalidCsvPath = path.join(process.cwd(), 'public/fixtures/invalid-sample.csv');
    await csvValidatorPage.uploadCsv(invalidCsvPath);
    
    // Trigger validation
    await csvValidatorPage.validate();
    
    // Check for error status
    const status = await csvValidatorPage.getValidationStatus();
    expect(status).toBe('invalid');
    
    // Results panel should show "Invalid data"
    await csvValidatorPage.resultsContain('Invalid data');
    
    // Should show specific error messages
    await csvValidatorPage.resultsContain('Row 1');  // Error in row 1
    await csvValidatorPage.resultsContain('Row 2');  // Error in row 2
    await csvValidatorPage.resultsContain('Row 3');  // Error in row 3
  });
  
  /**
   * Test 7 (Optional): Error highlighting when clicking on errors
   */
  test('should highlight CSV line when clicking on error', async () => {
    // Set up test with schema and invalid CSV
    await csvValidatorPage.selectSchema('event');
    const invalidCsvPath = path.join(process.cwd(), 'public/fixtures/invalid-sample.csv');
    await csvValidatorPage.uploadCsv(invalidCsvPath);
    
    // Trigger validation
    await csvValidatorPage.validate();
    
    // Verify we have errors
    const status = await csvValidatorPage.getValidationStatus();
    expect(status).toBe('invalid');
    
    // Click on a specific error (e.g., Row 1)
    await csvValidatorPage.clickResultItem(1);
    
    // We can't directly check if line highlighting happened in Monaco editor,
    // but we can verify the accordion expanded, which is part of the interaction
    // This is handled in the clickResultItem method
  });
}); 