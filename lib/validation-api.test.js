/**
 * Tests for the validation API client
 */
import { validateJson, getAvailableSchemas } from './validation-api';

// Mock the global fetch function
global.fetch = jest.fn();

describe('validation-api client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('validateJson', () => {
    it('successfully validates JSON data', async () => {
      // Mock response for successful validation
      const mockResponse = {
        valid: true,
        errors: null
      };
      
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse)
      });
      
      const data = { name: 'Test Person', email: 'test@example.com', age: 30 };
      const result = await validateJson('v1', 'person', data);
      
      // Check fetch was called with the right arguments
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: 'v1',
          schema: 'person',
          data: JSON.stringify(data)
        })
      });
      
      // Check the returned value
      expect(result).toEqual(mockResponse);
    });
    
    it('returns validation errors', async () => {
      // Mock response with validation errors
      const mockResponse = {
        valid: false,
        errors: [
          {
            message: 'Missing required field',
            path: '/email',
            line: 3,
            column: 1,
            fixSuggestion: 'Add the email field with a valid email address',
            expectedValue: 'Example: "user@example.com"'
          }
        ]
      };
      
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse)
      });
      
      const data = { name: 'Test Person' }; // missing email
      const result = await validateJson('v1', 'person', data);
      
      // Check the returned validation errors
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].message).toBe('Missing required field');
    });
    
    it('handles network errors', async () => {
      // Mock a network failure
      global.fetch.mockRejectedValueOnce(new Error('Network error'));
      
      const data = { name: 'Test Person' };
      
      // The function should throw an error
      await expect(validateJson('v1', 'person', data)).rejects.toThrow('Failed to validate JSON');
    });
    
    it('handles API errors', async () => {
      // Mock an API error response
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: jest.fn().mockResolvedValueOnce({ error: 'Invalid JSON data' })
      });
      
      const data = { name: 'Test Person' };
      
      // The function should throw an error with the API error message
      await expect(validateJson('v1', 'person', data)).rejects.toThrow('Invalid JSON data');
    });
  });
  
  describe('getAvailableSchemas', () => {
    it('successfully retrieves available schemas', async () => {
      // Mock response for schema listing
      const mockResponse = {
        versions: ['v1'],
        schemas: {
          v1: [
            { name: 'person', description: 'Person schema' },
            { name: 'event', description: 'Event schema' }
          ]
        }
      };
      
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse)
      });
      
      const result = await getAvailableSchemas();
      
      // Check fetch was called correctly
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith('/api/schemas', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      // Check the returned schemas
      expect(result).toEqual(mockResponse);
      expect(result.versions).toContain('v1');
      expect(result.schemas.v1.length).toBe(2);
      expect(result.schemas.v1[0].name).toBe('person');
      expect(result.schemas.v1[1].name).toBe('event');
    });
    
    it('handles network errors when fetching schemas', async () => {
      // Mock a network failure
      global.fetch.mockRejectedValueOnce(new Error('Network error'));
      
      // The function should throw an error
      await expect(getAvailableSchemas()).rejects.toThrow('Failed to fetch available schemas');
    });
    
    it('handles API errors when fetching schemas', async () => {
      // Mock an API error response
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: jest.fn().mockResolvedValueOnce({ error: 'Server error' })
      });
      
      // The function should throw an error with the API error message
      await expect(getAvailableSchemas()).rejects.toThrow('Server error');
    });
  });
}); 