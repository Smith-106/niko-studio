# -*- coding: utf-8 -*-
"""
OpenKL Module Integration Tests - IMPL-031

Comprehensive integration tests for:
1. CitationManager - Complete workflow testing
2. DistillationManager - Six distillation templates
3. MemoryManager - Temporal memory functionality
4. Module integration and data flow

These tests verify the interaction between modules and end-to-end workflows.
"""

import json
import pytest
import tempfile
import shutil
import hashlib
import asyncio
from datetime import datetime, date, timedelta, timezone
from pathlib import Path
from typing import List, Dict, Any
from unittest.mock import Mock, MagicMock, AsyncMock

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from memory.memory_manager import (
    MemoryManager,
    MemoryEntry,
    MemoryManagerAdapter,
    get_memory_manager,
    reset_memory_manager,
)
from memory.citation_manager import (
    CitationManager,
    TransientCitation,
    PersistedCitation,
    get_citation_manager,
    reset_citation_manager,
)
from memory.distillation_manager import (
    DistillationManager,
    DistillationTemplate,
    DistillationResult,
    DISTILLATION_PROMPTS,
    get_distillation_manager,
    reset_distillation_manager,
)


# ============================================================
# Fixtures
# ============================================================

@pytest.fixture
def temp_base_path(tmp_path):
    """Create temporary base path for all managers."""
    base = tmp_path / ".writing"
    base.mkdir(parents=True)
    return base


@pytest.fixture
def memory_manager(temp_base_path):
    """Create MemoryManager instance."""
    reset_memory_manager()
    return MemoryManager(base_path=temp_base_path)


@pytest.fixture
def citation_manager(temp_base_path, memory_manager):
    """Create CitationManager with MemoryManager integration."""
    reset_citation_manager()
    return CitationManager(
        base_path=temp_base_path,
        memory_manager=memory_manager
    )


@pytest.fixture
def distillation_manager(temp_base_path, citation_manager, memory_manager):
    """Create DistillationManager with all integrations."""
    reset_distillation_manager()
    return DistillationManager(
        base_path=temp_base_path,
        citation_manager=citation_manager,
        memory_manager=memory_manager
    )


@pytest.fixture
def integrated_managers(temp_base_path):
    """Create fully integrated manager suite."""
    reset_memory_manager()
    reset_citation_manager()
    reset_distillation_manager()

    memory_mgr = MemoryManager(base_path=temp_base_path)
    citation_mgr = CitationManager(
        base_path=temp_base_path,
        memory_manager=memory_mgr
    )
    distillation_mgr = DistillationManager(
        base_path=temp_base_path,
        citation_manager=citation_mgr,
        memory_manager=memory_mgr
    )

    return {
        "memory": memory_mgr,
        "citation": citation_mgr,
        "distillation": distillation_mgr,
        "base_path": temp_base_path
    }


# ============================================================
# Section 1: CitationManager Complete Workflow Tests
# ============================================================

