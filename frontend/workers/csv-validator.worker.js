console.log('Worker: Script starting (Bundled - ES Modules)...');

// --- Restore AJV Imports ---
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// --- Restore AJV Variables ---
let ajvInstance = null;
let validate = null;
let schema = null;
const IGNORE_VALUE = Symbol('ignore'); // Symbol to mark values to ignore

// Function to get schema for a property (handles basic nesting)
function getPropertySchema(schema, key) {
  if (!schema || !schema.properties) return null;

  if (key.includes('.')) {
      const parts = key.split('.');
      let currentSchema = schema;
      for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          const currentProperties = currentSchema.properties;
          if (!currentProperties || !currentProperties[part]) {
              // Maybe it's an array item property?
              if (currentSchema.type === 'array' && currentSchema.items && currentSchema.items.type === 'object' && currentSchema.items.properties && currentSchema.items.properties[part]) {
                  currentSchema = currentSchema.items.properties[part];
              } else {
                  return null; // Property not found
              }
          } else {
             currentSchema = currentProperties[part];
          }
          if (i === parts.length - 1) {
              return currentSchema;
          }
      }
      return null; // Should not be reached
  } else {
      return schema.properties[key] || null;
  }
}

// Function to convert CSV value based on schema type
function convertValueBasedOnSchema(value, propSchema) {
    // Check for the specific empty quoted string first
    if (value === '""') { 
        return IGNORE_VALUE; // Return the symbol for this specific case
    }
    
    // Handle general null/undefined/empty string cases
    if (value === null || value === undefined || value === '') {
        return (propSchema && propSchema.type === 'string') ? '' : null; 
    }

    if (!propSchema) {
        return String(value); 
    }

    const targetType = propSchema.type;
    const originalValueStr = String(value);

    switch (targetType) {
        case 'string':
            return originalValueStr;
        case 'integer':
            const intValue = parseInt(originalValueStr, 10);
            return isNaN(intValue) ? null : intValue;
        case 'number':
            const floatValue = parseFloat(originalValueStr);
            return isNaN(floatValue) ? null : floatValue;
        case 'boolean':
            const lowerVal = originalValueStr.toLowerCase();
            if (lowerVal === 'true' || lowerVal === 'yes' || lowerVal === '1') return true;
            if (lowerVal === 'false' || lowerVal === 'no' || lowerVal === '0') return false;
            return null;
        case 'array':
            const delimiter = propSchema['x-delimiter'] || ',';
            const itemsSchema = propSchema.items;
            const itemSchemaType = itemsSchema ? itemsSchema.type : null;
            const items = originalValueStr.split(delimiter).map(item => item.trim());
            const processedItems = [];
            for (const item of items) {
                 // Skip specific ignore value within arrays too? Or treat as empty string?
                 // Let's skip for now unless it should be an empty string entry
                if (item === '""') continue; // Skip processing the ignore marker itself within an array
                if (item === '' && itemSchemaType !== 'string') continue;
                
                const itemPropSchema = itemSchemaType ? { type: itemSchemaType } : null;
                const processedItem = convertValueBasedOnSchema(item, itemPropSchema);
                // Check against IGNORE_VALUE here too if it could appear nested
                if (processedItem !== IGNORE_VALUE && (processedItem !== null || (item === '' && itemSchemaType === 'string'))) {
                    processedItems.push(processedItem);
                }
            }
            return processedItems;
        default:
            return originalValueStr;
    }
}

