/**
 * JSON Schema validator implementation using Ajv
 */
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const fs = require('fs');
const path = require('path');

class SchemaValidator {
  constructor() {
    // Initialize Ajv with all options needed for proper validation
    this.ajv = new Ajv({
      allErrors: true,         // Return all errors, not just the first one
      verbose: true,           // Include more information in errors
      strict: false,           // Don't fail on unknown keywords
      strictSchema: false,     // Don't fail on unknown schema keywords
      strictNumbers: true,     // Validate numbers strictly
      validateFormats: true,   // Validate formats
      // Skip schema validation so we don't need the 2020-12 schema
      validateSchema: false
    });
    
    // Add support for formats like date, time, email, etc.
    addFormats(this.ajv);
    
    // Cache for loaded schemas
    this.schemaCache = new Map();
  }

  /**
   * Load schema from file path
   * @param {string} schemaPath - Path to the schema file
   * @returns {Object} The loaded schema
   */
  loadSchema(schemaPath) {
    if (this.schemaCache.has(schemaPath)) {
      return this.schemaCache.get(schemaPath);
    }
    
    try {
      const schemaContent = fs.readFileSync(schemaPath, 'utf8');
      const schema = JSON.parse(schemaContent);
      this.schemaCache.set(schemaPath, schema);
      return schema;
    } catch (error) {
      throw new Error(`Failed to load schema from ${schemaPath}: ${error.message}`);
    }
  }

  /**
   * Find line and column position in JSON string based on error path
   * @param {string} jsonString - Full JSON string
   * @param {string} errorPath - JSON path to the error location
   * @returns {Object} Position with line and column numbers
   */
  findPositionInJson(jsonString, errorPath) {
    if (!errorPath || errorPath === '/') {
      return { line: 1, column: 1 };
    }
    
    // Convert JSON path to a regex pattern to find in the JSON string
    // Remove the leading slash and split by /
    const pathParts = errorPath.substring(1).split('/');
    
    let position = 0;
    let line = 1;
    let column = 1;
    
    // Count lines until the position
    for (let i = 0; i < jsonString.length; i++) {
      // Build a pattern to find the field in the JSON
      const pathToFind = pathParts[position];
      
      // Look for the property name in quotes
      const pattern = new RegExp(`"${pathToFind}"\\s*:`);
      const substring = jsonString.substring(i);
      const match = substring.match(pattern);
      
      if (match && match.index !== undefined) {
        // Found the path part
        i += match.index + match[0].length;
        position++;
        
        // If we've found all parts of the path, this is the position of the error
        if (position >= pathParts.length) {
          // Count lines up to this position
          for (let j = 0; j < i; j++) {
            if (jsonString[j] === '\n') {
              line++;
              column = 1;
            } else {
              column++;
            }
          }
          break;
        }
      } else {
        // If not found, just count lines for the entire string
        if (jsonString[i] === '\n') {
          line++;
          column = 1;
        } else {
          column++;
        }
      }
    }
    
    return { line, column };
  }

  /**
   * Get a friendly field name from a JSON path
   * @param {string} path - JSON path
   * @returns {string} User-friendly field name
   */
  getFriendlyFieldName(path) {
    if (!path || path === '/') return 'root object';
    
    // Get the last part of the path which is typically the field name
    const parts = path.split('/').filter(Boolean);
    const fieldName = parts[parts.length - 1];
    
    // Convert camelCase or snake_case to words with spaces
    return fieldName
      .replace(/([A-Z])/g, ' $1') // Convert camelCase
      .replace(/_/g, ' ')         // Convert snake_case
      .toLowerCase()
      .trim();
  }

  /**
   * Validate data against a schema
   * @param {Object} data - The data to validate
   * @param {Object|string} schema - The schema object or path to schema file
   * @returns {Object} Validation result with errors formatted for better readability
   */
  validate(data, schema) {
    let schemaObj;
    
    if (typeof schema === 'string') {
      schemaObj = this.loadSchema(schema);
    } else {
      schemaObj = schema;
    }
    
    // Remove $schema property if present to avoid validation issues
    if (schemaObj.$schema) {
      const schemaCopy = { ...schemaObj };
      delete schemaCopy.$schema;
      schemaObj = schemaCopy;
    }
    
    const valid = this.ajv.validate(schemaObj, data);
    
    // Format for error reporting with line numbers
    const jsonString = JSON.stringify(data, null, 2);
    
    if (valid) {
      return { valid: true, errors: null };
    } else {
      return {
        valid: false,
        errors: this.formatErrors(this.ajv.errors, jsonString, schemaObj)
      };
    }
  }