class TestCitationManagerWorkflow:
    """Test CitationManager complete workflow scenarios."""

    def test_transient_to_persisted_workflow(self, citation_manager):
        """Test complete workflow: create transient -> persist -> verify."""
        # Step 1: Create transient citation
        transient = citation_manager.create_transient_citation(
            source_text="This is the quoted text from the source.",
            location={
                "surface": "document",
                "path": "novels/chapter1.md",
                "loc": {"kind": "char", "start": 100, "end": 150}
            },
            context_before="Before context...",
            context_after="...After context",
            score=0.95,
            metadata={"author": "Test Author", "chapter": 1}
        )

        assert transient.citation_id.startswith("cit-")
        assert transient.source_text == "This is the quoted text from the source."
        assert not transient.is_expired()

        # Step 2: Persist the citation
        persisted = citation_manager.make_citation(
            transient,
            retention_class="durable",
            tags=["important", "plot_point"]
        )

        assert persisted.citation_id == transient.citation_id
        assert persisted.source_hash == hashlib.sha256(
            transient.source_text.encode("utf-8")
        ).hexdigest()
        assert persisted.retention_class == "durable"
        assert "important" in persisted.tags

        # Step 3: Verify the citation
        is_valid = citation_manager.verify_citation(persisted.citation_id)
        assert is_valid is True

        # Step 4: Retrieve and check
        retrieved = citation_manager.get_citation(persisted.citation_id)
        assert retrieved is not None
        assert retrieved.quote == transient.source_text
        assert retrieved.verified_at is not None

    def test_citation_integrity_verification(self, citation_manager):
        """Test SHA256-based integrity verification."""
        original_text = "Original quote that will be verified."

        transient = citation_manager.create_transient_citation(
            source_text=original_text,
            location={"surface": "memory", "path": "mem-001"}
        )

        persisted = citation_manager.make_citation(transient, retention_class="standard")

        # Verify integrity check passes
        result = citation_manager.verify_citation_detailed(persisted.citation_id)
        assert result["valid"] is True
        assert result["stored_hash"] == result["current_hash"]

        # Manually corrupt the quote (simulating tampering)
        persisted.quote = "Tampered quote!"
        citation_manager._save_citation(persisted)

        # Verify integrity check fails
        result = citation_manager.verify_citation_detailed(persisted.citation_id)
        assert result["valid"] is False
        assert result["stored_hash"] != result["current_hash"]

    def test_citation_from_memory_integration(self, citation_manager, memory_manager):
        """Test creating citations from MemoryManager entries."""
        # Create a memory entry
        memory_entry = memory_manager.add(
            content="The protagonist discovered an ancient artifact. It glowed with mysterious energy.",
            topics=["plot", "artifact"],
            entity_id="artifact-001",
            importance=0.9
        )

        # Create citation from memory
        transient = citation_manager.create_citation_from_memory(
            memory_id=memory_entry.id,
            excerpt="ancient artifact",
            context_chars=50
        )

        assert transient is not None
        assert transient.source_location["surface"] == "memory"
        assert transient.source_location["path"] == memory_entry.id
        assert "ancient artifact" in transient.source_text
        assert transient.metadata["memory_id"] == memory_entry.id

    def test_citation_lifecycle_with_gc(self, citation_manager):
        """Test citation lifecycle including garbage collection."""
        # Create standard citation
        standard_transient = citation_manager.create_transient_citation(
            source_text="Standard citation",
            location={"surface": "doc", "path": "doc1.md"}
        )
        standard = citation_manager.make_citation(
            standard_transient,
            retention_class="standard"
        )

        # Create ephemeral citation
        ephemeral_transient = citation_manager.create_transient_citation(
            source_text="Ephemeral citation",
            location={"surface": "doc", "path": "doc2.md"}
        )
        ephemeral = citation_manager.make_citation(
            ephemeral_transient,
            retention_class="ephemeral"
        )

        # Both should exist
        assert citation_manager.get_citation(standard.citation_id) is not None
        assert citation_manager.get_citation(ephemeral.citation_id) is not None

        # Dry run GC
        to_delete = citation_manager.gc_expired(dry_run=True)

        # Ephemeral should not be deleted yet (not expired)
        assert ephemeral.citation_id not in to_delete

    def test_list_citations_by_source(self, citation_manager):
        """Test listing citations filtered by source."""
        sources = ["source-a.md", "source-b.md", "source-a.md"]

        for i, source in enumerate(sources):
            transient = citation_manager.create_transient_citation(
                source_text=f"Quote {i}",
                location={"surface": "doc", "path": source}
            )
            citation_manager.make_citation(transient)

        # List all
        all_citations = citation_manager.list_citations()
        assert len(all_citations) == 3

        # Filter by source
        source_a_citations = citation_manager.list_citations(source_id="source-a.md")
        assert len(source_a_citations) == 2

    def test_citation_stats(self, citation_manager):
        """Test citation statistics."""
        # Create some citations
        for i in range(3):
            transient = citation_manager.create_transient_citation(
                source_text=f"Quote {i}",
                location={"surface": "doc", "path": f"doc{i}.md"}
            )
            if i < 2:
                citation_manager.make_citation(transient)

        stats = citation_manager.stats()

        assert stats["persisted_count"] == 2
        assert stats["transient_count"] >= 1
        assert "citations_dir" in stats


# ============================================================
# Section 2: DistillationManager Six Templates Tests
# ============================================================

