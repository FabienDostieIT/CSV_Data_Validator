"""Tests for schema list generation functionality."""

import pytest
from pathlib import Path
from generate_schema_docs import generate_schema_list

def test_generate_schema_list():
    """Test generation of schema list for README."""
    # TODO: Add test with sample schemas
    pass

def test_generate_schema_list_empty():
    """Test handling of empty schema directory."""
    version_dir = Path("tests/fixtures/schemas/empty")
    version_dir.mkdir(parents=True, exist_ok=True)
    schema_list = generate_schema_list(version_dir, [])
    assert schema_list == ""
    # Cleanup
    version_dir.rmdir() 