"""
Unit tests for MemoryManager - OpenKL temporal memory management.

Tests:
- by_date directory organization
- topics symlink mechanism
- YAML Frontmatter format
- CRUD operations
- Temporal facts retrieval
- MemoryService integration via adapter
"""

import json
import os
import shutil
import tempfile
from datetime import datetime, date, timedelta
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import yaml

from src.memory.memory_manager import (
    MemoryEntry,
    MemoryManager,
    MemoryManagerAdapter,
    get_memory_manager,
    reset_memory_manager,
)


class TestMemoryEntry:
    """Tests for MemoryEntry dataclass."""

    def test_default_values(self):
        """Test default field values."""
        entry = MemoryEntry(id="test-001", content="Test content")
        
        assert entry.id == "test-001"
        assert entry.content == "Test content"
        assert entry.topics == []
        assert entry.entity_id is None
        assert entry.importance == 0.5
        assert entry.source == "user"
        assert entry.metadata == {}
        assert entry.supersedes is None
        assert entry.superseded_by is None

    def test_to_yaml_frontmatter(self):
        """Test YAML frontmatter serialization."""
        entry = MemoryEntry(
            id="mem-001",
            content="This is the memory content.",
            topics=["character", "plot"],
            entity_id="char-001",
            importance=0.8,
            source="agent",
            metadata={"scene": "chapter-1"}
        )
        
        yaml_content = entry.to_yaml_frontmatter()
        
        # Verify frontmatter structure
        assert yaml_content.startswith("---\n")
        assert "---\n\nThis is the memory content." in yaml_content
        
        # Parse frontmatter
        parts = yaml_content.split("---", 2)
        frontmatter = yaml.safe_load(parts[1])
        
        assert frontmatter["id"] == "mem-001"
        assert frontmatter["topics"] == ["character", "plot"]
        assert frontmatter["entity_id"] == "char-001"
        assert frontmatter["importance"] == 0.8
        assert frontmatter["source"] == "agent"

    def test_from_yaml_content(self):
        """Test parsing from YAML frontmatter string."""
        yaml_str = """---
id: mem-002
created_at: "2024-01-15T10:30:00"
updated_at: "2024-01-15T10:30:00"
topics:
  - worldview
  - setting
importance: 0.7
source: user
---

The world is a dystopian future."""
        
        entry = MemoryEntry.from_yaml_content(yaml_str)
        
        assert entry.id == "mem-002"
        assert entry.topics == ["worldview", "setting"]
        assert entry.importance == 0.7
        assert entry.content == "The world is a dystopian future."

    def test_from_yaml_content_invalid_format(self):
        """Test error handling for invalid YAML format."""
        with pytest.raises(ValueError, match="Invalid YAML frontmatter format"):
            MemoryEntry.from_yaml_content("No frontmatter here")

    def test_from_yaml_file(self, tmp_path):
        """Test reading from YAML file."""
        yaml_content = """---
id: mem-003
topics: []
importance: 0.5
source: user
---

File-based memory content."""
        
        file_path = tmp_path / "test_memory.md"
        file_path.write_text(yaml_content, encoding="utf-8")
        
        entry = MemoryEntry.from_yaml_file(file_path)
        
        assert entry.id == "mem-003"
        assert entry.content == "File-based memory content."


