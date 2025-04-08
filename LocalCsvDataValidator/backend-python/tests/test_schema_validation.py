"""Tests for schema validation."""

import json
import os
import pytest
from pathlib import Path
from jsonschema import validate, ValidationError

# Constants
SCHEMAS_DIR = Path('schemas')
FIXTURES_DIR = Path('tests/fixtures/validation')


def test_schema_exists():
    """Test that all schema files exist."""
    assert os.path.exists(SCHEMAS_DIR / 'v1' / 'event.json')
    assert os.path.exists(SCHEMAS_DIR / 'v1' / 'place.json')


def load_schema(schema_path):
    """Load a JSON schema from a file."""
    with open(schema_path, 'r') as f:
        return json.load(f)


def validate_schema(schema_path, valid_examples, invalid_examples, detailed_errors=True):
    """Validate a schema against valid and invalid examples.
    
    Args:
        schema_path: Path to the schema file
        valid_examples: List of examples that should validate
        invalid_examples: List of examples that should fail validation
        detailed_errors: Whether to show detailed error information
    """
    # Load schema
    schema = load_schema(schema_path)
    
    # Test valid examples
    for i, example in enumerate(valid_examples):
        try:
            validate(instance=example, schema=schema)
        except ValidationError as e:
            error_msg = f"Valid example {i} failed validation: {e}"
            if detailed_errors:
                error_msg += f"\n\nExample data: {json.dumps(example, indent=2)}"
            pytest.fail(error_msg)
    
    # Test invalid examples
    for i, example in enumerate(invalid_examples):
        with pytest.raises(ValidationError):
            validate(instance=example, schema=schema)
            error_msg = f"Invalid example {i} should have failed validation but didn't"
            if detailed_errors:
                error_msg += f"\n\nExample data: {json.dumps(example, indent=2)}"
            pytest.fail(error_msg)


# Base test data
@pytest.fixture
def event_base():
    """Base valid event data for testing."""
    return {
        "sourceId": "partner123",
        "id": "event123",
        "nameFr": "Concert de musique",
        "descriptionFr": "Un concert de musique classique",
        "status": "Scheduled"
    }


@pytest.fixture
def place_base():
    """Base valid place data for testing."""
    return {
        "sourceId": "partner123",
        "id": "place123",
        "nameFr": "Théâtre du Centre",
        "descriptionFr": "Un théâtre au centre-ville",
        "locationType": "Place",
        "containedInPlaceStatus": False,
        "addressStreet": "123 Rue Principale",
        "addressCity": "Montréal",
        "addressRegion": "QC",
        "addressPostalCode": "H2X 1Y6",
        "addressCountry": "CAN"
    }


def test_event_schema(event_base):
    """Test validation of the event schema."""
    schema_path = SCHEMAS_DIR / 'v1' / 'event.json'
    
    # Valid examples
    valid_examples = [
        event_base,
        {
            **event_base,
            "nameEn": "Music concert",
            "descriptionEn": "A classical music concert"
        }
    ]
    
    # Invalid examples (missing required fields)
    invalid_examples = [
        {k: v for k, v in event_base.items() if k != "sourceId"},  # Missing sourceId
        {k: v for k, v in event_base.items() if k != "id"},  # Missing id
        {k: v for k, v in event_base.items() if k != "status"},  # Missing status
        {k: v for k, v in event_base.items() if k not in ["nameFr", "descriptionFr"]}  # Missing nameFr and descriptionFr
    ]
    
    validate_schema(schema_path, valid_examples, invalid_examples)


def test_place_schema(place_base):
    """Test validation of the place schema."""
    schema_path = SCHEMAS_DIR / 'v1' / 'place.json'
    
    # Valid examples
    valid_examples = [
        place_base,
        {
            **place_base,
            "nameEn": "Central Theater",
            "descriptionEn": "A theater in downtown",
        }
    ]
    
    # Invalid examples (missing required fields)
    invalid_examples = [
        {k: v for k, v in place_base.items() if k != "sourceId"},  # Missing sourceId
        {k: v for k, v in place_base.items() if k != "id"},  # Missing id
        {k: v for k, v in place_base.items() if k != "locationType"},  # Missing locationType
        {k: v for k, v in place_base.items() if k != "containedInPlaceStatus"}  # Missing containedInPlaceStatus
    ]
    
    validate_schema(schema_path, valid_examples, invalid_examples)


# Parametrized tests for specific schema constraints
@pytest.mark.parametrize("field,invalid_value,error_type", [
    ("status", "Active", "enum"),  # Invalid enum value
    ("sourceId", "partner 123", "pattern"),  # Invalid pattern (spaces not allowed)
    ("id", " ", "pattern")  # Invalid pattern (alphanumeric required)
])
def test_event_field_constraints(event_base, field, invalid_value, error_type):
    """Test specific field constraints in event schema."""
    schema_path = SCHEMAS_DIR / 'v1' / 'event.json'
    schema = load_schema(schema_path)
    
    # Create example with invalid field value
    example = {**event_base, field: invalid_value}
    
    # Validation should fail
    with pytest.raises(ValidationError) as excinfo:
        validate(instance=example, schema=schema)
    
    # Check that the error is of the expected type
    assert error_type in str(excinfo.value), f"Expected {error_type} error, got: {excinfo.value}"


@pytest.mark.parametrize("field,invalid_value,error_type", [
    ("locationType", "Physical", "enum"),  # Invalid enum value
    ("addressRegion", "Quebec", "pattern"),  # Invalid pattern (should be 2-letter code)
    ("addressCountry", "CA", "pattern"),  # Invalid pattern (should be 3-letter code)
    ("addressPostalCode", "12345", "pattern")  # Invalid postal code format
])
def test_place_field_constraints(place_base, field, invalid_value, error_type):
    """Test specific field constraints in place schema."""
    schema_path = SCHEMAS_DIR / 'v1' / 'place.json'
    schema = load_schema(schema_path)
    
    # Create example with invalid field value
    example = {**place_base, field: invalid_value}
    
    # Validation should fail
    with pytest.raises(ValidationError) as excinfo:
        validate(instance=example, schema=schema)
    
    # Check that the error is of the expected type
    assert error_type in str(excinfo.value), f"Expected {error_type} error, got: {excinfo.value}"


def test_conditional_requirements():
    """Test conditional requirements in schemas."""
    schema_path = SCHEMAS_DIR / 'v1' / 'place.json'
    schema = load_schema(schema_path)
    
    # Test that containedInPlaceId is required when containedInPlaceStatus is true
    example = {
        "sourceId": "partner123",
        "id": "place123",
        "nameFr": "Salle dans un théâtre",
        "descriptionFr": "Une salle de spectacle à l'intérieur d'un théâtre",
        "locationType": "Place",
        "containedInPlaceStatus": True,  # Requires containedInPlaceId
        "addressStreet": "123 Rue Principale",
        "addressCity": "Montréal",
        "addressRegion": "QC",
        "addressPostalCode": "H2X 1Y6",
        "addressCountry": "CAN"
    }
    
    # Should fail because containedInPlaceId is missing
    with pytest.raises(ValidationError) as excinfo:
        validate(instance=example, schema=schema)
    
    assert "containedInPlaceId" in str(excinfo.value)
    
    # Add the required field
    example["containedInPlaceId"] = "parent123"
    
    # Should validate now
    validate(instance=example, schema=schema) 