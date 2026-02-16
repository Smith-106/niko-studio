"""
FileBuilder Tests

Tests for FileBuilderError, FileBuilderState, FileBuilder fluent API,
atomic writes, backup, rollback, and callbacks.
"""

import pytest
from pathlib import Path
from unittest.mock import patch
from src.storage.file_builder import (
    FileBuilderError,
    FileBuilderState,
    FileBuilder,
)


# ============================================================
# FileBuilderState
# ============================================================

class TestFileBuilderState:

    def test_defaults(self):
        s = FileBuilderState()
        assert s.path is None
        assert s.content is None
        assert s.encoding == "utf-8"
        assert s.create_parents is True
        assert s.backup_enabled is False
        assert s.backup_path is None
        assert s.last_written_path is None
        assert s.temp_suffix == ".tmp"
        assert s.on_success is None
        assert s.on_error is None


# ============================================================
# FileBuilder Fluent API
# ============================================================

class TestFileBuilderFluentAPI:

    def test_with_path(self):
        b = FileBuilder().with_path("/tmp/test.txt")
        assert b.state.path == Path("/tmp/test.txt")

    def test_with_content(self):
        b = FileBuilder().with_content("hello")
        assert b.state.content == "hello"

    def test_with_encoding(self):
        b = FileBuilder().with_encoding("ascii")
        assert b.state.encoding == "ascii"

    def test_with_backup(self):
        b = FileBuilder().with_backup(True)
        assert b.state.backup_enabled is True

    def test_with_create_parents(self):
        b = FileBuilder().with_create_parents(False)
        assert b.state.create_parents is False

    def test_with_temp_suffix(self):
        b = FileBuilder().with_temp_suffix(".bak")
        assert b.state.temp_suffix == ".bak"

    def test_with_on_success(self):
        cb = lambda p: None
        b = FileBuilder().with_on_success(cb)
        assert b.state.on_success is cb

    def test_with_on_error(self):
        cb = lambda e: None
        b = FileBuilder().with_on_error(cb)
        assert b.state.on_error is cb

    def test_chaining(self):
        b = (
            FileBuilder()
            .with_path("/tmp/test.txt")
            .with_content("hello")
            .with_encoding("utf-8")
            .with_backup(True)
        )
        assert b.state.path == Path("/tmp/test.txt")
        assert b.state.content == "hello"
        assert b.state.backup_enabled is True

    def test_reset(self):
        b = FileBuilder().with_path("/tmp/t").with_content("c")
        b.reset()
        assert b.state.path is None
        assert b.state.content is None


# ============================================================
# FileBuilder Validation
# ============================================================

class TestFileBuilderValidation:

    def test_no_path(self):
        b = FileBuilder().with_content("hello")
        with pytest.raises(FileBuilderError, match="Path is required"):
            b.build()

    def test_no_content(self):
        b = FileBuilder().with_path("/tmp/test.txt")
        with pytest.raises(FileBuilderError, match="Content is required"):
            b.build()


# ============================================================
# FileBuilder Build (Atomic Write)
# ============================================================

class TestFileBuilderBuild:

    def test_basic_write(self, tmp_path):
        target = tmp_path / "output.txt"
        path = (
            FileBuilder()
            .with_path(target)
            .with_content("Hello, World!")
            .build()
        )
        assert path == target
        assert target.read_text() == "Hello, World!"

    def test_write_chinese(self, tmp_path):
        target = tmp_path / "chinese.txt"
        FileBuilder().with_path(target).with_content("你好世界").build()
        assert target.read_text(encoding="utf-8") == "你好世界"

    def test_creates_parent_dirs(self, tmp_path):
        target = tmp_path / "sub" / "dir" / "file.txt"
        FileBuilder().with_path(target).with_content("nested").build()
        assert target.read_text() == "nested"

    def test_no_create_parents(self, tmp_path):
        target = tmp_path / "nonexistent" / "file.txt"
        b = (
            FileBuilder()
            .with_path(target)
            .with_content("test")
            .with_create_parents(False)
        )
        with pytest.raises(FileBuilderError):
            b.build()

    def test_overwrite_existing(self, tmp_path):
        target = tmp_path / "existing.txt"
        target.write_text("old content")
        FileBuilder().with_path(target).with_content("new content").build()
        assert target.read_text() == "new content"

    def test_success_callback(self, tmp_path):
        results = []
        target = tmp_path / "cb.txt"
        (
            FileBuilder()
            .with_path(target)
            .with_content("test")
            .with_on_success(lambda p: results.append(p))
            .build()
        )
        assert len(results) == 1
        assert results[0] == target

    def test_error_callback(self, tmp_path):
        errors = []
        b = (
            FileBuilder()
            .with_content("test")
            .with_on_error(lambda e: errors.append(e))
        )
        with pytest.raises(FileBuilderError):
            b.build()
        assert len(errors) == 1


# ============================================================
# FileBuilder Backup & Rollback
# ============================================================

class TestFileBuilderBackupRollback:

    def test_backup_created(self, tmp_path):
        target = tmp_path / "backup_test.txt"
        target.write_text("original")

        b = (
            FileBuilder()
            .with_path(target)
            .with_content("updated")
            .with_backup(True)
        )
        b.build()
        assert target.read_text() == "updated"
        assert b.state.backup_path is not None
        assert b.state.backup_path.exists()

    def test_backup_not_created_for_new_file(self, tmp_path):
        target = tmp_path / "new_file.txt"
        b = FileBuilder().with_path(target).with_content("new").with_backup(True)
        b.build()
        assert b.state.backup_path is None

    def test_rollback_from_backup(self, tmp_path):
        target = tmp_path / "rollback_test.txt"
        target.write_text("original")

        b = (
            FileBuilder()
            .with_path(target)
            .with_content("updated")
            .with_backup(True)
        )
        b.build()
        assert target.read_text() == "updated"

        result = b.rollback()
        assert result is True
        assert target.read_text() == "original"

    def test_rollback_delete_no_backup(self, tmp_path):
        target = tmp_path / "rollback_del.txt"
        b = FileBuilder().with_path(target).with_content("test")
        b.build()
        assert target.exists()

        result = b.rollback()
        assert result is True
        assert not target.exists()

    def test_rollback_no_previous_write(self):
        b = FileBuilder()
        result = b.rollback()
        assert result is False



def test_create_backup_failure_returns_none(tmp_path):
    target = tmp_path / "backup_fail.txt"
    target.write_text("origin", encoding="utf-8")

    builder = FileBuilder().with_path(target).with_content("new").with_backup(True)

    with patch("src.storage.file_builder.shutil.copy2", side_effect=OSError("copy failed")):
        backup = builder._create_backup()

    assert backup is None






def test_rollback_failure_returns_false(tmp_path):
    target = tmp_path / "rollback_fail.txt"
    builder = FileBuilder().with_path(target).with_content("data")
    builder.build()

    with patch("pathlib.Path.unlink", side_effect=OSError("unlink failed")):
        assert builder.rollback() is False



def test_atomic_write_temp_cleanup_failure_still_raises_builder_error(tmp_path):
    target = tmp_path / "atomic_cleanup_fail.txt"
    builder = FileBuilder().with_path(target).with_content("data")

    with (
        patch("pathlib.Path.write_text", side_effect=OSError("write failed")),
        patch("pathlib.Path.exists", return_value=True),
        patch("pathlib.Path.unlink", side_effect=OSError("temp unlink failed")),
    ):
        with pytest.raises(FileBuilderError, match="Failed to write file"):
            builder.build()
