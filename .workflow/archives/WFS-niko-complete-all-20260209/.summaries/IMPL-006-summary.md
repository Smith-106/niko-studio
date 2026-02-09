# Task: IMPL-006 Storage Unification

## Implementation Summary

### Files Created
- `src/storage/__init__.py`: Package initialization with IFileBuilder protocol and exports
- `src/storage/file_builder.py`: Base FileBuilder class with atomic write support
- `src/storage/json_file_builder.py`: JsonFileBuilder extending FileBuilder for JSON operations

### Content Added

#### `src/storage/__init__.py`
- **IFileBuilder** (Protocol): Interface defining builder contract with `with_path()`, `with_content()`, `with_encoding()`, `build()`, `rollback()` methods
- Exports: `IFileBuilder`, `FileBuilder`, `FileBuilderState`, `FileBuilderError`, `JsonFileBuilder`

#### `src/storage/file_builder.py` (~250 lines)
- **FileBuilderState** (dataclass): State container for builder configuration
- **FileBuilderError** (Exception): Custom exception for builder errors
- **FileBuilder** (class): Base builder with fluent API
  - `with_path(path)`: Set target file path
  - `with_content(content)`: Set file content
  - `with_encoding(encoding)`: Set character encoding (default: utf-8)
  - `with_backup(enabled)`: Enable backup before overwrite
  - `with_create_parents(enabled)`: Enable parent directory creation
  - `with_temp_suffix(suffix)`: Set temp file suffix
  - `with_on_success(callback)`: Set success callback
  - `with_on_error(callback)`: Set error callback
  - `build()`: Execute atomic write (temp file + rename)
  - `rollback()`: Restore from backup or delete written file
  - `reset()`: Reset builder state for reuse

#### `src/storage/json_file_builder.py` (~220 lines)
- **JsonValidationError** (Exception): JSON-specific validation errors
- **JsonSchema** (dataclass): Simple schema validator with required_fields, field_types, allowed_values
- **JsonFileBuilder** (class): Extends FileBuilder
  - `with_data(data)`: Set JSON-serializable data
  - `with_indent(indent)`: Set indentation (default: 2)
  - `with_sort_keys(sort)`: Enable key sorting
  - `with_ensure_ascii(ensure)`: Control ASCII-only output
  - `with_schema(schema)`: Set validation schema
  - `with_required_fields(fields)`: Convenience method for required fields
  - `with_default_serializer(serializer)`: Custom serializer for non-JSON objects
  - `write(path, data, indent, sort_keys)`: Class method for quick writes
  - `read(path)`: Class method for reading JSON files

## Outputs for Dependent Tasks

### Available Components
```python
from src.storage import FileBuilder, JsonFileBuilder, FileBuilderError
from src.storage.json_file_builder import JsonSchema, JsonValidationError
```

### Integration Points
- **FileBuilder**: Use for any text file with atomic write guarantee
- **JsonFileBuilder**: Use for structured JSON data with optional schema validation
- **Atomic writes**: Files are written to temp location first, then renamed (prevents partial writes)
- **Rollback**: Supports undo of last write operation

### Usage Examples
```python
# Basic file writing
FileBuilder().with_path("output.txt").with_content("Hello").build()

# JSON with backup
JsonFileBuilder() \
    .with_path("config.json") \
    .with_data({"setting": "value"}) \
    .with_backup(True) \
    .build()

# JSON with schema validation
schema = JsonSchema(required_fields=["id", "name"])
JsonFileBuilder() \
    .with_path("data.json") \
    .with_data({"id": 1, "name": "test"}) \
    .with_schema(schema) \
    .build()

# Quick write (class method)
JsonFileBuilder.write("/tmp/data.json", {"key": "value"})
```

## Acceptance Criteria Verification

| Criteria | Result |
|----------|--------|
| 3+ files created in src/storage/ | ✅ 3 files |
| FileBuilder implements builder pattern (>= 3 with_* methods) | ✅ 9 methods |
| JsonFileBuilder extends FileBuilder | ✅ Verified |
| Atomic writes work | ✅ Tested successfully |

## Status: ✅ Complete
