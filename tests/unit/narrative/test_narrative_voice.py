"""
Narrative Voice Manager Tests

Tests for VoiceStrength, VoiceMetrics, WeakPassage, NarrativeVoiceResult,
and NarrativeVoiceManager keyword-based analysis.
"""

import pytest
import asyncio
from src.narrative.narrative_voice import (
    VoiceStrength,
    VoiceMetrics,
    WeakPassage,
    NarrativeVoiceResult,
    NarrativeVoiceManager,
)


# ============================================================
# VoiceStrength Enum
# ============================================================

class TestVoiceStrength:

    def test_values(self):
        assert VoiceStrength.WEAK.value == "weak"
        assert VoiceStrength.MODERATE.value == "moderate"
        assert VoiceStrength.STRONG.value == "strong"
        assert VoiceStrength.AUTHORITATIVE.value == "authoritative"

    def test_count(self):
        assert len(VoiceStrength) == 4


# ============================================================
# VoiceMetrics
# ============================================================

class TestVoiceMetrics:

    def test_overall_strength(self):
        m = VoiceMetrics(
            detail_specificity=10.0,
            sensory_richness=10.0,
            voice_confidence=10.0,
            author_presence=10.0,
        )
        # (10*0.30 + 10*0.25 + 10*0.25 + 10*0.20) = 10.0
        assert m.overall_strength == 10.0

    def test_overall_strength_weighted(self):
        m = VoiceMetrics(
            detail_specificity=8.0,
            sensory_richness=6.0,
            voice_confidence=4.0,
            author_presence=2.0,
        )
        # 8*0.30 + 6*0.25 + 4*0.25 + 2*0.20 = 2.4 + 1.5 + 1.0 + 0.4 = 5.3
        assert abs(m.overall_strength - 5.3) < 0.01

    def test_strength_level_authoritative(self):
        m = VoiceMetrics(detail_specificity=9.0, sensory_richness=9.0,
                         voice_confidence=9.0, author_presence=9.0)
        assert m.strength_level == VoiceStrength.AUTHORITATIVE

    def test_strength_level_strong(self):
        m = VoiceMetrics(detail_specificity=7.5, sensory_richness=7.5,
                         voice_confidence=7.5, author_presence=7.5)
        assert m.strength_level == VoiceStrength.STRONG

    def test_strength_level_moderate(self):
        m = VoiceMetrics(detail_specificity=5.5, sensory_richness=5.5,
                         voice_confidence=5.5, author_presence=5.5)
        assert m.strength_level == VoiceStrength.MODERATE

    def test_strength_level_weak(self):
        m = VoiceMetrics(detail_specificity=2.0, sensory_richness=2.0,
                         voice_confidence=2.0, author_presence=2.0)
        assert m.strength_level == VoiceStrength.WEAK


# ============================================================
# WeakPassage
# ============================================================

class TestWeakPassage:

    def test_basic(self):
        wp = WeakPassage(location="para1", original_text="plain",
                         issue="too vague", suggestion="add detail")
        assert wp.location == "para1"
        assert wp.improved_example is None

    def test_with_example(self):
        wp = WeakPassage(location="p", original_text="o",
                         issue="i", suggestion="s",
                         improved_example="better")
        assert wp.improved_example == "better"


# ============================================================
# NarrativeVoiceResult
# ============================================================

class TestNarrativeVoiceResult:

    def test_authoritative_assessment(self):
        m = VoiceMetrics(detail_specificity=9.0, sensory_richness=9.0,
                         voice_confidence=9.0, author_presence=9.0)
        r = NarrativeVoiceResult(metrics=m, weak_passages=[], strong_passages=[])
        assert "权威" in r.overall_assessment

    def test_strong_assessment(self):
        m = VoiceMetrics(detail_specificity=7.5, sensory_richness=7.5,
                         voice_confidence=7.5, author_presence=7.5)
        r = NarrativeVoiceResult(metrics=m, weak_passages=[], strong_passages=[])
        assert "较强" in r.overall_assessment

    def test_moderate_assessment(self):
        m = VoiceMetrics(detail_specificity=5.5, sensory_richness=5.5,
                         voice_confidence=5.5, author_presence=5.5)
        r = NarrativeVoiceResult(metrics=m, weak_passages=[], strong_passages=[])
        assert "中等" in r.overall_assessment

    def test_weak_assessment(self):
        m = VoiceMetrics(detail_specificity=2.0, sensory_richness=2.0,
                         voice_confidence=2.0, author_presence=2.0)
        r = NarrativeVoiceResult(metrics=m, weak_passages=[], strong_passages=[])
        assert "薄弱" in r.overall_assessment


# ============================================================
# NarrativeVoiceManager (keyword-based analysis)
# ============================================================

