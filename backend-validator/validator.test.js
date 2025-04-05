/**
 * Tests for the JSON Schema validator implementation
 */
const SchemaValidator = require('./validator');
const path = require('path');
const fs = require('fs');

// Mock schemas directory for testing
const mockSchemaDir = path.join(__dirname, 'test-schemas');
const mockSchemaV1Dir = path.join(mockSchemaDir, 'v1');

// Set up test environment
beforeAll(() => {
  // Create test schema directories if they don't exist
  if (!fs.existsSync(mockSchemaDir)) {
    fs.mkdirSync(mockSchemaDir);
  }
  if (!fs.existsSync(mockSchemaV1Dir)) {
    fs.mkdirSync(mockSchemaV1Dir);
  }

  // Create a comprehensive test schema with various validation rules
  const testSchema = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
      "name": {
        "type": "string",
        "description": "The person's name",
        "minLength": 2,
        "maxLength": 50
      },
      "age": {
        "type": "integer",
        "minimum": 0,
        "maximum": 120,
        "description": "Age in years"
      },
      "email": {
        "type": "string",
        "format": "email",
        "description": "Email address"
      },
      "website": {
        "type": "string",
        "format": "uri",
        "description": "Personal website"
      },
      "tags": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "minItems": 1,
        "maxItems": 5,
        "uniqueItems": true,
        "description": "Tags or categories"
      },
      "status": {
        "type": "string",
        "enum": ["active", "inactive", "pending"],
        "description": "Account status"
      },
      "birthDate": {
        "type": "string",
        "format": "date",
        "description": "Date of birth in YYYY-MM-DD format"
      },
      "address": {
        "type": "object",
        "properties": {
          "street": { "type": "string" },
          "city": { "type": "string" },
          "zipCode": { 
            "type": "string",
            "pattern": "^[0-9]{5}(-[0-9]{4})?$" 
          }
        },
        "required": ["street", "city"],
        "additionalProperties": false,
        "description": "Physical address"
      }
    },
    "required": ["name", "email", "age"],
    "additionalProperties": false
  };

  fs.writeFileSync(
    path.join(mockSchemaV1Dir, 'person.json'),
    JSON.stringify(testSchema, null, 2)
  );
});

// Clean up after tests
afterAll(() => {
  // Remove test schema file
  if (fs.existsSync(path.join(mockSchemaV1Dir, 'person.json'))) {
    fs.unlinkSync(path.join(mockSchemaV1Dir, 'person.json'));
  }
  
  // Remove test schema directories
  if (fs.existsSync(mockSchemaV1Dir)) {
    fs.rmdirSync(mockSchemaV1Dir);
  }
  if (fs.existsSync(mockSchemaDir)) {
    fs.rmdirSync(mockSchemaDir);
  }
});

