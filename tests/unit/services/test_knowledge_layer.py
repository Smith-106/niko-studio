# -*- coding: utf-8 -*-
"""
AgentKnowledgeLayer Tests

Tests for graph schema init, add_entity, add_relation, get_neighbors,
add_document, sync_file, sync_directory.
"""

import json
import importlib
import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch
import src.services.knowledge_layer as knowledge_layer_module
from src.services.knowledge_layer import AgentKnowledgeLayer


# ============================================================
# Init & Schema
# ============================================================

class TestKnowledgeLayerInit:

    def test_module_watchdog_importerror_branch(self):
        import builtins

        real_import = builtins.__import__

        def fake_import(name, *args, **kwargs):
            if name.startswith("watchdog"):
                raise ImportError("no watchdog")
            return real_import(name, *args, **kwargs)

        with patch("builtins.__import__", side_effect=fake_import):
            module = importlib.reload(knowledge_layer_module)

        assert module.WATCHDOG_AVAILABLE is False

    def test_init_creates_db(self, tmp_path):
        db = str(tmp_path / "kl.db")
        kl = AgentKnowledgeLayer(db_path=db)
        assert Path(db).exists()

    def test_init_creates_tables(self, tmp_path):
        import sqlite3
        db = str(tmp_path / "kl.db")
        kl = AgentKnowledgeLayer(db_path=db)
        conn = sqlite3.connect(db)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = {r[0] for r in cursor.fetchall()}
        conn.close()
        assert "entities" in tables
        assert "relations" in tables
        assert "provenance" in tables


# ============================================================
# Entity CRUD
# ============================================================

class TestKnowledgeLayerEntity:

    @pytest.fixture
    def kl(self, tmp_path):
        return AgentKnowledgeLayer(db_path=str(tmp_path / "kl.db"))

    def test_add_entity(self, kl):
        kl.add_entity("e1", "Alice", "Character", "主角")
        import sqlite3
        conn = sqlite3.connect(str(kl.db_path))
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT * FROM entities WHERE id = ?", ("e1",)).fetchone()
        conn.close()
        assert row is not None
        assert row["name"] == "Alice"
        assert row["type"] == "Character"

    def test_add_entity_with_props(self, kl):
        kl.add_entity("e2", "Bob", "Character", props={"age": 30})
        import sqlite3
        conn = sqlite3.connect(str(kl.db_path))
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT * FROM entities WHERE id = ?", ("e2",)).fetchone()
        conn.close()
        props = json.loads(row["properties"])
        assert props["age"] == 30

    def test_add_entity_upsert(self, kl):
        kl.add_entity("e1", "Alice", "Character")
        kl.add_entity("e1", "Alice Updated", "Character")
        import sqlite3
        conn = sqlite3.connect(str(kl.db_path))
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT * FROM entities WHERE id = ?", ("e1",)).fetchone()
        conn.close()
        assert row["name"] == "Alice Updated"


# ============================================================
# Relation CRUD
# ============================================================

class TestKnowledgeLayerRelation:

    @pytest.fixture
    def kl(self, tmp_path):
        k = AgentKnowledgeLayer(db_path=str(tmp_path / "kl.db"))
        k.add_entity("e1", "Alice", "Character")
        k.add_entity("e2", "Bob", "Character")
        return k

    def test_add_relation(self, kl):
        kl.add_relation("e1", "e2", "KNOWS")
        import sqlite3
        conn = sqlite3.connect(str(kl.db_path))
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT * FROM relations WHERE source_id = ?", ("e1",)).fetchone()
        conn.close()
        assert row is not None
        assert row["type"] == "KNOWS"
        assert row["target_id"] == "e2"

    def test_add_relation_with_props(self, kl):
        kl.add_relation("e1", "e2", "FRIEND", props={"since": "childhood"})
        import sqlite3
        conn = sqlite3.connect(str(kl.db_path))
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT * FROM relations WHERE source_id = ?", ("e1",)).fetchone()
        conn.close()
        props = json.loads(row["properties"])
        assert props["since"] == "childhood"

    def test_relation_id_format(self, kl):
        kl.add_relation("e1", "e2", "KNOWS")
        import sqlite3
        conn = sqlite3.connect(str(kl.db_path))
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT id FROM relations LIMIT 1").fetchone()
        conn.close()
        assert row["id"] == "e1-KNOWS-e2"


# ============================================================
# get_neighbors
# ============================================================

