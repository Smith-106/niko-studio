# -*- coding: utf-8 -*-
"""Extra branch tests for sensory_analyzer."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.narrative.analyzers.sensory_analyzer import SensoryAnalyzer, SensoryDetail, SensoryType


def test_sensory_detail_to_dict_and_description():
    detail = SensoryDetail(type=SensoryType.VISUAL, content="看见红光", keywords=["红"], position=1, intensity=0.8, context="ctx")
    payload = detail.to_dict()

    assert payload["type"] == "visual"
    assert payload["content"] == "看见红光"
    assert SensoryAnalyzer().description.startswith("分析文本中的五感描写")


@pytest.mark.asyncio
async def test_analyze_without_llm_uses_quick_analyze():
    analyzer = SensoryAnalyzer()
    expected = analyzer.quick_analyze("看见光。")

    with patch.object(analyzer, "quick_analyze") as quick_mock:
        quick_mock.return_value = expected
        result = await analyzer.analyze("看见光。")

    quick_mock.assert_called_once()
    assert result.analysis_type.value == "sensory"


@pytest.mark.asyncio
async def test_analyze_with_llm_success_and_invalid_item_skipped():
    analyzer = SensoryAnalyzer(llm_client=MagicMock())
    analyzer.llm_client.generate_json = AsyncMock(
        return_value={
            "sensory_details": [
                {"type": "bad", "content": "invalid", "intensity": 0.2, "context": "x"},
                {"type": "auditory", "content": "听见钟声", "intensity": 0.7, "context": "制造紧张"},
            ]
        }
    )

    result = await analyzer.analyze("看见光。听见钟声。")

    assert result.metadata["llm_count"] == 1
    assert result.metadata["rule_count"] >= 1
    assert result.metadata["total_count"] >= 2


@pytest.mark.asyncio
async def test_analyze_with_llm_exception_falls_back_to_quick_analyze():
    analyzer = SensoryAnalyzer(llm_client=MagicMock())
    analyzer.llm_client.generate_json = AsyncMock(side_effect=RuntimeError("llm down"))

    expected = analyzer.quick_analyze("看见光。")
    with patch.object(analyzer, "quick_analyze", return_value=expected) as quick_mock:
        result = await analyzer.analyze("看见光。")

    quick_mock.assert_called_once()
    assert result is expected


def test_get_sensory_density_non_empty_content():
    analyzer = SensoryAnalyzer()
    density = analyzer.get_sensory_density("看见光。听见声音。")

    assert density["visual"] > 0
    assert density["auditory"] > 0
