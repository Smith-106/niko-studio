"""
Unit tests for DistillationManager.

Tests the knowledge distillation system including:
- 6 distillation templates
- DerivedFrom relationship tracking
- CitationManager integration
- Memory creation from distillation
"""

import json
import pytest
import tempfile
import shutil
from pathlib import Path
from unittest.mock import Mock, MagicMock, patch

from src.memory.distillation_manager import (
    DistillationManager,
    DistillationTemplate,
    DistillationResult,
    DISTILLATION_PROMPTS,
    get_distillation_manager,
    reset_distillation_manager,
)
from src.memory.citation_manager import (
    CitationManager,
    TransientCitation,
    PersistedCitation,
)


class TestDistillationTemplate:
    """Tests for DistillationTemplate enum."""

    def test_all_six_templates_exist(self):
        """Verify all 6 distillation templates are defined."""
        expected_templates = [
            "summary",
            "key_points",
            "character_traits",
            "plot_structure",
            "world_building",
            "style_elements",
        ]
        actual_templates = [t.value for t in DistillationTemplate]
        assert len(actual_templates) == 6
        for template in expected_templates:
            assert template in actual_templates

    def test_template_prompts_defined(self):
        """Verify prompts exist for all templates."""
        for template in DistillationTemplate:
            assert template in DISTILLATION_PROMPTS
            assert len(DISTILLATION_PROMPTS[template]) > 0
            assert "{content}" in DISTILLATION_PROMPTS[template]


class TestDistillationResult:
    """Tests for DistillationResult dataclass."""

    def test_create_result(self):
        """Test creating a DistillationResult."""
        result = DistillationResult(
            result_id="dist-test-001",
            source_ids=["source-1", "source-2"],
            template=DistillationTemplate.SUMMARY,
            content="Test distilled content",
            derived_from=["cit-001", "cit-002"],
            metadata={"key": "value"}
        )
        
        assert result.result_id == "dist-test-001"
        assert len(result.source_ids) == 2
        assert result.template == DistillationTemplate.SUMMARY
        assert result.content == "Test distilled content"
        assert len(result.derived_from) == 2

    def test_to_dict(self):
        """Test converting result to dictionary."""
        result = DistillationResult(
            result_id="dist-test-002",
            source_ids=["source-1"],
            template=DistillationTemplate.KEY_POINTS,
            content="Key points content"
        )
        
        data = result.to_dict()
        
        assert data["result_id"] == "dist-test-002"
        assert data["template"] == "key_points"
        assert data["content"] == "Key points content"

    def test_from_dict(self):
        """Test creating result from dictionary."""
        data = {
            "result_id": "dist-test-003",
            "source_ids": ["src-1"],
            "template": "character_traits",
            "content": "Character analysis",
            "derived_from": ["cit-003"],
            "created_at": "2026-02-05T10:00:00+00:00",
            "metadata": {"author": "test"}
        }
        
        result = DistillationResult.from_dict(data)
        
        assert result.result_id == "dist-test-003"
        assert result.template == DistillationTemplate.CHARACTER_TRAITS
        assert result.metadata["author"] == "test"


