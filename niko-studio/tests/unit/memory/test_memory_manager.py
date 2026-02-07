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

    def test_load_memory_alias(self, manager):
        """Test load_memory alias for get."""
        original = manager.add(content="Load test", topics=["test"])
        
        loaded = manager.load_memory(original.id)
        
        assert loaded is not None
        assert loaded.id == original.id
