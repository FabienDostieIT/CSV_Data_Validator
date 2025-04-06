console.log('Worker: Script starting (Bundled - ES Modules)...');

// --- Restore AJV Imports ---
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

// --- Restore AJV Variables ---
let ajvInstance = null;
let validate = null;
let schema = null;

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
      const batchSize = 50; // Reduce batch size slightly for potentially larger objects
      let errorsBatch = []; // This will now hold ValidationResult objects
      let totalErrorsCount = 0; // Keep track of the total number of individual AJV errors
      let rowErrorsMap = new Map(); // Use a map to group errors by row number temporarily

      const allowedPropertiesList = Object.keys(schema.properties || {}).join(', ');
      const requiredPropertiesList = schema.required?.join(', ') ?? 'N/A';

      console.log(`Worker: Starting row-by-row validation...`);
      for (let i = 0; i < csvData.length; i++) {
        const rowData = csvData[i];
        const csvRowNum = i + 2;

        const valid = validate(rowData);

        if (!valid) {
          const currentAjvErrors = validate.errors; // Raw AJV errors for this row
          if (currentAjvErrors && currentAjvErrors.length > 0) {
            totalErrorsCount += currentAjvErrors.length; // Increment total AJV error count

            // Format these specific AJV errors
            const formattedRowErrors = currentAjvErrors.map((error) => {
               let detailedMessage = error?.message ?? 'Unknown error';
               // Use `instancePath` for property name, clean it up
               const propertyName = error?.instancePath?.startsWith('/') ? error.instancePath.substring(1) : (error?.instancePath || 'Unknown Property');

               if (error.keyword === 'enum' && error.params?.allowedValues) {
                 detailedMessage = `${propertyName}: must be one of the allowed values. Allowed: [${error.params.allowedValues.join(', ')}]`;
               } else if (error.keyword === 'additionalProperties' && error.params?.additionalProperty) {
                 detailedMessage = `Property '${error.params.additionalProperty}' is not allowed. Allowed properties are: [${allowedPropertiesList}]`;
               } else if (error.keyword === 'required' && error.params?.missingProperty) {
                 detailedMessage = `Required property '${error.params.missingProperty}' is missing. Required properties are: [${requiredPropertiesList}]`;
               } else if (error.keyword === 'type') {
                 detailedMessage = `${propertyName}: must be type '${error.params.type}'.`;
               } else {
                 detailedMessage = `${propertyName}: ${detailedMessage}` // Prepend property name if not already included
               }

               return {
                 // We don't need row number here as it's grouped by row later
                 property: propertyName,
                 message: detailedMessage,
               };
            });

            // Add these errors to the map for the current row
            if (!rowErrorsMap.has(csvRowNum)) {
               rowErrorsMap.set(csvRowNum, []);
            }
            rowErrorsMap.get(csvRowNum).push(...formattedRowErrors);

          } else {
             console.log(`Worker: Row ${csvRowNum} invalid, but AJV provided no error details.`);
             totalErrorsCount++; // Increment total AJV error count
              // Add a generic error to the map for this row
              if (!rowErrorsMap.has(csvRowNum)) {
                  rowErrorsMap.set(csvRowNum, []);
              }
              rowErrorsMap.get(csvRowNum).push({
                 property: 'Unknown',
                 message: 'Validation failed for an unknown reason (AJV provided no details).'
              });
          }
        }

         // Check if map size exceeds batch size and process into ValidationResult objects
         if (rowErrorsMap.size >= batchSize) {
           for (const [rowNum, errors] of rowErrorsMap.entries()) {
             errorsBatch.push({ row: rowNum, errors: errors });
           }
           self.postMessage({ type: 'errorBatch', payload: { errors: errorsBatch } });
           errorsBatch = [];
           rowErrorsMap.clear(); // Clear the map after batching
         }
      }

      // After loop, process any remaining errors in the map
       if (rowErrorsMap.size > 0) {
         for (const [rowNum, errors] of rowErrorsMap.entries()) {
           errorsBatch.push({ row: rowNum, errors: errors });
         }
         if (errorsBatch.length > 0) { // Check if there's anything to send
            self.postMessage({ type: 'errorBatch', payload: { errors: errorsBatch } });
         }
       }

      // Send completion message using the total AJV error count
      console.log(`Worker: Validation complete. Total individual errors: ${totalErrorsCount}`);
      self.postMessage({ type: 'complete', payload: { totalErrors: totalErrorsCount } }); // Send total individual error count

    } catch (error) {
      console.error('Worker: Error during validation process:', error);
      self.postMessage({ type: 'error', payload: { message: `Validation error: ${error.message}` } });
    }
  }
};

console.log('CSV Validator Worker loaded and ready (Bundled - ES Modules).'); 