class TestDistillationManager:
    """Tests for DistillationManager class."""

    @pytest.fixture
    def temp_dir(self):
        """Create temporary directory for tests."""
        temp = tempfile.mkdtemp()
        yield temp
        shutil.rmtree(temp)

    @pytest.fixture
    def manager(self, temp_dir):
        """Create DistillationManager for tests."""
        return DistillationManager(base_path=temp_dir)

    @pytest.fixture
    def citation_manager(self, temp_dir):
        """Create CitationManager for integration tests."""
        return CitationManager(base_path=temp_dir)

    def test_init(self, manager, temp_dir):
        """Test DistillationManager initialization."""
        assert manager.base_path == Path(temp_dir)
        assert manager.distillation_dir.exists()
        assert len(manager._results_index) == 0

    def test_get_prompt_by_template(self, manager):
        """Test getting prompt by template enum."""
        prompt = manager.get_prompt(DistillationTemplate.SUMMARY)
        
        assert "PURPOSE" in prompt
        assert "{content}" in prompt

    def test_get_prompt_by_string(self, manager):
        """Test getting prompt by string value."""
        prompt = manager.get_prompt("key_points")
        
        assert "PURPOSE" in prompt
        assert "key points" in prompt.lower()

    def test_get_distillation_prompt(self, manager):
        """Test IDistillationService.get_distillation_prompt interface."""
        prompt = manager.get_distillation_prompt("summary")
        
        assert "PURPOSE" in prompt
        assert "summary" in prompt.lower()

    def test_get_distillation_prompt_invalid(self, manager):
        """Test fallback for invalid prompt type."""
        prompt = manager.get_distillation_prompt("invalid_type")
        
        # Should fall back to summary
        assert "PURPOSE" in prompt

    def test_distill_simple(self, manager):
        """Test basic distillation without LLM."""
        sources = ["This is the first paragraph. It contains important information."]
        
        result = manager.distill(
            sources=sources,
            template=DistillationTemplate.SUMMARY,
            source_ids=["doc-001"]
        )
        
        assert result.result_id.startswith("dist-")
        assert result.template == DistillationTemplate.SUMMARY
        assert len(result.content) > 0
        assert "doc-001" in result.source_ids

    def test_distill_key_points(self, manager):
        """Test key points distillation."""
        sources = [
            "First paragraph with point one.\n\n"
            "Second paragraph with point two.\n\n"
            "Third paragraph with point three."
        ]
        
        result = manager.distill(
            sources=sources,
            template="key_points",
            source_ids=["doc-002"]
        )
        
        assert result.template == DistillationTemplate.KEY_POINTS
        assert len(result.content) > 0

    def test_distill_with_citation_manager(self, manager, citation_manager):
        """Test distillation with DerivedFrom citation tracking."""
        manager.set_citation_manager(citation_manager)
        
        sources = ["Source content for distillation."]
        result = manager.distill(
            sources=sources,
            template=DistillationTemplate.SUMMARY,
            source_ids=["doc-003"]
        )
        
        assert len(result.derived_from) == 1
        
        # Verify citation was created
        citation_id = result.derived_from[0]
        citation = citation_manager.get_citation(citation_id)
        assert citation is not None
        assert "derived_from" in citation.tags

    def test_get_derived_from(self, manager, citation_manager):
        """Test retrieving DerivedFrom citations."""
        manager.set_citation_manager(citation_manager)
        
        sources = ["Content one.", "Content two."]
        result = manager.distill(
            sources=sources,
            template=DistillationTemplate.SUMMARY,
            source_ids=["src-1", "src-2"]
        )
        
        citations = manager.get_derived_from(result.result_id)
        
        assert len(citations) == 2
        for citation in citations:
            assert isinstance(citation, PersistedCitation)

    def test_list_by_template(self, manager):
        """Test listing results by template type."""
        # Create multiple results
        manager.distill(["Content 1"], DistillationTemplate.SUMMARY, ["s1"])
        manager.distill(["Content 2"], DistillationTemplate.SUMMARY, ["s2"])
        manager.distill(["Content 3"], DistillationTemplate.KEY_POINTS, ["s3"])
        
        summary_results = manager.list_by_template(DistillationTemplate.SUMMARY)
        key_points_results = manager.list_by_template("key_points")
        
        assert len(summary_results) == 2
        assert len(key_points_results) == 1

    def test_get_result(self, manager):
        """Test retrieving result by ID."""
        result = manager.distill(
            sources=["Test content"],
            template=DistillationTemplate.SUMMARY,
            source_ids=["test-src"]
        )
        
        retrieved = manager.get_result(result.result_id)
        
        assert retrieved is not None
        assert retrieved.result_id == result.result_id
        assert retrieved.content == result.content

    def test_get_result_not_found(self, manager):
        """Test retrieving non-existent result."""
        result = manager.get_result("non-existent-id")
        assert result is None

    def test_delete_result(self, manager):
        """Test deleting a result."""
        result = manager.distill(
            sources=["Content to delete"],
            template=DistillationTemplate.SUMMARY,
            source_ids=["del-src"]
        )
        
        assert manager.get_result(result.result_id) is not None
        
        deleted = manager.delete_result(result.result_id)
        
        assert deleted is True
        assert manager.get_result(result.result_id) is None

    def test_batch_distill(self, manager):
        """Test batch distillation with all templates."""
        sources = ["Content for batch distillation. This is a test paragraph."]
        
        results = manager.batch_distill(sources, source_ids=["batch-src"])
        
        assert len(results) == 6
        for template in DistillationTemplate:
            assert template in results
            assert results[template].content is not None

    def test_stats(self, manager):
        """Test statistics generation."""
        manager.distill(["C1"], DistillationTemplate.SUMMARY, ["s1"])
        manager.distill(["C2"], DistillationTemplate.KEY_POINTS, ["s2"])
        
        stats = manager.stats()
        
        assert stats["total_results"] == 2
        assert "summary" in stats["by_template"]
        assert stats["by_template"]["summary"] == 1

    def test_list_templates(self, manager):
        """Test listing available templates."""
        templates = manager.list_templates()
        
        assert len(templates) == 6
        for t in templates:
            assert "name" in t
            assert "description" in t

    def test_persistence(self, temp_dir):
        """Test results persist across manager instances."""
        # Create result with first manager
        manager1 = DistillationManager(base_path=temp_dir)
        result = manager1.distill(
            sources=["Persistent content"],
            template=DistillationTemplate.SUMMARY,
            source_ids=["persist-src"]
        )
        result_id = result.result_id
        
        # Load with new manager
        manager2 = DistillationManager(base_path=temp_dir)
        loaded = manager2.get_result(result_id)
        
        assert loaded is not None
        assert loaded.content == result.content


