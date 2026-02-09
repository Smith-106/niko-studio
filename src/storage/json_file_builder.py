"""
JsonFileBuilder - Builder for JSON File Operations

Extends FileBuilder with JSON-specific features:
- Automatic JSON serialization
- Configurable indentation
- Schema validation support
- Pretty-print options

Usage:
    builder = JsonFileBuilder()
    path = (
        builder
        .with_path("/path/to/data.json")
        .with_data({"key": "value", "count": 42})
        .with_indent(2)
        .with_sort_keys(True)
        .build()
    )
"""

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Optional, Type

from .file_builder import FileBuilder, FileBuilderError

logger = logging.getLogger("JsonFileBuilder")


class JsonValidationError(FileBuilderError):
    """Exception raised for JSON validation errors"""
    pass


@dataclass
class JsonSchema:
    """
    Simple JSON schema for validation.

    Validates:
    - Required fields
    - Field types
    - Allowed values (enum)
    """
    required_fields: list = field(default_factory=list)
    field_types: Dict[str, Type] = field(default_factory=dict)
    allowed_values: Dict[str, list] = field(default_factory=dict)

    def validate(self, data: Dict[str, Any]) -> None:
        """
        Validate data against schema.

        Raises:
            JsonValidationError: If validation fails
        """
        # Check required fields
        for field_name in self.required_fields:
            if field_name not in data:
                raise JsonValidationError(f"Missing required field: {field_name}")

        # Check field types
        for field_name, expected_type in self.field_types.items():
            if field_name in data:
                value = data[field_name]
                if not isinstance(value, expected_type):
                    raise JsonValidationError(
                        f"Field '{field_name}' expected {expected_type.__name__}, "
                        f"got {type(value).__name__}"
                    )

        # Check allowed values
        for field_name, allowed in self.allowed_values.items():
            if field_name in data:
                value = data[field_name]
                if value not in allowed:
                    raise JsonValidationError(
                        f"Field '{field_name}' value '{value}' not in allowed: {allowed}"
                    )


class JsonFileBuilder(FileBuilder):
    """
    JSON file builder extending FileBuilder.

    Adds JSON-specific functionality:
    - with_data() for dict/list input
    - with_indent() for formatting
    - with_schema() for validation
    - with_sort_keys() for consistent output
    - with_ensure_ascii() for Unicode handling
    """

    def __init__(self):
        super().__init__()
        self._data: Optional[Any] = None
        self._indent: Optional[int] = 2
        self._sort_keys: bool = False
        self._ensure_ascii: bool = False
        self._schema: Optional[JsonSchema] = None
        self._default_serializer: Optional[callable] = None

    def with_data(self, data: Any) -> "JsonFileBuilder":
        """
        Set the data to serialize as JSON.

        Args:
            data: Any JSON-serializable data (dict, list, etc.)

        Returns:
            Self for method chaining
        """
        self._data = data
        return self

    def with_indent(self, indent: Optional[int]) -> "JsonFileBuilder":
        """
        Set JSON indentation.

        Args:
            indent: Number of spaces for indentation (None for compact)

        Returns:
            Self for method chaining
        """
        self._indent = indent
        return self

    def with_sort_keys(self, sort: bool = True) -> "JsonFileBuilder":
        """
        Enable or disable key sorting.

        Args:
            sort: Whether to sort keys alphabetically

        Returns:
            Self for method chaining
        """
        self._sort_keys = sort
        return self

    def with_ensure_ascii(self, ensure: bool = True) -> "JsonFileBuilder":
        """
        Enable or disable ASCII-only output.

        Args:
            ensure: If True, escape non-ASCII characters

        Returns:
            Self for method chaining
        """
        self._ensure_ascii = ensure
        return self

    def with_schema(self, schema: JsonSchema) -> "JsonFileBuilder":
        """
        Set JSON schema for validation.

        Args:
            schema: JsonSchema instance for validation

        Returns:
            Self for method chaining
        """
        self._schema = schema
        return self

    def with_required_fields(self, fields: list) -> "JsonFileBuilder":
        """
        Set required fields for validation (convenience method).

        Args:
            fields: List of required field names

        Returns:
            Self for method chaining
        """
        if self._schema is None:
            self._schema = JsonSchema()
        self._schema.required_fields = fields
        return self

    def with_default_serializer(self, serializer: callable) -> "JsonFileBuilder":
        """
        Set default serializer for non-JSON-serializable objects.

        Args:
            serializer: Function to serialize custom objects

        Returns:
            Self for method chaining
        """
        self._default_serializer = serializer
        return self

    def _validate_json(self) -> None:
        """Validate JSON data against schema if set"""
        if self._schema is None:
            return

        if not isinstance(self._data, dict):
            raise JsonValidationError("Schema validation requires dict data")

        self._schema.validate(self._data)

    def _serialize(self) -> str:
        """Serialize data to JSON string"""
        try:
            return json.dumps(
                self._data,
                indent=self._indent,
                sort_keys=self._sort_keys,
                ensure_ascii=self._ensure_ascii,
                default=self._default_serializer,
            )
        except (TypeError, ValueError) as e:
            raise JsonValidationError(f"JSON serialization failed: {e}") from e

    def build(self) -> Path:
        """
        Build and write the JSON file.

        Validates data against schema (if set), serializes to JSON,
        and writes atomically.

        Returns:
            Path to the written file

        Raises:
            JsonValidationError: If validation or serialization fails
            FileBuilderError: If write fails
        """
        if self._data is None:
            raise JsonValidationError("Data is required. Use with_data() to set it.")

        # Validate against schema
        self._validate_json()

        # Serialize to JSON
        content = self._serialize()

        # Use parent's content mechanism
        self.with_content(content)

        # Build using parent
        return super().build()

    def reset(self) -> "JsonFileBuilder":
        """
        Reset builder state for reuse.

        Returns:
            Self for method chaining
        """
        super().reset()
        self._data = None
        self._indent = 2
        self._sort_keys = False
        self._ensure_ascii = False
        self._schema = None
        self._default_serializer = None
        return self

    # Convenience class methods

    @classmethod
    def write(
        cls,
        path: str | Path,
        data: Any,
        indent: int = 2,
        sort_keys: bool = False
    ) -> Path:
        """
        Convenience method for quick JSON file writing.

        Args:
            path: Target file path
            data: Data to serialize
            indent: Indentation level
            sort_keys: Whether to sort keys

        Returns:
            Path to written file
        """
        return (
            cls()
            .with_path(path)
            .with_data(data)
            .with_indent(indent)
            .with_sort_keys(sort_keys)
            .build()
        )

    @classmethod
    def read(cls, path: str | Path) -> Any:
        """
        Convenience method for reading JSON files.

        Args:
            path: Path to JSON file

        Returns:
            Parsed JSON data
        """
        path = Path(path)
        if not path.exists():
            raise FileBuilderError(f"File not found: {path}")

        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            raise JsonValidationError(f"Invalid JSON: {e}") from e
