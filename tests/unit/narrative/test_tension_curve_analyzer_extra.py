# -*- coding: utf-8 -*-
"""Extra branch tests for tension_curve_analyzer."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.narrative.analyzers.base import AnalysisResult, AnalysisType
from src.narrative.analyzers.tension_curve_analyzer import (
    PointType,
    TensionCurve,
    TensionCurveAnalyzer,
    TensionLevel,
    TensionPoint,
)


def test_description_property_branch():
    analyzer = TensionCurveAnalyzer()
    assert analyzer.description == "分析文本的情节张力变化曲线"


def test_tension_point_and_curve_to_dict_branches():
    point = TensionPoint(position=1, level=TensionLevel.HIGH, point_type=PointType.PEAK, content="x" * 120)
    point_dict = point.to_dict()
    assert point_dict["position"] == 1
    assert point_dict["level"] == 4

    curve = TensionCurve(points=[point], peaks=[0], valleys=[], turning_points=[0], climax_position=0)
    curve_dict = curve.to_dict()
    assert curve_dict["point_count"] == 1
    assert curve_dict["points"][0]["point_type"] == "peak"


@pytest.mark.asyncio
async def test_analyze_with_llm_merges_rule_points_and_uses_llm_summary():
    analyzer = TensionCurveAnalyzer(llm_client=MagicMock())
    analyzer.llm_client.generate_json = AsyncMock(
        return_value={
            "points": [
                {"position": 0, "level": "bad-level", "point_type": "normal", "description": "invalid"},
                {"position": 1, "level": 4, "point_type": "peak", "description": "valid"},
            ],
            "climax_position": 3,
            "overall_pattern": "rising",
            "summary": "llm-summary",
        }
    )

    fallback_curve = TensionCurve(
        points=[
            TensionPoint(position=0, level=TensionLevel.MEDIUM, score=0.6),
            TensionPoint(position=1, level=TensionLevel.HIGH, score=0.8),
            TensionPoint(position=2, level=TensionLevel.LOW, score=0.4),
        ],
        peaks=[1],
        valleys=[2],
        turning_points=[],
        climax_position=1,
        average_tension=0.6,
        variance=0.027,
    )
    fallback_result = AnalysisResult(
        analyzer_name=analyzer.name,
        analysis_type=AnalysisType.TENSION,
        items=[fallback_curve],
    )

    with patch.object(analyzer, "quick_analyze", return_value=fallback_result) as quick_mock:
        result = await analyzer.analyze("content")

    quick_mock.assert_called_once()
    assert result.summary == "llm-summary"
    assert result.metadata["overall_pattern"] == "rising"
    assert result.items[0].climax_position == 3


@pytest.mark.asyncio
async def test_analyze_with_llm_exception_falls_back_to_quick_analyze():
    analyzer = TensionCurveAnalyzer(llm_client=MagicMock())
    analyzer.llm_client.generate_json = AsyncMock(side_effect=RuntimeError("llm down"))

    expected = analyzer.quick_analyze("平静。突然危机。")
    with patch.object(analyzer, "quick_analyze", return_value=expected) as quick_mock:
        result = await analyzer.analyze("平静。突然危机。")

    quick_mock.assert_called_once()
    assert result is expected


def test_segment_text_paragraph_and_sentence_branches():
    analyzer = TensionCurveAnalyzer()

    paragraphs = analyzer._segment_text("a\n\n b\n\n c\n\n d")
    assert len(paragraphs) == 4

    sentences = analyzer._segment_text("一句。二句！三句？")
    assert len(sentences) == 3


def test_build_curve_empty_and_peak_valley_branches():
    analyzer = TensionCurveAnalyzer()

    empty = analyzer._build_curve([])
    assert empty.points == []

    points = [
        TensionPoint(position=0, level=TensionLevel.MEDIUM, score=0.5),
        TensionPoint(position=1, level=TensionLevel.HIGH, score=0.9),
        TensionPoint(position=2, level=TensionLevel.LOW, score=0.2),
        TensionPoint(position=3, level=TensionLevel.VERY_HIGH, score=1.0),
        TensionPoint(position=4, level=TensionLevel.MEDIUM, score=0.4),
    ]

    curve = analyzer._build_curve(points)
    assert len(curve.peaks) >= 1
    assert len(curve.valleys) >= 1
    assert curve.climax_position is not None


def test_build_curve_records_turning_points_when_not_overwritten():
    analyzer = TensionCurveAnalyzer()
    points = [
        TensionPoint(position=0, level=TensionLevel.MEDIUM, score=0.6),
        TensionPoint(position=1, level=TensionLevel.HIGH, point_type=PointType.TURNING_POINT, score=0.6),
        TensionPoint(position=2, level=TensionLevel.LOW, score=0.6),
    ]

    curve = analyzer._build_curve(points)

    assert len(curve.turning_points) == 1


def test_generate_summary_empty_and_detail_branches():
    analyzer = TensionCurveAnalyzer()
    assert analyzer._generate_summary(TensionCurve()) == "未检测到有效的张力变化"

    curve = TensionCurve(
        points=[TensionPoint(position=0, level=TensionLevel.MEDIUM, score=0.6)],
        peaks=[0],
        valleys=[0],
        turning_points=[0],
        climax_position=0,
        average_tension=0.6,
        variance=0.2,
    )
    summary = analyzer._generate_summary(curve)
    assert "高点" in summary
    assert "低点" in summary
    assert "转折" in summary


def test_detect_tension_level_prefers_low_when_starting_from_medium():
    analyzer = TensionCurveAnalyzer()
    level, indicators = analyzer._detect_tension_level("平静安宁如常")
    assert level in {TensionLevel.LOW, TensionLevel.VERY_LOW}
    assert len(indicators) >= 1


@pytest.mark.parametrize(
    "curve,expected",
    [
        (TensionCurve(points=[TensionPoint(position=0, level=TensionLevel.MEDIUM, score=0.5)], variance=0.05), "flat"),
        (
            TensionCurve(
                points=[TensionPoint(position=i, level=TensionLevel.MEDIUM, score=0.5) for i in range(6)],
                peaks=[0, 1, 2, 3],
                valleys=[0],
                variance=0.2,
            ),
            "rising",
        ),
        (
            TensionCurve(
                points=[TensionPoint(position=i, level=TensionLevel.MEDIUM, score=0.5) for i in range(6)],
                peaks=[0],
                valleys=[0, 1, 2, 3],
                variance=0.2,
            ),
            "falling",
        ),
        (
            TensionCurve(
                points=[TensionPoint(position=i, level=TensionLevel.MEDIUM, score=0.5) for i in range(5)],
                peaks=[0, 1],
                valleys=[0, 1],
                climax_position=4,
                variance=0.2,
            ),
            "building",
        ),
        (
            TensionCurve(
                points=[TensionPoint(position=i, level=TensionLevel.MEDIUM, score=0.5) for i in range(5)],
                peaks=[1],
                valleys=[2],
                climax_position=1,
                variance=0.2,
            ),
            "oscillating",
        ),
    ],
)
def test_get_tension_pattern_all_pattern_branches(curve, expected):
    analyzer = TensionCurveAnalyzer()

    result = AnalysisResult(analyzer_name=analyzer.name, analysis_type=AnalysisType.TENSION, items=[curve])
    with patch.object(analyzer, "quick_analyze", return_value=result):
        assert analyzer.get_tension_pattern("x") == expected






def test_get_tension_pattern_unknown_when_no_items():
    analyzer = TensionCurveAnalyzer()
    result = AnalysisResult(analyzer_name=analyzer.name, analysis_type=AnalysisType.TENSION, items=[])

    with patch.object(analyzer, "quick_analyze", return_value=result):
        assert analyzer.get_tension_pattern("x") == "unknown"










def test_quick_analyze_skips_empty_segment_branch():
    analyzer = TensionCurveAnalyzer()

    with patch.object(analyzer, "_segment_text", return_value=["   ", "紧张冲突爆发"]):
        result = analyzer.quick_analyze("ignored")

    assert result.metadata["segment_count"] == 2
    assert result.metadata["point_count"] == 1