class TestMemoryManager:
    """Tests for MemoryManager class."""

    @pytest.fixture
    def temp_base_path(self, tmp_path):
        """Create temporary base path for testing."""
        base = tmp_path / ".writing"
        base.mkdir()
        return base

    @pytest.fixture
    def manager(self, temp_base_path):
        """Create MemoryManager instance for testing."""
        return MemoryManager(base_path=temp_base_path)

    def test_init_creates_directories(self, temp_base_path):
        """Test that initialization creates required directories."""
        manager = MemoryManager(base_path=temp_base_path)
        
        assert manager.memories_dir.exists()
        assert manager.by_date_dir.exists()
        assert manager.topics_dir.exists()
        assert manager.index_path.parent.exists()

    def test_add_memory(self, manager):
        """Test adding a new memory."""
        entry = manager.add(
            content="Character is brave and loyal.",
            topics=["character", "trait"],
            entity_id="char-protagonist",
            importance=0.9,
            source="user"
        )
        
        assert entry.id.startswith("mem-")
        assert entry.content == "Character is brave and loyal."
        assert entry.topics == ["character", "trait"]
        assert entry.entity_id == "char-protagonist"
        assert entry.importance == 0.9
        
        # Verify file exists in by_date structure
        now = datetime.now()
        date_path = manager.by_date_dir / str(now.year) / f"{now.month:02d}" / f"{now.day:02d}"
        memory_file = date_path / f"{entry.id}.md"
        assert memory_file.exists()
        
        # Verify index updated
        assert entry.id in manager._index["memories"]

    def test_add_creates_topic_links(self, manager):
        """Test that adding memory creates topic symlinks/copies."""
        entry = manager.add(
            content="Plot twist in chapter 5.",
            topics=["plot", "twist"]
        )
        
        # Verify topic directories exist
        for topic in ["plot", "twist"]:
            topic_dir = manager.topics_dir / topic
            assert topic_dir.exists()
            
            # Verify link/copy exists
            link_path = topic_dir / f"{entry.id}.md"
            assert link_path.exists()

    def test_get_memory(self, manager):
        """Test retrieving memory by ID."""
        original = manager.add(
            content="Test memory content",
            topics=["test"]
        )
        
        retrieved = manager.get(original.id)
        
        assert retrieved is not None
        assert retrieved.id == original.id
        assert retrieved.content == original.content
        assert retrieved.topics == original.topics

    def test_get_nonexistent_memory(self, manager):
        """Test retrieving non-existent memory returns None."""
        result = manager.get("nonexistent-id")
        assert result is None

    def test_update_memory_content(self, manager):
        """Test updating memory content."""
        entry = manager.add(content="Original content", topics=["test"])
        
        updated = manager.update(
            entry.id,
            content="Updated content",
            importance=0.8
        )
        
        assert updated is not None
        assert updated.content == "Updated content"
        assert updated.importance == 0.8
        
        # Verify persisted
        retrieved = manager.get(entry.id)
        assert retrieved.content == "Updated content"

    def test_update_memory_topics(self, manager):
        """Test updating memory topics updates symlinks."""
        entry = manager.add(content="Test", topics=["old_topic"])
        
        updated = manager.update(entry.id, topics=["new_topic"])
        
        assert updated.topics == ["new_topic"]
        
        # Old topic link should be removed
        old_link = manager.topics_dir / "old_topic" / f"{entry.id}.md"
        assert not old_link.exists()
        
        # New topic link should exist
        new_link = manager.topics_dir / "new_topic" / f"{entry.id}.md"
        assert new_link.exists()

    def test_delete_memory(self, manager):
        """Test deleting a memory."""
        entry = manager.add(content="To be deleted", topics=["temp"])
        memory_id = entry.id
        
        result = manager.delete(memory_id)
        
        assert result is True
        assert manager.get(memory_id) is None
        assert memory_id not in manager._index["memories"]
        
        # Verify topic link removed
        link_path = manager.topics_dir / "temp" / f"{memory_id}.md"
        assert not link_path.exists()

    def test_supersede_memory(self, manager):
        """Test superseding a memory."""
        old_entry = manager.add(
            content="Character age is 25",
            topics=["character"],
            entity_id="char-001"
        )
        
        new_entry = manager.supersede(
            old_entry.id,
            new_content="Character age is 26 (birthday passed)"
        )
        
        assert new_entry is not None
        assert new_entry.content == "Character age is 26 (birthday passed)"
        
        # Check supersedes relationship (stored in metadata)
        old_refreshed = manager.get(old_entry.id)
        assert old_refreshed.metadata.get("superseded_by") == new_entry.id
        assert old_refreshed.valid_until is not None

    def test_get_by_topic(self, manager):
        """Test retrieving memories by topic."""
        manager.add(content="Memory 1", topics=["alpha"])
        manager.add(content="Memory 2", topics=["alpha", "beta"])
        manager.add(content="Memory 3", topics=["beta"])
        
        alpha_memories = manager.get_by_topic("alpha")
        
        assert len(alpha_memories) == 2
        assert all(m.content.startswith("Memory") for m in alpha_memories)

    def test_get_by_entity(self, manager):
        """Test retrieving memories by entity."""
        manager.add(content="Char trait 1", entity_id="char-001")
        manager.add(content="Char trait 2", entity_id="char-001")
        manager.add(content="Other char", entity_id="char-002")
        
        char_memories = manager.get_by_entity("char-001")
        
        assert len(char_memories) == 2

    def test_get_by_date(self, manager):
        """Test retrieving memories by date."""
        # Add memory (will be created with today's date)
        entry = manager.add(content="Today's memory", topics=["daily"])
        
        today = date.today()
        memories = manager.get_by_date(today)
        
        assert len(memories) >= 1
        assert any(m.id == entry.id for m in memories)

    def test_get_temporal_facts(self, manager):
        """Test temporal fact retrieval."""
        # Create facts with temporal validity
        now = datetime.now()
        
        # Current fact
        current = manager.add(
            content="Character is a knight",
            entity_id="char-001",
            importance=0.8
        )
        
        # Retrieve facts valid now
        facts = manager.get_temporal_facts("char-001")
        
        assert len(facts) >= 1
        assert facts[0].content == "Character is a knight"

    def test_list_by_date_range(self, manager):
        """Test listing memories by date range."""
        manager.add(content="Memory A", topics=["test"])
        manager.add(content="Memory B", topics=["test"])
        
        today = date.today()
        memories = manager.list_by_date(
            start_date=today - timedelta(days=1),
            end_date=today
        )
        
        assert len(memories) >= 2

    def test_list_by_topic_with_limit(self, manager):
        """Test listing memories by topic with limit."""
        for i in range(5):
            manager.add(content=f"Memory {i}", topics=["bulk"], importance=i * 0.2)
        
        limited = manager.list_by_topic("bulk", limit=3)
        
        assert len(limited) == 3
        # Should be sorted by importance (highest first)
        assert limited[0].importance >= limited[1].importance

    def test_search(self, manager):
        """Test text search across memories."""
        manager.add(content="The dragon breathes fire", topics=["creature"])
        manager.add(content="The knight fights bravely", topics=["character"])
        manager.add(content="Fire consumes the forest", topics=["event"])
        
        results = manager.search("fire")
        
        assert len(results) == 2
        assert all("fire" in r.content.lower() for r in results)

    def test_list_topics(self, manager):
        """Test listing all topics."""
        manager.add(content="Test 1", topics=["alpha", "beta"])
        manager.add(content="Test 2", topics=["gamma"])
        
        topics = manager.list_topics()
        
        assert "alpha" in topics
        assert "beta" in topics
        assert "gamma" in topics

    def test_stats(self, manager):
        """Test getting memory statistics."""
        manager.add(content="Test 1", topics=["a", "b"], entity_id="e1")
        manager.add(content="Test 2", topics=["b", "c"], entity_id="e2")
        
        stats = manager.stats()
        
        assert stats["total_memories"] == 2
        assert stats["total_topics"] >= 3
        assert stats["total_entities"] == 2

    def test_rebuild_index(self, manager):
        """Test index rebuilding from filesystem."""
        # Add some memories
        entry = manager.add(content="Indexed memory", topics=["rebuild"])
        
        # Corrupt the index
        manager._index = {"memories": {}, "topics": {}, "entities": {}}
        
        # Rebuild
        new_index = manager._rebuild_index()
        
        assert entry.id in new_index["memories"]
        assert "rebuild" in new_index["topics"]