self.onmessage = (event) => {
  console.log('Worker: Message received:', event.data.type);
  const { type, payload } = event.data;

  if (type === 'validate') {
    const { csvData, parsedSchema } = payload;
    console.log(`Worker: Received validation request for ${csvData?.length} rows.`);

    if (!csvData || csvData.length === 0) {
        console.log('Worker: No CSV data received.');
        self.postMessage({ type: 'complete', payload: { totalErrors: 0 } });
        return;
    }

    try {
      // Initialize AJV and compile schema if needed
      if (!ajvInstance || schema !== parsedSchema) {
        console.log('Worker: Initializing AJV and compiling schema...');
        schema = parsedSchema;
        ajvInstance = new Ajv({ allErrors: true });
        addFormats(ajvInstance);
        validate = ajvInstance.compile(schema);
        console.log('Worker: Schema compiled.');
      }

      if (!validate) {
        throw new Error('Schema did not compile correctly.');
      }

      // --- Restore Validation Logic ---
      const batchSize = 50;
      let resultsBatch = []; // Holds combined results { row, errors, warnings }
      let totalErrorsCount = 0;
      let totalWarningsCount = 0;
      let rowResultsMap = new Map(); // Temporarily holds { errors: [], warnings: [] } per row

      const allowedPropertiesList = Object.keys(schema.properties || {}).join(', ');
      const requiredPropertiesList = schema.required?.join(', ') ?? 'N/A';

      console.log(`Worker: Starting row-by-row processing and validation...`);
      for (let i = 0; i < csvData.length; i++) {
        const originalRowData = csvData[i];
        const csvRowNum = i + 2;
        let processedRowData = {};
        let rowWarnings = [];
        let rowErrors = [];
        let conversionErrorMsg = null;
        let valid = false;

        try {
            // --- Schema-Based Type Conversion & Warning Generation ---
            for (const key in originalRowData) {
                if (Object.hasOwnProperty.call(originalRowData, key)) {
                    const rawValue = originalRowData[key];
                    const propSchema = getPropertySchema(schema, key);
                    
                    if (rawValue === '""') {
                        // Log warning
                        rowWarnings.push({
                            property: key,
                            message: 'Field contains empty quoted value ("""").'
                        });
                        totalWarningsCount++;
                        // Do not convert or add to processedRowData
                        continue; 
                    }
                    
                    // Convert other values
                    const convertedValue = convertValueBasedOnSchema(rawValue, propSchema);

                    // Assign if not null or IGNORE_VALUE (and not empty string for non-strings)
                    if (convertedValue !== IGNORE_VALUE && 
                        (convertedValue !== null || (rawValue === '' && propSchema && propSchema.type === 'string'))) {
                       // Handle nesting
                       if (key.includes('.')) {
                           const parts = key.split('.');
                           let current = processedRowData;
                           for (let j = 0; j < parts.length - 1; j++) {
                               const part = parts[j];
                               if (!current[part]) current[part] = {};
                               current = current[part];
                           }
                           current[parts[parts.length - 1]] = convertedValue;
                       } else {
                          processedRowData[key] = convertedValue;
                       }
                    }
                }
            }
            // --- End Conversion ---

            // --- Validation --- 
            valid = validate(processedRowData);

        } catch (err) {
            console.error(`Worker: Error during conversion/structure for row ${csvRowNum}:`, err);
            conversionErrorMsg = err.message || 'Unknown conversion error';
            valid = false; 
        }

        // --- Collect Errors --- 
        if (!valid) {
            const ajvErrors = validate?.errors || [];
            if (conversionErrorMsg) {
                rowErrors.push({
                    property: 'Row Conversion',
                    message: `Failed to process row before validation: ${conversionErrorMsg}`
                });
                totalErrorsCount++;
            }
            if (ajvErrors.length > 0) {
                totalErrorsCount += ajvErrors.length;
                const formattedAjvErrors = ajvErrors.map((error) => { 
                     let detailedMessage = error?.message ?? 'Unknown error';
                     const propertyName = error?.instancePath?.startsWith('/') ? error.instancePath.substring(1) : (error?.instancePath || 'Unknown Property');
                     if (error.keyword === 'enum') {
                         detailedMessage = `${propertyName}: must be one of the allowed values. Allowed: [${error.params.allowedValues.join(', ')}]`;
                     } else if (error.keyword === 'additionalProperties') {
                         detailedMessage = `Property '${error.params.additionalProperty}' is not allowed. Allowed properties are: [${allowedPropertiesList}]`;
                     } else if (error.keyword === 'required') {
                         detailedMessage = `Required property '${error.params.missingProperty}' is missing. Required properties are: [${requiredPropertiesList}]`;
                     } else if (error.keyword === 'type') {
                         detailedMessage = `${propertyName}: must be type '${error.params.type}'.`;
                     } else {
                         detailedMessage = `${propertyName}: ${detailedMessage}` // Prepend property name if not already included
                     }
                     return { property: propertyName, message: detailedMessage };
                });
                rowErrors.push(...formattedAjvErrors);
            } else if (!conversionErrorMsg) { // Generic if no other errors
                rowErrors.push({ property: 'Unknown', message: 'Validation failed (reason unknown).' });
                totalErrorsCount++;
            }
        }
        
        // --- Store results for the row if there are errors or warnings ---
        if (rowErrors.length > 0 || rowWarnings.length > 0) {
            rowResultsMap.set(csvRowNum, { errors: rowErrors, warnings: rowWarnings });
        }

        // --- Batching Logic ---
        if (rowResultsMap.size >= batchSize) {
            for (const [rowNum, results] of rowResultsMap.entries()) {
                resultsBatch.push({ row: rowNum, ...results }); // Combine row num with errors/warnings
            }
            self.postMessage({ type: 'resultsBatch', payload: { results: resultsBatch } });
            resultsBatch = [];
            rowResultsMap.clear();
        }
      } // End for loop

      // After loop, process remaining results
      if (rowResultsMap.size > 0) {
          for (const [rowNum, results] of rowResultsMap.entries()) {
              resultsBatch.push({ row: rowNum, ...results });
          }
          if (resultsBatch.length > 0) {
              self.postMessage({ type: 'resultsBatch', payload: { results: resultsBatch } });
          }
      }

      // Send completion message with separate counts
      console.log(`Worker: Validation complete. Total errors: ${totalErrorsCount}, Total warnings: ${totalWarningsCount}`);
      self.postMessage({ type: 'complete', payload: { totalErrors: totalErrorsCount, totalWarnings: totalWarningsCount } });

    } catch (error) {
      console.error('Worker: Error during validation process:', error);
      self.postMessage({ type: 'error', payload: { message: `Validation error: ${error.message}` } });
    }
  }
};

console.log('CSV Validator Worker loaded and ready (Bundled - ES Modules).'); 