  /**
   * Format Ajv errors for better readability
   * @param {Array} errors - Ajv error objects
   * @param {string} jsonString - Original JSON string for line position calculation
   * @param {Object} schema - The schema object used for validation
   * @returns {Array} Formatted errors with improved readability
   */
  formatErrors(errors, jsonString, schema) {
    if (!errors) return null;
    
    return errors.map(error => {
      const { keyword, instancePath, message, params, schemaPath } = error;
      
      // Build a more readable error message
      let formattedMessage = `${message}`;
      let path = instancePath || '/';
      let fixSuggestion = '';
      let expectedValue = '';
      
      // Get a user-friendly field name
      const friendlyFieldName = this.getFriendlyFieldName(path);
      
      // Add additional context based on the error type
      switch (keyword) {
        case 'required':
          const missingField = this.getFriendlyFieldName(`/${params.missingProperty}`);
          formattedMessage = `Missing required field: '${missingField}'`;
          path = `${instancePath || ''}/${params.missingProperty}`;
          fixSuggestion = `Add the '${missingField}' field to your data.`;
          
          // Try to get expected type from schema
          try {
            const propSchema = schema.properties[params.missingProperty];
            if (propSchema) {
              if (propSchema.type) {
                expectedValue = `Expected type: ${propSchema.type}`;
                if (propSchema.example) {
                  expectedValue += `, Example: ${JSON.stringify(propSchema.example)}`;
                }
              }
            }
          } catch (e) {
            // Ignore schema lookup errors
          }
          break;
          
        case 'type':
          formattedMessage = `'${friendlyFieldName}' should be a ${params.type}`;
          fixSuggestion = `Change the value to a valid ${params.type}.`;
          
          if (params.type === 'string') {
            expectedValue = 'Example: "text in quotes"';
          } else if (params.type === 'number' || params.type === 'integer') {
            expectedValue = 'Example: 42';
          } else if (params.type === 'boolean') {
            expectedValue = 'Use: true or false';
          } else if (params.type === 'array') {
            expectedValue = 'Example: [1, 2, 3]';
          } else if (params.type === 'object') {
            expectedValue = 'Example: {"key": "value"}';
          }
          break;
          
        case 'enum':
          formattedMessage = `'${friendlyFieldName}' must be one of the allowed values`;
          fixSuggestion = `Use one of the allowed values.`;
          expectedValue = `Allowed values: ${params.allowedValues.map(v => 
            typeof v === 'string' ? `"${v}"` : JSON.stringify(v)
          ).join(', ')}`;
          break;
          
        case 'format':
          formattedMessage = `'${friendlyFieldName}' must be a valid ${params.format} format`;
          
          if (params.format === 'email') {
            fixSuggestion = `Provide a valid email address.`;
            expectedValue = 'Example: user@example.com';
          } else if (params.format === 'date') {
            fixSuggestion = `Use the ISO date format YYYY-MM-DD.`;
            expectedValue = 'Example: 2023-04-25';
          } else if (params.format === 'time') {
            fixSuggestion = `Use the time format HH:MM:SS.`;
            expectedValue = 'Example: 14:30:00';
          } else if (params.format === 'date-time') {
            fixSuggestion = `Use the ISO date-time format.`;
            expectedValue = 'Example: 2023-04-25T14:30:00Z';
          } else if (params.format === 'uri') {
            fixSuggestion = `Provide a valid URL.`;
            expectedValue = 'Example: https://example.com';
          } else {
            fixSuggestion = `Check the format and try again.`;
          }
          break;
          
        case 'minimum':
        case 'exclusiveMinimum':
          formattedMessage = `'${friendlyFieldName}' must be ${keyword === 'exclusiveMinimum' ? 'greater than' : 'at least'} ${params.limit}`;
          fixSuggestion = `Use a ${keyword === 'exclusiveMinimum' ? 'larger' : 'larger or equal'} value.`;
          expectedValue = `Value must be ${keyword === 'exclusiveMinimum' ? '>' : '>='} ${params.limit}`;
          break;
          
        case 'maximum':
        case 'exclusiveMaximum':
          formattedMessage = `'${friendlyFieldName}' must be ${keyword === 'exclusiveMaximum' ? 'less than' : 'at most'} ${params.limit}`;
          fixSuggestion = `Use a ${keyword === 'exclusiveMaximum' ? 'smaller' : 'smaller or equal'} value.`;
          expectedValue = `Value must be ${keyword === 'exclusiveMaximum' ? '<' : '<='} ${params.limit}`;
          break;
          
        case 'minLength':
          formattedMessage = `'${friendlyFieldName}' is too short`;
          fixSuggestion = `Make sure this text is at least ${params.limit} character${params.limit === 1 ? '' : 's'} long.`;
          expectedValue = `Minimum length: ${params.limit} characters`;
          break;
          
        case 'maxLength':
          formattedMessage = `'${friendlyFieldName}' is too long`;
          fixSuggestion = `Shorten this text to ${params.limit} character${params.limit === 1 ? '' : 's'} or less.`;
          expectedValue = `Maximum length: ${params.limit} characters`;
          break;
          
        case 'pattern':
          formattedMessage = `'${friendlyFieldName}' does not match the required pattern`;
          fixSuggestion = `Check the format and try again.`;
          try {
            // Try to give more context about the pattern
            const patternStr = params.pattern.toString();
            if (patternStr.includes('\\d')) expectedValue += "Should contain numbers. ";
            if (patternStr.includes('[A-Z]')) expectedValue += "Should contain uppercase letters. ";
            if (patternStr.includes('[a-z]')) expectedValue += "Should contain lowercase letters. ";
            if (patternStr === '^[0-9]+$') expectedValue = "Must contain only numbers.";
            if (patternStr === '^[A-Za-z]+$') expectedValue = "Must contain only letters.";
          } catch (e) {
            // Fall back to showing the pattern
            expectedValue = `Pattern: ${params.pattern}`;
          }
          break;
          
        case 'additionalProperties':
          formattedMessage = `'${friendlyFieldName}' has extra properties that are not allowed`;
          fixSuggestion = `Remove the unexpected properties.`;
          
          // Try to get allowed properties from schema
          try {
            const allowedProps = Object.keys(schema.properties || {});
            if (allowedProps.length > 0) {
              expectedValue = `Allowed properties: ${allowedProps.join(', ')}`;
            }
          } catch (e) {
            // Ignore schema lookup errors
          }
          break;
          
        case 'minItems':
          formattedMessage = `'${friendlyFieldName}' has too few items`;
          fixSuggestion = `Add more items to the array.`;
          expectedValue = `Minimum items: ${params.limit}`;
          break;
          
        case 'maxItems':
          formattedMessage = `'${friendlyFieldName}' has too many items`;
          fixSuggestion = `Remove some items from the array.`;
          expectedValue = `Maximum items: ${params.limit}`;
          break;
          
        case 'uniqueItems':
          formattedMessage = `'${friendlyFieldName}' has duplicate items`;
          fixSuggestion = `Ensure all items in the array are unique.`;
          break;
          
        // Add more cases for other error types as needed
      }
      
      // Find position in the JSON string
      const position = this.findPositionInJson(jsonString, path);
      
      return {
        path,
        message: formattedMessage,
        fixSuggestion,
        expectedValue,
        schemaPath,
        friendlyFieldName,
        line: position.line,
        column: position.column,
        details: error
      };
    });
  }
  
