"""
JsonFileBuilder Tests

Tests for JsonValidationError, JsonSchema, JsonFileBuilder fluent API,
validation, serialization, build, reset, and convenience methods.
"""

import json
import pytest
from pathlib import Path
from src.storage.json_file_builder import (
    JsonValidationError,
    JsonSchema,
    JsonFileBuilder,
)
from src.storage.file_builder import FileBuilderError


# ============================================================
# JsonSchema
# ============================================================

class TestJsonSchema:

    def test_empty_schema_passes(self):
        s = JsonSchema()
        s.validate({"any": "data"})  # no error

    def test_required_fields_pass(self):
        s = JsonSchema(required_fields=["name", "age"])
        s.validate({"name": "Alice", "age": 30})

    def test_required_fields_missing(self):
        s = JsonSchema(required_fields=["name", "age"])
        with pytest.raises(JsonValidationError, match="Missing required field: age"):
            s.validate({"name": "Alice"})

    def test_field_types_pass(self):
        s = JsonSchema(field_types={"name": str, "count": int})
        s.validate({"name": "test", "count": 5})

    def test_field_types_wrong(self):
        s = JsonSchema(field_types={"count": int})
        with pytest.raises(JsonValidationError, match="expected int"):
            s.validate({"count": "not_int"})

    def test_field_types_missing_key_ok(self):
        s = JsonSchema(field_types={"optional": str})
        s.validate({"other": 123})  # field not present, no error

    def test_allowed_values_pass(self):
        s = JsonSchema(allowed_values={"status": ["active", "inactive"]})
        s.validate({"status": "active"})

    def test_allowed_values_fail(self):
        s = JsonSchema(allowed_values={"status": ["active", "inactive"]})
        with pytest.raises(JsonValidationError, match="not in allowed"):
            s.validate({"status": "deleted"})

    def test_allowed_values_missing_key_ok(self):
        s = JsonSchema(allowed_values={"status": ["a", "b"]})
        s.validate({"other": "value"})


# ============================================================
# JsonFileBuilder Fluent API
# ============================================================

class TestJsonFileBuilderFluentAPI:

    def test_with_data(self):
        b = JsonFileBuilder().with_data({"key": "val"})
        assert b._data == {"key": "val"}

    def test_with_indent(self):
        b = JsonFileBuilder().with_indent(4)
        assert b._indent == 4

    def test_with_indent_none(self):
        b = JsonFileBuilder().with_indent(None)
        assert b._indent is None

    def test_with_sort_keys(self):
        b = JsonFileBuilder().with_sort_keys(True)
        assert b._sort_keys is True

    def test_with_ensure_ascii(self):
        b = JsonFileBuilder().with_ensure_ascii(True)
        assert b._ensure_ascii is True

    def test_with_schema(self):
        s = JsonSchema(required_fields=["id"])
        b = JsonFileBuilder().with_schema(s)
        assert b._schema is s

    def test_with_required_fields(self):
        b = JsonFileBuilder().with_required_fields(["a", "b"])
        assert b._schema is not None
        assert b._schema.required_fields == ["a", "b"]

    def test_with_required_fields_existing_schema(self):
        s = JsonSchema(field_types={"x": str})
        b = JsonFileBuilder().with_schema(s).with_required_fields(["a"])
        assert b._schema.required_fields == ["a"]
        assert b._schema.field_types == {"x": str}

    def test_with_default_serializer(self):
        fn = lambda o: str(o)
        b = JsonFileBuilder().with_default_serializer(fn)
        assert b._default_serializer is fn

    def test_chaining(self):
        b = (
            JsonFileBuilder()
            .with_data({"x": 1})
            .with_indent(4)
            .with_sort_keys(True)
            .with_ensure_ascii(False)
        )
        assert b._data == {"x": 1}
        assert b._indent == 4
        assert b._sort_keys is True

    def test_defaults(self):
        b = JsonFileBuilder()
        assert b._data is None
        assert b._indent == 2
        assert b._sort_keys is False
        assert b._ensure_ascii is False
        assert b._schema is None
        assert b._default_serializer is None


# ============================================================
# JsonFileBuilder Validation & Serialization
# ============================================================

class TestJsonFileBuilderValidation:

    def test_no_data(self, tmp_path):
        b = JsonFileBuilder().with_path(tmp_path / "test.json")
        with pytest.raises(JsonValidationError, match="Data is required"):
            b.build()

    def test_schema_requires_dict(self, tmp_path):
        s = JsonSchema(required_fields=["id"])
        b = (
            JsonFileBuilder()
            .with_path(tmp_path / "test.json")
            .with_data([1, 2, 3])
            .with_schema(s)
        )
        with pytest.raises(JsonValidationError, match="requires dict"):
            b.build()

    def test_schema_missing_field(self, tmp_path):
        b = (
            JsonFileBuilder()
            .with_path(tmp_path / "test.json")
            .with_data({"name": "test"})
            .with_required_fields(["name", "id"])
        )
        with pytest.raises(JsonValidationError, match="Missing required field: id"):
            b.build()

    def test_serialization_error(self, tmp_path):
        class Unserializable:
            pass
        b = (
            JsonFileBuilder()
            .with_path(tmp_path / "test.json")
            .with_data({"obj": Unserializable()})
        )
        with pytest.raises(JsonValidationError, match="serialization failed"):
            b.build()


