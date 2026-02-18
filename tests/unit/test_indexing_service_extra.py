import builtins
import importlib
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np
import pytest

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../src")))

from services.indexing_service import IndexingService
import services.indexing_service as indexing_service_module


def test_module_importerror_branches_for_optional_deps():
    real_import = builtins.__import__

    def fake_import(name, *args, **kwargs):
        if name == "fastembed":
            raise ImportError("no fastembed")
        if name == "sqlite_vec":
            raise ImportError("no sqlite_vec")
        return real_import(name, *args, **kwargs)

    with patch("builtins.__import__", side_effect=fake_import):
        reloaded = importlib.reload(indexing_service_module)

    assert reloaded.TextEmbedding is None
    assert reloaded.sqlite_vec is None

    importlib.reload(indexing_service_module)


def test_init_db_creates_parent_directory(tmp_path):
    db_path = tmp_path / "nested" / "deeper" / "index.db"
    assert not db_path.parent.exists()

    IndexingService(str(db_path))

    assert db_path.parent.exists()


def test_init_db_logs_error_when_sqlite_vec_load_fails(tmp_path):
    mock_vec = MagicMock()
    mock_vec.load.side_effect = RuntimeError("load failed")

    with patch("services.indexing_service.sqlite_vec", mock_vec):
        with patch("services.indexing_service.logger.error") as logger_error:
            IndexingService(str(tmp_path / "index.db"))

    logger_error.assert_any_call("Failed to load sqlite-vec extension: load failed")


def test_init_vector_db_returns_early_without_sqlite_vec(tmp_path):
    service = IndexingService(str(tmp_path / "index.db"))

    with patch("services.indexing_service.sqlite_vec", None):
        with patch("services.indexing_service.sqlite3.connect") as connect:
            service._init_vector_db()

    connect.assert_not_called()


def test_init_vector_db_load_failure_closes_connection(tmp_path):
    service = IndexingService(str(tmp_path / "index.db"))
    fake_conn = MagicMock()
    mock_vec = MagicMock()
    mock_vec.load.side_effect = RuntimeError("vec load failed")

    with patch("services.indexing_service.sqlite_vec", mock_vec):
        with patch("services.indexing_service.sqlite3.connect", return_value=fake_conn):
            with patch("services.indexing_service.logger.error") as logger_error:
                service._init_vector_db()

    fake_conn.close.assert_called_once()
    logger_error.assert_any_call("Failed to load sqlite-vec extension: vec load failed")


def test_init_vector_db_dimension_exception_defaults_to_384(tmp_path):
    service = IndexingService(str(tmp_path / "index.db"))

    class BrokenEmbedder:
        def __getattribute__(self, name):
            raise RuntimeError("hasattr boom")

    service._embedder = BrokenEmbedder()

    fake_cursor = MagicMock()
    fake_conn = MagicMock()
    fake_conn.cursor.return_value = fake_cursor

    mock_vec = MagicMock()

    with patch("services.indexing_service.sqlite_vec", mock_vec):
        with patch("services.indexing_service.sqlite3.connect", return_value=fake_conn):
            with patch("services.indexing_service.logger.warning") as logger_warning:
                service._init_vector_db()

    sql = fake_cursor.execute.call_args[0][0]
    assert "float[384]" in sql
    logger_warning.assert_any_call("Error determining embedding size: hasattr boom, defaulting to 384")


def test_embedder_raises_when_fastembed_missing(tmp_path):
    service = IndexingService(str(tmp_path / "index.db"))
    service._embedder = None

    with patch("services.indexing_service.TextEmbedding", None):
        with pytest.raises(ImportError, match="FastEmbed is required"):
            _ = service.embedder


def test_add_document_deletes_existing_vector_row(tmp_path):
    service = IndexingService(str(tmp_path / "index.db"))
    service._embedder = MagicMock()
    service._embedder.embed.return_value = iter([np.ones(384, dtype=np.float32)])

    class FakeCursor:
        def __init__(self):
            self.calls = []
            self.lastrowid = 123

        def execute(self, sql, params=()):
            self.calls.append((sql, params))
            return self

        def fetchone(self):
            if self.calls and "SELECT rowid FROM document_chunks" in self.calls[-1][0]:
                return (77,)
            return None

    fake_cursor = FakeCursor()
    fake_conn = MagicMock()
    fake_conn.cursor.return_value = fake_cursor

    mock_vec = MagicMock()

    with patch("services.indexing_service.sqlite_vec", mock_vec):
        with patch("services.indexing_service.sqlite3.connect", return_value=fake_conn):
            service.add_document("doc-1", "hello", "test")

    assert any("DELETE FROM vec_document_chunks WHERE rowid = ?" in sql for sql, _ in fake_cursor.calls)


def test_add_document_logs_error_when_vector_insert_fails(tmp_path):
    service = IndexingService(str(tmp_path / "index.db"))
    service._embedder = MagicMock()
    service._embedder.embed.return_value = iter([np.ones(384, dtype=np.float32)])

    class FakeCursor:
        def __init__(self):
            self.lastrowid = 5

        def execute(self, sql, params=()):
            if "INSERT INTO vec_document_chunks" in sql:
                raise RuntimeError("vec insert failed")
            return self

        def fetchone(self):
            return None

    fake_conn = MagicMock()
    fake_conn.cursor.return_value = FakeCursor()
    mock_vec = MagicMock()

    with patch("services.indexing_service.sqlite_vec", mock_vec):
        with patch("services.indexing_service.sqlite3.connect", return_value=fake_conn):
            with patch("services.indexing_service.logger.error") as logger_error:
                service.add_document("doc-2", "world", "test")

    logger_error.assert_any_call("Failed to index vector for document doc-2: vec insert failed")


def test_search_returns_empty_when_db_missing(tmp_path):
    service = IndexingService(str(tmp_path / "index.db"))
    service.db_path = tmp_path / "missing.db"

    result = service.search("anything")

    assert result == []