class TestDistillationManagerWithLLM:
    """Tests for DistillationManager with mock LLM client."""

    @pytest.fixture
    def temp_dir(self):
        """Create temporary directory."""
        temp = tempfile.mkdtemp()
        yield temp
        shutil.rmtree(temp)

    def test_distill_with_llm_generate(self, temp_dir):
        """Test distillation using LLM with generate method."""
        mock_llm = Mock()
        mock_llm.generate.return_value = "LLM generated summary"
        
        manager = DistillationManager(
            base_path=temp_dir,
            llm_client=mock_llm
        )
        
        result = manager.distill(
            sources=["Source content"],
            template=DistillationTemplate.SUMMARY,
            source_ids=["llm-src"]
        )
        
        assert result.content == "LLM generated summary"
        mock_llm.generate.assert_called_once()

    def test_distill_with_llm_complete(self, temp_dir):
        """Test distillation using LLM with complete method."""
        mock_llm = Mock(spec=['complete'])
        mock_llm.complete.return_value = "LLM completed content"
        
        manager = DistillationManager(
            base_path=temp_dir,
            llm_client=mock_llm
        )
        
        result = manager.distill(
            sources=["Source"],
            template=DistillationTemplate.KEY_POINTS,
            source_ids=["llm-src"]
        )
        
        assert result.content == "LLM completed content"

    def test_distill_with_callable_llm(self, temp_dir):
        """Test distillation using callable LLM."""
        def callable_llm(prompt):
            return "Callable LLM result"

        manager = DistillationManager(
            base_path=temp_dir,
            llm_client=callable_llm
        )

        result = manager.distill(
            sources=["Source"],
            template=DistillationTemplate.SUMMARY,
            source_ids=["callable-src"]
        )

        assert result.content == "Callable LLM result"

    def test_llm_failure_fallback(self, temp_dir):
        """Test fallback to simple distillation on LLM failure."""
        mock_llm = Mock()
        mock_llm.generate.side_effect = Exception("LLM error")
        
        manager = DistillationManager(
            base_path=temp_dir,
            llm_client=mock_llm
        )
        
        result = manager.distill(
            sources=["Fallback content. This should work."],
            template=DistillationTemplate.SUMMARY,
            source_ids=["fallback-src"]
        )
        
        # Should fall back to simple distillation
        assert len(result.content) > 0