class TestDistillationSixTemplates:
    """Test all six distillation templates."""

    @pytest.fixture
    def sample_content(self):
        """Sample content for distillation tests."""
        return """
        Chapter One: The Beginning

        Lin Xiao stood at the edge of the cliff, his dark eyes scanning the horizon.
        The wind whipped through his black hair as he contemplated his next move.
        At twenty-five years old, he had already seen more tragedy than most people
        experience in a lifetime.

        "You shouldn't be here," a voice called from behind him.

        He turned to see Zhang Ming approaching, her silver hair glinting in the
        morning light. Despite her youthful appearance, her eyes held centuries of wisdom.

        "The Council won't wait forever," she continued. "They expect your decision
        by sundown."

        Lin Xiao nodded slowly. The ancient magic that coursed through his veins
        demanded action. The five elements - fire, water, earth, metal, and wood -
        existed in perfect balance within him, a gift from his mysterious lineage.

        The kingdom of Yun had been at peace for three hundred years, but dark clouds
        gathered on the horizon. The Shadow Court had awakened, and only those blessed
        with elemental magic could stand against them.
        """

    def test_summary_template(self, distillation_manager, sample_content):
        """Test SUMMARY distillation template."""
        result = distillation_manager.distill(
            sources=[sample_content],
            template=DistillationTemplate.SUMMARY,
            source_ids=["chapter-1"]
        )

        assert result.template == DistillationTemplate.SUMMARY
        assert len(result.content) > 0
        assert len(result.content) < len(sample_content)
        assert result.result_id.startswith("dist-")

    def test_key_points_template(self, distillation_manager, sample_content):
        """Test KEY_POINTS distillation template."""
        result = distillation_manager.distill(
            sources=[sample_content],
            template=DistillationTemplate.KEY_POINTS,
            source_ids=["chapter-1"]
        )

        assert result.template == DistillationTemplate.KEY_POINTS
        assert len(result.content) > 0
        # Key points should have numbered items
        assert "1." in result.content or "1)" in result.content or "First" in result.content

    def test_character_traits_template(self, distillation_manager, sample_content):
        """Test CHARACTER_TRAITS distillation template."""
        result = distillation_manager.distill(
            sources=[sample_content],
            template=DistillationTemplate.CHARACTER_TRAITS,
            source_ids=["chapter-1"]
        )

        assert result.template == DistillationTemplate.CHARACTER_TRAITS
        assert len(result.content) > 0
        # Should contain character analysis indicators
        assert "Character" in result.content or "character" in result.content

    def test_plot_structure_template(self, distillation_manager, sample_content):
        """Test PLOT_STRUCTURE distillation template."""
        result = distillation_manager.distill(
            sources=[sample_content],
            template=DistillationTemplate.PLOT_STRUCTURE,
            source_ids=["chapter-1"]
        )

        assert result.template == DistillationTemplate.PLOT_STRUCTURE
        assert len(result.content) > 0
        # Should contain plot structure elements
        assert "Plot" in result.content or "Beginning" in result.content or "Middle" in result.content

    def test_world_building_template(self, distillation_manager, sample_content):
        """Test WORLD_BUILDING distillation template."""
        result = distillation_manager.distill(
            sources=[sample_content],
            template=DistillationTemplate.WORLD_BUILDING,
            source_ids=["chapter-1"]
        )

        assert result.template == DistillationTemplate.WORLD_BUILDING
        assert len(result.content) > 0
        # Should contain world-building indicators
        assert "World" in result.content or "world" in result.content

    def test_style_elements_template(self, distillation_manager, sample_content):
        """Test STYLE_ELEMENTS distillation template."""
        result = distillation_manager.distill(
            sources=[sample_content],
            template=DistillationTemplate.STYLE_ELEMENTS,
            source_ids=["chapter-1"]
        )

        assert result.template == DistillationTemplate.STYLE_ELEMENTS
        assert len(result.content) > 0
        # Should contain style metrics
        assert "Style" in result.content or "Word count" in result.content

    def test_all_templates_have_prompts(self, distillation_manager):
        """Verify all 6 templates have defined prompts."""
        for template in DistillationTemplate:
            prompt = distillation_manager.get_prompt(template)
            assert len(prompt) > 0
            assert "{content}" in prompt
            assert "PURPOSE" in prompt

    def test_batch_distill_all_templates(self, distillation_manager, sample_content):
        """Test batch distillation with all templates."""
        results = distillation_manager.batch_distill(
            sources=[sample_content],
            source_ids=["batch-test"]
        )

        assert len(results) == 6

        for template in DistillationTemplate:
            assert template in results
            assert results[template].content is not None
            assert len(results[template].content) > 0


# ============================================================
# Section 3: MemoryManager Temporal Memory Tests
# ============================================================

