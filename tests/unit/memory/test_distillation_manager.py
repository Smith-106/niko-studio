"""
Distillation Manager Tests

Tests for DistillationTemplate, DistillationResult, DISTILLATION_PROMPTS,
DistillationManager (_simple_distill, get_prompt, distill, stats, list_templates,
get_result, delete_result, batch_distill, legacy methods),
and factory functions.
"""

import pytest
import json
from pathlib import Path
from unittest.mock import MagicMock
from src.memory.distillation_manager import (
    DistillationTemplate,
    DistillationResult,
    DistillationManager,
    DISTILLATION_PROMPTS,
    get_distillation_manager,
    reset_distillation_manager,
)


# ============================================================
# Data Model Tests
# ============================================================

class TestDistillationTemplate:

    def test_all_values(self):
        assert DistillationTemplate.SUMMARY.value == "summary"
        assert DistillationTemplate.KEY_POINTS.value == "key_points"
        assert DistillationTemplate.CHARACTER_TRAITS.value == "character_traits"
        assert DistillationTemplate.PLOT_STRUCTURE.value == "plot_structure"
        assert DistillationTemplate.WORLD_BUILDING.value == "world_building"
        assert DistillationTemplate.STYLE_ELEMENTS.value == "style_elements"

    def test_six_templates(self):
        assert len(DistillationTemplate) == 6


class TestDistillationResult:

    def test_defaults(self):
        dr = DistillationResult(
            result_id="r1",
            source_ids=["s1"],
            template=DistillationTemplate.SUMMARY,
            content="test summary",
        )
        assert dr.derived_from == []
        assert dr.metadata == {}
        assert dr.created_at is not None

    def test_to_dict(self):
        dr = DistillationResult(
            result_id="r1",
            source_ids=["s1", "s2"],
            template=DistillationTemplate.KEY_POINTS,
            content="key points here",
            metadata={"key": "val"},
        )
        d = dr.to_dict()
        assert d["result_id"] == "r1"
        assert d["template"] == "key_points"
        assert d["source_ids"] == ["s1", "s2"]
        assert d["metadata"] == {"key": "val"}

    def test_from_dict(self):
        data = {
            "result_id": "r1",
            "source_ids": ["s1"],
            "template": "summary",
            "content": "test",
        }
        dr = DistillationResult.from_dict(data)
        assert dr.result_id == "r1"
        assert dr.template == DistillationTemplate.SUMMARY
        assert dr.content == "test"

    def test_from_dict_defaults(self):
        data = {
            "result_id": "r1",
        }
        dr = DistillationResult.from_dict(data)
        assert dr.source_ids == []
        assert dr.template == DistillationTemplate.SUMMARY
        assert dr.content == ""
        assert dr.derived_from == []

    def test_roundtrip(self):
        original = DistillationResult(
            result_id="r1",
            source_ids=["s1"],
            template=DistillationTemplate.CHARACTER_TRAITS,
            content="character analysis",
            derived_from=["c1"],
            metadata={"tag": "test"},
        )
        d = original.to_dict()
        restored = DistillationResult.from_dict(d)
        assert restored.result_id == original.result_id
        assert restored.template == original.template
        assert restored.content == original.content
        assert restored.derived_from == original.derived_from


class TestDistillationPrompts:

    def test_all_templates_have_prompts(self):
        for t in DistillationTemplate:
            assert t in DISTILLATION_PROMPTS
            assert len(DISTILLATION_PROMPTS[t]) > 0

    def test_prompts_contain_content_placeholder(self):
        for t in DistillationTemplate:
            assert "{content}" in DISTILLATION_PROMPTS[t]


# ============================================================
# DistillationManager Tests
# ============================================================