describe('SchemaValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new SchemaValidator();
  });

  // Basic functionality tests
  describe('basic functionality', () => {
    test('should initialize properly', () => {
      expect(validator).toBeDefined();
      expect(validator.ajv).toBeDefined();
      expect(validator.schemaCache.size).toBe(0);
    });

    test('should load a schema from file', () => {
      const schemaPath = path.join(mockSchemaV1Dir, 'person.json');
      const schema = validator.loadSchema(schemaPath);
      
      expect(schema).toBeDefined();
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(schema.properties.name).toBeDefined();
      expect(schema.required).toContain('name');
      expect(schema.required).toContain('email');
      expect(schema.required).toContain('age');
    });

    test('should validate valid data against schema', () => {
      const schemaPath = path.join(mockSchemaV1Dir, 'person.json');
      const validData = {
        name: 'John Doe',
        age: 30,
        email: 'john@example.com',
        tags: ['developer', 'writer'],
        status: 'active',
        birthDate: '1993-05-15',
        address: {
          street: '123 Main St',
          city: 'Anytown'
        }
      };
      
      const result = validator.validate(validData, schemaPath);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toBeNull();
    });
  });

  // User-friendly field name tests
  describe('friendly field names', () => {
    test('should convert camelCase to spaced words', () => {
      expect(validator.getFriendlyFieldName('/userFirstName')).toBe('user first name');
    });

    test('should convert snake_case to spaced words', () => {
      expect(validator.getFriendlyFieldName('/user_last_name')).toBe('user last name');
    });

    test('should handle root path', () => {
      expect(validator.getFriendlyFieldName('/')).toBe('root object');
    });
  });

  // Line and column position tests
  describe('line and column calculation', () => {
    test('should find correct position for simple property', () => {
      const jsonString = `{
  "name": "John Doe",
  "age": 30,
  "email": "john@example.com"
}`;
      
      const position = validator.findPositionInJson(jsonString, '/age');
      expect(position.line).toBe(3);
    });
    
    test('should find correct position for nested property', () => {
      const jsonString = `{
  "name": "John Doe",
  "address": {
    "street": "123 Main St",
    "city": "Anytown"
  }
}`;
      
      const position = validator.findPositionInJson(jsonString, '/address/city');
      expect(position.line).toBe(5);
    });
    
    test('should return position 1,1 for root object', () => {
      const jsonString = `{
  "name": "John Doe"
}`;
      
      const position = validator.findPositionInJson(jsonString, '/');
      expect(position.line).toBe(1);
      expect(position.column).toBe(1);
    });
  });

  // Specific error types tests
  describe('validation errors', () => {
    // Required field errors
    test('should report missing required field with fix suggestion', () => {
      const schemaPath = path.join(mockSchemaV1Dir, 'person.json');
      const invalidData = {
        name: 'John Doe',
        // missing required email field
        age: 30
      };
      
      const result = validator.validate(invalidData, schemaPath);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      
      const emailError = result.errors.find(e => e.message.includes('Missing required field'));
      expect(emailError).toBeDefined();
      expect(emailError.fixSuggestion).toContain('Add the');
      expect(emailError.path).toContain('email');
    });

    // Type errors
    test('should report type errors with examples', () => {
      const schemaPath = path.join(mockSchemaV1Dir, 'person.json');
      const invalidData = {
        name: 'John Doe',
        age: "thirty", // wrong type
        email: 'john@example.com'
      };
      
      const result = validator.validate(invalidData, schemaPath);
      
      expect(result.valid).toBe(false);
      const typeError = result.errors.find(e => e.message.includes('should be a'));
      expect(typeError).toBeDefined();
      expect(typeError.expectedValue).toBeDefined();
    });

    // Format errors
    test('should report format errors with fix suggestions', () => {
      const schemaPath = path.join(mockSchemaV1Dir, 'person.json');
      const invalidData = {
        name: 'John Doe',
        age: 30,
        email: 'not-an-email', // invalid email format
        website: 'not-a-url'    // invalid URL format
      };
      
      const result = validator.validate(invalidData, schemaPath);
      
      expect(result.valid).toBe(false);
      
      const emailError = result.errors.find(e => e.path.includes('email'));
      expect(emailError).toBeDefined();
      expect(emailError.fixSuggestion).toContain('valid email');
      expect(emailError.expectedValue).toBeDefined();
      
      const urlError = result.errors.find(e => e.path.includes('website'));
      expect(urlError).toBeDefined();
      expect(urlError.fixSuggestion).toContain('valid URL');
    });

    // Enum errors
    test('should report enum errors with allowed values', () => {
      const schemaPath = path.join(mockSchemaV1Dir, 'person.json');
      const invalidData = {
        name: 'John Doe',
        age: 30,
        email: 'john@example.com',
        status: 'unknown' // not in allowed values
      };
      
      const result = validator.validate(invalidData, schemaPath);
      
      expect(result.valid).toBe(false);
      const enumError = result.errors.find(e => e.path.includes('status'));
      expect(enumError).toBeDefined();
      expect(enumError.expectedValue).toContain('Allowed values');
      expect(enumError.expectedValue).toContain('active');
    });

    // Length errors
    test('should report length errors for strings', () => {
      const schemaPath = path.join(mockSchemaV1Dir, 'person.json');
      const invalidData = {
        name: 'J', // too short
        age: 30,
        email: 'john@example.com'
      };
      
      const result = validator.validate(invalidData, schemaPath);
      
      expect(result.valid).toBe(false);
      const lengthError = result.errors.find(e => e.message.includes('too short'));
      expect(lengthError).toBeDefined();
      expect(lengthError.fixSuggestion).toContain('at least');
    });

    // Range errors
    test('should report range errors for numbers', () => {
      const schemaPath = path.join(mockSchemaV1Dir, 'person.json');
      const invalidData = {
        name: 'John Doe',
        age: 150, // exceeds maximum
        email: 'john@example.com'
      };
      
      const result = validator.validate(invalidData, schemaPath);
      
      expect(result.valid).toBe(false);
      const rangeError = result.errors.find(e => e.message.includes('at most'));
      expect(rangeError).toBeDefined();
      expect(rangeError.fixSuggestion).toContain('smaller');
    });

    // Pattern errors
    test('should report pattern errors with suggestions', () => {
      const schemaPath = path.join(mockSchemaV1Dir, 'person.json');
      const invalidData = {
        name: 'John Doe',
        age: 30,
        email: 'john@example.com',
        address: {
          street: '123 Main St',
          city: 'Anytown',
          zipCode: 'ABC' // doesn't match pattern
        }
      };
      
      const result = validator.validate(invalidData, schemaPath);
      
      expect(result.valid).toBe(false);
      const patternError = result.errors.find(e => e.message.includes('does not match'));
      expect(patternError).toBeDefined();
      expect(patternError.fixSuggestion).toBeDefined();
    });

    // Additional properties errors
    test('should report additional properties errors', () => {
      const schemaPath = path.join(mockSchemaV1Dir, 'person.json');
      const invalidData = {
        name: 'John Doe',
        age: 30,
        email: 'john@example.com',
        unknownField: 'value' // not allowed by schema
      };
      
      const result = validator.validate(invalidData, schemaPath);
      
      expect(result.valid).toBe(false);
      const additionalPropsError = result.errors.find(e => e.message.includes('extra properties'));
      expect(additionalPropsError).toBeDefined();
      expect(additionalPropsError.fixSuggestion).toContain('Remove');
    });

    // Array validation errors
    test('should report array validation errors', () => {
      const schemaPath = path.join(mockSchemaV1Dir, 'person.json');
      const invalidData = {
        name: 'John Doe',
        age: 30,
        email: 'john@example.com',
        tags: [1, 2] // array items should be strings
      };
      
      const result = validator.validate(invalidData, schemaPath);
      
      expect(result.valid).toBe(false);
      const arrayTypeError = result.errors.find(e => e.path.includes('tags'));
      expect(arrayTypeError).toBeDefined();
    });

    // Date format errors
    test('should report date format errors with examples', () => {
      const schemaPath = path.join(mockSchemaV1Dir, 'person.json');
      const invalidData = {
        name: 'John Doe',
        age: 30,
        email: 'john@example.com',
        birthDate: '05/15/1993' // wrong format, should be YYYY-MM-DD
      };
      
      const result = validator.validate(invalidData, schemaPath);
      
      expect(result.valid).toBe(false);
      const dateError = result.errors.find(e => e.path.includes('birthDate'));
      expect(dateError).toBeDefined();
      expect(dateError.expectedValue).toContain('Example:');
    });
  });

  // Schema discovery tests
  describe('schema discovery', () => {
    test('should list available schema versions', () => {
      const versions = validator.getAvailableVersions(mockSchemaDir);
      
      expect(versions).toBeDefined();
      expect(versions).toContain('v1');
    });

    test('should list available schemas for a version', () => {
      const schemas = validator.getAvailableSchemas(mockSchemaDir, 'v1');
      
      expect(schemas).toBeDefined();
      expect(schemas.length).toBe(1);
      expect(schemas[0].name).toBe('person');
    });
  });
}); 