class TestMemoryManagerTemporal:
    """Test MemoryManager temporal memory functionality."""

    def test_temporal_fact_creation(self, memory_manager):
        """Test creating memories with temporal validity."""
        now = datetime.now()
        past = (now - timedelta(days=30)).isoformat()
        future = (now + timedelta(days=30)).isoformat()

        entry = memory_manager.add(
            content="Character is 25 years old",
            topics=["character", "age"],
            entity_id="char-protagonist",
            valid_from=past,
            valid_until=future,
            importance=0.8
        )

        assert entry.valid_from == past
        assert entry.valid_until == future
        assert entry.entity_id == "char-protagonist"

    def test_temporal_fact_supersession(self, memory_manager):
        """Test superseding temporal facts."""
        # Create original fact
        original = memory_manager.add(
            content="Character is a student",
            topics=["character", "occupation"],
            entity_id="char-001",
            importance=0.7
        )

        # Supersede with new fact
        new_entry = memory_manager.supersede(
            old_memory_id=original.id,
            new_content="Character is now a teacher"
        )

        assert new_entry is not None
        assert new_entry.content == "Character is now a teacher"

        # Original should be marked as superseded
        old_refreshed = memory_manager.get(original.id)
        assert old_refreshed.metadata.get("superseded_by") == new_entry.id
        assert old_refreshed.valid_until is not None

    def test_get_temporal_facts_at_time(self, memory_manager):
        """Test retrieving facts valid at specific time."""
        entity_id = "char-temporal"
        now = datetime.now()

        # Past fact (no longer valid)
        past_start = (now - timedelta(days=60)).isoformat()
        past_end = (now - timedelta(days=30)).isoformat()
        memory_manager.add(
            content="Character was an apprentice",
            entity_id=entity_id,
            valid_from=past_start,
            valid_until=past_end,
            topics=["occupation"]
        )

        # Current fact
        current_start = (now - timedelta(days=30)).isoformat()
        memory_manager.add(
            content="Character is a master",
            entity_id=entity_id,
            valid_from=current_start,
            valid_until=None,  # Still valid
            topics=["occupation"]
        )

        # Get facts valid now
        current_facts = memory_manager.get_temporal_facts(entity_id)

        assert len(current_facts) >= 1
        assert any("master" in f.content for f in current_facts)

    def test_by_date_organization(self, memory_manager):
        """Test by_date directory organization."""
        entry = memory_manager.add(
            content="Test memory content",
            topics=["test"]
        )

        # Verify file exists in correct date structure
        now = datetime.now()
        expected_path = (
            memory_manager.by_date_dir /
            str(now.year) /
            f"{now.month:02d}" /
            f"{now.day:02d}" /
            f"{entry.id}.md"
        )

        assert expected_path.exists()

        # Verify content is valid YAML frontmatter
        content = expected_path.read_text(encoding="utf-8")
        assert content.startswith("---\n")
        assert entry.id in content

    def test_topic_symlinks(self, memory_manager):
        """Test topic-based symlink/copy organization."""
        entry = memory_manager.add(
            content="Multi-topic memory",
            topics=["topic_a", "topic_b", "topic_c"]
        )

        # Verify topic directories exist
        for topic in ["topic_a", "topic_b", "topic_c"]:
            topic_dir = memory_manager.topics_dir / topic
            assert topic_dir.exists()

            # Verify link/copy exists
            link_path = topic_dir / f"{entry.id}.md"
            assert link_path.exists()

    def test_list_by_date_range(self, memory_manager):
        """Test listing memories by date range."""
        # Add memories
        for i in range(5):
            memory_manager.add(
                content=f"Memory {i}",
                topics=["range_test"]
            )

        today = date.today()
        yesterday = today - timedelta(days=1)

        memories = memory_manager.list_by_date(
            start_date=yesterday,
            end_date=today
        )

        assert len(memories) >= 5
        # Should be sorted by created_at (newest first)
        for i in range(len(memories) - 1):
            assert memories[i].created_at >= memories[i + 1].created_at

    def test_search_with_filters(self, memory_manager):
        """Test search with topic and entity filters."""
        memory_manager.add(content="Dragon breathes fire", topics=["creature"])
        memory_manager.add(content="Knight fights dragon", topics=["character"])
        memory_manager.add(content="Fire spreads in forest", topics=["event"])

        # Search with topic filter
        creature_results = memory_manager.search("fire", topics=["creature"])
        assert len(creature_results) == 1
        assert "Dragon" in creature_results[0].content

        # Search without filter
        all_results = memory_manager.search("fire")
        assert len(all_results) >= 2


