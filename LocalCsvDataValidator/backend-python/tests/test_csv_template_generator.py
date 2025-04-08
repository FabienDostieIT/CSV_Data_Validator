import pytest
import csv
import os
import tempfile
from pathlib import Path
from src.csv_template_generator import (
    generate_template,
    generate_event_template,
    generate_place_template,
    get_available_schemas,
    _schema_to_csv_headers,
    _flatten_schema,
    _load_schema
)

def test_generate_template_event():
    """Test generating a template for the event schema."""
    event_csv = generate_template('event')
    
    # Create a temp file for the CSV content
    fd, temp_path = tempfile.mkstemp(suffix='.csv')
    os.close(fd)
    
    try:
        # Write the CSV content to the temp file
        with open(temp_path, 'w', newline='') as f:
            f.write(event_csv)
        
        # Read the CSV and check it
        with open(temp_path, 'r', newline='') as f:
            reader = csv.reader(f)
            headers = next(reader)
            sample_row = next(reader)
            
            # Check for essential headers
            assert 'sourceId' in headers
            assert 'id' in headers
            assert 'nameFr' in headers
            assert 'nameEn' in headers
            assert 'descriptionFr' in headers
            assert 'status' in headers
            
            # Check that a sample row exists
            assert len(sample_row) == len(headers)
    finally:
        os.unlink(temp_path)


def test_generate_template_place():
    """Test generating a template for the place schema."""
    place_csv = generate_template('place')
    
    # Create a temp file for the CSV content
    fd, temp_path = tempfile.mkstemp(suffix='.csv')
    os.close(fd)
    
    try:
        # Write the CSV content to the temp file
        with open(temp_path, 'w', newline='') as f:
            f.write(place_csv)
        
        # Read the CSV and check it
        with open(temp_path, 'r', newline='') as f:
            reader = csv.reader(f)
            headers = next(reader)
            sample_row = next(reader)
            
            # Check for essential headers
            assert 'sourceId' in headers
            assert 'id' in headers
            assert 'nameFr' in headers
            assert 'addressStreet' in headers
            assert 'addressCity' in headers
            assert 'addressRegion' in headers
            assert 'addressCountry' in headers
            
            # Check that a sample row exists
            assert len(sample_row) == len(headers)
    finally:
        os.unlink(temp_path)


def test_backward_compatibility():
    """Test that the old functions remain backward compatible."""
    event_csv1 = generate_event_template()
    event_csv2 = generate_template('event')
    place_csv1 = generate_place_template()
    place_csv2 = generate_template('place')
    
    # The outputs should be the same
    assert event_csv1 == event_csv2
    assert place_csv1 == place_csv2


def test_generate_template_nonexistent_schema():
    """Test error handling when trying to generate a template for a nonexistent schema."""
    with pytest.raises(ValueError) as excinfo:
        generate_template('nonexistent_schema')
    
    assert "Unknown schema: nonexistent_schema" in str(excinfo.value)
    assert "Available schemas:" in str(excinfo.value)


def test_get_available_schemas():
    """Test the dynamic schema discovery function."""
    schemas = get_available_schemas()
    
    # Check that we have at least the event and place schemas
    assert 'event' in schemas
    assert 'place' in schemas
    
    # Check that schema paths exist
    for schema_name, schema_path in schemas.items():
        assert schema_path.exists()
        assert schema_path.is_file()


def test_schema_flattening():
    """Test schema flattening functionality."""
    # Get the event schema
    schemas = get_available_schemas()
    schema_path = schemas['event']
    schema = _load_schema(schema_path)
    
    # Flatten the schema
    flattened = {}
    _flatten_schema(schema, flattened=flattened)
    
    # Check that essential properties are flattened correctly
    assert 'sourceId' in flattened
    assert 'id' in flattened
    assert 'nameFr' in flattened
    assert 'nameEn' in flattened
    assert 'descriptionFr' in flattened
    assert 'descriptionEn' in flattened


def test_schema_to_csv_headers():
    """Test conversion of flattened schema to CSV headers."""
    # Get the event schema
    schemas = get_available_schemas()
    schema_path = schemas['event']
    schema = _load_schema(schema_path)
    
    # Flatten the schema
    flattened = {}
    _flatten_schema(schema, flattened=flattened)
    
    # Convert to headers
    headers = _schema_to_csv_headers(flattened)
    
    # Check essential headers
    assert 'sourceId' in headers
    assert 'id' in headers
    assert 'nameFr' in headers
    assert 'nameEn' in headers
    assert 'descriptionFr' in headers
    assert 'descriptionEn' in headers 