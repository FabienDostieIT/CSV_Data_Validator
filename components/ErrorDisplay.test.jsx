/**
 * Tests for the ErrorDisplay React component
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ErrorDisplay from './ErrorDisplay';

describe('ErrorDisplay Component', () => {
  const mockErrors = [
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
  ];

  it('renders error count and header', () => {
    render(<ErrorDisplay errors={mockErrors} />);
    
    expect(screen.getByText(/2 validation errors/i)).toBeInTheDocument();
    expect(screen.getByText(/Please fix the following issues/i)).toBeInTheDocument();
  });

  it('displays all error messages', () => {
    render(<ErrorDisplay errors={mockErrors} />);
    
    expect(screen.getByText(/Missing required field/i)).toBeInTheDocument();
    expect(screen.getByText(/Value should be a number/i)).toBeInTheDocument();
    
    // Check line and column info
    expect(screen.getByText(/Line 3/i)).toBeInTheDocument();
    expect(screen.getByText(/Line 4/i)).toBeInTheDocument();
  });

  it('shows error paths in a user-friendly format', () => {
    render(<ErrorDisplay errors={mockErrors} />);
    
    // Check for friendly field names (e.g., 'email' instead of '/email')
    expect(screen.getByText(/email/i)).toBeInTheDocument();
    expect(screen.getByText(/age/i)).toBeInTheDocument();
  });

  it('toggles accordion to show fix suggestions', () => {
    render(<ErrorDisplay errors={mockErrors} />);
    
    // Initial state - fix suggestions should be hidden
    expect(screen.queryByText(/Add the email field with a valid email address/i)).not.toBeInTheDocument();
    
    // Open the first accordion
    const accordionButtons = screen.getAllByText(/How to fix this/i);
    fireEvent.click(accordionButtons[0]);
    
    // Now the fix suggestion should be visible
    expect(screen.getByText(/Add the email field with a valid email address/i)).toBeInTheDocument();
    
    // Example should also be visible
    expect(screen.getByText(/Example: "user@example.com"/i)).toBeInTheDocument();
    
    // Close the accordion
    fireEvent.click(accordionButtons[0]);
    
    // Fix suggestion should be hidden again
    expect(screen.queryByText(/Add the email field with a valid email address/i)).not.toBeInTheDocument();
  });

  it('renders "No errors" message when error array is empty', () => {
    render(<ErrorDisplay errors={[]} />);
    
    expect(screen.getByText(/No errors/i)).toBeInTheDocument();
  });

  it('renders error icons', () => {
    render(<ErrorDisplay errors={mockErrors} />);
    
    // Check for error icons (may need to adjust based on your implementation)
    const errorIcons = screen.getAllByTestId('error-icon');
    expect(errorIcons.length).toBeGreaterThan(0);
  });

  it('renders line and column indicators for each error', () => {
    render(<ErrorDisplay errors={mockErrors} />);
    
    // First error is at line 3, column 1
    expect(screen.getByText(/Line 3, Column 1/i)).toBeInTheDocument();
    
    // Second error is at line 4, column 10
    expect(screen.getByText(/Line 4, Column 10/i)).toBeInTheDocument();
  });

  it('handles errors without line/column information', () => {
    const errorsWithoutPosition = [
      {
        message: 'Schema validation error',
        path: '/data',
        // No line/column
        fixSuggestion: 'Check your data structure',
        expectedValue: 'Example: {...}'
      }
    ];
    
    render(<ErrorDisplay errors={errorsWithoutPosition} />);
    
    // Should still render the error without position information
    expect(screen.getByText(/Schema validation error/i)).toBeInTheDocument();
    expect(screen.queryByText(/Line/i)).not.toBeInTheDocument();
  });

  it('handles errors without fix suggestions', () => {
    const errorsWithoutFix = [
      {
        message: 'Unknown error',
        path: '/data',
        line: 1,
        column: 1
        // No fixSuggestion or expectedValue
      }
    ];
    
    render(<ErrorDisplay errors={errorsWithoutFix} />);
    
    // Should still render the error
    expect(screen.getByText(/Unknown error/i)).toBeInTheDocument();
    
    // The accordion should not be present
    expect(screen.queryByText(/How to fix this/i)).not.toBeInTheDocument();
  });
}); 