# ============================================================
# Section 4: Module Integration and Data Flow Tests
# ============================================================

class TestModuleIntegration:
    """Test integration between all OpenKL modules."""

    def test_full_knowledge_extraction_workflow(self, integrated_managers):
        """Test complete workflow: Source -> Memory -> Citation -> Distillation."""
        memory_mgr = integrated_managers["memory"]
        citation_mgr = integrated_managers["citation"]
        distill_mgr = integrated_managers["distillation"]

        # Step 1: Create source memories
        source_memories = []
        contents = [
            "Chapter 1: The hero discovered a magical sword.",
            "Chapter 2: The villain attacked the village.",
            "Chapter 3: The final battle began at dawn."
        ]

        for i, content in enumerate(contents):
            entry = memory_mgr.add(
                content=content,
                topics=["plot", f"chapter_{i+1}"],
                importance=0.8
            )
            source_memories.append(entry)

        # Step 2: Distill the content with DerivedFrom tracking
        result = distill_mgr.distill(
            sources=[m.content for m in source_memories],
            template=DistillationTemplate.PLOT_STRUCTURE,
            source_ids=[m.id for m in source_memories]
        )

        # Verify distillation result
        assert result.template == DistillationTemplate.PLOT_STRUCTURE
        assert len(result.derived_from) == 3

        # Step 3: Verify DerivedFrom citations were created
        citations = distill_mgr.get_derived_from(result.result_id)
        assert len(citations) == 3

        for citation in citations:
            assert citation.retention_class == "durable"
            assert "derived_from" in citation.tags
            assert "distillation" in citation.tags

    def test_memory_to_citation_flow(self, integrated_managers):
        """Test creating citations from memory entries."""
        memory_mgr = integrated_managers["memory"]
        citation_mgr = integrated_managers["citation"]

        # Create memory
        memory = memory_mgr.add(
            content="The ancient prophecy spoke of a chosen one who would bring balance.",
            topics=["prophecy", "lore"],
            entity_id="prophecy-001"
        )

        # Create citation from memory
        transient = citation_mgr.create_citation_from_memory(
            memory_id=memory.id,
            excerpt="chosen one",
            context_chars=30
        )

        assert transient is not None
        assert transient.metadata["memory_id"] == memory.id

        # Persist citation
        persisted = citation_mgr.make_citation(
            transient,
            retention_class="durable",
            tags=["prophecy"]
        )

        # Verify integrity
        assert citation_mgr.verify_citation(persisted.citation_id)

    def test_distillation_to_memory_flow(self, integrated_managers):
        """Test creating memory entries from distillation results."""
        distill_mgr = integrated_managers["distillation"]
        memory_mgr = integrated_managers["memory"]

        # Perform distillation
        source_content = "The magic system uses five elements: fire, water, earth, metal, wood."

        # Create memory from distillation
        memory_id = distill_mgr.create_memory_from_distillation(
            content="Five element magic system",
            prompt_type="world_building",
            source_citations=["cit-001"],
            topics=["magic", "worldview"]
        )

        assert memory_id is not None

        # Verify memory was created
        entry = memory_mgr.get(memory_id)
        assert entry is not None
        assert entry.source == "distill"
        assert "distillation_type" in entry.metadata
        assert entry.metadata["distillation_type"] == "world_building"

    def test_cross_module_data_consistency(self, integrated_managers):
        """Test data consistency across all modules."""
        memory_mgr = integrated_managers["memory"]
        citation_mgr = integrated_managers["citation"]
        distill_mgr = integrated_managers["distillation"]

        # Create interconnected data
        memory = memory_mgr.add(
            content="Complex interconnected content for testing.",
            topics=["integration_test"],
            importance=0.9
        )

        transient = citation_mgr.create_transient_citation(
            source_text=memory.content[:20],
            location={"surface": "memory", "path": memory.id}
        )

        citation = citation_mgr.make_citation(transient, tags=["test"])

        result = distill_mgr.distill(
            sources=[memory.content],
            template=DistillationTemplate.SUMMARY,
            source_ids=[memory.id]
        )

        # Verify all components reference each other correctly
        assert memory.id in memory_mgr._index["memories"]
        assert citation_mgr.get_citation(citation.citation_id) is not None
        assert distill_mgr.get_result(result.result_id) is not None

    def test_concurrent_module_operations(self, integrated_managers):
        """Test concurrent operations across modules."""
        import threading

        memory_mgr = integrated_managers["memory"]
        citation_mgr = integrated_managers["citation"]

        errors = []
        results = {"memories": [], "citations": []}
        lock = threading.Lock()

        def create_memory(idx):
            try:
                entry = memory_mgr.add(
                    content=f"Concurrent memory {idx}",
                    topics=["concurrent"]
                )
                with lock:
                    results["memories"].append(entry.id)
            except Exception as e:
                with lock:
                    errors.append(str(e))

        def create_citation(idx):
            try:
                transient = citation_mgr.create_transient_citation(
                    source_text=f"Concurrent citation {idx}",
                    location={"surface": "test", "path": f"test-{idx}"}
                )
                persisted = citation_mgr.make_citation(transient)
                with lock:
                    results["citations"].append(persisted.citation_id)
            except Exception as e:
                with lock:
                    errors.append(str(e))

        # Run concurrent operations
        threads = []
        for i in range(5):
            threads.append(threading.Thread(target=create_memory, args=(i,)))
            threads.append(threading.Thread(target=create_citation, args=(i,)))

        for t in threads:
            t.start()

        for t in threads:
            t.join()

        # Verify no errors and all created
        assert len(errors) == 0, f"Errors occurred: {errors}"
        assert len(results["memories"]) == 5
        assert len(results["citations"]) == 5

    def test_module_persistence_across_restarts(self, temp_base_path):
        """Test data persists across manager restarts."""
        # Create managers and add data
        memory_mgr1 = MemoryManager(base_path=temp_base_path)
        citation_mgr1 = CitationManager(base_path=temp_base_path)
        distill_mgr1 = DistillationManager(
            base_path=temp_base_path,
            citation_manager=citation_mgr1
        )

        memory = memory_mgr1.add(content="Persistent memory", topics=["persist"])

        transient = citation_mgr1.create_transient_citation(
            source_text="Persistent citation",
            location={"surface": "test", "path": "test.md"}
        )
        citation = citation_mgr1.make_citation(transient)

        result = distill_mgr1.distill(
            sources=["Persistent distillation"],
            template=DistillationTemplate.SUMMARY,
            source_ids=["src-persist"]
        )

        # Recreate managers (simulating restart)
        memory_mgr2 = MemoryManager(base_path=temp_base_path)
        citation_mgr2 = CitationManager(base_path=temp_base_path)
        distill_mgr2 = DistillationManager(base_path=temp_base_path)

        # Verify data persists
        assert memory_mgr2.get(memory.id) is not None
        assert citation_mgr2.get_citation(citation.citation_id) is not None
        assert distill_mgr2.get_result(result.result_id) is not None


