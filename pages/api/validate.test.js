/**
 * Tests for the validation API endpoint
 */
import { createMocks } from 'node-mocks-http';
import handler from './validate';

// Mock the schema validator
jest.mock('../../validator/validator', () => {
  return jest.fn().mockImplementation(() => {
    return {
      validate: jest.fn(),
      loadSchema: jest.fn(),
      getAvailableVersions: jest.fn().mockReturnValue(['v1']),
      getAvailableSchemas: jest.fn().mockReturnValue([
        { name: 'person', description: 'Person schema' }
      ])
    };
  });
});

describe('/api/validate endpoint', () => {
  let req, res;
  
  beforeEach(() => {
    // Reset the mocks for each test
    jest.clearAllMocks();
    
    // Create fresh req/res mocks with event emitter to simulate Next.js behavior
    const mocks = createMocks({
      method: 'POST',
      body: {
        version: 'v1',
        schema: 'person',
        data: JSON.stringify({ name: 'Test Person', email: 'test@example.com', age: 30 })
      },
      eventEmitter: true
    });
    
    req = mocks.req;
    res = mocks.res;
  });

  it('handles successful validation', async () => {
    // Mock a successful validation result
    const SchemaValidator = require('../../validator/validator');
    const mockValidator = new SchemaValidator();
    mockValidator.validate.mockReturnValue({
      valid: true,
      errors: null
    });
    
    await handler(req, res);
    
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({
      valid: true,
      errors: null
    });
  });

  it('handles validation errors', async () => {
    // Mock a validation with errors
    const SchemaValidator = require('../../validator/validator');
    const mockValidator = new SchemaValidator();
    mockValidator.validate.mockReturnValue({
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
    });
    
    await handler(req, res);
    
    expect(res._getStatusCode()).toBe(200);
    const responseData = JSON.parse(res._getData());
    expect(responseData.valid).toBe(false);
    expect(responseData.errors.length).toBe(1);
    expect(responseData.errors[0].message).toBe('Missing required field');
  });

  it('returns 400 for missing required fields', async () => {
    // Request without required fields
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        // Missing version and schema
        data: JSON.stringify({ name: 'Test Person' })
      }
    });
    
    await handler(req, res);
    
    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Missing required fields: version, schema, data'
    });
  });

  it('returns 400 for invalid JSON data', async () => {
    // Request with invalid JSON
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        version: 'v1',
        schema: 'person',
        data: '{ invalid json }'
      }
    });
    
    await handler(req, res);
    
    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData()).error).toContain('Invalid JSON data');
  });

  it('returns 405 for non-POST requests', async () => {
    // GET request
    const { req, res } = createMocks({
      method: 'GET'
    });
    
    await handler(req, res);
    
    expect(res._getStatusCode()).toBe(405);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Method not allowed'
    });
  });

  it('handles internal server errors', async () => {
    // Force an error in the validator
    const SchemaValidator = require('../../validator/validator');
    const mockValidator = new SchemaValidator();
    mockValidator.validate.mockImplementation(() => {
      throw new Error('Test error');
    });
    
    await handler(req, res);
    
    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData()).error).toContain('Internal server error');
  });
}); 