class TestMemoryManagerAdapter:
    """Tests for MemoryManagerAdapter integration."""

    @pytest.fixture
    def temp_base_path(self, tmp_path):
        """Create temporary base path."""
        base = tmp_path / ".writing"
        base.mkdir()
        return base

    @pytest.fixture
    def mock_memory_service(self):
        """Create mock MemoryService."""
        service = MagicMock()
        service.add = AsyncMock(return_value="vector-id-001")
        service.search = AsyncMock(return_value=[])
        return service

    @pytest.fixture
    def adapter(self, temp_base_path, mock_memory_service):
        """Create adapter with mocked service."""
        manager = MemoryManager(base_path=temp_base_path)
        return MemoryManagerAdapter(
            memory_manager=manager,
            memory_service=mock_memory_service
        )

    @pytest.mark.asyncio
    async def test_save_to_both_stores(self, adapter, mock_memory_service):
        """Test saving to both file and vector stores."""
        entry = await adapter.save(
            content="Dual stored memory",
            topics=["test"],
            importance=0.7,
            index_in_vector=True
        )
        
        # Verify file store
        assert entry.id.startswith("mem-")
        assert adapter.manager.get(entry.id) is not None
        
        # Verify vector store called
        mock_memory_service.add.assert_called_once()

    @pytest.mark.asyncio
    async def test_save_file_only(self, adapter, mock_memory_service):
        """Test saving to file store only."""
        entry = await adapter.save(
            content="File only memory",
            topics=["test"],
            index_in_vector=False
        )
        
        assert entry.id.startswith("mem-")
        mock_memory_service.add.assert_not_called()

    @pytest.mark.asyncio
    async def test_search_hybrid(self, adapter, mock_memory_service):
        """Test hybrid search across stores."""
        # Add file-based memory
        adapter.manager.add(content="File memory about dragons", topics=["creature"])
        
        # Configure mock vector results
        mock_memory_service.search = AsyncMock(return_value=[])
        
        results = await adapter.search_hybrid("dragons", limit=5)
        
        # Should find file-based result
        assert len(results) >= 1
        assert any("dragons" in r["content"] for r in results)