class TestGetNeighbors:

    def test_basic(self, tmp_path):
        kl = AgentKnowledgeLayer(db_path=str(tmp_path / "kl.db"))
        kl.add_entity("e1", "Alice", "Character", "主角")
        kl.add_entity("e2", "Bob", "Character", "配角")
        kl.add_relation("e1", "e2", "KNOWS")

        neighbors = kl.get_neighbors("e1")
        assert len(neighbors) == 1
        assert neighbors[0]["target_name"] == "Bob"
        assert neighbors[0]["rel_type"] == "KNOWS"

    def test_no_neighbors(self, tmp_path):
        kl = AgentKnowledgeLayer(db_path=str(tmp_path / "kl.db"))
        kl.add_entity("e1", "Alice", "Character")
        neighbors = kl.get_neighbors("e1")
        assert neighbors == []

    def test_multiple_neighbors(self, tmp_path):
        kl = AgentKnowledgeLayer(db_path=str(tmp_path / "kl.db"))
        kl.add_entity("e1", "Alice", "Character")
        kl.add_entity("e2", "Bob", "Character")
        kl.add_entity("e3", "Carol", "Character")
        kl.add_relation("e1", "e2", "KNOWS")
        kl.add_relation("e1", "e3", "LOVES")
        neighbors = kl.get_neighbors("e1")
        assert len(neighbors) == 2


# ============================================================
# sync_file
# ============================================================

class TestSyncFile:

    @pytest.fixture
    def kl(self, tmp_path):
        return AgentKnowledgeLayer(db_path=str(tmp_path / "kl.db"))

    def test_sync_existing_file(self, kl, tmp_path):
        kl.add_document = MagicMock()
        f = tmp_path / "doc.md"
        f.write_text("# Test Document", encoding="utf-8")
        result = kl.sync_file(str(f))
        assert result["success"] is True
        assert result["action"] == "synced"
        assert "content_hash" in result

    def test_sync_nonexistent_file(self, kl):
        result = kl.sync_file("/nonexistent/file.md")
        assert result["success"] is False
        assert result["action"] == "error"

    def test_sync_citation_type(self, kl, tmp_path):
        kl.add_document = MagicMock()
        d = tmp_path / "citations"
        d.mkdir()
        f = d / "ref.md"
        f.write_text("Citation content", encoding="utf-8")
        result = kl.sync_file(str(f))
        assert result["success"] is True
        assert "citation" in result["message"]

    def test_sync_memory_type(self, kl, tmp_path):
        kl.add_document = MagicMock()
        d = tmp_path / "memories"
        d.mkdir()
        f = d / "mem.md"
        f.write_text("Memory content", encoding="utf-8")
        result = kl.sync_file(str(f))
        assert result["success"] is True
        assert "memory" in result["message"]


# ============================================================
# sync_directory
# ============================================================

class TestSyncDirectory:

    def test_sync_directory(self, tmp_path):
        kl = AgentKnowledgeLayer(db_path=str(tmp_path / "kl.db"))
        d = tmp_path / "docs"
        d.mkdir()
        (d / "a.md").write_text("Doc A", encoding="utf-8")
        (d / "b.txt").write_text("Doc B", encoding="utf-8")
        (d / "c.py").write_text("code", encoding="utf-8")

        results = kl.sync_directory(str(d))
        synced_paths = [r["path"] for r in results]
        assert any("a.md" in p for p in synced_paths)
        assert any("b.txt" in p for p in synced_paths)
        assert not any("c.py" in p for p in synced_paths)

    def test_sync_directory_nonexistent(self, tmp_path):
        kl = AgentKnowledgeLayer(db_path=str(tmp_path / "kl.db"))
        results = kl.sync_directory("/nonexistent/dir")
        assert results == []

    def test_sync_directory_custom_patterns(self, tmp_path):
        kl = AgentKnowledgeLayer(db_path=str(tmp_path / "kl.db"))
        d = tmp_path / "src"
        d.mkdir()
        (d / "a.py").write_text("code", encoding="utf-8")
        (d / "b.md").write_text("doc", encoding="utf-8")

        results = kl.sync_directory(str(d), patterns=["*.py"])
        assert len(results) == 1
        assert "a.py" in results[0]["path"]


# ============================================================
# query_hybrid
# ============================================================

class TestQueryHybrid:

    def test_basic_query(self, tmp_path):
        kl = AgentKnowledgeLayer(db_path=str(tmp_path / "kl.db"))
        kl.vector_store.search = MagicMock(return_value=[])
        kl.add_entity("e1", "李明", "Character", "勇敢的战士")

        results = kl.query_hybrid("李明")
        assert "entities" in results
        assert "chunks" in results

    def test_with_entity_filter(self, tmp_path):
        kl = AgentKnowledgeLayer(db_path=str(tmp_path / "kl.db"))
        kl.vector_store.search = MagicMock(return_value=[])
        kl.add_entity("e1", "Alice", "Character")
        kl.add_entity("e2", "Bob", "Character")

        results = kl.query_hybrid("test", entity_filter=["e1", "e2"])
        entity_ids = [e["id"] for e in results["entities"]]
        assert "e1" in entity_ids
        assert "e2" in entity_ids


