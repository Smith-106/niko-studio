# -*- coding: utf-8 -*-
"""Extra branch tests for conflict_analyzer."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.narrative.analyzers.base import AnalysisResult, AnalysisType
from src.narrative.analyzers.conflict_analyzer import (
    Conflict,
    ConflictAnalyzer,
    ConflictIntensity,
    ConflictType,
)


def test_conflict_to_dict_and_description_property():
    conflict = Conflict(
        type=ConflictType.INTERNAL,
        content="他非常犹豫",
        parties=["self"],
        intensity=ConflictIntensity.HIGH,
        indicators=["犹豫"],
        position=0,
        description="内在冲突",
    )
    payload = conflict.to_dict()

    assert payload["type"] == "internal"
    assert payload["intensity"] == "high"
    assert ConflictAnalyzer().description.startswith("分析文本中的冲突元素")


@pytest.mark.asyncio
async def test_analyze_without_llm_uses_quick_analyze():
    analyzer = ConflictAnalyzer()
    expected = analyzer.quick_analyze("他犹豫。")

    with patch.object(analyzer, "quick_analyze") as quick_mock:
        quick_mock.return_value = expected
        result = await analyzer.analyze("他犹豫。")

    quick_mock.assert_called_once()
    assert result.analysis_type.value == "conflict"


@pytest.mark.asyncio
async def test_analyze_with_llm_success_and_invalid_item_skipped():
    analyzer = ConflictAnalyzer(llm_client=MagicMock())
    analyzer.llm_client.generate_json = AsyncMock(
        return_value={
            "conflicts": [
                {"type": "bad", "content": "x", "intensity": "high"},
                {
                    "type": "interpersonal",
                    "content": "两人争吵",
                    "parties": ["A", "B"],
                    "intensity": "critical",
                    "description": "关系破裂",
                },
            ]
        }
    )

    result = await analyzer.analyze("两人争吵，冲突爆发。")

    assert result.metadata["llm_count"] == 1
    assert result.metadata["total_count"] >= 1
    assert result.metadata["type_distribution"]["interpersonal"] >= 1


@pytest.mark.asyncio
async def test_analyze_with_llm_exception_falls_back_to_quick_analyze():
    analyzer = ConflictAnalyzer(llm_client=MagicMock())
    analyzer.llm_client.generate_json = AsyncMock(side_effect=RuntimeError("llm down"))

    expected = analyzer.quick_analyze("他犹豫。")
    with patch.object(analyzer, "quick_analyze", return_value=expected) as quick_mock:
        result = await analyzer.analyze("他犹豫。")

    quick_mock.assert_called_once()
    assert result is expected


def test_get_dominant_conflict_type_none_when_distribution_empty():
    analyzer = ConflictAnalyzer()
    expected = analyzer.quick_analyze("平静无事")

    with patch.object(analyzer, "quick_analyze") as quick_mock:
        quick_mock.return_value = expected
        quick_mock.return_value.metadata["type_distribution"] = {}
        dominant = analyzer.get_dominant_conflict_type("平静无事")

    assert dominant is None


def test_get_dominant_conflict_type_none_when_all_zero():
    analyzer = ConflictAnalyzer()
    mocked = AnalysisResult(
        analyzer_name=analyzer.name,
        analysis_type=AnalysisType.CONFLICT,
        metadata={
            "type_distribution": {
                "internal": 0,
                "external": 0,
                "interpersonal": 0,
            }
        },
    )

    with patch.object(analyzer, "quick_analyze", return_value=mocked):
        dominant = analyzer.get_dominant_conflict_type("平静无事")

    assert dominant is None
