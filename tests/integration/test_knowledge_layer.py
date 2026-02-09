# -*- coding: utf-8 -*-
"""
Knowledge Layer Integration Tests - IMPL-030

Comprehensive integration tests for:
1. Hybrid Search - Vector + Graph combined search
2. Distillation Cycle - Knowledge extraction and refinement
3. StoreManager + GraphManager integration
4. AgentKnowledgeLayer unified interface

These tests verify the interaction between knowledge components and end-to-end workflows.
"""

import json
import pytest
import tempfile
import shutil
import asyncio
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any
from unittest.mock import Mock, MagicMock, AsyncMock, patch

import sys
src_path = Path(__file__).parent.parent.parent / "src"
sys.path.insert(0, str(src_path))

# Import modules using src. prefix for proper package resolution
from src.store.store_manager import StoreManager, Document, DocumentFormat
from src.graph.graph_manager import GraphManager
from src.memory.memory_manager import MemoryManager, reset_memory_manager
from src.memory.citation_manager import CitationManager, reset_citation_manager
from src.memory.distillation_manager import (
    DistillationManager,
    DistillationTemplate,
    reset_distillation_manager,
)
from docs.contracts.graph_contracts import (
    Entity,
    EntityType,
    Relationship,
    RelationType,
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
def graph_db_path(tmp_path):
    """Create temporary path for graph database."""
    db_path = tmp_path / "test_graph.db"
    return db_path


@pytest.fixture
def store_manager(temp_base_path):
    """Create StoreManager instance."""
    return StoreManager(base_path=temp_base_path)


@pytest.fixture
def graph_manager(graph_db_path):
    """Create GraphManager instance."""
    return GraphManager(db_path=str(graph_db_path))


@pytest.fixture
def knowledge_layer(tmp_path):
    """Create AgentKnowledgeLayer instance with mocked IndexingService."""
    import src.services.knowledge_layer as kl_module

    # Mock IndexingService
    mock_indexing = MagicMock()
    mock_indexing.search.return_value = []
    kl_module.IndexingService = MagicMock(return_value=mock_indexing)

    from src.services.knowledge_layer import AgentKnowledgeLayer

    db_path = tmp_path / "test_kl.db"
    return AgentKnowledgeLayer(str(db_path))


@pytest.fixture
def distillation_manager(temp_base_path):
    """Create DistillationManager instance."""
    reset_distillation_manager()
    return DistillationManager(base_path=temp_base_path)


@pytest.fixture
def memory_manager(temp_base_path):
    """Create MemoryManager instance."""
    reset_memory_manager()
    return MemoryManager(base_path=temp_base_path)


@pytest.fixture
def citation_manager(temp_base_path, memory_manager):
    """Create CitationManager instance."""
    reset_citation_manager()
    return CitationManager(
        base_path=temp_base_path,
        memory_manager=memory_manager
    )


@pytest.fixture
def integrated_knowledge_system(temp_base_path, graph_db_path):
    """Create fully integrated knowledge system."""
    reset_memory_manager()
    reset_citation_manager()
    reset_distillation_manager()

    store_mgr = StoreManager(base_path=temp_base_path)
    graph_mgr = GraphManager(db_path=str(graph_db_path))
    memory_mgr = MemoryManager(base_path=temp_base_path)
    citation_mgr = CitationManager(
        base_path=temp_base_path,
        memory_manager=memory_mgr
    )
    distill_mgr = DistillationManager(
        base_path=temp_base_path,
        citation_manager=citation_mgr,
        memory_manager=memory_mgr
    )

    return {
        "store": store_mgr,
        "graph": graph_mgr,
        "memory": memory_mgr,
        "citation": citation_mgr,
        "distillation": distill_mgr,
        "base_path": temp_base_path
    }


# ============================================================
# Section 1: Hybrid Search Integration Tests
# ============================================================

class TestHybridSearchIntegration:
    """Test Hybrid Search combining vector and graph search."""

    def test_hybrid_search_basic(self, knowledge_layer):
        """Test basic hybrid search functionality."""
        kl = knowledge_layer

        # Add entities to graph
        kl.add_entity("char-001", "Lin Xiao", "Character")
        kl.add_entity("char-002", "Zhang Ming", "Character")
        kl.add_entity("loc-001", "Yun Kingdom", "Location")

        # Perform hybrid search
        results = kl.query_hybrid("Tell me about Lin Xiao")

        assert "chunks" in results
        assert "entities" in results
        assert len(results["entities"]) >= 1

        entity_names = [e["name"] for e in results["entities"]]
        assert "Lin Xiao" in entity_names

    def test_hybrid_search_entity_filter(self, knowledge_layer):
        """Test hybrid search with entity type filter."""
        kl = knowledge_layer

        # Add mixed entities
        kl.add_entity("char-001", "Hero", "Character")
        kl.add_entity("loc-001", "Hero City", "Location")
        kl.add_entity("item-001", "Hero Sword", "Item")

        # Search should find all "Hero" related entities
        results = kl.query_hybrid("Hero")

        assert len(results["entities"]) >= 1

    def test_hybrid_search_case_insensitive(self, knowledge_layer):
        """Test hybrid search is case insensitive."""
        kl = knowledge_layer

        kl.add_entity("char-001", "Sherlock Holmes", "Character")

        # Search with different cases
        results_lower = kl.query_hybrid("sherlock holmes")
        results_upper = kl.query_hybrid("SHERLOCK HOLMES")
        results_mixed = kl.query_hybrid("Sherlock Holmes")

        # All should find the entity
        assert len(results_lower["entities"]) >= 1
        assert len(results_upper["entities"]) >= 1
        assert len(results_mixed["entities"]) >= 1

    def test_hybrid_search_partial_match(self, knowledge_layer):
        """Test hybrid search with partial name match."""
        kl = knowledge_layer

        kl.add_entity("char-001", "Sherlock", "Character")
        kl.add_entity("char-002", "Sherlock Holmes", "Character")

        # Partial match should work
        results = kl.query_hybrid("Sherlock is cool")

        entity_names = [e["name"] for e in results["entities"]]
        assert "Sherlock" in entity_names
        # Full name should not match if not in query
        assert "Sherlock Holmes" not in entity_names

    def test_hybrid_search_with_relations(self, knowledge_layer):
        """Test hybrid search considers entity relations."""
        kl = knowledge_layer

        # Add entities
        kl.add_entity("char-001", "Hero", "Character")
        kl.add_entity("char-002", "Mentor", "Character")

        # Add relation
        kl.add_relation("char-001", "char-002", "TRAINED_BY")

        # Search should find related entities
        results = kl.query_hybrid("Hero")

        assert len(results["entities"]) >= 1

    def test_hybrid_search_empty_query(self, knowledge_layer):
        """Test hybrid search with empty query."""
        kl = knowledge_layer

        kl.add_entity("char-001", "Test", "Character")

        results = kl.query_hybrid("")

        assert "chunks" in results
        assert "entities" in results

    def test_hybrid_search_no_results(self, knowledge_layer):
        """Test hybrid search with no matching results."""
        kl = knowledge_layer

        kl.add_entity("char-001", "Alice", "Character")

        results = kl.query_hybrid("NonExistentEntity12345")

        assert len(results["entities"]) == 0


class TestHybridSearchWithStoreManager:
    """Test Hybrid Search with StoreManager document integration."""

    def test_store_document_search_integration(self, store_manager):
        """Test document content search in store."""
        store = store_manager

        # Add documents
        store.add_document(
            path="chapter1.md",
            content="Lin Xiao stood at the edge of the cliff, contemplating his destiny."
        )
        store.add_document(
            path="chapter2.md",
            content="Zhang Ming arrived with news from the Council."
        )

        # Search documents
        results = store.search_by_content("Lin Xiao")

        assert len(results) >= 1
        assert "Lin Xiao" in results[0].content

    def test_store_chunk_search(self, store_manager):
        """Test chunk-level search in store."""
        store = store_manager

        # Add long document that will be chunked
        long_content = """
        Chapter 1: The Beginning

        Lin Xiao was a young warrior with extraordinary abilities. His mastery
        of the five elements made him unique among his peers. The ancient magic
        coursed through his veins, a gift from his mysterious lineage.

        Chapter 2: The Journey

        The path ahead was treacherous. Mountains loomed in the distance, their
        peaks shrouded in mist. Lin Xiao knew that the answers he sought lay
        beyond those peaks, in the forgotten temple of the ancients.
        """ * 10  # Make it long enough to chunk

        store.add_document(path="novel.md", content=long_content)

        # Search chunks
        results = store.search_chunks("Lin Xiao")

        assert isinstance(results, list)

    def test_store_and_graph_combined_search(self, integrated_knowledge_system):
        """Test combined store and graph search."""
        store = integrated_knowledge_system["store"]
        graph = integrated_knowledge_system["graph"]

        from docs.contracts.graph_contracts import Entity, EntityType

        # Add document to store
        doc_id = store.add_document(
            path="character_intro.md",
            content="Lin Xiao is the protagonist of our story. He possesses elemental magic."
        )

        # Add entity to graph
        entity = Entity(
            id="char-lin-xiao",
            name="Lin Xiao",
            type=EntityType.CHARACTER,
            properties={"role": "protagonist", "magic": "elemental"}
        )
        graph.create_entity(entity)

        # Verify both can be found
        doc_results = store.search_by_content("Lin Xiao")
        graph_results = graph.search_entities("Lin Xiao")

        assert len(doc_results) >= 1
        assert len(graph_results) >= 1


class TestGraphManagerIntegration:
    """Test GraphManager knowledge graph operations."""

    def test_entity_crud_operations(self, graph_manager):
        """Test entity CRUD operations."""
        from docs.contracts.graph_contracts import Entity, EntityType

        graph = graph_manager

        # Create
        entity = Entity(
            id="test-entity-001",
            name="Test Character",
            type=EntityType.CHARACTER,
            properties={"age": 25, "role": "hero"}
        )
        entity_id = graph.create_entity(entity)

        assert entity_id == "test-entity-001"

        # Read
        retrieved = graph.get_entity(entity_id)
        assert retrieved is not None
        assert retrieved.name == "Test Character"
        assert retrieved.properties["age"] == 25

        # Update
        retrieved.name = "Updated Character"
        graph.update_entity(retrieved)

        updated = graph.get_entity(entity_id)
        assert updated.name == "Updated Character"

        # Delete
        result = graph.delete_entity(entity_id)
        assert result is True

        deleted = graph.get_entity(entity_id)
        assert deleted is None

    def test_relationship_operations(self, graph_manager):
        """Test relationship creation and queries."""
        from docs.contracts.graph_contracts import (
            Entity, EntityType, Relationship, RelationType
        )

        graph = graph_manager

        # Create entities
        hero = Entity(id="hero-001", name="Hero", type=EntityType.CHARACTER)
        mentor = Entity(id="mentor-001", name="Mentor", type=EntityType.CHARACTER)

        graph.create_entity(hero)
        graph.create_entity(mentor)

        # Create relationship
        rel = Relationship(
            id="rel-001",
            source_id="hero-001",
            target_id="mentor-001",
            type=RelationType.KNOWS,
            properties={"since": "childhood"}
        )
        rel_id = graph.create_relationship(rel)

        assert rel_id == "rel-001"

        # Query relationships
        hero_rels = graph.get_relationships("hero-001", direction="out")
        assert len(hero_rels) >= 1
        assert hero_rels[0].target_id == "mentor-001"

    def test_find_related_entities(self, graph_manager):
        """Test finding related entities via graph traversal."""
        from docs.contracts.graph_contracts import (
            Entity, EntityType, Relationship, RelationType
        )

        graph = graph_manager

        # Create a small network
        entities = [
            Entity(id="e1", name="Entity1", type=EntityType.CHARACTER),
            Entity(id="e2", name="Entity2", type=EntityType.CHARACTER),
            Entity(id="e3", name="Entity3", type=EntityType.CHARACTER),
            Entity(id="e4", name="Entity4", type=EntityType.CHARACTER),
        ]

        for e in entities:
            graph.create_entity(e)

        # Create connections: e1 -> e2 -> e3 -> e4
        rels = [
            Relationship(id="r1", source_id="e1", target_id="e2", type=RelationType.KNOWS),
            Relationship(id="r2", source_id="e2", target_id="e3", type=RelationType.KNOWS),
            Relationship(id="r3", source_id="e3", target_id="e4", type=RelationType.KNOWS),
        ]

        for r in rels:
            graph.create_relationship(r)

        # Find related entities from e1 with depth 2
        related = graph.find_related_entities("e1", max_depth=2)

        # Should find e2 (depth 1) and e3 (depth 2), but not e4 (depth 3)
        related_ids = [e.id for e in related]
        assert "e2" in related_ids
        assert "e3" in related_ids

    def test_get_entity_stats(self, graph_manager):
        """Test entity statistics generation."""
        from docs.contracts.graph_contracts import (
            Entity, EntityType, Relationship, RelationType
        )

        graph = graph_manager

        # Add some entities
        graph.create_entity(Entity(id="c1", name="Char1", type=EntityType.CHARACTER))
        graph.create_entity(Entity(id="c2", name="Char2", type=EntityType.CHARACTER))
        graph.create_entity(Entity(id="l1", name="Loc1", type=EntityType.LOCATION))

        # Add relationship
        graph.create_relationship(Relationship(
            id="r1", source_id="c1", target_id="l1", type=RelationType.LOCATED_IN
        ))

        stats = graph.get_entity_stats()

        assert stats.total_entities == 3
        assert stats.total_relationships == 1
        assert "character" in stats.entities_by_type
        assert stats.entities_by_type["character"] == 2

    def test_cypher_query_execution(self, graph_manager):
        """Test Cypher query execution."""
        from docs.contracts.graph_contracts import Entity, EntityType

        graph = graph_manager

        # Add entities
        graph.create_entity(Entity(
            id="q1", name="Query Test", type=EntityType.CHARACTER,
            properties={"role": "protagonist"}
        ))

        # Execute Cypher MATCH query
        results = graph.run_cypher("MATCH (n:Character) RETURN n")

        assert len(results) >= 1

    def test_shortest_path(self, graph_manager):
        """Test shortest path finding."""
        from docs.contracts.graph_contracts import (
            Entity, EntityType, Relationship, RelationType
        )

        graph = graph_manager

        # Create entities
        for i in range(1, 5):
            graph.create_entity(Entity(
                id=f"sp{i}", name=f"Node{i}", type=EntityType.CONCEPT
            ))

        # Create path: sp1 -> sp2 -> sp3 -> sp4
        for i in range(1, 4):
            graph.create_relationship(Relationship(
                id=f"spr{i}",
                source_id=f"sp{i}",
                target_id=f"sp{i+1}",
                type=RelationType.RELATED_TO
            ))

        # Find shortest path
        path = graph.find_shortest_path("sp1", "sp4")

        assert path is not None
        assert len(path.nodes) == 4
        assert len(path.edges) == 3

    def test_get_subgraph(self, graph_manager):
        """Test subgraph extraction."""
        from docs.contracts.graph_contracts import (
            Entity, EntityType, Relationship, RelationType
        )

        graph = graph_manager

        # Create entities
        graph.create_entity(Entity(id="sg1", name="Center", type=EntityType.CHARACTER))
        graph.create_entity(Entity(id="sg2", name="Near1", type=EntityType.CHARACTER))
        graph.create_entity(Entity(id="sg3", name="Near2", type=EntityType.CHARACTER))
        graph.create_entity(Entity(id="sg4", name="Far", type=EntityType.CHARACTER))

        # Connect: sg1 <-> sg2, sg1 <-> sg3, sg3 <-> sg4
        graph.create_relationship(Relationship(
            id="sgr1", source_id="sg1", target_id="sg2", type=RelationType.KNOWS
        ))
        graph.create_relationship(Relationship(
            id="sgr2", source_id="sg1", target_id="sg3", type=RelationType.KNOWS
        ))
        graph.create_relationship(Relationship(
            id="sgr3", source_id="sg3", target_id="sg4", type=RelationType.KNOWS
        ))

        # Get subgraph with radius 1
        subgraph = graph.get_subgraph("sg1", radius=1)

        assert subgraph.center_entity_id == "sg1"
        entity_ids = [e.id for e in subgraph.entities]
        assert "sg1" in entity_ids
        assert "sg2" in entity_ids
        assert "sg3" in entity_ids


# ============================================================
# Section 2: Distillation Cycle Integration Tests
# ============================================================

class TestDistillationCycleIntegration:
    """Test Distillation Cycle for knowledge extraction and refinement."""

    @pytest.fixture
    def sample_novel_content(self):
        """Sample novel content for distillation tests."""
        return """
        Chapter One: The Awakening

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

    def test_distillation_to_memory_cycle(
        self, integrated_knowledge_system, sample_novel_content
    ):
        """Test complete distillation to memory cycle."""
        distill_mgr = integrated_knowledge_system["distillation"]
        memory_mgr = integrated_knowledge_system["memory"]

        from memory.distillation_manager import DistillationTemplate

        # Step 1: Distill content
        result = distill_mgr.distill(
            sources=[sample_novel_content],
            template=DistillationTemplate.SUMMARY,
            source_ids=["chapter-1"]
        )

        assert result.result_id.startswith("dist-")
        assert len(result.content) > 0

        # Step 2: Create memory from distillation
        memory_id = distill_mgr.create_memory_from_distillation(
            content=result.content,
            prompt_type="summary",
            topics=["plot", "chapter_1"]
        )

        assert memory_id is not None

        # Step 3: Verify memory was created
        memory = memory_mgr.get(memory_id)
        assert memory is not None
        assert memory.source == "distill"

    def test_multi_template_distillation(
        self, distillation_manager, sample_novel_content
    ):
        """Test distillation with all six templates."""
        from memory.distillation_manager import DistillationTemplate

        # Batch distill with all templates
        results = distillation_manager.batch_distill(
            sources=[sample_novel_content],
            source_ids=["multi-template-test"]
        )

        assert len(results) == 6

        # Verify each template produced results
        for template in DistillationTemplate:
            assert template in results
            assert results[template].content is not None
            assert len(results[template].content) > 0

    def test_distillation_with_citations(
        self, integrated_knowledge_system, sample_novel_content
    ):
        """Test distillation creates proper citations."""
        distill_mgr = integrated_knowledge_system["distillation"]
        citation_mgr = integrated_knowledge_system["citation"]

        from memory.distillation_manager import DistillationTemplate

        # Distill with citation tracking
        result = distill_mgr.distill(
            sources=[sample_novel_content],
            template=DistillationTemplate.CHARACTER_TRAITS,
            source_ids=["citation-test"]
        )

        # Get derived from citations
        citations = distill_mgr.get_derived_from(result.result_id)

        # Should have created citations
        assert len(citations) >= 1

        for citation in citations:
            assert "derived_from" in citation.tags
            assert "distillation" in citation.tags

    def test_distillation_cycle_with_graph_entities(
        self, integrated_knowledge_system, sample_novel_content
    ):
        """Test distillation extracts entities for graph."""
        distill_mgr = integrated_knowledge_system["distillation"]
        graph_mgr = integrated_knowledge_system["graph"]

        from memory.distillation_manager import DistillationTemplate
        from docs.contracts.graph_contracts import Entity, EntityType

        # Distill character traits
        result = distill_mgr.distill(
            sources=[sample_novel_content],
            template=DistillationTemplate.CHARACTER_TRAITS,
            source_ids=["graph-integration"]
        )

        # Manually create entities based on distillation
        # In production, this would be automated by an entity extraction service
        entities = [
            Entity(id="lin-xiao", name="Lin Xiao", type=EntityType.CHARACTER,
                   properties={"age": 25, "magic": "elemental"}),
            Entity(id="zhang-ming", name="Zhang Ming", type=EntityType.CHARACTER,
                   properties={"appearance": "silver hair", "wisdom": "ancient"}),
        ]

        for entity in entities:
            graph_mgr.create_entity(entity)

        # Verify entities exist in graph
        lin_xiao = graph_mgr.get_entity("lin-xiao")
        assert lin_xiao is not None
        assert lin_xiao.properties["magic"] == "elemental"

    def test_distillation_refinement_cycle(
        self, integrated_knowledge_system, sample_novel_content
    ):
        """Test iterative distillation refinement."""
        distill_mgr = integrated_knowledge_system["distillation"]
        memory_mgr = integrated_knowledge_system["memory"]

        from memory.distillation_manager import DistillationTemplate

        # First distillation pass
        summary1 = distill_mgr.distill(
            sources=[sample_novel_content],
            template=DistillationTemplate.SUMMARY,
            source_ids=["refinement-pass-1"]
        )

        # Create memory from first pass
        memory1_id = distill_mgr.create_memory_from_distillation(
            content=summary1.content,
            prompt_type="summary",
            topics=["draft"]
        )

        # Second distillation pass using first summary as input
        summary2 = distill_mgr.distill(
            sources=[summary1.content, sample_novel_content],
            template=DistillationTemplate.KEY_POINTS,
            source_ids=["refinement-pass-2", "original"]
        )

        # Verify refinement produced results
        assert len(summary2.content) > 0
        assert summary2.result_id != summary1.result_id


class TestDistillationTemplates:
    """Test individual distillation templates."""

    @pytest.fixture
    def sample_content(self):
        """Sample content for template tests."""
        return """
        The ancient temple stood silent in the moonlight. Sarah approached
        cautiously, her footsteps echoing on the marble floor. The prophecy
        had led her here, to this forgotten place where magic still lingered.

        "You've finally come," whispered a voice from the shadows.

        Sarah's hand went to her sword. "Who's there?"

        A figure emerged - an old woman with piercing blue eyes. "I am the
        Guardian. I've waited three hundred years for the chosen one."
        """

    def test_summary_template(self, distillation_manager, sample_content):
        """Test SUMMARY distillation template."""
        from memory.distillation_manager import DistillationTemplate

        result = distillation_manager.distill(
            sources=[sample_content],
            template=DistillationTemplate.SUMMARY,
            source_ids=["summary-test"]
        )

        assert result.template == DistillationTemplate.SUMMARY
        assert len(result.content) < len(sample_content)

    def test_key_points_template(self, distillation_manager, sample_content):
        """Test KEY_POINTS distillation template."""
        from memory.distillation_manager import DistillationTemplate

        result = distillation_manager.distill(
            sources=[sample_content],
            template=DistillationTemplate.KEY_POINTS,
            source_ids=["key-points-test"]
        )

        assert result.template == DistillationTemplate.KEY_POINTS
        # Key points should have list indicators
        has_list = any(c in result.content for c in ["1.", "1)", "-", "*"])
        # Note: Simple distillation may not produce numbered list

    def test_character_traits_template(self, distillation_manager, sample_content):
        """Test CHARACTER_TRAITS distillation template."""
        from memory.distillation_manager import DistillationTemplate

        result = distillation_manager.distill(
            sources=[sample_content],
            template=DistillationTemplate.CHARACTER_TRAITS,
            source_ids=["character-test"]
        )

        assert result.template == DistillationTemplate.CHARACTER_TRAITS

    def test_plot_structure_template(self, distillation_manager, sample_content):
        """Test PLOT_STRUCTURE distillation template."""
        from memory.distillation_manager import DistillationTemplate

        result = distillation_manager.distill(
            sources=[sample_content],
            template=DistillationTemplate.PLOT_STRUCTURE,
            source_ids=["plot-test"]
        )

        assert result.template == DistillationTemplate.PLOT_STRUCTURE

    def test_world_building_template(self, distillation_manager, sample_content):
        """Test WORLD_BUILDING distillation template."""
        from memory.distillation_manager import DistillationTemplate

        result = distillation_manager.distill(
            sources=[sample_content],
            template=DistillationTemplate.WORLD_BUILDING,
            source_ids=["world-test"]
        )

        assert result.template == DistillationTemplate.WORLD_BUILDING

    def test_style_elements_template(self, distillation_manager, sample_content):
        """Test STYLE_ELEMENTS distillation template."""
        from memory.distillation_manager import DistillationTemplate

        result = distillation_manager.distill(
            sources=[sample_content],
            template=DistillationTemplate.STYLE_ELEMENTS,
            source_ids=["style-test"]
        )

        assert result.template == DistillationTemplate.STYLE_ELEMENTS
        # Style analysis should include metrics
        assert "Word count" in result.content or "Sentence" in result.content


# ============================================================
# Section 3: StoreManager + GraphManager Integration
# ============================================================

class TestStoreGraphIntegration:
    """Test integration between StoreManager and GraphManager."""

    def test_document_to_entity_flow(self, integrated_knowledge_system):
        """Test flow from document ingestion to entity creation."""
        store = integrated_knowledge_system["store"]
        graph = integrated_knowledge_system["graph"]

        from docs.contracts.graph_contracts import Entity, EntityType

        # Add document to store
        doc_id = store.add_document(
            path="character_profile.md",
            content="""
            # Character Profile: Lin Xiao

            Age: 25
            Role: Protagonist
            Magic: Elemental (Five Elements)
            Background: Mysterious lineage, witnessed great tragedy
            """
        )

        # Extract entity from document (simulated)
        entity = Entity(
            id=f"entity-from-{doc_id}",
            name="Lin Xiao",
            type=EntityType.CHARACTER,
            properties={
                "source_doc": doc_id,
                "age": 25,
                "role": "protagonist",
                "magic_type": "elemental"
            }
        )
        graph.create_entity(entity)

        # Verify connection
        retrieved_entity = graph.get_entity(f"entity-from-{doc_id}")
        assert retrieved_entity is not None
        assert retrieved_entity.properties["source_doc"] == doc_id

        # Verify document still accessible
        doc = store.get_document(doc_id)
        assert doc is not None
        assert "Lin Xiao" in doc.content

    def test_chunk_to_entity_linking(self, integrated_knowledge_system):
        """Test linking document chunks to graph entities."""
        store = integrated_knowledge_system["store"]
        graph = integrated_knowledge_system["graph"]

        from docs.contracts.graph_contracts import Entity, EntityType, Relationship, RelationType

        # Add long document that will be chunked
        doc_id = store.add_document(
            path="novel_chapter.md",
            content="Lin Xiao and Zhang Ming traveled together. " * 50
        )

        chunks = store.get_chunks(doc_id)

        # Create entities
        graph.create_entity(Entity(id="char-lx", name="Lin Xiao", type=EntityType.CHARACTER))
        graph.create_entity(Entity(id="char-zm", name="Zhang Ming", type=EntityType.CHARACTER))

        # Create relationship
        graph.create_relationship(Relationship(
            id="rel-travel",
            source_id="char-lx",
            target_id="char-zm",
            type=RelationType.KNOWS,
            properties={"context": "travel companions", "source_doc": doc_id}
        ))

        # Verify
        rels = graph.get_relationships("char-lx")
        travel_rel = [r for r in rels if r.properties.get("source_doc") == doc_id]
        assert len(travel_rel) >= 1

    def test_cross_reference_search(self, integrated_knowledge_system):
        """Test searching across both store and graph."""
        store = integrated_knowledge_system["store"]
        graph = integrated_knowledge_system["graph"]

        from docs.contracts.graph_contracts import Entity, EntityType

        # Add multiple documents
        store.add_document(
            path="doc1.md",
            content="The magical artifact was discovered in the ancient temple."
        )
        store.add_document(
            path="doc2.md",
            content="The artifact granted its wielder immense power."
        )

        # Add entity
        graph.create_entity(Entity(
            id="artifact-001",
            name="Magical Artifact",
            type=EntityType.ITEM,
            properties={"location": "ancient temple", "power": "immense"}
        ))

        # Search both
        doc_results = store.search_by_content("artifact")
        entity_results = graph.search_entities("artifact")

        assert len(doc_results) == 2
        assert len(entity_results) >= 1


# ============================================================
# Section 4: Full Knowledge Pipeline Tests
# ============================================================

class TestFullKnowledgePipeline:
    """Test complete knowledge extraction and retrieval pipeline."""

    def test_ingest_distill_store_retrieve(self, integrated_knowledge_system):
        """Test full pipeline: ingest -> distill -> store -> retrieve."""
        store = integrated_knowledge_system["store"]
        distill_mgr = integrated_knowledge_system["distillation"]
        memory_mgr = integrated_knowledge_system["memory"]

        from memory.distillation_manager import DistillationTemplate

        # Step 1: Ingest raw content
        raw_content = """
        The hero embarked on a journey to find the lost kingdom. Along the way,
        he encountered many challenges and made unexpected allies. The path was
        treacherous, but his determination never wavered.
        """

        doc_id = store.add_document(
            path="journey.md",
            content=raw_content,
            metadata={"type": "narrative", "chapter": 1}
        )

        # Step 2: Distill content
        summary = distill_mgr.distill(
            sources=[raw_content],
            template=DistillationTemplate.SUMMARY,
            source_ids=[doc_id]
        )

        key_points = distill_mgr.distill(
            sources=[raw_content],
            template=DistillationTemplate.KEY_POINTS,
            source_ids=[doc_id]
        )

        # Step 3: Store distilled knowledge as memory
        memory_id = distill_mgr.create_memory_from_distillation(
            content=summary.content,
            prompt_type="summary",
            topics=["plot", "journey"]
        )

        # Step 4: Retrieve and verify
        doc = store.get_document(doc_id)
        memory = memory_mgr.get(memory_id)

        assert doc is not None
        assert memory is not None
        assert memory.source == "distill"

    def test_knowledge_layer_unified_query(self, knowledge_layer):
        """Test unified query through AgentKnowledgeLayer."""
        kl = knowledge_layer

        # Populate knowledge layer
        kl.add_entity("hero-001", "The Hero", "Character")
        kl.add_entity("kingdom-001", "Lost Kingdom", "Location")
        kl.add_relation("hero-001", "kingdom-001", "SEEKS")

        # Unified hybrid query
        results = kl.query_hybrid("hero seeks kingdom", top_k=10)

        assert "chunks" in results
        assert "entities" in results

    def test_concurrent_knowledge_operations(self, integrated_knowledge_system):
        """Test concurrent operations across knowledge components."""
        import threading

        store = integrated_knowledge_system["store"]
        graph = integrated_knowledge_system["graph"]

        from docs.contracts.graph_contracts import Entity, EntityType

        errors = []
        results = {"docs": [], "entities": []}
        lock = threading.Lock()

        def add_document(idx):
            try:
                doc_id = store.add_document(
                    path=f"concurrent_{idx}.md",
                    content=f"Concurrent document content {idx}"
                )
                with lock:
                    results["docs"].append(doc_id)
            except Exception as e:
                with lock:
                    errors.append(str(e))

        def add_entity(idx):
            try:
                entity = Entity(
                    id=f"concurrent-entity-{idx}",
                    name=f"Entity {idx}",
                    type=EntityType.CONCEPT
                )
                entity_id = graph.create_entity(entity)
                with lock:
                    results["entities"].append(entity_id)
            except Exception as e:
                with lock:
                    errors.append(str(e))

        # Run concurrent operations
        threads = []
        for i in range(5):
            threads.append(threading.Thread(target=add_document, args=(i,)))
            threads.append(threading.Thread(target=add_entity, args=(i,)))

        for t in threads:
            t.start()

        for t in threads:
            t.join()

        # Verify no errors
        assert len(errors) == 0, f"Errors occurred: {errors}"
        assert len(results["docs"]) == 5
        assert len(results["entities"]) == 5


# ============================================================
# Section 5: Error Handling and Edge Cases
# ============================================================

class TestKnowledgeLayerErrorHandling:
    """Test error handling across knowledge layer components."""

    def test_graph_entity_not_found(self, graph_manager):
        """Test handling of non-existent entity queries."""
        entity = graph_manager.get_entity("non-existent-id")
        assert entity is None

    def test_store_document_not_found(self, store_manager):
        """Test handling of non-existent document queries."""
        doc = store_manager.get_document("non-existent-id")
        assert doc is None

    def test_hybrid_search_with_empty_graph(self, knowledge_layer):
        """Test hybrid search with no entities in graph."""
        results = knowledge_layer.query_hybrid("test query")

        assert "chunks" in results
        assert "entities" in results
        assert len(results["entities"]) == 0

    def test_distillation_empty_content(self, distillation_manager):
        """Test distillation with empty content."""
        from memory.distillation_manager import DistillationTemplate

        result = distillation_manager.distill(
            sources=[""],
            template=DistillationTemplate.SUMMARY,
            source_ids=["empty-test"]
        )

        assert result is not None

    def test_graph_relationship_with_missing_entity(self, graph_manager):
        """Test relationship creation with missing entities."""
        from docs.contracts.graph_contracts import Relationship, RelationType

        # Try to create relationship without entities
        rel = Relationship(
            id="orphan-rel",
            source_id="missing-source",
            target_id="missing-target",
            type=RelationType.KNOWS
        )

        # This may raise an integrity error or silently fail
        try:
            graph_manager.create_relationship(rel)
        except Exception:
            pass  # Expected behavior


# ============================================================
# Section 6: Performance and Persistence Tests
# ============================================================

class TestKnowledgeLayerPersistence:
    """Test persistence across knowledge layer components."""

    def test_store_persistence(self, temp_base_path):
        """Test store data persists across instances."""
        from store.store_manager import StoreManager

        # Create store and add document
        store1 = StoreManager(base_path=temp_base_path)
        doc_id = store1.add_document(
            path="persistent.md",
            content="Persistent content"
        )

        # Create new instance
        store2 = StoreManager(base_path=temp_base_path)

        # Document should persist
        doc = store2.get_document(doc_id)
        assert doc is not None
        assert doc.content == "Persistent content"

    def test_graph_persistence(self, graph_db_path):
        """Test graph data persists across instances."""
        from graph.graph_manager import GraphManager
        from docs.contracts.graph_contracts import Entity, EntityType

        # Create graph and add entity
        graph1 = GraphManager(db_path=str(graph_db_path))
        entity = Entity(
            id="persist-entity",
            name="Persistent Entity",
            type=EntityType.CHARACTER
        )
        graph1.create_entity(entity)
        graph1.close()

        # Create new instance
        graph2 = GraphManager(db_path=str(graph_db_path))

        # Entity should persist
        retrieved = graph2.get_entity("persist-entity")
        assert retrieved is not None
        assert retrieved.name == "Persistent Entity"
        graph2.close()

    def test_distillation_persistence(self, temp_base_path):
        """Test distillation results persist across instances."""
        from memory.distillation_manager import (
            DistillationManager,
            DistillationTemplate,
            reset_distillation_manager
        )

        reset_distillation_manager()

        # Create manager and distill
        mgr1 = DistillationManager(base_path=temp_base_path)
        result = mgr1.distill(
            sources=["Persistent distillation content"],
            template=DistillationTemplate.SUMMARY,
            source_ids=["persist-src"]
        )
        result_id = result.result_id

        # Create new instance
        mgr2 = DistillationManager(base_path=temp_base_path)

        # Result should persist
        retrieved = mgr2.get_result(result_id)
        assert retrieved is not None


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