class TestDistillationManagerMemoryIntegration:
    """Tests for DistillationManager with MemoryManager integration."""

    @pytest.fixture
    def temp_dir(self):
        """Create temporary directory."""
        temp = tempfile.mkdtemp()
        yield temp
        shutil.rmtree(temp)

    def test_create_memory_from_distillation(self, temp_dir):
        """Test creating memory entry from distillation."""
        from src.memory.memory_manager import MemoryManager
        
        memory_manager = MemoryManager(base_path=temp_dir)
        manager = DistillationManager(
            base_path=temp_dir,
            memory_manager=memory_manager
        )
        
        memory_id = manager.create_memory_from_distillation(
            content="Distilled knowledge content",
            prompt_type="summary",
            tags=["knowledge", "distilled"],
            topics=["writing", "summary"]
        )
        
        assert memory_id is not None
        
        # Verify memory was created
        entry = memory_manager.get(memory_id)
        assert entry is not None
        assert "Distilled knowledge content" in entry.content
        assert entry.source == "distill"

    def test_create_memory_without_manager(self, temp_dir):
        """Test create_memory returns None without MemoryManager."""
        manager = DistillationManager(base_path=temp_dir)
        
        result = manager.create_memory_from_distillation(
            content="Content",
            prompt_type="summary"
        )
        
        assert result is None


class TestFactoryFunctions:
    """Tests for factory functions."""

    @pytest.fixture(autouse=True)
    def reset_singleton(self):
        """Reset singleton before each test."""
        reset_distillation_manager()
        yield
        reset_distillation_manager()

    def test_get_distillation_manager_singleton(self):
        """Test singleton pattern."""
        manager1 = get_distillation_manager()
        manager2 = get_distillation_manager()
        
        assert manager1 is manager2

    def test_get_distillation_manager_with_deps(self, tmp_path):
        """Test getting manager with dependencies."""
        from src.memory.citation_manager import CitationManager
        from src.memory.memory_manager import MemoryManager
        
        citation_mgr = CitationManager(base_path=tmp_path)
        memory_mgr = MemoryManager(base_path=tmp_path)
        
        manager = get_distillation_manager(
            base_path=tmp_path,
            citation_manager=citation_mgr,
            memory_manager=memory_mgr
        )
        
        assert manager._citation_manager is citation_mgr
        assert manager._memory_manager is memory_mgr


class TestSimpleDistillation:
    """Tests for simple (non-LLM) distillation methods."""

    @pytest.fixture
    def manager(self, tmp_path):
        """Create manager without LLM."""
        return DistillationManager(base_path=tmp_path)

    def test_simple_summary(self, manager):
        """Test simple summary extraction."""
        content = "First sentence. Second sentence. Third sentence. Fourth sentence."
        result = manager._simple_distill(content, DistillationTemplate.SUMMARY)
        
        assert "First sentence" in result
        assert len(result) < len(content)

    def test_simple_key_points(self, manager):
        """Test simple key points extraction."""
        content = "First point here.\n\nSecond point here.\n\nThird point here."
        result = manager._simple_distill(content, DistillationTemplate.KEY_POINTS)
        
        assert "1." in result or "First" in result

    def test_simple_style_metrics(self, manager):
        """Test simple style analysis metrics."""
        content = "Short sentence. Another short one. And one more here."
        result = manager._simple_distill(content, DistillationTemplate.STYLE_ELEMENTS)
        
        assert "Word count" in result
        assert "Sentence count" in result


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
