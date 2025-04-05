/**
 * Tests for the ValidationUI React component
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the validation-api
jest.mock('../lib/validation-api', () => ({
  validateJson: jest.fn(),
  getAvailableSchemas: jest.fn().mockResolvedValue({
    versions: ['v1'],
    schemas: {
      v1: [
        { name: 'person', description: 'Person schema' }
      ]
    }
  })
}));

// Import the component and mock dependencies
import ValidationUI from './ValidationUI';
import { validateJson, getAvailableSchemas } from '../lib/validation-api';

describe('ValidationUI Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the validation form correctly', async () => {
    render(<ValidationUI />);
    
    // Check for main elements
    expect(screen.getByText(/JSON Validator/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Schema Version/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Schema Type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/JSON Data/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Validate/i })).toBeInTheDocument();
    
    // Wait for schema options to load
    await waitFor(() => {
      expect(getAvailableSchemas).toHaveBeenCalled();
    });
  });

  it('validates valid JSON data successfully', async () => {
    validateJson.mockResolvedValue({
      valid: true,
      errors: null
    });

    render(<ValidationUI />);
    
    // Fill in the form
    await waitFor(() => {
      expect(screen.getByLabelText(/Schema Type/i)).not.toBeDisabled();
    });
    
    // Enter valid JSON
    const jsonInput = screen.getByLabelText(/JSON Data/i);
    fireEvent.change(jsonInput, { 
      target: { 
        value: JSON.stringify({ 
          name: 'John Doe', 
          email: 'john@example.com',
          age: 30 
        }) 
      } 
    });
    
    // Click validate button
    fireEvent.click(screen.getByRole('button', { name: /Validate/i }));
    
    await waitFor(() => {
      expect(validateJson).toHaveBeenCalled();
      expect(screen.getByText(/Validation successful!/i)).toBeInTheDocument();
    });
  });

  it('shows validation errors for invalid JSON data', async () => {
    validateJson.mockResolvedValue({
      valid: false,
      errors: [
        {
          message: 'Missing required field',
          path: '/email',
          line: 3,
          column: 1,
          fixSuggestion: 'Add the email field with a valid email address',
          expectedValue: 'Example: "user@example.com"'
        },
        {
          message: 'Value should be a number',
          path: '/age',
          line: 4,
          column: 10,
          fixSuggestion: 'Change the value to a number',
          expectedValue: 'Example: 30'
        }
      ]
    });

    render(<ValidationUI />);
    
    // Fill in the form
    await waitFor(() => {
      expect(screen.getByLabelText(/Schema Type/i)).not.toBeDisabled();
    });
    
    // Enter invalid JSON
    const jsonInput = screen.getByLabelText(/JSON Data/i);
    fireEvent.change(jsonInput, { 
      target: { 
        value: JSON.stringify({ 
          name: 'John Doe', 
          // missing email
          age: "thirty" // wrong type
        }, null, 2) 
      } 
    });
    
    // Click validate button
    fireEvent.click(screen.getByRole('button', { name: /Validate/i }));
    
    await waitFor(() => {
      expect(validateJson).toHaveBeenCalled();
      expect(screen.getByText(/Validation errors/i)).toBeInTheDocument();
      expect(screen.getByText(/Missing required field/i)).toBeInTheDocument();
      expect(screen.getByText(/Value should be a number/i)).toBeInTheDocument();
    });
  });

  it('displays error accordions with fix suggestions', async () => {
    validateJson.mockResolvedValue({
      valid: false,
      errors: [
        {
          message: 'Value should be a number',
          path: '/age',
          line: 3,
          column: 10,
          fixSuggestion: 'Change the value to a number',
          expectedValue: 'Example: 30'
        }
      ]
    });

    render(<ValidationUI />);
    
    // Fill in the form
    await waitFor(() => {
      expect(screen.getByLabelText(/Schema Type/i)).not.toBeDisabled();
    });
    
    // Enter invalid JSON
    const jsonInput = screen.getByLabelText(/JSON Data/i);
    fireEvent.change(jsonInput, { 
      target: { 
        value: JSON.stringify({ 
          name: 'John Doe', 
          email: 'john@example.com',
          age: "thirty" // wrong type
        }, null, 2) 
      } 
    });
    
    // Click validate button
    fireEvent.click(screen.getByRole('button', { name: /Validate/i }));
    
    await waitFor(() => {
      expect(validateJson).toHaveBeenCalled();
      expect(screen.getByText(/Value should be a number/i)).toBeInTheDocument();
    });
    
    // Find and click the accordion to see fix suggestions
    const accordionButton = screen.getByText(/How to fix this/i);
    fireEvent.click(accordionButton);
    
    // Check that fix suggestions are displayed
    await waitFor(() => {
      expect(screen.getByText(/Change the value to a number/i)).toBeInTheDocument();
      expect(screen.getByText(/Example: 30/i)).toBeInTheDocument();
    });
  });

  it('shows error for invalid JSON syntax', async () => {
    render(<ValidationUI />);
    
    // Fill in the form with invalid JSON syntax
    await waitFor(() => {
      expect(screen.getByLabelText(/Schema Type/i)).not.toBeDisabled();
    });
    
    // Enter invalid JSON syntax
    const jsonInput = screen.getByLabelText(/JSON Data/i);
    fireEvent.change(jsonInput, { 
      target: { 
        value: `{ 
          "name": "John Doe",
          "email": "john@example.com"
          "age": 30
        }` // missing comma after email
      } 
    });
    
    // Click validate button
    fireEvent.click(screen.getByRole('button', { name: /Validate/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/Invalid JSON syntax/i)).toBeInTheDocument();
    });
  });

  it('handles error state during schema loading', async () => {
    getAvailableSchemas.mockRejectedValue(new Error('Failed to load schemas'));
    
    render(<ValidationUI />);
    
    await waitFor(() => {
      expect(screen.getByText(/Error loading schemas/i)).toBeInTheDocument();
    });
  });

  it('handles error state during validation', async () => {
    validateJson.mockRejectedValue(new Error('Validation service error'));
    
    render(<ValidationUI />);
    
    // Fill in the form
    await waitFor(() => {
      expect(screen.getByLabelText(/Schema Type/i)).not.toBeDisabled();
    });
    
    // Enter valid JSON
    const jsonInput = screen.getByLabelText(/JSON Data/i);
    fireEvent.change(jsonInput, { 
      target: { 
        value: JSON.stringify({ 
          name: 'John Doe', 
          email: 'john@example.com',
          age: 30 
        }) 
      } 
    });
    
    // Click validate button
    fireEvent.click(screen.getByRole('button', { name: /Validate/i }));
    
    await waitFor(() => {
      expect(validateJson).toHaveBeenCalled();
      expect(screen.getByText(/Error during validation/i)).toBeInTheDocument();
    });
  });
}); 