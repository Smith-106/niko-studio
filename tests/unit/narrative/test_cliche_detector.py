"""
Cliche Detector Tests

Tests for ClicheDetector evaluate method with various cliche patterns.
"""

import pytest
from src.narrative.evaluators.cliche_detector import ClicheDetector
from src.narrative.evaluators.base import Severity


class TestClicheDetector:

    @pytest.fixture
    def detector(self):
        return ClicheDetector()

    def test_name(self, detector):
        assert detector.name == "陈词滥调检测器"

    def test_description(self, detector):
        assert len(detector.description) > 0

    def test_related_skill(self, detector):
        assert detector.related_skill == "script-doctor"

    @pytest.mark.asyncio
    async def test_no_cliches(self, detector):
        content = "独特的开场白，没有任何老套的表达方式。"
        result = await detector.evaluate(content)
        assert result.score == 100
        assert len(result.issues) == 0

    @pytest.mark.asyncio
    async def test_opening_cliche(self, detector):
        content = "闹钟响了，他从梦中醒来。"
        result = await detector.evaluate(content)
        assert result.score < 100
        assert result.metrics["cliche_count"] >= 2

    @pytest.mark.asyncio
    async def test_character_cliches(self, detector):
        content = "他是一个失忆的天才，被选中去拯救世界。"
        result = await detector.evaluate(content)
        assert result.metrics["cliche_count"] >= 2

    @pytest.mark.asyncio
    async def test_plot_cliches(self, detector):
        content = "因为误会分手，后来又遭遇车祸。"
        result = await detector.evaluate(content)
        assert result.metrics["cliche_count"] >= 2

    @pytest.mark.asyncio
    async def test_dialogue_cliches(self, detector):
        content = "我们需要谈谈。你根本不了解我。相信我，一切都会不同。"
        result = await detector.evaluate(content)
        assert result.metrics["cliche_count"] >= 3

    @pytest.mark.asyncio
    async def test_description_cliches(self, detector):
        content = "她不禁忍不住眼眶湿润，泪如雨下。"
        result = await detector.evaluate(content)
        assert result.metrics["cliche_count"] >= 3

    @pytest.mark.asyncio
    async def test_many_cliches_major_severity(self, detector):
        content = "闹钟响了，他从梦中醒来，睁开眼。突然天才少年不禁忍不住说道。"
        result = await detector.evaluate(content)
        assert any(i.severity == Severity.MAJOR for i in result.issues)

    @pytest.mark.asyncio
    async def test_opening_context(self, detector):
        content = "闹钟响了，又是新的一天。"
        result = await detector.evaluate(content, context={"is_opening": True})
        codes = [i.code for i in result.issues]
        assert "OPENING_CLICHE" in codes

    @pytest.mark.asyncio
    async def test_non_opening_context(self, detector):
        content = "闹钟响了。"
        result = await detector.evaluate(content, context={"is_opening": False})
        codes = [i.code for i in result.issues]
        assert "OPENING_CLICHE" not in codes

    @pytest.mark.asyncio
    async def test_score_floor(self, detector):
        # Many cliches should not go below 0
        content = "闹钟响了从梦中醒来睁开眼又是新的一天阳光透过窗帘照镜子" * 3
        result = await detector.evaluate(content)
        assert result.score >= 0

    @pytest.mark.asyncio
    async def test_repeated_cliche_counted(self, detector):
        content = "突然突然突然"
        result = await detector.evaluate(content)
        # "突然" appears 3 times, deduction = 3 * 8 = 24
        assert result.score == 100 - 24
