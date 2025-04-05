/**
 * JSON Schema Validator API Server
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const SchemaValidator = require('./validator');

// Configuration
const PORT = process.env.PORT || 3001;
const SCHEMAS_DIR = path.resolve(__dirname, '../../schemas');

// Initialize the validator
const validator = new SchemaValidator();

// Create Express application
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Static files for the frontend
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.get('/api/versions', (req, res) => {
  const versions = validator.getAvailableVersions(SCHEMAS_DIR);
  res.json({ versions });
});

app.get('/api/schemas/:version', (req, res) => {
  const { version } = req.params;
  const schemas = validator.getAvailableSchemas(SCHEMAS_DIR, version);
  res.json({ schemas });
});

app.get('/api/schema/:version/:name', (req, res) => {
  const { version, name } = req.params;
  const schemaPath = path.join(SCHEMAS_DIR, version, `${name}.json`);
  
  try {
    const schema = validator.loadSchema(schemaPath);
    res.json({ schema });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

app.post('/api/validate/:version/:name', (req, res) => {
  const { version, name } = req.params;
  const data = req.body;
  const schemaPath = path.join(SCHEMAS_DIR, version, `${name}.json`);
  
  try {
    // Store original request string for error line calculation
    const jsonString = JSON.stringify(data, null, 2);
    
    // Validate with schema
    const result = validator.validate(data, schemaPath);
    
    // Include original JSON in response for error highlighting
    if (!result.valid) {
      result.originalJson = jsonString;
    }
    
    res.json(result);
  } catch (error) {
    res.status(400).json({
      valid: false,
      error: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`JSON Schema Validator API running on port ${PORT}`);
  console.log(`Schemas directory: ${SCHEMAS_DIR}`);
  
  // Log available schemas for each version
  const versions = validator.getAvailableVersions(SCHEMAS_DIR);
  console.log(`Available versions: ${versions.join(', ')}`);
  
  versions.forEach(version => {
    const schemas = validator.getAvailableSchemas(SCHEMAS_DIR, version);
    console.log(`Schemas for ${version}: ${schemas.map(s => s.name).join(', ')}`);
  });
});

module.exports = app; 