class TestFactoryFunctions:
    """Tests for module-level factory functions."""

    def test_get_memory_manager_singleton(self, tmp_path):
        """Test singleton pattern."""
        reset_memory_manager()
        
        base = tmp_path / ".writing"
        base.mkdir()
        
        manager1 = get_memory_manager(base_path=base)
        manager2 = get_memory_manager(base_path=base)
        
        assert manager1 is manager2
        
        reset_memory_manager()

    def test_reset_memory_manager(self, tmp_path):
        """Test singleton reset."""
        reset_memory_manager()
        
        base = tmp_path / ".writing"
        base.mkdir()
        
        manager1 = get_memory_manager(base_path=base)
        reset_memory_manager()
        manager2 = get_memory_manager(base_path=base)
        
        assert manager1 is not manager2
        
        reset_memory_manager()


class TestAliasAPIs:
    """Tests for OpenKL API compatibility aliases."""

    @pytest.fixture
    def manager(self, tmp_path):
        """Create manager for testing."""
        base = tmp_path / ".writing"
        base.mkdir()
        return MemoryManager(base_path=base)

    def test_save_memory_alias(self, manager):
        """Test save_memory alias for add."""
        entry = manager.save_memory(
            content="Alias test",
            topics=["test"]
        )
        
        assert entry.id.startswith("mem-")
        assert manager.get(entry.id) is not None