class TestKnowledgeLayerExtraBranches:

    def test_init_backfills_fts_when_entities_exist(self, tmp_path):
        import sqlite3

        db = str(tmp_path / "kl-backfill.db")
        AgentKnowledgeLayer(db_path=db)

        conn = sqlite3.connect(db)
        conn.execute(
            """
            INSERT INTO entities (id, name, type, description, properties, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            ("e1", "Alice", "Character", "", "{}", 0.0),
        )
        conn.execute("DELETE FROM entities_fts")
        conn.commit()
        conn.close()

        AgentKnowledgeLayer(db_path=db)

        conn = sqlite3.connect(db)
        row = conn.execute(
            "SELECT entity_id, name FROM entities_fts WHERE entity_id = ?",
            ("e1",),
        ).fetchone()
        conn.close()

        assert row is not None
        assert row[1] == "Alice"

    def test_init_backfill_exception_logs_warning(self, tmp_path):
        import sqlite3

        class FakeCursor:
            def execute(self, sql, params=()):
                if "SELECT count(*) FROM entities" in sql:
                    raise RuntimeError("count failed")
                return self

            def fetchone(self):
                return (0,)

        fake_conn = MagicMock()
        fake_conn.cursor.return_value = FakeCursor()

        with patch("src.services.knowledge_layer.sqlite3.connect", return_value=fake_conn):
            with patch("src.services.knowledge_layer.IndexingService", return_value=MagicMock()):
                with patch("src.services.knowledge_layer.logger.warning") as warning:
                    AgentKnowledgeLayer(db_path=str(tmp_path / "kl.db"))

        warning.assert_any_call("Failed to populate FTS (schema might be initializing): count failed")

    def test_query_hybrid_fts_operational_error_fallback(self, tmp_path):
        kl = AgentKnowledgeLayer(db_path=str(tmp_path / "kl.db"))
        kl.vector_store.search = MagicMock(return_value=[])

        import sqlite3

        class FakeCursor:
            def __init__(self):
                self._last_sql = ""

            def execute(self, sql, params=()):
                self._last_sql = sql
                if "MATCH" in sql:
                    raise sqlite3.OperationalError("bad fts")
                return self

            def fetchall(self):
                if "instr(lower(?), lower(name))" in self._last_sql:
                    return [{"id": "e1", "name": "Alice", "type": "Character"}]
                return []

        fake_conn = MagicMock()
        fake_conn.row_factory = sqlite3.Row
        fake_conn.cursor.return_value = FakeCursor()

        with patch("src.services.knowledge_layer.sqlite3.connect", return_value=fake_conn):
            results = kl.query_hybrid("Alice")

        assert any(e["id"] == "e1" for e in results["entities"])

    def test_query_hybrid_empty_tokens_branch(self, tmp_path):
        kl = AgentKnowledgeLayer(db_path=str(tmp_path / "kl.db"))
        kl.vector_store.search = MagicMock(return_value=[])
        kl.add_entity("e1", "Alice", "Character")

        results = kl.query_hybrid("!!!")
        assert "entities" in results

    def test_sync_file_exception_branch(self, tmp_path):
        kl = AgentKnowledgeLayer(db_path=str(tmp_path / "kl.db"))
        f = tmp_path / "doc.md"
        f.write_text("content", encoding="utf-8")

        with patch("builtins.open", side_effect=RuntimeError("boom")):
            result = kl.sync_file(str(f))

        assert result["success"] is False
        assert result["action"] == "error"

    def test_create_file_watcher_import_error_when_watchdog_missing(self, tmp_path):
        kl = AgentKnowledgeLayer(db_path=str(tmp_path / "kl.db"))

        with patch("src.services.knowledge_layer.WATCHDOG_AVAILABLE", False):
            with pytest.raises(ImportError, match="watchdog not installed"):
                kl.create_file_watcher()

    def test_create_file_watcher_callback_skips_deleted_events(self, tmp_path):
        kl = AgentKnowledgeLayer(db_path=str(tmp_path / "kl.db"))
        fake_watcher = MagicMock()

        class Event:
            def __init__(self, event_type, path):
                self.event_type = event_type
                self.path = path

        with patch("src.services.knowledge_layer.WATCHDOG_AVAILABLE", True):
            with patch("src.services.file_sync.FileWatcher", return_value=fake_watcher):
                with patch.object(kl, "sync_file") as sync_file:
                    kl.create_file_watcher()

                    callback = fake_watcher.on_change.call_args[0][0]
                    callback(Event("deleted", "/tmp/deleted.md"))
                    sync_file.assert_not_called()

                    callback(Event("modified", "/tmp/changed.md"))
                    sync_file.assert_called_once_with("/tmp/changed.md")

    def test_create_file_watcher_with_watch_dirs(self, tmp_path):
        kl = AgentKnowledgeLayer(db_path=str(tmp_path / "kl.db"))
        fake_watcher = MagicMock()

        with patch("src.services.knowledge_layer.WATCHDOG_AVAILABLE", True):
            with patch("src.services.file_sync.FileWatcher", return_value=fake_watcher):
                watcher = kl.create_file_watcher(watch_dirs=["d1", "d2"])

        assert watcher is fake_watcher
        assert fake_watcher.watch.call_count == 2
