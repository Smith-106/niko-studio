# -*- coding: utf-8 -*-
"""CoreMemoryStore tests - CoreMemory dataclass, CRUD, search, archive, access tracking."""

import pytest
import time
import json
import sqlite3
from unittest.mock import MagicMock, patch

from src.memory.core_memory_store import CoreMemory, CoreMemoryStore


class TestCoreMemory:
    def test_defaults(self):
        m = CoreMemory(id="m1", content="hello")
        assert m.summary is None
        assert m.archived is False
        assert m.importance == 0.5
        assert m.access_count == 0
        assert m.created_at > 0

    def test_to_dict(self):
        m = CoreMemory(id="m1", content="text", importance=0.8)
        d = m.to_dict()
        assert d["id"] == "m1"
        assert d["content"] == "text"
        assert d["importance"] == 0.8

    def test_from_dict(self):
        d = {"id": "m1", "content": "text", "summary": "s", "archived": False,
             "created_at": 1.0, "updated_at": 2.0, "metadata": {}}
        m = CoreMemory.from_dict(d)
        assert m.id == "m1"
        assert m.importance == 0.5  # default
        assert m.access_count == 0  # default

    def test_from_dict_with_all_fields(self):
        d = {"id": "m2", "content": "c", "summary": None, "archived": True,
             "created_at": 1.0, "updated_at": 2.0, "metadata": {"k": "v"},
             "importance": 0.9, "access_count": 5}
        m = CoreMemory.from_dict(d)
        assert m.importance == 0.9
        assert m.access_count == 5
        assert m.archived is True


