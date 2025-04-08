/**
 * Tests for the schemas API endpoint
 */
import { createMocks } from 'node-mocks-http';
import handler from '../../pages/api/schemas';

// Mock the schema validator
jest.mock('../../../validator/validator', () => {
  return jest.fn().mockImplementation(() => {
    return {
      getAvailableVersions: jest.fn().mockReturnValue(['v1']),
      getAvailableSchemas: jest.fn().mockImplementation((dir, version) => {
        if (version === 'v1') {
          return [
            { name: 'person', description: 'Person schema' },
            { name: 'event', description: 'Event schema' }
          ];
        }
        return [];
      })
    };
  });
});

describe('/api/schemas endpoint', () => {
  beforeEach(() => {
    // Reset mocks for each test
    jest.clearAllMocks();
  });
  
  it('returns available schema versions and schemas', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      eventEmitter: true
    });
    
    await handler(req, res);
    
    expect(res._getStatusCode()).toBe(200);
    
    const responseData = JSON.parse(res._getData());
    expect(responseData.versions).toEqual(['v1']);
    expect(responseData.schemas.v1).toHaveLength(2);
    expect(responseData.schemas.v1[0].name).toBe('person');
    expect(responseData.schemas.v1[1].name).toBe('event');
  });
  
  it('returns 405 for non-GET requests', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {},
      eventEmitter: true
    });
    
    await handler(req, res);
    
    expect(res._getStatusCode()).toBe(405);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Method not allowed'
    });
  });
  
  it('handles errors during schema discovery', async () => {
    // Mock implementation to throw an error
    const SchemaValidator = require('../../../validator/validator');
    const mockValidator = new SchemaValidator();
    mockValidator.getAvailableVersions.mockImplementation(() => {
      throw new Error('Test error');
    });
    
    const { req, res } = createMocks({
      method: 'GET',
      eventEmitter: true
    });
    
    await handler(req, res);
    
    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData()).error).toContain('Internal server error');
  });
  
  it('returns empty arrays for no schemas', async () => {
    // Mock implementation to return empty arrays
    const SchemaValidator = require('../../../validator/validator');
    const mockValidator = new SchemaValidator();
    mockValidator.getAvailableVersions.mockReturnValue([]);
    
    const { req, res } = createMocks({
      method: 'GET',
      eventEmitter: true
    });
    
    await handler(req, res);
    
    expect(res._getStatusCode()).toBe(200);
    
    const responseData = JSON.parse(res._getData());
    expect(responseData.versions).toEqual([]);
    expect(responseData.schemas).toEqual({});
  });
}); 