# ============================================================
# JsonFileBuilder Build
# ============================================================

class TestJsonFileBuilderBuild:

    def test_basic_write(self, tmp_path):
        target = tmp_path / "data.json"
        data = {"name": "test", "count": 42}
        path = (
            JsonFileBuilder()
            .with_path(target)
            .with_data(data)
            .build()
        )
        assert path == target
        loaded = json.loads(target.read_text(encoding="utf-8"))
        assert loaded == data

    def test_sorted_keys(self, tmp_path):
        target = tmp_path / "sorted.json"
        data = {"z": 1, "a": 2, "m": 3}
        JsonFileBuilder().with_path(target).with_data(data).with_sort_keys(True).build()
        content = target.read_text(encoding="utf-8")
        # Keys should appear in alphabetical order
        a_pos = content.index('"a"')
        m_pos = content.index('"m"')
        z_pos = content.index('"z"')
        assert a_pos < m_pos < z_pos

    def test_compact_no_indent(self, tmp_path):
        target = tmp_path / "compact.json"
        JsonFileBuilder().with_path(target).with_data({"a": 1}).with_indent(None).build()
        content = target.read_text(encoding="utf-8")
        assert "\n" not in content

    def test_chinese_content(self, tmp_path):
        target = tmp_path / "chinese.json"
        data = {"name": "你好世界"}
        JsonFileBuilder().with_path(target).with_data(data).build()
        loaded = json.loads(target.read_text(encoding="utf-8"))
        assert loaded["name"] == "你好世界"

    def test_ensure_ascii(self, tmp_path):
        target = tmp_path / "ascii.json"
        data = {"name": "你好"}
        JsonFileBuilder().with_path(target).with_data(data).with_ensure_ascii(True).build()
        content = target.read_text(encoding="utf-8")
        assert "\\u" in content

    def test_with_schema_pass(self, tmp_path):
        target = tmp_path / "schema.json"
        s = JsonSchema(required_fields=["id"], field_types={"id": str})
        path = (
            JsonFileBuilder()
            .with_path(target)
            .with_data({"id": "001", "extra": True})
            .with_schema(s)
            .build()
        )
        assert path == target

    def test_list_data(self, tmp_path):
        target = tmp_path / "list.json"
        data = [1, 2, 3]
        JsonFileBuilder().with_path(target).with_data(data).build()
        loaded = json.loads(target.read_text(encoding="utf-8"))
        assert loaded == [1, 2, 3]

    def test_custom_serializer(self, tmp_path):
        from datetime import date
        target = tmp_path / "custom.json"
        data = {"date": date(2025, 1, 1)}
        (
            JsonFileBuilder()
            .with_path(target)
            .with_data(data)
            .with_default_serializer(str)
            .build()
        )
        loaded = json.loads(target.read_text(encoding="utf-8"))
        assert loaded["date"] == "2025-01-01"


# ============================================================
# JsonFileBuilder Reset
# ============================================================

class TestJsonFileBuilderReset:

    def test_reset(self):
        b = (
            JsonFileBuilder()
            .with_data({"x": 1})
            .with_indent(4)
            .with_sort_keys(True)
            .with_ensure_ascii(True)
            .with_required_fields(["x"])
        )
        b.reset()
        assert b._data is None
        assert b._indent == 2
        assert b._sort_keys is False
        assert b._ensure_ascii is False
        assert b._schema is None
        assert b._default_serializer is None


# ============================================================
# Convenience Methods
# ============================================================

class TestJsonFileBuilderConvenience:

    def test_write_classmethod(self, tmp_path):
        target = tmp_path / "quick.json"
        path = JsonFileBuilder.write(target, {"fast": True})
        assert path == target
        loaded = json.loads(target.read_text(encoding="utf-8"))
        assert loaded["fast"] is True

    def test_write_with_sort(self, tmp_path):
        target = tmp_path / "sorted.json"
        JsonFileBuilder.write(target, {"z": 1, "a": 2}, sort_keys=True)
        content = target.read_text(encoding="utf-8")
        assert content.index('"a"') < content.index('"z"')

    def test_read_classmethod(self, tmp_path):
        target = tmp_path / "read.json"
        target.write_text('{"key": "value"}', encoding="utf-8")
        data = JsonFileBuilder.read(target)
        assert data == {"key": "value"}

    def test_read_not_found(self, tmp_path):
        with pytest.raises(FileBuilderError, match="File not found"):
            JsonFileBuilder.read(tmp_path / "nonexistent.json")

    def test_read_invalid_json(self, tmp_path):
        target = tmp_path / "bad.json"
        target.write_text("not json", encoding="utf-8")
        with pytest.raises(JsonValidationError, match="Invalid JSON"):
            JsonFileBuilder.read(target)

    def test_roundtrip(self, tmp_path):
        target = tmp_path / "roundtrip.json"
        original = {"name": "test", "values": [1, 2, 3]}
        JsonFileBuilder.write(target, original)
        loaded = JsonFileBuilder.read(target)
        assert loaded == original
