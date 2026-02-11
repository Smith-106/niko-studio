"""
Analyzer Base Tests

Tests for AnalysisType enum, AnalysisResult (properties, to_dict),
and BaseAnalyzer.
"""

import pytest
from src.narrative.analyzers.base import (
    AnalysisType,
    AnalysisResult,
    BaseAnalyzer,
)


# ============================================================
# AnalysisType Enum Tests
# ============================================================

class TestAnalysisType:

    def test_values(self):
        assert AnalysisType.SENSORY.value == "sensory"
        assert AnalysisType.CONFLICT.value == "conflict"
        assert AnalysisType.TENSION.value == "tension"
        assert AnalysisType.CHARACTER_STATE.value == "character_state"
        assert AnalysisType.DIALOGUE.value == "dialogue"
        assert AnalysisType.PACING.value == "pacing"

    def test_six_types(self):
        assert len(AnalysisType) == 6


# ============================================================
# AnalysisResult Tests
# ============================================================

class TestAnalysisResult:

    def test_defaults(self):
        result = AnalysisResult(
            analyzer_name="test",
            analysis_type=AnalysisType.SENSORY,
        )
        assert result.items == []
        assert result.metadata == {}
        assert result.summary == ""

    def test_count(self):
        result = AnalysisResult(
            analyzer_name="test",
            analysis_type=AnalysisType.CONFLICT,
            items=["a", "b", "c"],
        )
        assert result.count == 3

    def test_count_empty(self):
        result = AnalysisResult(
            analyzer_name="test",
            analysis_type=AnalysisType.TENSION,
        )
        assert result.count == 0

    def test_is_empty_true(self):
        result = AnalysisResult(
            analyzer_name="test",
            analysis_type=AnalysisType.DIALOGUE,
        )
        assert result.is_empty is True

    def test_is_empty_false(self):
        result = AnalysisResult(
            analyzer_name="test",
            analysis_type=AnalysisType.PACING,
            items=["item"],
        )
        assert result.is_empty is False

    def test_to_dict(self):
        result = AnalysisResult(
            analyzer_name="sensory_analyzer",
            analysis_type=AnalysisType.SENSORY,
            items=["sight", "sound"],
            metadata={"density": 0.5},
            summary="Found 2 items",
        )
        d = result.to_dict()
        assert d["analyzer"] == "sensory_analyzer"
        assert d["type"] == "sensory"
        assert d["count"] == 2
        assert len(d["items"]) == 2
        assert d["metadata"] == {"density": 0.5}
        assert d["summary"] == "Found 2 items"

    def test_to_dict_with_to_dict_items(self):
        class DictableItem:
            def to_dict(self):
                return {"key": "val"}

        result = AnalysisResult(
            analyzer_name="test",
            analysis_type=AnalysisType.CONFLICT,
            items=[DictableItem()],
        )
        d = result.to_dict()
        assert d["items"][0] == {"key": "val"}

    def test_to_dict_plain_items(self):
        result = AnalysisResult(
            analyzer_name="test",
            analysis_type=AnalysisType.TENSION,
            items=[42, None],
        )
        d = result.to_dict()
        assert d["items"] == ["42", "None"]


# ============================================================
# BaseAnalyzer Tests (via concrete subclass)
# ============================================================

class _ConcreteAnalyzer(BaseAnalyzer):
    @property
    def name(self):
        return "concrete_analyzer"

    @property
    def analysis_type(self):
        return AnalysisType.SENSORY

    @property
    def description(self):
        return "test analyzer"

    async def analyze(self, content, context=None):
        return AnalysisResult(
            analyzer_name=self.name,
            analysis_type=self.analysis_type,
        )


class TestBaseAnalyzer:

    def test_init_no_llm(self):
        a = _ConcreteAnalyzer()
        assert a.llm_client is None

    def test_init_with_llm(self):
        mock = object()
        a = _ConcreteAnalyzer(llm_client=mock)
        assert a.llm_client is mock

    def test_quick_analyze_default(self):
        a = _ConcreteAnalyzer()
        result = a.quick_analyze("test content")
        assert result.analyzer_name == "concrete_analyzer"
        assert result.analysis_type == AnalysisType.SENSORY
        assert result.is_empty is True
