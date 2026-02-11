# -*- coding: utf-8 -*-
"""
AgentKnowledgeLayer Tests

Tests for graph schema init, add_entity, add_relation, get_neighbors,
add_document, sync_file, sync_directory.
"""

import json
import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch
from src.services.knowledge_layer import AgentKnowledgeLayer


# ============================================================
# Init & Schema
# ============================================================

class TestKnowledgeLayerInit:

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
        d = tmp_path / "citations"
        d.mkdir()
        f = d / "ref.md"
        f.write_text("Citation content", encoding="utf-8")
        result = kl.sync_file(str(f))
        assert result["success"] is True
        assert "citation" in result["message"]

    def test_sync_memory_type(self, kl, tmp_path):
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
        kl.add_entity("e1", "李明", "Character", "勇敢的战士")

        results = kl.query_hybrid("李明")
        assert "entities" in results
        assert "chunks" in results

    def test_with_entity_filter(self, tmp_path):
        kl = AgentKnowledgeLayer(db_path=str(tmp_path / "kl.db"))
        kl.add_entity("e1", "Alice", "Character")
        kl.add_entity("e2", "Bob", "Character")

        results = kl.query_hybrid("test", entity_filter=["e1", "e2"])
        entity_ids = [e["id"] for e in results["entities"]]
        assert "e1" in entity_ids
        assert "e2" in entity_ids
