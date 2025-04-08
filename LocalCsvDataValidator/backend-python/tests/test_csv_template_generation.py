import os
import json
import pytest
import pandas as pd
from pathlib import Path
from io import StringIO
from src.csv_template_generator import generate_event_template, generate_place_template

# Fixture paths
FIXTURES_DIR = Path(__file__).parent / "fixtures"
VALIDATION_DIR = FIXTURES_DIR / "validation"
CSV_TEMPLATES_DIR = FIXTURES_DIR / "csv_templates"

def test_event_template_generation():
    """Test that event template CSV is correctly generated."""
    # Generate the template
    template_csv = generate_event_template()
    
    # Convert the generated template to DataFrame for comparison
    generated_df = pd.read_csv(StringIO(template_csv))
    
    # Check for required columns
    required_columns = [
        "sourceId", "id", "nameFr", "nameEn", "descriptionFr", "descriptionEn",
        "status"
    ]
    
    for col in required_columns:
        assert col in generated_df.columns, f"Required column {col} is missing from template"

def test_place_template_generation():
    """Test that place template CSV is correctly generated."""
    # Generate the template
    template_csv = generate_place_template()
    
    # Convert the generated template to DataFrame for comparison
    generated_df = pd.read_csv(StringIO(template_csv))
    
    # Check for required columns
    required_columns = [
        "sourceId", "id", "nameFr", "nameEn", "descriptionFr", "descriptionEn",
        "locationType", "addressStreet", "addressCity", "addressRegion", 
        "addressPostalCode", "addressCountry"
    ]
    
    for col in required_columns:
        assert col in generated_df.columns, f"Required column {col} is missing from template"

def test_event_template_from_schema():
    """Test that event template matches the schema requirements."""
    # Load a valid event JSON for reference
    with open(VALIDATION_DIR / "event_valid.json", "r") as f:
        valid_event = json.load(f)
    
    # Generate the template
    template_csv = generate_event_template()
    generated_df = pd.read_csv(StringIO(template_csv))
    
    # List of schema fields we expect to see in the CSV template
    expected_fields = [
        "sourceId", "id", "nameFr", "nameEn", "descriptionFr", "descriptionEn", 
        "status"
    ]
    
    # Check that the expected fields are in the template
    for field in expected_fields:
        assert field in generated_df.columns, f"Field {field} from schema not found in template"
    
    # For nested objects in valid_event, check if their flattened representation exists
    for key, value in valid_event.items():
        if isinstance(value, dict) and key not in ["price"]:  # Skip price as it's not in the schema
            # Check at least one column with the key prefix exists
            assert any(col.startswith(key + ".") for col in generated_df.columns), \
                f"No flattened columns found for nested object {key}"

def test_place_template_from_schema():
    """Test that place template matches the schema requirements."""
    # Load a valid place JSON for reference
    with open(VALIDATION_DIR / "place_valid.json", "r") as f:
        valid_place = json.load(f)
    
    # Generate the template
    template_csv = generate_place_template()
    generated_df = pd.read_csv(StringIO(template_csv))
    
    # List of schema fields we expect to see in the CSV template
    expected_fields = [
        "sourceId", "id", "nameFr", "nameEn", "descriptionFr", "descriptionEn",
        "locationType", "addressStreet", "addressCity", "addressRegion", 
        "addressPostalCode", "addressCountry"
    ]
    
    # Check that the expected fields are in the template
    for field in expected_fields:
        assert field in generated_df.columns, f"Field {field} from schema not found in template"
    
    # Special handling for opening hours
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    for day in days:
        opens_key = f"openingHours.{day}.opens"
        closes_key = f"openingHours.{day}.closes"
        # These are optional, so we'll use a less strict check
        if opens_key in generated_df.columns:
            assert closes_key in generated_df.columns, f"Found {opens_key} but missing {closes_key}"
    
    # For nested objects in valid_place, check if their flattened representation exists
    for key, value in valid_place.items():
        if isinstance(value, dict):
            # Check at least one column with the key prefix exists
            assert any(col.startswith(key + ".") for col in generated_df.columns), \
                f"No flattened columns found for nested object {key}" 