"""
Core Memory Store Tests

Tests for CoreMemory data model and CoreMemoryStore SQLite-only operations.
Tests cover upsert_memory, get_memory, get_memories, archive_memory,
delete_memory, search_memories (SQLite fallback), generate_summary,
_default_summary, _parse_metadata, and list_all.
"""

import pytest
import time
from pathlib import Path
from unittest.mock import MagicMock
from src.memory.core_memory_store import (
    CoreMemory,
    CoreMemoryStore,
)


# ============================================================
# CoreMemory Data Model Tests
# ============================================================

class TestCoreMemory:

    def test_defaults(self):
        m = CoreMemory(id="m1", content="test")
        assert m.summary is None
        assert m.archived is False
        assert m.importance == 0.5
        assert m.access_count == 0
        assert m.metadata == {}

    def test_to_dict(self):
        m = CoreMemory(
            id="m1",
            content="test content",
            summary="short",
            importance=0.8,
        )
        d = m.to_dict()
        assert d["id"] == "m1"
        assert d["content"] == "test content"
        assert d["summary"] == "short"
        assert d["importance"] == 0.8

    def test_from_dict(self):
        data = {
            "id": "m1",
            "content": "test",
            "summary": "short",
            "archived": False,
            "created_at": 100.0,
            "updated_at": 200.0,
            "metadata": {},
        }
        m = CoreMemory.from_dict(data)
        assert m.id == "m1"
        assert m.importance == 0.5  # default
        assert m.access_count == 0  # default

    def test_from_dict_with_all_fields(self):
        data = {
            "id": "m1",
            "content": "test",
            "summary": None,
            "archived": True,
            "created_at": 100.0,
            "updated_at": 200.0,
            "metadata": {"key": "val"},
            "importance": 0.9,
            "access_count": 5,
        }
        m = CoreMemory.from_dict(data)
        assert m.importance == 0.9
        assert m.access_count == 5
        assert m.archived is True

    def test_roundtrip(self):
        original = CoreMemory(
            id="m1",
            content="hello",
            summary="hi",
            importance=0.7,
            metadata={"tag": "test"},
        )
        d = original.to_dict()
        restored = CoreMemory.from_dict(d)
        assert restored.id == original.id
        assert restored.content == original.content
        assert restored.importance == original.importance


# ============================================================
# CoreMemoryStore SQLite-Only Tests
# ============================================================