class TestMemoryManagerAdditionalBranches:
    def test_load_index_rebuilds_corrupted_file(self, tmp_path):
        base = tmp_path / ".writing"
        memories_dir = base / "memories"
        memories_dir.mkdir(parents=True)
        (memories_dir / "index.json").write_text("{broken", encoding="utf-8")

        manager = MemoryManager(base_path=base)
        assert manager._index == {"memories": {}, "topics": {}, "entities": {}}

    def test_rebuild_index_skips_non_directories(self, tmp_path):
        base = tmp_path / ".writing"
        manager = MemoryManager(base_path=base)
        (manager.by_date_dir / "not_a_dir.txt").write_text("x", encoding="utf-8")
        rebuilt = manager._rebuild_index()
        assert rebuilt == {"memories": {}, "topics": {}, "entities": {}}

    def test_create_topic_links_copy_fallback(self, tmp_path, monkeypatch):
        base = tmp_path / ".writing"
        manager = MemoryManager(base_path=base)
        entry = manager.add(content="topic data", topics=["copy-topic"])

        date_file = manager.memories_dir / manager._index["memories"][entry.id]
        link_path = manager.topics_dir / "copy-topic" / f"{entry.id}.md"

        def fail_symlink(self, *args, **kwargs):
            raise OSError("no symlink")

        monkeypatch.setattr(Path, "symlink_to", fail_symlink)
        manager._create_topic_links(entry, date_file)

        assert link_path.exists()
        assert "topic data" in link_path.read_text(encoding="utf-8")

    def test_get_returns_none_when_index_points_missing_file(self, tmp_path):
        base = tmp_path / ".writing"
        manager = MemoryManager(base_path=base)
        manager._index["memories"]["missing"] = "by_date/2024/01/01/missing.md"
        assert manager.get("missing") is None

    def test_get_batch_parallel_branch_handles_loader_error(self, tmp_path, monkeypatch):
        base = tmp_path / ".writing"
        manager = MemoryManager(base_path=base)
        ids = []
        for i in range(6):
            ids.append(manager.add(content=f"c{i}", topics=["t"]).id)

        original_get = manager.get

        def flaky(mid):
            if mid == ids[0]:
                raise RuntimeError("boom")
            return original_get(mid)

        monkeypatch.setattr(manager, "get", flaky)
        result = manager.get_batch(ids)
        assert len(result) == 5

    def test_get_by_date_with_invalid_file_is_skipped(self, tmp_path):
        base = tmp_path / ".writing"
        manager = MemoryManager(base_path=base)
        today = date.today()
        day_dir = manager.by_date_dir / str(today.year) / f"{today.month:02d}" / f"{today.day:02d}"
        day_dir.mkdir(parents=True, exist_ok=True)
        (day_dir / "bad.md").write_text("bad", encoding="utf-8")
        assert manager.get_by_date(today) == []

    def test_get_temporal_facts_filters_not_yet_valid(self, tmp_path):
        base = tmp_path / ".writing"
        manager = MemoryManager(base_path=base)
        manager.add(
            content="future fact",
            entity_id="e1",
            valid_from="2999-01-01T00:00:00",
            importance=0.9,
        )
        assert manager.get_temporal_facts("e1", at_time="2026-01-01T00:00:00") == []

    def test_search_deduplicates_topic_candidates(self, tmp_path):
        base = tmp_path / ".writing"
        manager = MemoryManager(base_path=base)
        manager.add(content="shared match", topics=["a", "b"], importance=0.8)
        manager.add(content="other", topics=["b"], importance=0.2)

        result = manager.search("shared", topics=["a", "b"], limit=5)
        assert len(result) == 1
        assert result[0].content == "shared match"




