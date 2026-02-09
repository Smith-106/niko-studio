import pytest

from src.narrative.analyzers.base import AnalysisResult, AnalysisType
from src.narrative.analyzers.sensory_analyzer import SensoryAnalyzer, SensoryType
from src.narrative.analyzers.conflict_analyzer import ConflictAnalyzer, ConflictType
from src.narrative.analyzers.tension_curve_analyzer import TensionCurveAnalyzer


def test_analysis_result_helpers():
    result = AnalysisResult(analyzer_name="A", analysis_type=AnalysisType.SENSORY)
    assert result.count == 0
    assert result.is_empty is True
    assert result.to_dict()["type"] == "sensory"


@pytest.mark.asyncio
async def test_sensory_analyzer_quick_and_async_analyze():
    content = "红色灯光闪烁。听见脚步声。闻到花香。"
    analyzer = SensoryAnalyzer()

    quick = analyzer.quick_analyze(content)
    full = await analyzer.analyze(content)

    assert quick.count >= 3
    assert full.count == quick.count
    assert quick.metadata["type_distribution"]["visual"] >= 1
    assert quick.metadata["type_distribution"]["auditory"] >= 1
    assert quick.metadata["type_distribution"]["olfactory"] >= 1


def test_sensory_extract_by_type_and_density():
    content = "他看见光芒，也听到低语。"
    analyzer = SensoryAnalyzer()

    visuals = analyzer.extract_by_type(content, SensoryType.VISUAL)
    assert len(visuals) >= 1

    density = analyzer.get_sensory_density("")
    assert density["visual"] == 0.0
    assert density["auditory"] == 0.0


@pytest.mark.asyncio
async def test_conflict_analyzer_detects_types_and_dominant():
    content = "他犹豫是否离开。敌人的威胁逼近。两人开始争吵。"
    analyzer = ConflictAnalyzer()

    result = await analyzer.analyze(content)
    assert result.count >= 3

    distribution = result.metadata["type_distribution"]
    assert distribution["internal"] >= 1
    assert distribution["external"] >= 1
    assert distribution["interpersonal"] >= 1

    dominant = analyzer.get_dominant_conflict_type(content)
    assert dominant in {ConflictType.INTERNAL, ConflictType.EXTERNAL, ConflictType.INTERPERSONAL}


@pytest.mark.asyncio
async def test_tension_curve_analyzer_basic_and_pattern():
    content = "平静的夜晚。突然危机爆发。最后绝望崩溃。"
    analyzer = TensionCurveAnalyzer()

    result = await analyzer.analyze(content)
    assert result.count == 1

    curve = result.items[0]
    assert len(curve.points) >= 2
    assert result.metadata["point_count"] == len(curve.points)

    pattern = analyzer.get_tension_pattern("平静。平静。平静。")
    assert pattern in {"flat", "rising", "falling", "building", "oscillating"}
