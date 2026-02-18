# -*- coding: utf-8 -*-
"""Extra branch tests for character_state_analyzer."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.narrative.analyzers.base import AnalysisResult, AnalysisType
from src.narrative.analyzers.character_state_analyzer import CharacterStateAnalyzer, CharacterState


def test_character_state_to_dict_and_description_property():
    state = CharacterState(position=2, content="内容", emotions=["negative"], goals=["要"], conflicts=["但是"], agency_score=0.6)
    payload = state.to_dict()

    assert payload["position"] == 2
    assert payload["agency_score"] == 0.6
    assert CharacterStateAnalyzer().description.startswith("分析角色在叙事中的情绪")


@pytest.mark.asyncio
async def test_analyze_without_llm_uses_quick_analyze():
    analyzer = CharacterStateAnalyzer()
    expected = analyzer.quick_analyze("他必须行动。")

    with patch.object(analyzer, "quick_analyze") as quick_mock:
        quick_mock.return_value = expected
        result = await analyzer.analyze("他必须行动。")

    quick_mock.assert_called_once()
    assert result.analysis_type.value == "character_state"


@pytest.mark.asyncio
async def test_analyze_with_llm_success_branch():
    analyzer = CharacterStateAnalyzer(llm_client=MagicMock())
    analyzer.llm_client.generate_json = AsyncMock(
        return_value={
            "states": [
                {
                    "position": 1,
                    "content": "他决定行动",
                    "emotions": ["negative"],
                    "goals": ["必须"],
                    "conflicts": ["但是"],
                    "agency_score": 0.9,
                }
            ],
            "summary": "llm-summary",
        }
    )

    result = await analyzer.analyze("他决定行动")

    assert result.metadata["analysis_source"] == "llm"
    assert result.metadata["total_count"] == 1
    assert result.summary == "llm-summary"


@pytest.mark.asyncio
async def test_analyze_with_llm_empty_states_falls_back_to_quick_analyze():
    analyzer = CharacterStateAnalyzer(llm_client=MagicMock())
    analyzer.llm_client.generate_json = AsyncMock(return_value={"states": [], "summary": "x"})

    expected = analyzer.quick_analyze("他必须行动。")
    with patch.object(analyzer, "quick_analyze", return_value=expected) as quick_mock:
        result = await analyzer.analyze("他必须行动。")

    quick_mock.assert_called_once()
    assert result is expected


@pytest.mark.asyncio
async def test_analyze_with_llm_exception_falls_back_to_quick_analyze():
    analyzer = CharacterStateAnalyzer(llm_client=MagicMock())
    analyzer.llm_client.generate_json = AsyncMock(side_effect=RuntimeError("llm down"))

    expected = analyzer.quick_analyze("他必须行动。")
    with patch.object(analyzer, "quick_analyze", return_value=expected) as quick_mock:
        result = await analyzer.analyze("他必须行动。")

    quick_mock.assert_called_once()
    assert result is expected


def test_quick_analyze_skips_segments_without_signals_and_summary_empty_branch():
    analyzer = CharacterStateAnalyzer()

    with patch.object(analyzer, "_segment_text", return_value=["普通描述", "   "]):
        result = analyzer.quick_analyze("ignored")

    assert result.count == 0
    assert result.summary == "未检测到明显角色状态信号"


def test_get_dominant_emotions_empty_distribution_and_zero_branch():
    analyzer = CharacterStateAnalyzer()

    mocked_empty = AnalysisResult(
        analyzer_name=analyzer.name,
        analysis_type=AnalysisType.CHARACTER_STATE,
        metadata={"emotion_distribution": {}},
    )
    with patch.object(analyzer, "quick_analyze", return_value=mocked_empty):
        assert analyzer.get_dominant_emotions("x") == []

    mocked_zero = AnalysisResult(
        analyzer_name=analyzer.name,
        analysis_type=AnalysisType.CHARACTER_STATE,
        metadata={"emotion_distribution": {"positive": 0, "negative": 0, "neutral": 0}},
    )
    with patch.object(analyzer, "quick_analyze", return_value=mocked_zero):
        assert analyzer.get_dominant_emotions("x") == []