# ============================================================
# Section 5: MemoryManagerAdapter Integration Tests
# ============================================================

class TestMemoryManagerAdapterIntegration:
    """Test MemoryManagerAdapter with dual storage."""

    @pytest.fixture
    def mock_memory_service(self):
        """Create mock MemoryService."""
        service = MagicMock()
        service.add = AsyncMock(return_value="vector-id-001")
        service.search = AsyncMock(return_value=[])
        return service

    @pytest.fixture
    def adapter(self, memory_manager, mock_memory_service):
        """Create adapter with mocked service."""
        return MemoryManagerAdapter(
            memory_manager=memory_manager,
            memory_service=mock_memory_service
        )

    @pytest.mark.asyncio
    async def test_dual_storage_save(self, adapter, mock_memory_service):
        """Test saving to both file and vector stores."""
        entry = await adapter.save(
            content="Dual stored memory for integration test",
            topics=["integration", "dual_storage"],
            importance=0.8,
            index_in_vector=True
        )

        # Verify file store
        assert entry.id.startswith("mem-")
        assert adapter.manager.get(entry.id) is not None

        # Verify vector store was called
        mock_memory_service.add.assert_called_once()

    @pytest.mark.asyncio
    async def test_hybrid_search(self, adapter, mock_memory_service):
        """Test hybrid search across stores."""
        # Add file-based memory
        adapter.manager.add(
            content="File-based memory about dragons",
            topics=["creature"]
        )

        # Configure mock vector results
        mock_memory_service.search = AsyncMock(return_value=[])

        results = await adapter.search_hybrid("dragons", limit=5)

        # Should find file-based result
        assert len(results) >= 1
        assert any("dragons" in r["content"] for r in results)


