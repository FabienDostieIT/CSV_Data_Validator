import json
import csv
import io
from pathlib import Path
from typing import Dict, List, Any, Optional

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


def _load_schema(schema_path: Path) -> Dict[str, Any]:
    """Load a JSON schema file."""
    with open(schema_path, 'r') as f:
        return json.load(f)


def _flatten_schema(schema: Dict[str, Any], parent_key: str = '', flattened: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Flatten a nested JSON schema into a dictionary with keys representing paths.
    
    Args:
        schema: The JSON schema to flatten
        parent_key: The parent key for nested fields
        flattened: The accumulator for flattened fields
        
    Returns:
        A dictionary mapping flattened paths to their schema definitions
    """
    if flattened is None:
        flattened = {}
    
    # Process properties if they exist
    properties = schema.get('properties', {})
    
    for key, value in properties.items():
        new_key = f"{parent_key}.{key}" if parent_key else key
        
        # Handle nested objects
        if 'properties' in value and value.get('type') == 'object':
            _flatten_schema(value, new_key, flattened)
        # Handle arrays
        elif 'items' in value and value.get('type') == 'array':
            items = value.get('items', {})
            
            # If array of objects, flatten each property
            if 'properties' in items and items.get('type') == 'object':
                for item_key, item_value in items.get('properties', {}).items():
                    item_path = f"{new_key}.{item_key}"
                    flattened[item_path] = item_value
            # Special handling for opening hours
            elif key == 'openingHours':
                days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
                for day in days:
                    flattened[f"{new_key}.{day}.opens"] = {"type": "string", "format": "time"}
                    flattened[f"{new_key}.{day}.closes"] = {"type": "string", "format": "time"}
            # For simple arrays, just use the array key
            else:
                flattened[new_key] = value
        # Simple property
        else:
            flattened[new_key] = value
    
    return flattened


def _schema_to_csv_headers(schema: Dict[str, Any]) -> List[str]:
    """
    Convert a flattened schema to CSV headers.
    
    Args:
        schema: The flattened schema dictionary
        
    Returns:
        A list of column headers for the CSV template
    """
    # Extract headers from flattened schema
    headers = list(schema.keys())
    
    # Sort headers to ensure consistent ordering
    # Required fields first, then alphabetically
    return headers


def _create_sample_row(headers: List[str], schema_name: str) -> Dict[str, str]:
    """
    Create a sample data row based on the schema name and headers.
    
    Args:
        headers: List of CSV headers
        schema_name: The name of the schema (e.g., 'event', 'place')
        
    Returns:
        A dictionary with sample values for each header
    """
    # Common sample data for all entity types
    common_samples = {
        "sourceId": "partner123",
        "id": f"{schema_name}123",
        "nameFr": "Nom en français",
        "nameEn": "Name in English",
        "descriptionFr": "Description en français",
        "descriptionEn": "Description in English"
    }
    
    # Schema-specific sample data
    schema_samples = {}
    
    # Add schema-specific samples based on schema name
    if schema_name == 'event':
        schema_samples = {
            "status": "scheduled",
            "startDate": "2023-08-15",
            "endDate": "2023-08-15",
            "startTime": "19:30",
            "endTime": "22:00",
            "placeId": "place123",
            "price.type": "range",
            "price.currency": "CAD",
            "price.minValue": "25.00",
            "price.maxValue": "75.00",
            "categoryTags": "music,concert,jazz",
            "performerNames": "John Smith Quartet,Jane Doe",
            "isAccessible": "true",
            "accessibilityFeatures": "Wheelchair Access,Assistive Listening Systems",
            "images.url": "https://example.com/images/event.jpg",
            "images.altText": "Event image description",
            "images.width": "1200",
            "images.height": "800",
            "ticketPurchaseUrl": "https://example.com/tickets"
        }
    elif schema_name == 'place':
        schema_samples = {
            "locationType": "Place",
            "containedInPlaceStatus": "false",
            "addressStreet": "123 Main Street",
            "addressCity": "Montréal",
            "addressRegion": "QC",
            "addressPostalCode": "H2X1Z4",
            "addressCountry": "CAN",
            "latitude": "45.5088",
            "longitude": "-73.5878",
            "capacity": "500",
            "phoneNumber": "+15141234567",
            "emailAddress": "info@example.com",
            "websiteUrl": "https://example.com",
            "openingHours.Monday.opens": "09:00",
            "openingHours.Monday.closes": "17:00",
            "openingHours.Tuesday.opens": "09:00",
            "openingHours.Tuesday.closes": "17:00",
            "openingHours.Wednesday.opens": "09:00",
            "openingHours.Wednesday.closes": "17:00",
            "openingHours.Thursday.opens": "09:00",
            "openingHours.Thursday.closes": "21:00",
            "openingHours.Friday.opens": "09:00",
            "openingHours.Friday.closes": "21:00",
            "openingHours.Saturday.opens": "10:00",
            "openingHours.Saturday.closes": "21:00",
            "openingHours.Sunday.opens": "10:00",
            "openingHours.Sunday.closes": "17:00",
            "accessibilityFeatures": "Wheelchair Access,Accessible Restrooms,Assistive Listening Systems",
            "images.url": "https://example.com/images/place.jpg",
            "images.altText": "Exterior view of the location",
            "images.width": "1200",
            "images.height": "800"
        }
    
    # Combine common and schema-specific samples
    sample_data = {**common_samples, **schema_samples}
    
    # Filter sample data to only include headers that are in the schema
    return {header: sample_data.get(header, "") for header in headers}


def _generate_csv_template(schema_path: Path, schema_name: str) -> str:
    """
    Generate a CSV template from a JSON schema.
    
    Args:
        schema_path: Path to the JSON schema file
        schema_name: The name of the schema (e.g., 'event', 'place')
        
    Returns:
        CSV template as a string
    """
    # Load and flatten schema
    schema = _load_schema(schema_path)
    flattened_schema = _flatten_schema(schema)
    
    # Get headers
    headers = _schema_to_csv_headers(flattened_schema)
    
    # Create sample row
    sample_row = _create_sample_row(headers, schema_name)
    
    # Generate CSV
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=headers)
    writer.writeheader()
    writer.writerow(sample_row)
    
    return output.getvalue()


def generate_template(schema_name: str) -> str:
    """
    Generate a CSV template for the specified schema.
    
    Args:
        schema_name: Name of the schema without file extension (e.g., 'event', 'place')
        
    Returns:
        CSV template as a string
    """
    # Get available schemas
    available_schemas = get_available_schemas()
    
    # Check if schema exists
    if schema_name not in available_schemas:
        raise ValueError(f"Unknown schema: {schema_name}. Available schemas: {list(available_schemas.keys())}")
    
    schema_path = available_schemas[schema_name]
    
    return _generate_csv_template(schema_path, schema_name)


# Backwards compatibility functions
def generate_event_template() -> str:
    """Generate a CSV template for events (for backwards compatibility)."""
    return generate_template('event')


def generate_place_template() -> str:
    """Generate a CSV template for places (for backwards compatibility)."""
    return generate_template('place') 