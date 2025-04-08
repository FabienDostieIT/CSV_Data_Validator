"""Tests for configuration loading functionality."""

import pytest
from pathlib import Path
from generate_schema_docs import load_config

def test_load_config_defaults():
    """Test that default configuration values are set correctly."""
    config = load_config()
    assert config.template_name == "md_nested"
    assert config.minify is True
    assert config.copy_css is True
    assert config.show_breadcrumbs is True
    assert config.show_toc is True
    assert config.description_is_markdown is True

def test_load_config_custom_values():
    """Test that custom configuration values override defaults."""
    # TODO: Add test with custom config file
    pass

def test_load_config_invalid_file():
    """Test handling of invalid configuration file."""
    # TODO: Add test for invalid config
    pass 