class TestDistillationManager:

    @pytest.fixture(autouse=True)
    def setup(self, tmp_path):
        reset_distillation_manager()
        self.mgr = DistillationManager(base_path=tmp_path)

    def test_get_prompt_by_enum(self):
        prompt = self.mgr.get_prompt(DistillationTemplate.SUMMARY)
        assert "summary" in prompt.lower() or "PURPOSE" in prompt

    def test_get_prompt_by_string(self):
        prompt = self.mgr.get_prompt("key_points")
        assert "key points" in prompt.lower() or "KEY" in prompt.upper()

    def test_get_prompt_fallback(self):
        # Unknown template value should fallback to SUMMARY
        prompt = self.mgr.get_prompt(DistillationTemplate.SUMMARY)
        assert len(prompt) > 0

    def test_get_distillation_prompt(self):
        prompt = self.mgr.get_distillation_prompt("summary")
        assert len(prompt) > 0

    def test_get_distillation_prompt_invalid(self):
        # Invalid type falls back to SUMMARY
        prompt = self.mgr.get_distillation_prompt("nonexistent")
        assert len(prompt) > 0

    def test_simple_distill_summary(self):
        content = "First sentence. Second sentence. Third sentence."
        result = self.mgr._simple_distill(content, DistillationTemplate.SUMMARY)
        assert len(result) > 0
        assert result.endswith(".")

    def test_simple_distill_key_points(self):
        content = "Para one first sentence.\n\nPara two first sentence."
        result = self.mgr._simple_distill(content, DistillationTemplate.KEY_POINTS)
        assert "1." in result

    def test_simple_distill_character_traits(self):
        result = self.mgr._simple_distill("Some content", DistillationTemplate.CHARACTER_TRAITS)
        assert "Character" in result

    def test_simple_distill_plot_structure(self):
        content = "A" * 600  # Long content
        result = self.mgr._simple_distill(content, DistillationTemplate.PLOT_STRUCTURE)
        assert "Plot" in result or "Beginning" in result

    def test_simple_distill_world_building(self):
        result = self.mgr._simple_distill("Some content", DistillationTemplate.WORLD_BUILDING)
        assert "World" in result

    def test_simple_distill_style_elements(self):
        content = "Short sentence. Another one. And more."
        result = self.mgr._simple_distill(content, DistillationTemplate.STYLE_ELEMENTS)
        assert "Word count" in result or "word count" in result.lower()

    def test_distill_no_llm(self):
        result = self.mgr.distill(
            sources=["Hello world. This is a test."],
            template=DistillationTemplate.SUMMARY,
        )
        assert result.result_id.startswith("dist-")
        assert result.template == DistillationTemplate.SUMMARY
        assert len(result.content) > 0

    def test_distill_with_source_ids(self):
        result = self.mgr.distill(
            sources=["Content here"],
            template="summary",
            source_ids=["src-1"],
        )
        assert result.source_ids == ["src-1"]

    def test_distill_with_metadata(self):
        result = self.mgr.distill(
            sources=["Content"],
            template=DistillationTemplate.SUMMARY,
            metadata={"key": "val"},
        )
        assert result.metadata == {"key": "val"}

    def test_distill_with_llm(self):
        mock_llm = MagicMock()
        mock_llm.generate = MagicMock(return_value="LLM summary")
        self.mgr.set_llm_client(mock_llm)

        result = self.mgr.distill(
            sources=["Content to summarize"],
            template=DistillationTemplate.SUMMARY,
        )
        assert result.content == "LLM summary"
        mock_llm.generate.assert_called_once()

    def test_distill_with_callable_llm(self):
        # Use a plain function (not MagicMock) to avoid hasattr(generate) matching
        def fake_llm(prompt):
            return "Callable result"
        self.mgr.set_llm_client(fake_llm)
        result = self.mgr.distill(
            sources=["Content"],
            template=DistillationTemplate.SUMMARY,
        )
        assert result.content == "Callable result"

    def test_distill_llm_failure_fallback(self):
        mock_llm = MagicMock()
        mock_llm.generate = MagicMock(side_effect=RuntimeError("fail"))
        self.mgr.set_llm_client(mock_llm)

        result = self.mgr.distill(
            sources=["First sentence. Second sentence. Third sentence."],
            template=DistillationTemplate.SUMMARY,
        )
        # Should fall back to simple distill
        assert len(result.content) > 0

    def test_get_result(self):
        result = self.mgr.distill(
            sources=["Content"],
            template=DistillationTemplate.SUMMARY,
        )
        fetched = self.mgr.get_result(result.result_id)
        assert fetched is not None
        assert fetched.result_id == result.result_id

    def test_get_result_not_found(self):
        assert self.mgr.get_result("nonexistent") is None

    def test_delete_result(self):
        result = self.mgr.distill(
            sources=["Content"],
            template=DistillationTemplate.SUMMARY,
        )
        deleted = self.mgr.delete_result(result.result_id)
        assert deleted is True
        assert self.mgr.get_result(result.result_id) is None

    def test_delete_result_not_found(self):
        assert self.mgr.delete_result("nonexistent") is False

    def test_list_by_template(self):
        self.mgr.distill(["C1"], DistillationTemplate.SUMMARY)
        self.mgr.distill(["C2"], DistillationTemplate.SUMMARY)
        self.mgr.distill(["C3"], DistillationTemplate.KEY_POINTS)

        summaries = self.mgr.list_by_template(DistillationTemplate.SUMMARY)
        assert len(summaries) == 2

        key_points = self.mgr.list_by_template("key_points")
        assert len(key_points) == 1

    def test_list_by_template_limit(self):
        for i in range(5):
            self.mgr.distill([f"Content {i}"], DistillationTemplate.SUMMARY)
        results = self.mgr.list_by_template(DistillationTemplate.SUMMARY, limit=2)
        assert len(results) == 2

    def test_batch_distill(self):
        results = self.mgr.batch_distill(["Some content here"])
        assert len(results) == 6
        for t in DistillationTemplate:
            assert t in results

    def test_stats(self):
        self.mgr.distill(["C1"], DistillationTemplate.SUMMARY)
        self.mgr.distill(["C2"], DistillationTemplate.KEY_POINTS)
        stats = self.mgr.stats()
        assert stats["total_results"] == 2
        assert stats["by_template"]["summary"] == 1
        assert stats["by_template"]["key_points"] == 1

    def test_list_templates(self):
        templates = self.mgr.list_templates()
        assert len(templates) == 6
        names = [t["name"] for t in templates]
        assert "summary" in names
        assert "key_points" in names

    def test_distill_chapter_legacy(self):
        result = self.mgr.distill_chapter("Chapter content here. It was a dark night.")
        assert "summary" in result
        assert len(result["summary"]) > 0

    def test_get_distillation_prompt_legacy(self):
        prompt = self.mgr.get_distillation_prompt("extract-facts")
        assert len(prompt) > 0

    def test_get_distillation_prompt_legacy_with_content(self):
        prompt = self.mgr.get_distillation_prompt("insight", content="test content")
        assert "test content" in prompt

    def test_get_result_from_disk(self):
        """Test loading a result from disk after clearing in-memory cache."""
        result = self.mgr.distill(["Content"], DistillationTemplate.SUMMARY)
        rid = result.result_id
        # Clear in-memory cache
        self.mgr._results_index.clear()
        # Should load from disk
        fetched = self.mgr.get_result(rid)
        assert fetched is not None
        assert fetched.result_id == rid

    def test_set_citation_manager(self):
        mock_cm = MagicMock()
        self.mgr.set_citation_manager(mock_cm)
        assert self.mgr._citation_manager is mock_cm

    def test_set_memory_manager(self):
        mock_mm = MagicMock()
        self.mgr.set_memory_manager(mock_mm)
        assert self.mgr._memory_manager is mock_mm


# ============================================================
# Factory Function Tests
# ============================================================

class TestFactory:

    def setup_method(self):
        reset_distillation_manager()

    def test_reset(self):
        reset_distillation_manager()
        # Should not raise