# ============================================================
# Section 6: Error Handling and Edge Cases
# ============================================================

class TestErrorHandlingAndEdgeCases:
    """Test error handling and edge cases across modules."""

    def test_memory_manager_nonexistent_get(self, memory_manager):
        """Test getting non-existent memory returns None."""
        result = memory_manager.get("nonexistent-memory-id")
        assert result is None

    def test_citation_manager_expired_transient(self, citation_manager):
        """Test expired transient citations are handled."""
        import time

        # Create transient with very short TTL
        citation_manager._transient_ttl = 1  # 1 second expiration

        transient = citation_manager.create_transient_citation(
            source_text="Will expire soon",
            location={"surface": "test", "path": "test.md"}
        )

        # Should not be expired immediately
        assert not transient.is_expired()

        # Wait for expiration
        time.sleep(1.1)

        # Should be expired now
        assert transient.is_expired()

        # Getting should return None
        retrieved = citation_manager.get_transient_citation(transient.citation_id)
        assert retrieved is None

    def test_distillation_without_dependencies(self, temp_base_path):
        """Test distillation works without citation/memory managers."""
        manager = DistillationManager(base_path=temp_base_path)

        result = manager.distill(
            sources=["Content without dependencies"],
            template=DistillationTemplate.SUMMARY,
            source_ids=["standalone"]
        )

        assert result is not None
        assert len(result.derived_from) == 0  # No citations without manager

    def test_memory_yaml_parsing_error(self, memory_manager):
        """Test handling of corrupted YAML files."""
        # Create valid memory
        entry = memory_manager.add(content="Valid content", topics=["test"])

        # Corrupt the file
        relative_path = memory_manager._index["memories"][entry.id]
        file_path = memory_manager.memories_dir / relative_path
        file_path.write_text("Invalid YAML content without frontmatter", encoding="utf-8")

        # Should raise ValueError for invalid YAML format
        with pytest.raises(ValueError, match="Invalid YAML frontmatter format"):
            memory_manager.get(entry.id)

    def test_empty_content_handling(self, memory_manager, citation_manager, distillation_manager):
        """Test handling of empty content."""
        # Memory with empty content
        entry = memory_manager.add(content="", topics=["empty"])
        assert entry is not None

        # Citation with empty text
        transient = citation_manager.create_transient_citation(
            source_text="",
            location={"surface": "test", "path": "empty.md"}
        )
        assert transient is not None

        # Distillation with empty sources
        result = distillation_manager.distill(
            sources=[""],
            template=DistillationTemplate.SUMMARY,
            source_ids=["empty"]
        )
        assert result is not None


# ============================================================
# Section 7: Statistics and Reporting Tests
# ============================================================

class TestStatisticsAndReporting:
    """Test statistics and reporting functionality."""

    def test_memory_manager_stats(self, memory_manager):
        """Test memory statistics generation."""
        memory_manager.add(content="M1", topics=["a", "b"], entity_id="e1")
        memory_manager.add(content="M2", topics=["b", "c"], entity_id="e2")
        memory_manager.add(content="M3", topics=["c"], entity_id="e1")

        stats = memory_manager.stats()

        assert stats["total_memories"] == 3
        assert stats["total_topics"] >= 3
        assert stats["total_entities"] == 2
        assert "topics" in stats
        assert stats["topics"]["b"] == 2

    def test_citation_manager_stats(self, citation_manager):
        """Test citation statistics generation."""
        for i in range(3):
            transient = citation_manager.create_transient_citation(
                source_text=f"Quote {i}",
                location={"surface": "test", "path": f"doc{i}.md"}
            )
            if i < 2:
                citation_manager.make_citation(transient)

        stats = citation_manager.stats()

        assert stats["persisted_count"] == 2
        assert stats["transient_count"] >= 1

    def test_distillation_manager_stats(self, distillation_manager):
        """Test distillation statistics generation."""
        distillation_manager.distill(["C1"], DistillationTemplate.SUMMARY, ["s1"])
        distillation_manager.distill(["C2"], DistillationTemplate.SUMMARY, ["s2"])
        distillation_manager.distill(["C3"], DistillationTemplate.KEY_POINTS, ["s3"])

        stats = distillation_manager.stats()

        assert stats["total_results"] == 3
        assert stats["by_template"]["summary"] == 2
        assert stats["by_template"]["key_points"] == 1


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