class TestNarrativeVoiceManager:

    def test_init_no_llm(self):
        mgr = NarrativeVoiceManager()
        assert mgr.llm is None

    # --- detail_specificity ---

    def test_detail_specificity_base(self):
        mgr = NarrativeVoiceManager()
        score = asyncio.get_event_loop().run_until_complete(
            mgr.analyze_detail_specificity("普通内容没有具体词")
        )
        assert score == 5.0

    def test_detail_specificity_with_indicators(self):
        mgr = NarrativeVoiceManager()
        score = asyncio.get_event_loop().run_until_complete(
            mgr.analyze_detail_specificity("鲨皮套装和鳄鱼皮鞋")
        )
        assert score > 5.0

    def test_detail_specificity_capped(self):
        mgr = NarrativeVoiceManager()
        # Even with many indicators, score capped at 10
        text = "鲨皮 鳄鱼皮 丝质 弓着腰 金斯顿 " * 5
        score = asyncio.get_event_loop().run_until_complete(
            mgr.analyze_detail_specificity(text)
        )
        assert score <= 10.0

    # --- sensory_richness ---

    def test_sensory_richness_none(self):
        mgr = NarrativeVoiceManager()
        score = asyncio.get_event_loop().run_until_complete(
            mgr.measure_sensory_richness("没有感官词汇")
        )
        assert score == 0.0

    def test_sensory_richness_one_sense(self):
        mgr = NarrativeVoiceManager()
        score = asyncio.get_event_loop().run_until_complete(
            mgr.measure_sensory_richness("看到了光")
        )
        assert score == 2.0

    def test_sensory_richness_multiple_senses(self):
        mgr = NarrativeVoiceManager()
        text = "看到了光，听到声音，触摸冷冰冰的，闻到香味，尝到甜味"
        score = asyncio.get_event_loop().run_until_complete(
            mgr.measure_sensory_richness(text)
        )
        assert score == 10.0

    # --- voice_confidence ---

    def test_voice_confidence_strong(self):
        mgr = NarrativeVoiceManager()
        score = asyncio.get_event_loop().run_until_complete(
            mgr.evaluate_voice_confidence("他坚定地走了过去")
        )
        assert score == 8.0

    def test_voice_confidence_weak_words(self):
        mgr = NarrativeVoiceManager()
        score = asyncio.get_event_loop().run_until_complete(
            mgr.evaluate_voice_confidence("好像似乎大概可能也许或许不知道")
        )
        assert score < 8.0

    def test_voice_confidence_floor(self):
        mgr = NarrativeVoiceManager()
        text = "好像好像好像好像好像好像好像好像好像好像好像好像好像好像好像好像好像好像好像好像"
        score = asyncio.get_event_loop().run_until_complete(
            mgr.evaluate_voice_confidence(text)
        )
        assert score == 0.0

    # --- author_presence ---

    def test_author_presence_base(self):
        mgr = NarrativeVoiceManager()
        score = asyncio.get_event_loop().run_until_complete(
            mgr.detect_author_presence("普通内容")
        )
        assert score == 5.0

    def test_author_presence_with_indicators(self):
        mgr = NarrativeVoiceManager()
        score = asyncio.get_event_loop().run_until_complete(
            mgr.detect_author_presence("显然，事实上，毫无疑问")
        )
        assert score > 5.0

    # --- analyze_voice (no LLM) ---

    def test_analyze_voice_no_llm(self):
        mgr = NarrativeVoiceManager()
        metrics = asyncio.get_event_loop().run_until_complete(
            mgr.analyze_voice("看到光，显然这很重要")
        )
        assert isinstance(metrics, VoiceMetrics)
        assert metrics.overall_strength > 0

    # --- mock methods ---

    def test_mock_weak_passages(self):
        mgr = NarrativeVoiceManager()
        passages = mgr._mock_weak_passages()
        assert len(passages) == 1
        assert isinstance(passages[0], WeakPassage)

    def test_mock_strong_passages(self):
        mgr = NarrativeVoiceManager()
        passages = mgr._mock_strong_passages()
        assert len(passages) == 2

    # --- identify_weak_passages (no LLM) ---

    def test_identify_weak_passages_no_llm(self):
        mgr = NarrativeVoiceManager()
        passages = asyncio.get_event_loop().run_until_complete(
            mgr.identify_weak_passages("content")
        )
        assert len(passages) == 1

    # --- extract_strong_passages ---

    def test_extract_strong_passages_no_llm_no_cache(self):
        mgr = NarrativeVoiceManager()
        passages = asyncio.get_event_loop().run_until_complete(
            mgr.extract_strong_passages("content")
        )
        assert len(passages) == 2

    def test_extract_strong_passages_cached(self):
        mgr = NarrativeVoiceManager()
        mgr._last_strong_passages = ["cached"]
        passages = asyncio.get_event_loop().run_until_complete(
            mgr.extract_strong_passages("content")
        )
        assert passages == ["cached"]

    # --- suggest_voice_strengthening ---

    def test_suggestions_all_low(self):
        mgr = NarrativeVoiceManager()
        m = VoiceMetrics(detail_specificity=3.0, sensory_richness=3.0,
                         voice_confidence=3.0, author_presence=3.0)
        suggestions = asyncio.get_event_loop().run_until_complete(
            mgr.suggest_voice_strengthening("content", m)
        )
        assert len(suggestions) == 4

    def test_suggestions_all_high(self):
        mgr = NarrativeVoiceManager()
        m = VoiceMetrics(detail_specificity=9.0, sensory_richness=9.0,
                         voice_confidence=9.0, author_presence=9.0)
        suggestions = asyncio.get_event_loop().run_until_complete(
            mgr.suggest_voice_strengthening("content", m)
        )
        assert len(suggestions) == 0

    # --- analyze_full (no LLM) ---

    def test_analyze_full_no_llm(self):
        mgr = NarrativeVoiceManager()
        result = asyncio.get_event_loop().run_until_complete(
            mgr.analyze_full("看到光芒，显然非常重要")
        )
        assert isinstance(result, NarrativeVoiceResult)
        assert result.overall_assessment != ""
