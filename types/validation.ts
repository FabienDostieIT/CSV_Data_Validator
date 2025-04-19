// types/validation.ts

// Define a basic structure for validation errors
export interface ValidationError {
  row?: number; // Optional: Row number where the error occurred (1-based index)
  column?: string; // Optional: Column header/name where the error occurred
  field?: string; // Optional: Field name if different from column
  value?: unknown; // Optional: The value that caused the error
  message: string; // The error description
  type?: 'error' | 'warning'; // Optional: Type of issue (default could be error)
}

// Define the structure for the overall validation response
export interface ValidationResponse {
  isValid: boolean; // Indicates if the data is valid according to the schema
  errors: ValidationError[]; // Array of validation errors
  warnings?: ValidationError[]; // Optional: Array of validation warnings
  // Optional: Add any other relevant fields, e.g., statistics
  rowCount?: number; 
  errorCount?: number;
  warningCount?: number;
} 