# -*- coding: utf-8 -*-
"""
Integration Tests - Memory Workflow Integration

Tests memory layer transitions, conflict resolution in workflow,
and temporal queries during execution.
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from memory.memory_layers import (
    LayerManager,
    LayerType,
    LayerEntry,
    EphemeralLayer,
    SessionLayer,
    ProjectLayer,
    create_layer,
)


class TestMemoryLayerTransitions:
    """Memory layer transition tests during workflow execution."""

    @pytest.fixture
    def layer_manager(self):
        """Create layer manager for testing."""
        return LayerManager(
            session_id="test-session-001",
            user_id="test-user",
            project_id="test-project"
        )

    @pytest.mark.asyncio
    async def test_ephemeral_to_session_promotion(self, layer_manager):
        """Test promoting ephemeral memory to session layer."""
        # Store in ephemeral layer
        ephemeral = layer_manager.get_layer(LayerType.EPHEMERAL)
        entry = await ephemeral.store(
            id="temp-idea-001",
            content="Initial scene idea: sunset confrontation",
            importance=0.7
        )

        assert entry.id == "temp-idea-001"

        # Promote to session layer (simulate workflow decision)
        session = layer_manager.get_layer(LayerType.SESSION)
        promoted = await session.store(
            id="scene-idea-001",
            content=entry.content,
            importance=0.9,
            metadata={"promoted_from": "ephemeral", "original_id": entry.id}
        )

        assert promoted.metadata["promoted_from"] == "ephemeral"
        assert promoted.importance == 0.9

    @pytest.mark.asyncio
    async def test_session_to_project_persistence(self, layer_manager):
        """Test persisting session memory to project layer."""
        session = layer_manager.get_layer(LayerType.SESSION)
        project = layer_manager.get_layer(LayerType.PROJECT)

        # Store character development in session
        await session.store(
            id="char-dev-001",
            content="Character Lin Xiao reveals hidden power",
            importance=0.8
        )

        # Persist to project (long-term storage)
        persisted = await project.store(
            id="char-linxiao-power",
            content="Lin Xiao has latent fire magic ability",
            importance=0.95,
            metadata={"entity_type": "character", "character_id": "linxiao"}
        )

        # Verify project layer entry
        retrieved = await project.retrieve("char-linxiao-power")
        assert retrieved is not None
        assert retrieved.importance == 0.95

    @pytest.mark.asyncio
    async def test_layer_priority_retrieval(self, layer_manager):
        """Test retrieval follows layer priority (project > user > session > ephemeral)."""
        # Store same concept in different layers with different values
        ephemeral = layer_manager.get_layer(LayerType.EPHEMERAL)
        session = layer_manager.get_layer(LayerType.SESSION)
        project = layer_manager.get_layer(LayerType.PROJECT)

        await ephemeral.store(id="setting-001", content="Setting: old version", importance=0.3)
        await session.store(id="setting-001", content="Setting: updated version", importance=0.6)
        await project.store(id="setting-001", content="Setting: canonical version", importance=0.9)

        # Retrieve should return project layer (highest priority)
        result = await layer_manager.retrieve("setting-001")
        assert result is not None
        assert "canonical" in result.content

    @pytest.mark.asyncio
    async def test_cross_layer_stats(self, layer_manager):
        """Test getting stats across all layers."""
        ephemeral = layer_manager.get_layer(LayerType.EPHEMERAL)
        session = layer_manager.get_layer(LayerType.SESSION)

        await ephemeral.store(id="e1", content="ephemeral 1", importance=0.5)
        await ephemeral.store(id="e2", content="ephemeral 2", importance=0.5)
        await session.store(id="s1", content="session 1", importance=0.8)

        all_stats = await layer_manager.stats_all()

        assert all_stats[LayerType.EPHEMERAL].total_entries == 2
        assert all_stats[LayerType.SESSION].total_entries == 1


class TestConflictResolutionInWorkflow:
    """Conflict detection and resolution during workflow execution."""

    @pytest.fixture
    def project_layer(self):
        return ProjectLayer(project_id="conflict-test")

    @pytest.mark.asyncio
    async def test_detect_contradictory_facts(self, project_layer):
        """Test detecting contradictory character facts."""
        # Add initial fact
        await project_layer.store(
            id="char-age-v1",
            content="Lin Xiao is 25 years old",
            importance=0.9,
            metadata={"entity_id": "character:linxiao", "attribute": "age"}
        )

        # Add contradictory fact
        await project_layer.store(
            id="char-age-v2",
            content="Lin Xiao is 30 years old",
            importance=0.85,
            metadata={"entity_id": "character:linxiao", "attribute": "age"}
        )

        # List entries and check for potential conflict
        entries = await project_layer.list_entries(limit=10)
        age_entries = [e for e in entries if e.metadata.get("attribute") == "age"]

        assert len(age_entries) == 2  # Both versions exist - conflict detected

    @pytest.mark.asyncio
    async def test_resolve_by_importance(self, project_layer):
        """Test resolving conflicts by keeping higher importance entry."""
        await project_layer.store(
            id="fact-v1",
            content="Old fact",
            importance=0.6
        )
        await project_layer.store(
            id="fact-v2",
            content="New authoritative fact",
            importance=0.95
        )

        entries = await project_layer.list_entries(limit=2)
        # Sorted by importance, higher first
        assert entries[0].importance == 0.95
        assert "authoritative" in entries[0].content

    @pytest.mark.asyncio
    async def test_resolve_by_recency(self, project_layer):
        """Test resolving conflicts by keeping most recent entry."""
        await project_layer.store(
            id="event-old",
            content="Event description v1",
            importance=0.7
        )
        await asyncio.sleep(0.01)  # Ensure different timestamps
        await project_layer.store(
            id="event-new",
            content="Event description v2 (corrected)",
            importance=0.7
        )

        entries = await project_layer.list_entries(limit=2)
        # With same importance, sorted by created_at descending
        assert "v2" in entries[0].content


class TestTemporalQueriesDuringExecution:
    """Temporal memory queries during workflow execution."""

    @pytest.fixture
    def session_layer(self):
        return SessionLayer(session_id="temporal-test")

    @pytest.mark.asyncio
    async def test_store_with_temporal_metadata(self, session_layer):
        """Test storing entries with temporal validity metadata."""
        entry = await session_layer.store(
            id="timeline-event-001",
            content="Lin Xiao joins the academy",
            importance=0.8,
            metadata={
                "story_time": "chapter-1",
                "valid_from": "2024-01-01",
                "valid_until": None,
                "event_type": "character_action"
            }
        )

        assert entry.metadata["story_time"] == "chapter-1"
        assert entry.metadata["valid_until"] is None  # Still valid

    @pytest.mark.asyncio
    async def test_query_by_story_timeline(self, session_layer):
        """Test querying memories by story timeline position."""
        # Store events from different chapters
        await session_layer.store(
            id="ch1-event",
            content="Chapter 1 event",
            metadata={"chapter": 1}
        )
        await session_layer.store(
            id="ch2-event",
            content="Chapter 2 event",
            metadata={"chapter": 2}
        )
        await session_layer.store(
            id="ch3-event",
            content="Chapter 3 event",
            metadata={"chapter": 3}
        )

        entries = await session_layer.list_entries(limit=10)
        ch2_events = [e for e in entries if e.metadata.get("chapter") == 2]

        assert len(ch2_events) == 1
        assert "Chapter 2" in ch2_events[0].content

    @pytest.mark.asyncio
    async def test_ttl_expiration_in_workflow(self, session_layer):
        """Test TTL-based expiration during workflow."""
        # Store with very short TTL
        entry = await session_layer.store(
            id="temp-note",
            content="Temporary workflow note",
            importance=0.3,
            ttl_seconds=1  # 1 second TTL
        )

        # Immediately retrievable
        result = await session_layer.retrieve("temp-note")
        assert result is not None

        # Wait for expiration
        await asyncio.sleep(1.1)

        # Should be expired now
        result = await session_layer.retrieve("temp-note")
        assert result is None


class TestLayerManagerIntegration:
    """Integration tests for LayerManager with workflow context."""

    @pytest.mark.asyncio
    async def test_full_workflow_memory_lifecycle(self):
        """Test complete memory lifecycle in a workflow."""
        manager = LayerManager(
            session_id="workflow-001",
            project_id="novel-001"
        )

        # 1. Store ephemeral working notes
        ephemeral = manager.get_layer(LayerType.EPHEMERAL)
        await ephemeral.store(id="note-1", content="Draft idea", importance=0.4)

        # 2. Store session context
        session = manager.get_layer(LayerType.SESSION)
        await session.store(id="ctx-1", content="Current scene: confrontation", importance=0.7)

        # 3. Store project-level facts
        project = manager.get_layer(LayerType.PROJECT)
        await project.store(id="char-1", content="Protagonist trait", importance=0.9)

        # 4. Verify stats
        stats = await manager.stats_all()
        assert stats[LayerType.EPHEMERAL].total_entries == 1
        assert stats[LayerType.SESSION].total_entries == 1
        assert stats[LayerType.PROJECT].total_entries == 1

        # 5. Expire ephemeral entries
        expired = await manager.expire_all_layers()
        # No entries expired yet (not past TTL)
        assert expired[LayerType.EPHEMERAL] == 0


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v"])