  /**
   * Get the list of available schema versions
   * @param {string} schemasDir - Directory containing schema versions
   * @returns {Array} List of available versions
   */
  getAvailableVersions(schemasDir) {
    try {
      return fs.readdirSync(schemasDir)
        .filter(item => {
          const stats = fs.statSync(path.join(schemasDir, item));
          return stats.isDirectory() && item.startsWith('v');
        })
        .sort((a, b) => {
          // Sort versions semantically
          const versionA = parseInt(a.substring(1));
          const versionB = parseInt(b.substring(1));
          return versionB - versionA; // Descending order
        });
    } catch (error) {
      console.error(`Error getting schema versions: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Get schemas available for a specific version
   * @param {string} schemasDir - Base directory containing schemas
   * @param {string} version - Version to check (e.g., 'v1')
   * @returns {Array} List of available schemas in that version
   */
  getAvailableSchemas(schemasDir, version) {
    const versionDir = path.join(schemasDir, version);
    
    try {
      return fs.readdirSync(versionDir)
        .filter(file => file.endsWith('.json'))
        .map(file => ({
          name: path.basename(file, '.json'),
          path: path.join(versionDir, file)
        }));
    } catch (error) {
      console.error(`Error getting schemas for version ${version}: ${error.message}`);
      return [];
    }
  }
}

module.exports = SchemaValidator; 