class TestCoreMemoryStore:

    @pytest.fixture(autouse=True)
    def setup(self, tmp_path):
        db_path = str(tmp_path / "test_core.db")
        self.store = CoreMemoryStore(
            vector_search=None,
            db_path=db_path,
        )

    def test_upsert_memory_new(self):
        m = self.store.upsert_memory(
            content="Hello world",
            memory_id="m1",
        )
        assert m.id == "m1"
        assert m.content == "Hello world"
        assert m.archived is False

    def test_upsert_memory_auto_id(self):
        m = self.store.upsert_memory(content="Hello world")
        assert m.id is not None
        assert len(m.id) > 0

    def test_upsert_memory_update(self):
        self.store.upsert_memory(content="v1", memory_id="m1")
        m = self.store.upsert_memory(content="v2", memory_id="m1")
        assert m.content == "v2"

    def test_upsert_memory_with_summary(self):
        m = self.store.upsert_memory(
            content="long content",
            memory_id="m1",
            summary="short",
        )
        assert m.summary == "short"

    def test_upsert_memory_with_metadata(self):
        m = self.store.upsert_memory(
            content="test",
            memory_id="m1",
            metadata={"key": "val"},
        )
        assert m.metadata == {"key": "val"}

    def test_upsert_memory_positional_args(self):
        m = self.store.upsert_memory("m1", "content here", "summary", False)
        assert m.id == "m1"
        assert m.content == "content here"
        assert m.summary == "summary"

    def test_get_memory(self):
        self.store.upsert_memory(content="Hello", memory_id="m1")
        m = self.store.get_memory("m1")
        assert m is not None
        assert m.content == "Hello"

    def test_get_memory_not_found(self):
        m = self.store.get_memory("nonexistent")
        assert m is None

    def test_get_sqlite_only(self):
        self.store.upsert_memory(content="Hello", memory_id="m1")
        m = self.store.get("m1")
        assert m is not None
        assert m.content == "Hello"

    def test_get_not_found(self):
        m = self.store.get("nonexistent")
        assert m is None

    def test_get_with_access_tracking(self):
        self.store.upsert_memory(content="Hello", memory_id="m1")
        m = self.store.get("m1", track_access=True)
        assert m.access_count == 1

    def test_get_memories(self):
        self.store.upsert_memory(content="m1", memory_id="m1")
        self.store.upsert_memory(content="m2", memory_id="m2")
        memories = self.store.get_memories()
        assert len(memories) == 2

    def test_get_memories_exclude_archived(self):
        self.store.upsert_memory(content="m1", memory_id="m1")
        self.store.upsert_memory(content="m2", memory_id="m2", archived=True)
        memories = self.store.get_memories(include_archived=False)
        assert len(memories) == 1

    def test_get_memories_include_archived(self):
        self.store.upsert_memory(content="m1", memory_id="m1")
        self.store.upsert_memory(content="m2", memory_id="m2", archived=True)
        memories = self.store.get_memories(include_archived=True)
        assert len(memories) == 2

    def test_get_memories_limit(self):
        for i in range(5):
            self.store.upsert_memory(content=f"m{i}", memory_id=f"m{i}")
        memories = self.store.get_memories(limit=2)
        assert len(memories) == 2

    def test_archive_memory(self):
        self.store.upsert_memory(content="test", memory_id="m1")
        result = self.store.archive_memory("m1")
        assert result is True
        m = self.store.get_memory("m1")
        assert m.archived is True

    def test_delete_memory(self):
        self.store.upsert_memory(content="test", memory_id="m1")
        result = self.store.delete_memory("m1")
        assert result is True
        m = self.store.get_memory("m1")
        assert m is None

    def test_search_memories_sqlite(self):
        self.store.upsert_memory(
            content="The hero fought bravely in the arena",
            memory_id="m1",
        )
        self.store.upsert_memory(
            content="The villain escaped through the tunnel",
            memory_id="m2",
        )
        results = self.store.search_memories("hero")
        assert len(results) >= 1
        assert results[0].content == "The hero fought bravely in the arena"

    def test_search_memories_no_match(self):
        self.store.upsert_memory(content="Some content", memory_id="m1")
        results = self.store.search_memories("nonexistent")
        assert len(results) == 0

    def test_search_memories_empty_query(self):
        results = self.store.search_memories("")
        assert len(results) == 0

    def test_search_memories_exclude_archived(self):
        self.store.upsert_memory(
            content="hero content",
            memory_id="m1",
            archived=True,
        )
        results = self.store.search_memories("hero", include_archived=False)
        assert len(results) == 0

    def test_generate_summary_fallback(self):
        self.store.upsert_memory(
            content="A very long content string that needs summarization",
            memory_id="m1",
        )
        summary = self.store.generate_summary("m1")
        assert len(summary) > 0

    def test_generate_summary_not_found(self):
        summary = self.store.generate_summary("nonexistent")
        assert summary == ""

    def test_generate_summary_cached(self):
        self.store.upsert_memory(
            content="test",
            memory_id="m1",
            summary="existing summary",
        )
        summary = self.store.generate_summary("m1")
        assert summary == "existing summary"

    def test_generate_summary_force(self):
        self.store.upsert_memory(
            content="New content to summarize",
            memory_id="m1",
            summary="old summary",
        )
        summary = self.store.generate_summary("m1", force=True)
        # Should regenerate (fallback to content[:120])
        assert summary != "old summary"

    def test_generate_summary_with_tool(self):
        self.store.upsert_memory(
            content="Content for tool",
            memory_id="m1",
        )
        mock_tool = MagicMock()
        mock_tool.summarize = MagicMock(return_value="Tool summary")
        summary = self.store.generate_summary("m1", tool=mock_tool)
        assert summary == "Tool summary"

    def test_generate_summary_bool_force_compat(self):
        """Test legacy call pattern: generate_summary(id, True)"""
        self.store.upsert_memory(
            content="Content to resummarize",
            memory_id="m1",
            summary="old",
        )
        summary = self.store.generate_summary("m1", True)
        # force=True means regenerate
        assert summary != "old"

    def test_default_summary_short(self):
        result = self.store._default_summary("Short sentence.")
        assert result == "Short sentence."

    def test_default_summary_long(self):
        content = "A" * 300
        result = self.store._default_summary(content, max_length=200)
        assert len(result) <= 200
        assert result.endswith("...")

    def test_parse_metadata_valid(self):
        result = self.store._parse_metadata('{"key": "val"}')
        assert result == {"key": "val"}

    def test_parse_metadata_invalid(self):
        result = self.store._parse_metadata("not json")
        assert result == {}

    def test_parse_metadata_none(self):
        result = self.store._parse_metadata(None)
        assert result == {}

    def test_parse_metadata_empty(self):
        result = self.store._parse_metadata("")
        assert result == {}

    def test_list_all_sqlite(self):
        self.store.upsert_memory(content="m1", memory_id="m1")
        self.store.upsert_memory(content="m2", memory_id="m2")
        memories = self.store.list_all()
        assert len(memories) == 2

    def test_upsert_memory_preserves_created_at(self):
        """Update should preserve original created_at."""
        self.store.upsert_memory(content="v1", memory_id="m1")
        m1 = self.store.get_memory("m1")
        original_created = m1.created_at

        self.store.upsert_memory(content="v2", memory_id="m1")
        m2 = self.store.get_memory("m1")
        assert m2.created_at == original_created
        assert m2.content == "v2"
