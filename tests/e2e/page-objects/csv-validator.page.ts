import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object Model for CSV Validator application
 * Encapsulates common interactions with the application UI
 */
export class CSVValidatorPage {
  // The page instance
  readonly page: Page;
  
  // Locators for UI elements
  readonly heading: Locator;
  readonly schemaDropdownTrigger: Locator;
  readonly schemaDropdownOptions: Locator;
  readonly uploadSchemaButton: Locator;
  readonly showSchemaViewButton: Locator;
  readonly schemaDocPanel: Locator;
  readonly uploadCsvButton: Locator;
  readonly csvFileInput: Locator;
  readonly schemaFileInput: Locator;
  readonly validateButton: Locator;
  readonly resultsPanel: Locator;
  readonly resultItems: Locator;
  readonly csvEditor: Locator;
  
  /**
   * Constructor
   * @param page Playwright page instance
   */
  constructor(page: Page) {
    this.page = page;
    
    // Initialize locators
    this.heading = page.locator('h1').filter({ hasText: 'CSV Data Validator' });
    this.schemaDropdownTrigger = page.locator('[role="combobox"]').first();
    this.schemaDropdownOptions = page.locator('[role="option"]');
    this.uploadSchemaButton = page.getByRole('button', { name: 'Upload Schema' });
    this.showSchemaViewButton = page.getByRole('button', { name: /Show Schema View|Hide Schema View/ });
    this.schemaDocPanel = page.locator('h1', { hasText: 'Schema Documentation' }).first().locator('xpath=ancestor::div[contains(@class, "card")]');
    this.uploadCsvButton = page.getByRole('button', { name: 'Upload CSV' });
    this.csvFileInput = page.locator('input[type="file"][accept=".csv, text/csv"]');
    this.schemaFileInput = page.locator('input[type="file"][accept=".json, application/json"]');
    this.validateButton = page.getByRole('button', { name: 'Validate Data' });
    this.resultsPanel = page.getByText('Validation Results').first().locator('xpath=ancestor::div[contains(@class, "card")]');
    this.resultItems = page.locator('[data-accordion-item]');
    this.csvEditor = page.locator('.monaco-editor');
  }
  
  /**
   * Navigate to the application
   */
  async goto() {
    await this.page.goto('/');
    await expect(this.heading).toBeVisible();
  }
  
  /**
   * Select a schema from the dropdown
   * @param schemaName Schema name to select
   */
  async selectSchema(schemaName: string) {
    await this.schemaDropdownTrigger.click();
    
    // Remove .json extension if present in the selector
    const displayName = schemaName.replace(/\.json$/, '');
    
    // Wait for options to appear and select the one matching our schema name
    await expect(this.schemaDropdownOptions).toBeVisible();
    await this.schemaDropdownOptions.filter({ hasText: displayName }).click();
    
    // Verify selection was made
    await expect(this.schemaDropdownTrigger).toContainText(displayName);
  }
  
  /**
   * Toggle schema documentation panel
   * @returns True if panel is now visible, false otherwise
   */
  async toggleSchemaDocPanel() {
    const isVisible = await this.isSchemaDocPanelVisible();
    await this.showSchemaViewButton.click();
    
    // Wait for the opposite state
    if (isVisible) {
      await expect(this.schemaDocPanel).not.toBeVisible();
      return false;
    } else {
      await expect(this.schemaDocPanel).toBeVisible();
      return true;
    }
  }
  
  /**
   * Check if schema documentation panel is visible
   */
  async isSchemaDocPanelVisible() {
    return await this.schemaDocPanel.isVisible().catch(() => false);
  }
  
  /**
   * Upload a CSV file
   * @param filePath Path to the CSV file
   */
  async uploadCsv(filePath: string) {
    // If upload button is visible (no CSV loaded yet), click it first
    const uploadButtonVisible = await this.uploadCsvButton.isVisible();
    if (uploadButtonVisible) {
      await this.uploadCsvButton.click();
    }
    
    // Set the file
    await this.csvFileInput.setInputFiles(filePath);
    
    // Wait for the editor to contain content
    await expect(this.csvEditor).toBeVisible();
    // Small pause to let the file process
    await this.page.waitForTimeout(500);
  }
  
  /**
   * Upload a schema file
   * @param filePath Path to the schema file
   */
  async uploadSchema(filePath: string) {
    await this.uploadSchemaButton.click();
    await this.schemaFileInput.setInputFiles(filePath);
    
    // Wait a moment for the upload to process
    await this.page.waitForTimeout(500);
  }
  
  /**
   * Trigger validation and wait for results
   */
  async validate() {
    // First check if the button is enabled
    await expect(this.validateButton).toBeEnabled();
    
    // Click it and wait for results to appear
    await this.validateButton.click();
    await expect(this.resultsPanel).toBeVisible();
  }
  
  /**
   * Check if validation results contain specific text
   * @param text Text to look for in results
   */
  async resultsContain(text: string) {
    await expect(this.resultsPanel.getByText(text)).toBeVisible();
  }
  
  /**
   * Get the validation status (valid/invalid)
   */
  async getValidationStatus() {
    const successMessage = this.resultsPanel.getByText('Success: Data is valid!');
    const errorMessage = this.resultsPanel.getByText('Invalid data');
    
    const isSuccess = await successMessage.isVisible().catch(() => false);
    if (isSuccess) return 'valid';
    
    const isError = await errorMessage.isVisible().catch(() => false);
    if (isError) return 'invalid';
    
    return 'unknown';
  }
  
  /**
   * Click on a specific result item
   * @param rowNumber Row number to click on
   */
  async clickResultItem(rowNumber: number) {
    // Find the result item containing the row number
    const item = this.resultItems.filter({ hasText: `Row ${rowNumber}` }).first();
    await item.click();
    
    // Check if the CSV editor has a highlighted line now
    // This is harder to verify directly, but we can check the accordion opened
    await expect(item.locator('[data-state="open"]')).toBeVisible();
  }
} 