class TestMemoryManagerUncoveredBranches:
    def test_memory_entry_invalid_frontmatter_and_rebuild_bad_files(self, tmp_path):
        with pytest.raises(ValueError):
            MemoryEntry.from_yaml_content("---\nid: only")

        manager = MemoryManager(base_path=tmp_path / ".writing")
        day_path = manager._get_date_path()
        day_path.mkdir(parents=True, exist_ok=True)
        (day_path / "bad.md").write_text("---\ninvalid: [\n---\n", encoding="utf-8")

        rebuilt = manager._rebuild_index()
        assert rebuilt["memories"] == {}

    def test_create_topic_links_outer_exception(self, tmp_path, monkeypatch):
        manager = MemoryManager(base_path=tmp_path / ".writing")
        entry = manager.add(content="x", topics=["t1"])
        source = manager.memories_dir / manager._index["memories"][entry.id]

        monkeypatch.setattr(os.path, "relpath", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("rel")))
        manager._create_topic_links(entry, source)

    def test_update_missing_and_supersede_missing_and_delete_missing(self, tmp_path):
        manager = MemoryManager(base_path=tmp_path / ".writing")

        assert manager.update("missing", content="x") is None
        assert manager.supersede("missing", "new") is None
        assert manager.delete("missing") is False

    def test_delete_entity_branch_and_basic_aliases(self, tmp_path):
        manager = MemoryManager(base_path=tmp_path / ".writing")
        e = manager.add(content="x", entity_id="ent", topics=["t"])
        assert manager.delete(e.id) is True
        assert manager._index["entities"]["ent"] == []

        assert manager.load_memory("not-exist") is None

    def test_get_by_topic_entity_empty_and_date_string_and_exclude_superseded(self, tmp_path):
        manager = MemoryManager(base_path=tmp_path / ".writing")

        assert manager.get_by_topic("nope") == []
        assert manager.get_by_entity("nope") == []

        old = manager.add(content="old", topics=["topic-a"], entity_id="e")
        manager.supersede(old.id, "new")

        today = date.today().isoformat()
        visible = manager.get_by_date(today, include_superseded=False)
        assert all(not e.superseded_by for e in visible)

    def test_get_temporal_facts_superseded_and_expired(self, tmp_path):
        manager = MemoryManager(base_path=tmp_path / ".writing")
        old = manager.add(content="old", entity_id="e1")
        manager.supersede(old.id, "new")

        manager.add(content="expired", entity_id="e1", valid_until="2000-01-01T00:00:00")
        out = manager.get_temporal_facts("e1", at_time="2026-01-01T00:00:00")

        assert all(x.superseded_by is None for x in out)
        assert all(not x.valid_until or x.valid_until > "2026-01-01T00:00:00" for x in out)

    def test_list_by_date_string_conversion_and_search_branches(self, tmp_path):
        manager = MemoryManager(base_path=tmp_path / ".writing")
        manager.add(content="A match", topics=["alpha"], entity_id="ent")

        out = manager.list_by_date(start_date=date.today().isoformat(), end_date=date.today().isoformat())
        assert isinstance(out, list)

        # search with entity candidate path
        res_entity = manager.search("match", entity_id="ent", limit=10)
        assert len(res_entity) == 1

        # search all candidates path + skip superseded + break by limit
        old = manager.add(content="common text", importance=0.9)
        manager.supersede(old.id, "common text newer")
        manager.add(content="common text 2", importance=0.8)

        res_all = manager.search("common", limit=1)
        assert len(res_all) == 1

    @pytest.mark.asyncio
    async def test_adapter_service_property_and_vector_dedupe(self, tmp_path):
        manager = MemoryManager(base_path=tmp_path / ".writing")
        manager.add(content="dup content", topics=["t"], importance=0.7)

        dup = MagicMock()
        dup.id = next(iter(manager._index["memories"].keys()))
        dup.content = "dup content"
        dup.score = 0.95
        dup.metadata = {"tags": ["t"]}

        uniq = MagicMock()
        uniq.id = "vector-only"
        uniq.content = "vector"
        uniq.score = 0.99
        uniq.metadata = {"tags": ["tv"]}

        service = MagicMock()
        service.search = AsyncMock(return_value=[dup, uniq])

        adapter = MemoryManagerAdapter(memory_manager=manager, memory_service=service)
        assert adapter.service is service

        results = await adapter.search_hybrid("content", topics=["t"], limit=10)
        ids = [r["id"] for r in results]
        assert "vector-only" in ids


class TestMemoryManagerAdapterAdditionalBranches:
    @pytest.mark.asyncio
    async def test_save_vector_indexing_failure_is_ignored(self, tmp_path):
        manager = MemoryManager(base_path=tmp_path / ".writing")
        service = MagicMock()
        service.add = AsyncMock(side_effect=RuntimeError("vector down"))
        adapter = MemoryManagerAdapter(memory_manager=manager, memory_service=service)

        entry = await adapter.save(content="safe", topics=["t"], index_in_vector=True)
        assert entry.id in adapter.manager._index["memories"]

    @pytest.mark.asyncio
    async def test_search_hybrid_vector_failure_returns_file_results(self, tmp_path):
        manager = MemoryManager(base_path=tmp_path / ".writing")
        manager.add(content="file result", topics=["topic"], importance=0.6)

        service = MagicMock()
        service.search = AsyncMock(side_effect=RuntimeError("down"))
        adapter = MemoryManagerAdapter(memory_manager=manager, memory_service=service)

        results = await adapter.search_hybrid("file", topics=["topic"], limit=5)
        assert len(results) == 1
        assert results[0]["source"] == "file"