class TestCoreMemoryStore:
    @pytest.fixture()
    def store(self, tmp_path):
        db = str(tmp_path / "core_mem.db")
        return CoreMemoryStore(db_path=db)

    def test_init_creates_schema(self, store):
        conn = store._get_core_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='core_memories'")
        assert cursor.fetchone() is not None
        conn.close()

    def test_parse_metadata_valid(self, store):
        assert store._parse_metadata('{"key": "val"}') == {"key": "val"}

    def test_parse_metadata_empty(self, store):
        assert store._parse_metadata("") == {}
        assert store._parse_metadata(None) == {}

    def test_parse_metadata_invalid(self, store):
        assert store._parse_metadata("not json") == {}

    def test_parse_metadata_non_dict(self, store):
        assert store._parse_metadata("[1,2,3]") == {}

    def test_upsert_memory_new(self, store):
        m = store.upsert_memory(content="hello world", memory_id="m1")
        assert m.id == "m1"
        assert m.content == "hello world"

    def test_upsert_memory_update(self, store):
        store.upsert_memory(content="v1", memory_id="m1")
        m = store.upsert_memory(content="v2", memory_id="m1")
        assert m.content == "v2"

    def test_get_memory_existing(self, store):
        store.upsert_memory(content="test", memory_id="g1")
        m = store.get_memory("g1")
        assert m is not None
        assert m.content == "test"

    def test_get_memory_nonexistent(self, store):
        assert store.get_memory("nonexistent") is None

    def test_list_all_memories(self, store):
        store.upsert_memory(content="a", memory_id="l1")
        store.upsert_memory(content="b", memory_id="l2")
        memories = store.get_memories()
        assert len(memories) >= 2

    def test_archive_memory_legacy(self, store):
        """Test archive_memory (legacy API) which handles vector_search=None."""
        store.upsert_memory(content="to archive", memory_id="ar1")
        result = store.archive_memory("ar1")
        assert result is True
        # Verify in DB
        conn = store._get_core_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT archived FROM core_memories WHERE id = ?", ("ar1",))
        row = cursor.fetchone()
        conn.close()
        assert row["archived"] == 1

    def test_delete_memory_legacy(self, store):
        """Test delete_memory (legacy API) which handles vector_search=None."""
        store.upsert_memory(content="to delete", memory_id="d1")
        result = store.delete_memory("d1")
        assert result is True
        assert store.get_memory("d1") is None

    def test_delete_memory_nonexistent(self, store):
        result = store.delete_memory("nonexistent")
        assert result is True  # delete_memory always returns True

    def test_set_pending_vector_sync(self, store):
        store.upsert_memory(content="sync test", memory_id="sv1")
        store._set_pending_vector_sync("sv1", True)
        conn = store._get_core_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT pending_vector_sync FROM core_memories WHERE id = ?", ("sv1",))
        row = cursor.fetchone()
        conn.close()
        assert row["pending_vector_sync"] == 1

    def test_update_access_count(self, store):
        store.upsert_memory(content="access test", memory_id="ac1")
        store._update_sqlite_access_count("ac1", 5)
        m = store.get_memory("ac1")
        assert m.access_count == 5

    def test_upsert_with_vector_search(self, tmp_path):
        mock_vs = MagicMock()
        mock_vs.db_path = str(tmp_path / "vs.db")
        # Create real sqlite db for vector_search._get_connection()
        vs_db = str(tmp_path / "vs_items.db")
        conn = sqlite3.connect(vs_db)
        conn.row_factory = sqlite3.Row
        conn.execute("CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, content TEXT, metadata TEXT, type TEXT)")
        conn.commit()
        mock_vs._get_connection.return_value = conn

        s = CoreMemoryStore(vector_search=mock_vs, db_path=str(tmp_path / "cm.db"))
        m = s.upsert(content="vector test", memory_id="v1", importance=0.9)
        assert m.id == "v1"
        assert m.importance == 0.9
        mock_vs.upsert_vector.assert_called_once()
        conn.close()

    def test_upsert_updates_existing(self, tmp_path):
        mock_vs = MagicMock()
        # Create real sqlite db for vector_search._get_connection()
        vs_db = str(tmp_path / "vs_items2.db")

        def make_conn():
            c = sqlite3.connect(vs_db)
            c.row_factory = sqlite3.Row
            return c

        # Init the table
        c = make_conn()
        c.execute("CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, content TEXT, metadata TEXT, type TEXT)")
        c.commit()
        c.close()

        mock_vs._get_connection.side_effect = lambda: make_conn()

        s = CoreMemoryStore(vector_search=mock_vs, db_path=str(tmp_path / "cm2.db"))
        s.upsert(content="v1", memory_id="u1")
        s.upsert(content="v2", memory_id="u1")
        assert mock_vs.upsert_vector.call_count == 2

    def test_archive_with_vector_search(self, tmp_path):
        """Test archive() with a real-ish vector_search mock."""
        vs_db = str(tmp_path / "arc_vs.db")
        mock_vs = MagicMock()

        def make_conn():
            c = sqlite3.connect(vs_db)
            c.row_factory = sqlite3.Row
            return c

        # Init the items table with a record
        c = make_conn()
        c.execute("CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, content TEXT, metadata TEXT, type TEXT)")
        c.execute("INSERT INTO items VALUES (?, ?, ?, ?)", ("ar1", "text", json.dumps({"archived": False}), "memory"))
        c.commit()
        c.close()

        mock_vs._get_connection.side_effect = lambda: make_conn()
        mock_vs.db_path = vs_db

        s = CoreMemoryStore(vector_search=mock_vs, db_path=str(tmp_path / "cm_arc.db"))
        s.upsert_memory(content="text", memory_id="ar1")
        result = s.archive("ar1")
        assert result is True

    def test_delete_with_vector_search(self, tmp_path):
        mock_vs = MagicMock()
        s = CoreMemoryStore(vector_search=mock_vs, db_path=str(tmp_path / "cm_del.db"))
        result = s.delete("d1")
        assert result is True
        mock_vs.delete_vector.assert_called_once_with("d1")

    def test_init_from_vector_search_path(self, tmp_path):
        mock_vs = MagicMock()
        mock_vs.db_path = str(tmp_path / "from_vs.db")
        s = CoreMemoryStore(vector_search=mock_vs)
        assert str(tmp_path / "from_vs.db") in s._db_path

    def test_ensure_core_columns_idempotent(self, store):
        store._init_schema()
        m = store.upsert_memory(content="still works", memory_id="ec1")
        assert m.content == "still works"

    def test_upsert_memory_with_summary(self, store):
        m = store.upsert_memory(content="text", memory_id="sm1", summary="short summary")
        assert m.summary == "short summary"

    def test_upsert_memory_positional_args(self, store):
        """Test legacy positional arg style: upsert_memory(id, content, summary, archived)."""
        m = store.upsert_memory("pos1", "positional content", "pos summary", False)
        assert m.id == "pos1"
        assert m.content == "positional content"
        assert m.summary == "pos summary"

    def test_get_core_connection(self, store):
        conn = store._get_core_connection()
        assert conn is not None
        conn.close()
