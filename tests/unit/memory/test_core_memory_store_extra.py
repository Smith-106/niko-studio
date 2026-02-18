# -*- coding: utf-8 -*-
"""CoreMemoryStore tests - CoreMemory dataclass, CRUD, search, archive, access tracking."""

import pytest
import time
import json
import sqlite3
from pathlib import Path
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



class TestCoreMemoryStoreAdditionalBranches:
    @pytest.fixture()
    def store(self, tmp_path):
        return CoreMemoryStore(db_path=str(tmp_path / "core_extra.db"))

    def test_init_uses_default_path_without_vector_search(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        store = CoreMemoryStore()
        assert Path(store._db_path).as_posix().endswith(".writing/core_memory.db")

    def test_upsert_memory_legacy_content_first_signature(self, store):
        m = store.upsert_memory("sentence with spaces", "legacy-id")
        assert m.id == "legacy-id"
        assert m.content == "sentence with spaces"

    def test_upsert_memory_requires_content(self, store):
        with pytest.raises(ValueError, match="content is required"):
            store.upsert_memory(memory_id="only-id")

    def test_upsert_memory_wraps_non_dict_metadata(self, store):
        m = store.upsert_memory(content="meta", memory_id="md1", metadata="raw")
        assert m.metadata == {"value": "raw"}

    def test_generate_summary_with_callable_tool(self, store):
        store.upsert_memory(content="callable summary content", memory_id="sum-call")
        summary = store.generate_summary("sum-call", tool=lambda text: text[:8])
        assert summary == "callable"

    def test_generate_summary_tool_failure_falls_back_to_default(self, store):
        store.upsert_memory(content="fallback text", memory_id="sum-fallback")

        def broken(_):
            raise RuntimeError("boom")

        summary = store.generate_summary("sum-fallback", tool=broken)
        assert summary == "fallback text"

    def test_generate_summary_summary_generator_failure_falls_back(self, tmp_path):
        def broken(_):
            raise RuntimeError("boom")

        s = CoreMemoryStore(db_path=str(tmp_path / "sg.db"), summary_generator=broken)
        s.upsert_memory(content="x" * 140, memory_id="sg1")
        summary = s.generate_summary("sg1")
        assert len(summary) == 120

    def test_generate_summary_vector_update_failure_sets_pending(self, tmp_path):
        mock_vs = MagicMock()
        mock_vs.db_path = str(tmp_path / "vs.db")

        conn = sqlite3.connect(str(tmp_path / "items.db"))
        conn.row_factory = sqlite3.Row
        conn.execute("CREATE TABLE items (id TEXT PRIMARY KEY, content TEXT, metadata TEXT, type TEXT)")
        conn.execute(
            "INSERT INTO items VALUES (?, ?, ?, ?)",
            ("m1", "content", json.dumps({"archived": False}), "memory"),
        )
        conn.commit()
        conn.close()

        def make_conn():
            c = sqlite3.connect(str(tmp_path / "items.db"))
            c.row_factory = sqlite3.Row
            return c

        mock_vs._get_connection.side_effect = make_conn
        s = CoreMemoryStore(vector_search=mock_vs, db_path=str(tmp_path / "core.db"))
        s.upsert_memory(content="content", memory_id="m1")

        with patch.object(s, "_update_vector_summary", side_effect=RuntimeError("fail")):
            s.generate_summary("m1", force=True)

        conn2 = s._get_core_connection()
        row = conn2.execute(
            "SELECT pending_vector_sync FROM core_memories WHERE id = ?", ("m1",)
        ).fetchone()
        conn2.close()
        assert row["pending_vector_sync"] == 1

    def test_archive_memory_vector_failure_returns_false(self, tmp_path):
        mock_vs = MagicMock()
        mock_vs.db_path = str(tmp_path / "vs_arc.db")
        s = CoreMemoryStore(vector_search=mock_vs, db_path=str(tmp_path / "core_arc.db"))
        s.upsert_memory(content="arc", memory_id="a1")

        with patch.object(s, "archive", return_value=False):
            assert s.archive_memory("a1") is False

    def test_delete_memory_vector_failure_returns_false(self, tmp_path):
        mock_vs = MagicMock()
        mock_vs.db_path = str(tmp_path / "vs_del.db")
        s = CoreMemoryStore(vector_search=mock_vs, db_path=str(tmp_path / "core_del.db"))
        s.upsert_memory(content="del", memory_id="d1")

        mock_vs.delete_vector.side_effect = RuntimeError("fail")
        assert s.delete_memory("d1") is False

    def test_default_summary_returns_unmodified_when_short_no_period(self, store):
        assert store._default_summary("short") == "short."



class TestCoreMemoryStoreHighGapBranches:
    @pytest.fixture()
    def store(self, tmp_path):
        return CoreMemoryStore(db_path=str(tmp_path / "core_high_gap.db"))

    def _make_vector_conn_factory(self, db_path):
        def make_conn():
            c = sqlite3.connect(str(db_path))
            c.row_factory = sqlite3.Row
            return c

        return make_conn

    def _init_items_table(self, db_path):
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        conn.execute("CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, content TEXT, metadata TEXT, type TEXT)")
        conn.commit()
        conn.close()

    def test_init_schema_migrates_legacy_core_table(self, tmp_path):
        db = tmp_path / "legacy_core.db"
        conn = sqlite3.connect(str(db))
        conn.row_factory = sqlite3.Row
        conn.execute(
            """
            CREATE TABLE core_memories (
                id TEXT PRIMARY KEY,
                content TEXT,
                summary TEXT,
                archived INTEGER NOT NULL DEFAULT 0
            )
            """
        )
        conn.execute(
            "INSERT INTO core_memories (id, content, summary, archived) VALUES (?, ?, ?, ?)",
            ("m1", "legacy", None, 0),
        )
        conn.commit()
        conn.close()

        store = CoreMemoryStore(db_path=str(db))
        row = store._get_core_connection().execute(
            "SELECT created_at, updated_at, metadata, importance, access_count, pending_vector_sync FROM core_memories WHERE id = ?",
            ("m1",),
        ).fetchone()

        assert row["created_at"] == 0
        assert row["updated_at"] == 0
        assert row["metadata"] == "{}"
        assert row["importance"] == 0.5
        assert row["access_count"] == 0
        assert row["pending_vector_sync"] == 0

    def test_upsert_memory_positional_non_string_id_branch(self, store):
        m = store.upsert_memory(123, "numeric id content", "s", True)
        assert m.id == 123
        assert m.archived is True

    def test_upsert_memory_single_arg_branch(self, store):
        m = store.upsert_memory("single arg content", summary="s1", archived=True, metadata={"t": 1})
        assert m.content == "single arg content"
        assert m.summary == "s1"
        assert m.archived is True
        assert m.metadata == {"t": 1}

    def test_upsert_memory_archived_vector_archive_failure_sets_pending(self, tmp_path):
        mock_vs = MagicMock()
        mock_vs.db_path = str(tmp_path / "vs_archive_fail.db")

        s = CoreMemoryStore(vector_search=mock_vs, db_path=str(tmp_path / "core_archive_fail.db"))
        with patch.object(s, "upsert", return_value=None), patch.object(s, "archive", return_value=False):
            s.upsert_memory(content="content", memory_id="m-arch", archived=True)

        row = s._get_core_connection().execute(
            "SELECT pending_vector_sync FROM core_memories WHERE id = ?",
            ("m-arch",),
        ).fetchone()
        assert row["pending_vector_sync"] == 1

    def test_get_memory_falls_back_to_vector_get(self, tmp_path):
        vs_db = tmp_path / "fallback_get.db"
        self._init_items_table(vs_db)
        conn = sqlite3.connect(str(vs_db))
        conn.row_factory = sqlite3.Row
        conn.execute(
            "INSERT INTO items VALUES (?, ?, ?, ?)",
            (
                "m1",
                "vector content",
                json.dumps({"summary": "sum", "archived": False, "extra": {"x": 1}}),
                "memory",
            ),
        )
        conn.commit()
        conn.close()

        mock_vs = MagicMock()
        mock_vs.db_path = str(vs_db)
        mock_vs._get_connection.side_effect = self._make_vector_conn_factory(vs_db)

        s = CoreMemoryStore(vector_search=mock_vs, db_path=str(tmp_path / "core_fallback_get.db"))
        got = s.get_memory("m1")
        assert got is not None
        assert got.content == "vector content"

    def test_get_vector_track_access_updates_both_storages(self, tmp_path):
        vs_db = tmp_path / "track_access.db"
        self._init_items_table(vs_db)
        conn = sqlite3.connect(str(vs_db))
        conn.row_factory = sqlite3.Row
        conn.execute(
            "INSERT INTO items VALUES (?, ?, ?, ?)",
            (
                "m2",
                "track me",
                json.dumps({"summary": None, "archived": False, "access_count": 0, "extra": {}}),
                "memory",
            ),
        )
        conn.commit()
        conn.close()

        mock_vs = MagicMock()
        mock_vs.db_path = str(vs_db)
        mock_vs._get_connection.side_effect = self._make_vector_conn_factory(vs_db)

        s = CoreMemoryStore(vector_search=mock_vs, db_path=str(tmp_path / "core_track_access.db"))
        with patch.object(s, "_update_access_count") as upd_vec, patch.object(s, "_update_sqlite_access_count") as upd_sqlite:
            mem = s.get("m2", track_access=True)

        assert mem is not None
        assert mem.access_count == 1
        upd_vec.assert_called_once_with("m2", 1)
        upd_sqlite.assert_called_once_with("m2", 1)

    def test_update_access_count_updates_vector_metadata(self, tmp_path):
        vs_db = tmp_path / "update_access.db"
        self._init_items_table(vs_db)
        conn = sqlite3.connect(str(vs_db))
        conn.row_factory = sqlite3.Row
        conn.execute(
            "INSERT INTO items VALUES (?, ?, ?, ?)",
            ("m3", "c", json.dumps({"access_count": 0}), "memory"),
        )
        conn.commit()
        conn.close()

        mock_vs = MagicMock()
        mock_vs.db_path = str(vs_db)
        mock_vs._get_connection.side_effect = self._make_vector_conn_factory(vs_db)

        s = CoreMemoryStore(vector_search=mock_vs, db_path=str(tmp_path / "core_update_access.db"))
        s._update_access_count("m3", 7)

        conn2 = sqlite3.connect(str(vs_db))
        conn2.row_factory = sqlite3.Row
        row = conn2.execute("SELECT metadata FROM items WHERE id = ?", ("m3",)).fetchone()
        conn2.close()
        assert json.loads(row["metadata"])["access_count"] == 7

    def test_update_vector_summary_updates_metadata(self, tmp_path):
        vs_db = tmp_path / "update_summary.db"
        self._init_items_table(vs_db)
        conn = sqlite3.connect(str(vs_db))
        conn.row_factory = sqlite3.Row
        conn.execute(
            "INSERT INTO items VALUES (?, ?, ?, ?)",
            ("m4", "c", json.dumps({"summary": "old"}), "memory"),
        )
        conn.commit()
        conn.close()

        mock_vs = MagicMock()
        mock_vs.db_path = str(vs_db)
        mock_vs._get_connection.side_effect = self._make_vector_conn_factory(vs_db)

        s = CoreMemoryStore(vector_search=mock_vs, db_path=str(tmp_path / "core_update_summary.db"))
        s._update_vector_summary("m4", "new summary")

        conn2 = sqlite3.connect(str(vs_db))
        conn2.row_factory = sqlite3.Row
        row = conn2.execute("SELECT metadata FROM items WHERE id = ?", ("m4",)).fetchone()
        conn2.close()
        meta = json.loads(row["metadata"])
        assert meta["summary"] == "new summary"
        assert "updated_at" in meta

    def test_search_memories_sqlite_science_fiction_alt_term(self, store):
        store.upsert_memory(content="classic sci-fi epic", memory_id="sf1")
        results = store.search_memories("science fiction", top_k=5)
        assert any(m.id == "sf1" for m in results)

    def test_search_memories_vector_success_and_archive_filter(self, tmp_path):
        mock_vs = MagicMock()
        mock_vs.db_path = str(tmp_path / "vs_search_success.db")
        mock_vs.search_memory_vectors.return_value = [
            {
                "id": "a1",
                "content": "archived",
                "metadata": {"archived": True, "summary": "s1", "extra": {}},
            },
            {
                "id": "v1",
                "content": "visible",
                "metadata": {"archived": False, "summary": "s2", "extra": {}},
            },
        ]

        s = CoreMemoryStore(vector_search=mock_vs, db_path=str(tmp_path / "core_search_success.db"))
        visible = s.search_memories("x", top_k=5, include_archived=False)
        all_items = s.search_memories("x", top_k=5, include_archived=True)

        assert [m.id for m in visible] == ["v1"]
        assert {m.id for m in all_items} == {"a1", "v1"}

    def test_archive_returns_false_when_memory_missing(self, tmp_path):
        mock_vs = MagicMock()
        mock_vs.db_path = str(tmp_path / "vs_archive_missing.db")
        s = CoreMemoryStore(vector_search=mock_vs, db_path=str(tmp_path / "core_archive_missing.db"))

        with patch.object(s, "get", return_value=None):
            assert s.archive("missing") is False

    def test_archive_returns_false_when_vector_row_missing(self, tmp_path):
        vs_db = tmp_path / "vs_archive_row_missing.db"
        self._init_items_table(vs_db)

        mock_vs = MagicMock()
        mock_vs.db_path = str(vs_db)
        mock_vs._get_connection.side_effect = self._make_vector_conn_factory(vs_db)

        s = CoreMemoryStore(vector_search=mock_vs, db_path=str(tmp_path / "core_archive_row_missing.db"))
        with patch.object(s, "get", return_value=CoreMemory(id="m5", content="c")):
            assert s.archive("m5") is False

    def test_archive_memory_success_clears_pending_with_vector(self, tmp_path):
        mock_vs = MagicMock()
        mock_vs.db_path = str(tmp_path / "vs_archive_ok.db")
        s = CoreMemoryStore(vector_search=mock_vs, db_path=str(tmp_path / "core_archive_ok.db"))
        s.upsert_memory(content="x", memory_id="ok1")

        with patch.object(s, "archive", return_value=True):
            assert s.archive_memory("ok1") is True

        row = s._get_core_connection().execute(
            "SELECT pending_vector_sync FROM core_memories WHERE id = ?",
            ("ok1",),
        ).fetchone()
        assert row["pending_vector_sync"] == 0

    def test_generate_summary_uses_vector_fallback_get_path(self, tmp_path):
        vs_db = tmp_path / "vs_summary_fallback.db"
        self._init_items_table(vs_db)
        conn = sqlite3.connect(str(vs_db))
        conn.row_factory = sqlite3.Row
        conn.execute(
            "INSERT INTO items VALUES (?, ?, ?, ?)",
            (
                "m6",
                "fallback get content for summary",
                json.dumps({"archived": False, "summary": None, "extra": {}}),
                "memory",
            ),
        )
        conn.commit()
        conn.close()

        mock_vs = MagicMock()
        mock_vs.db_path = str(vs_db)
        mock_vs._get_connection.side_effect = self._make_vector_conn_factory(vs_db)

        s = CoreMemoryStore(vector_search=mock_vs, db_path=str(tmp_path / "core_summary_fallback.db"))
        summary = s.generate_summary("m6", force=True)
        assert summary == "fallback get content for summary"

    def test_search_memories_vector_empty_fallback_uses_sqlite(self, tmp_path):
        mock_vs = MagicMock()
        mock_vs.db_path = str(tmp_path / "vs_empty_fallback.db")
        mock_vs.search_memory_vectors.return_value = []

        s = CoreMemoryStore(vector_search=mock_vs, db_path=str(tmp_path / "core_empty_fallback.db"))
        s.upsert_memory(content="fallback keyword content", memory_id="k1")

        results = s.search_memories("keyword", top_k=3)
        assert [m.id for m in results] == ["k1"]

    def test_generate_summary_bool_tool_compat(self, store):
        store.upsert_memory(content="compat content", memory_id="compat1", summary="old")
        summary = store.generate_summary("compat1", True)
        assert summary != "old"

    def test_default_summary_truncation_branch(self, store):
        content = "x" * 240
        summary = store._default_summary(content, max_length=60)
        assert summary.endswith("...")
        assert len(summary) <= 60

    def test_search_memories_sqlite_score_zero_branch_skipped(self, tmp_path):
        store = CoreMemoryStore(db_path=str(tmp_path / "score_zero.db"))
        store.upsert_memory(content="abc", memory_id="a1")

        class _CursorWrap:
            def __init__(self, base):
                self._base = base

            def execute(self, sql, params):
                replaced = list(params)
                if replaced:
                    replaced[0] = "%zzz%"
                return self._base.execute(sql, tuple(replaced))

            def fetchall(self):
                return self._base.fetchall()

            def __getattr__(self, name):
                return getattr(self._base, name)

        class _ConnWrap:
            def __init__(self, base):
                self._base = base

            def cursor(self):
                return _CursorWrap(self._base.cursor())

            def close(self):
                return self._base.close()

            def __getattr__(self, name):
                return getattr(self._base, name)

        with patch.object(store, "_get_core_connection", side_effect=lambda: _ConnWrap(sqlite3.connect(str(tmp_path / "score_zero.db")))):
            results = store._search_memories_sqlite("abc", top_k=5)

        assert results == []


    def test_update_vector_summary_no_vector_search_branch(self, store):
        store._update_vector_summary("missing", "summary")

    def test_search_memories_sqlite_empty_search_terms_branch(self, store):
        class _FakeDict:
            @staticmethod
            def fromkeys(_):
                return []

        with patch("src.memory.core_memory_store.dict", _FakeDict):
            assert store._search_memories_sqlite("query", top_k=3) == []

    def test_search_memories_sqlite_score_zero_continue_branch(self, store):
        class _Cursor:
            def execute(self, *_args, **_kwargs):
                return None

            def fetchall(self):
                return [
                    {
                        "id": "x1",
                        "content": "no overlap",
                        "summary": None,
                        "archived": 0,
                        "created_at": 0,
                        "updated_at": 0,
                        "metadata": "{}",
                        "importance": 0.5,
                        "access_count": 0,
                    }
                ]

        class _Conn:
            def cursor(self):
                return _Cursor()

            def close(self):
                return None

        with patch.object(store, "_get_core_connection", return_value=_Conn()):
            assert store._search_memories_sqlite("query", top_k=3) == []

    def test_search_memories_vector_exception_fallback_branch(self, tmp_path):
        mock_vs = MagicMock()
        mock_vs.db_path = str(tmp_path / "vs_search_exception.db")
        mock_vs.search_memory_vectors.side_effect = RuntimeError("boom")

        s = CoreMemoryStore(vector_search=mock_vs, db_path=str(tmp_path / "core_search_exception.db"))
        s.upsert_memory(content="fallback after exception", memory_id="e1")

        results = s.search_memories("fallback", top_k=3)
        assert [m.id for m in results] == ["e1"]

    def test_search_memories_vector_break_at_top_k(self, tmp_path):
        mock_vs = MagicMock()
        mock_vs.db_path = str(tmp_path / "vs_break.db")
        mock_vs.search_memory_vectors.return_value = [
            {"id": "m1", "content": "c1", "metadata": {"archived": False, "extra": {}}},
            {"id": "m2", "content": "c2", "metadata": {"archived": False, "extra": {}}},
        ]

        s = CoreMemoryStore(vector_search=mock_vs, db_path=str(tmp_path / "core_break.db"))
        results = s.search_memories("x", top_k=1)
        assert len(results) == 1
        assert results[0].id == "m1"

    def test_generate_summary_memory_fallback_to_get_branch(self, tmp_path):
        mock_vs = MagicMock()
        mock_vs.db_path = str(tmp_path / "vs_generate_fallback.db")
        s = CoreMemoryStore(vector_search=mock_vs, db_path=str(tmp_path / "core_generate_fallback.db"))

        with patch.object(s, "get_memory", return_value=None), patch.object(
            s,
            "get",
            return_value=CoreMemory(id="m-fallback", content="fallback body"),
        ):
            summary = s.generate_summary("m-fallback", force=True)

        assert summary == "fallback body"





    def test_default_summary_returns_content_final_branch(self, store):
        class _FirstSentence:
            def strip(self):
                return self

            def __len__(self):
                return 100

        class _Replaced:
            def split(self, _sep):
                return [_FirstSentence()]

        class _Content:
            def replace(self, *_args, **_kwargs):
                return _Replaced()

            def __len__(self):
                return 5

        content = _Content()
        result = store._default_summary(content, max_length=20)
        assert result is content

    def test_list_all_vector_branch_covers_rows_and_archive_filter(self, tmp_path):
        vs_db = tmp_path / "list_all_vector_branch.db"
        self._init_items_table(vs_db)
        conn = sqlite3.connect(str(vs_db))
        conn.row_factory = sqlite3.Row
        conn.execute(
            "INSERT INTO items VALUES (?, ?, ?, ?)",
            (
                "m1",
                "visible",
                json.dumps({
                    "archived": False,
                    "summary": "s1",
                    "created_at": 1,
                    "updated_at": 2,
                    "importance": 0.8,
                    "access_count": 4,
                    "extra": {"tag": "x"},
                }),
                "memory",
            ),
        )
        conn.execute(
            "INSERT INTO items VALUES (?, ?, ?, ?)",
            (
                "m2",
                "hidden",
                json.dumps({"archived": True, "summary": "s2", "extra": {}}),
                "memory",
            ),
        )
        conn.commit()
        conn.close()

        mock_vs = MagicMock()
        mock_vs.db_path = str(vs_db)
        mock_vs._get_connection.side_effect = self._make_vector_conn_factory(vs_db)

        s = CoreMemoryStore(vector_search=mock_vs, db_path=str(tmp_path / "core_list_all_branch.db"))

        visible = s.list_all(include_archived=False, limit=10)
        all_items = s.list_all(include_archived=True, limit=10)

        assert [m.id for m in visible] == ["m1"]
        assert {m.id for m in all_items} == {"m1", "m2"}
        assert visible[0].importance == 0.8
        assert visible[0].access_count == 4
        assert visible[0].metadata == {"tag": "x"}