class TestMemoryManagerCoverageClosure:
    def test_rebuild_index_skips_non_dirs_and_indexes_entity(self, tmp_path):
        manager = MemoryManager(base_path=tmp_path / ".writing")

        year_dir = manager.by_date_dir / "2026"
        year_dir.mkdir(parents=True, exist_ok=True)
        (year_dir / "not_month.txt").write_text("x", encoding="utf-8")

        month_dir = year_dir / "02"
        month_dir.mkdir(parents=True, exist_ok=True)
        (month_dir / "not_day.txt").write_text("x", encoding="utf-8")

        day_dir = month_dir / "18"
        day_dir.mkdir(parents=True, exist_ok=True)
        entry = MemoryEntry(id="entity-rebuild", content="entity content", entity_id="ent-1")
        (day_dir / "entity-rebuild.md").write_text(entry.to_yaml_frontmatter(), encoding="utf-8")

        rebuilt = manager._rebuild_index()

        assert rebuilt["memories"]["entity-rebuild"].endswith("entity-rebuild.md")
        assert rebuilt["entities"]["ent-1"] == ["entity-rebuild"]

    def test_get_batch_empty_ids_returns_empty_list(self, tmp_path):
        manager = MemoryManager(base_path=tmp_path / ".writing")
        assert manager.get_batch([]) == []

    def test_update_topic_link_fallback_to_copy_when_symlink_fails(self, tmp_path):
        manager = MemoryManager(base_path=tmp_path / ".writing")
        entry = manager.add(content="topic fallback", topics=["old-topic"])

        with patch("pathlib.Path.symlink_to", side_effect=OSError("no symlink")):
            updated = manager.update(entry.id, topics=["new-topic"])

        assert updated is not None
        fallback_link = manager.topics_dir / "new-topic" / f"{entry.id}.md"
        assert fallback_link.exists()
        assert fallback_link.read_text(encoding="utf-8")
        assert "topic fallback" in fallback_link.read_text(encoding="utf-8")

    def test_get_by_date_excludes_superseded_frontmatter_field(self, tmp_path):
        manager = MemoryManager(base_path=tmp_path / ".writing")
        entry = manager.add(content="to hide", topics=["x"])

        file_path = manager.memories_dir / manager._index["memories"][entry.id]
        stored = MemoryEntry.from_yaml_file(file_path)
        stored.superseded_by = "newer-id"
        file_path.write_text(stored.to_yaml_frontmatter(), encoding="utf-8")

        results = manager.get_by_date(date.today(), include_superseded=False)
        assert all(r.id != entry.id for r in results)

    def test_temporal_filters_superseded_and_expired_by_frontmatter(self, tmp_path):
        manager = MemoryManager(base_path=tmp_path / ".writing")

        superseded = manager.add(content="old", entity_id="ent")
        expired = manager.add(
            content="expired",
            entity_id="ent",
            valid_from="2000-01-01T00:00:00",
            valid_until="2020-01-01T00:00:00",
        )

        superseded_file = manager.memories_dir / manager._index["memories"][superseded.id]
        superseded_entry = MemoryEntry.from_yaml_file(superseded_file)
        superseded_entry.superseded_by = "replacement"
        superseded_file.write_text(superseded_entry.to_yaml_frontmatter(), encoding="utf-8")

        expired_file = manager.memories_dir / manager._index["memories"][expired.id]
        expired_entry = MemoryEntry.from_yaml_file(expired_file)
        expired_entry.superseded_by = None
        expired_entry.valid_until = "2020-01-01T00:00:00"
        expired_file.write_text(expired_entry.to_yaml_frontmatter(), encoding="utf-8")

        out = manager.get_temporal_facts("ent", at_time="2026-01-01T00:00:00")
        assert out == []

    def test_list_by_date_defaults_and_search_skips_superseded_field(self, tmp_path):
        manager = MemoryManager(base_path=tmp_path / ".writing")

        old = manager.add(content="find me", importance=0.9)
        new = manager.add(content="find me newer", importance=0.8)

        old_file = manager.memories_dir / manager._index["memories"][old.id]
        old_entry = MemoryEntry.from_yaml_file(old_file)
        old_entry.superseded_by = new.id
        old_file.write_text(old_entry.to_yaml_frontmatter(), encoding="utf-8")

        ranged = manager.list_by_date()
        assert isinstance(ranged, list)

        results = manager.search("find me", limit=10)
        ids = [r.id for r in results]
        assert old.id not in ids
        assert new.id in ids
