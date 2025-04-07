import csv
import json
import re
from pathlib import Path
from typing import Dict, List, Any, Tuple, Optional
from jsonschema import validate, ValidationError

# Path to schema directory
SCHEMA_DIR = Path(__file__).parent.parent / "schemas" / "v1"


def get_available_schemas() -> Dict[str, Path]:
    """
    Discover and return all available schemas in the schema directory.
    
    Returns:
        Dictionary mapping schema names to file paths
    """
    schemas = {}
    
    for schema_file in SCHEMA_DIR.glob("*.json"):
        schema_name = schema_file.stem  # Get filename without extension
        schemas[schema_name] = schema_file
    
    return schemas


def read_csv_file(file_path: str) -> List[Dict[str, Any]]:
    """
    Read a CSV file and return a list of dictionaries, one per row.
    
    Args:
        file_path: Path to the CSV file to read
        
    Returns:
        List of dictionaries where keys are column headers and values are cell values
    """
    data = []
    
    with open(file_path, 'r', newline='', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            # Remove empty values
            cleaned_row = {k: v for k, v in row.items() if v.strip()}
            data.append(cleaned_row)
    
    return data


def transform_flat_to_nested(flat_dict: Dict[str, Any]) -> Dict[str, Any]:
    """
    Transform a flat dictionary with dot notation keys to a nested dictionary.
    
    For example, {'a.b.c': 'value'} becomes {'a': {'b': {'c': 'value'}}}
    
    Args:
        flat_dict: Dictionary with keys in dot notation
        
    Returns:
        Nested dictionary structure
    """
    nested_dict = {}
    
    for key, value in flat_dict.items():
        # Handle dot notation for nested objects
        if '.' in key:
            parts = key.split('.')
            current = nested_dict
            
            # Navigate through nested levels
            for part in parts[:-1]:
                if part not in current:
                    current[part] = {}
                current = current[part]
            
            # Set the final value
            current[parts[-1]] = process_value(value, parts[-1])
        else:
            # Handle top-level keys
            nested_dict[key] = process_value(value, key)
    
    return nested_dict


def process_value(value: str, key: str) -> Any:
    """
    Process a string value from CSV to appropriate type based on context.
    
    Args:
        value: String value from CSV cell
        key: Field name to provide context for type conversion
        
    Returns:
        Converted value in appropriate type
    """
    # Convert empty strings to None
    if value == "":
        return None
    
    # Handle boolean values
    if value.lower() in ["true", "yes", "1"]:
        return True
    elif value.lower() in ["false", "no", "0"]:
        return False
    
    # Handle lists (comma-separated values)
    # This is a simple approach - a more comprehensive one would use schema info
    list_field_indicators = ["tags", "features", "names", "ids"]
    is_list_field = any(indicator in key.lower() for indicator in list_field_indicators)
    
    if ',' in value and is_list_field:
        # Handle quoted items in lists
        if value.startswith('"') and value.endswith('"'):
            value = value[1:-1]  # Remove enclosing quotes
        return [item.strip() for item in value.split(',')]
    
    # Try to convert to numeric value if possible
    try:
        if '.' in value:
            return float(value)
        else:
            return int(value)
    except ValueError:
        # Keep as string if not numeric
        return value


def load_schema(schema_path: Path) -> Dict[str, Any]:
    """
    Load a JSON schema from file.
    
    Args:
        schema_path: Path to the JSON schema file
        
    Returns:
        Schema as a dictionary
    """
    with open(schema_path, 'r') as f:
        return json.load(f)


def validate_against_schema(data: Dict[str, Any], schema_path: Path) -> Tuple[bool, Optional[str]]:
    """
    Validate data against a JSON schema.
    
    Args:
        data: Data to validate
        schema_path: Path to the JSON schema
        
    Returns:
        Tuple containing (success, error_message)
    """
    try:
        schema = load_schema(schema_path)
        validate(instance=data, schema=schema)
        return True, None
    except ValidationError as e:
        return False, str(e)


def import_and_validate_csv(file_path: str, schema_name: str) -> Dict[str, Any]:
    """
    Import CSV data and validate against the specified schema.
    
    Args:
        file_path: Path to the CSV file
        schema_name: Name of the schema without file extension (e.g., 'event', 'place')
        
    Returns:
        Dictionary with validation results
    """
    # Get available schemas
    available_schemas = get_available_schemas()
    
    # Check if schema exists
    if schema_name not in available_schemas:
        raise ValueError(f"Unknown schema: {schema_name}. Available schemas: {list(available_schemas.keys())}")
    
    schema_path = available_schemas[schema_name]
    
    # Read CSV data
    csv_data = read_csv_file(file_path)
    
    # Process each row and validate
    validation_results = {
        "total": len(csv_data),
        "valid": 0,
        "invalid": 0,
        "valid_items": [],
        "invalid_items": []
    }
    
    for i, row in enumerate(csv_data):
        # Transform flat CSV row to nested structure
        nested_data = transform_flat_to_nested(row)
        
        # Validate against schema
        is_valid, error_message = validate_against_schema(nested_data, schema_path)
        
        if is_valid:
            validation_results["valid"] += 1
            validation_results["valid_items"].append({
                "row": i + 2,  # +2 because row 1 is header, and we're 0-indexed
                "id": nested_data.get("id", "unknown"),
                "data": nested_data
            })
        else:
            validation_results["invalid"] += 1
            validation_results["invalid_items"].append({
                "row": i + 2,
                "id": nested_data.get("id", "unknown"),
                "error": error_message,
                "data": nested_data
            })
    
    return validation_results


def get_validation_report(validation_results: Dict[str, Any]) -> str:
    """
    Generate a human-readable validation report.
    
    Args:
        validation_results: Validation results from import_and_validate_csv
        
    Returns:
        Formatted validation report as a string
    """
    report = []
    
    report.append(f"Validation Report")
    report.append(f"==================")
    report.append(f"Total rows: {validation_results['total']}")
    report.append(f"Valid: {validation_results['valid']}")
    report.append(f"Invalid: {validation_results['invalid']}")
    report.append("")
    
    if validation_results["invalid"] > 0:
        report.append("Invalid Entries")
        report.append("--------------")
        
        for item in validation_results["invalid_items"]:
            report.append(f"Row {item['row']} (ID: {item['id']})")
            report.append(f"Error: {item['error']}")
            report.append("")
    
    return "\n".join(report) 