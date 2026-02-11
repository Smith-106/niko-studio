"""
Suspense Analyzer Tests

Tests for SuspensePillar, StoryQuestion, ThreatSituation, LitFuse,
SuspenseScore, SuspenseAnalysisResult, and SuspenseAnalyzer.
"""

import pytest
import asyncio
from src.narrative.suspense_analyzer import (
    SuspensePillar,
    StoryQuestion,
    ThreatSituation,
    LitFuse,
    SuspenseScore,
    SuspenseAnalysisResult,
    SuspenseAnalyzer,
)


# ============================================================
# Enums & Dataclasses
# ============================================================

class TestSuspensePillar:

    def test_values(self):
        assert SuspensePillar.STORY_QUESTION.value == "story_question"
        assert SuspensePillar.THREAT_SITUATION.value == "threat_situation"
        assert SuspensePillar.LIT_FUSE.value == "lit_fuse"

    def test_count(self):
        assert len(SuspensePillar) == 3


class TestStoryQuestion:

    def test_defaults(self):
        sq = StoryQuestion(question="Who?", location="开篇", intensity=8.0)
        assert sq.is_answered is False
        assert sq.answer_location is None

    def test_with_answer(self):
        sq = StoryQuestion(question="Why?", location="中间", intensity=6.0,
                           is_answered=True, answer_location="结尾")
        assert sq.is_answered is True


class TestThreatSituation:

    def test_defaults(self):
        ts = ThreatSituation(threat_type="physical", description="shark",
                             target_character="hero", intensity=9.0)
        assert ts.is_resolved is False


class TestLitFuse:

    def test_defaults(self):
        lf = LitFuse(crisis="bomb", deadline="1 hour",
                     consequence="explosion", intensity=10.0)
        assert lf.is_defused is False


class TestSuspenseScore:

    def test_basic(self):
        ss = SuspenseScore(pillar=SuspensePillar.STORY_QUESTION, score=7.0)
        assert ss.elements == []
        assert ss.issues == []


# ============================================================
# SuspenseAnalysisResult (weighted scoring)
# ============================================================

class TestSuspenseAnalysisResult:

    def _make_score(self, pillar, score):
        return SuspenseScore(pillar=pillar, score=score)

    def test_gripping(self):
        # All 10: (10*0.30 + 10*0.40 + 10*0.30) * 10 = 100
        r = SuspenseAnalysisResult(
            story_questions=self._make_score(SuspensePillar.STORY_QUESTION, 10.0),
            threat_situations=self._make_score(SuspensePillar.THREAT_SITUATION, 10.0),
            lit_fuses=self._make_score(SuspensePillar.LIT_FUSE, 10.0),
        )
        assert r.overall_score == 100.0
        assert r.suspense_level == "GRIPPING"

    def test_high(self):
        # All 7: 70
        r = SuspenseAnalysisResult(
            story_questions=self._make_score(SuspensePillar.STORY_QUESTION, 7.0),
            threat_situations=self._make_score(SuspensePillar.THREAT_SITUATION, 7.0),
            lit_fuses=self._make_score(SuspensePillar.LIT_FUSE, 7.0),
        )
        assert r.overall_score == 70.0
        assert r.suspense_level == "HIGH"

    def test_moderate(self):
        # All 5: 50
        r = SuspenseAnalysisResult(
            story_questions=self._make_score(SuspensePillar.STORY_QUESTION, 5.0),
            threat_situations=self._make_score(SuspensePillar.THREAT_SITUATION, 5.0),
            lit_fuses=self._make_score(SuspensePillar.LIT_FUSE, 5.0),
        )
        assert r.overall_score == 50.0
        assert r.suspense_level == "MODERATE"

    def test_low(self):
        # All 3: 30
        r = SuspenseAnalysisResult(
            story_questions=self._make_score(SuspensePillar.STORY_QUESTION, 3.0),
            threat_situations=self._make_score(SuspensePillar.THREAT_SITUATION, 3.0),
            lit_fuses=self._make_score(SuspensePillar.LIT_FUSE, 3.0),
        )
        assert r.overall_score == 30.0
        assert r.suspense_level == "LOW"

    def test_weighted(self):
        # sq=8, ts=6, lf=4 → (8*0.30 + 6*0.40 + 4*0.30) * 10 = (2.4+2.4+1.2)*10 = 60
        r = SuspenseAnalysisResult(
            story_questions=self._make_score(SuspensePillar.STORY_QUESTION, 8.0),
            threat_situations=self._make_score(SuspensePillar.THREAT_SITUATION, 6.0),
            lit_fuses=self._make_score(SuspensePillar.LIT_FUSE, 4.0),
        )
        assert abs(r.overall_score - 60.0) < 0.01
        assert r.suspense_level == "MODERATE"


# ============================================================
# SuspenseAnalyzer (mock methods + pure logic)
# ============================================================

class TestSuspenseAnalyzer:

    def test_init_no_llm(self):
        a = SuspenseAnalyzer()
        assert a.llm is None

    # --- mock methods ---

    def test_mock_story_questions(self):
        a = SuspenseAnalyzer()
        s = a._mock_story_questions()
        assert s.pillar == SuspensePillar.STORY_QUESTION
        assert s.score == 7.0
        assert len(s.elements) == 1

    def test_mock_threat_situations(self):
        a = SuspenseAnalyzer()
        s = a._mock_threat_situations()
        assert s.pillar == SuspensePillar.THREAT_SITUATION
        assert s.score == 6.0

    def test_mock_lit_fuses(self):
        a = SuspenseAnalyzer()
        s = a._mock_lit_fuses()
        assert s.pillar == SuspensePillar.LIT_FUSE
        assert s.score == 5.0

    # --- async methods (no LLM) ---

    def test_detect_story_questions_no_llm(self):
        a = SuspenseAnalyzer()
        result = asyncio.get_event_loop().run_until_complete(
            a.detect_story_questions("content")
        )
        assert result.pillar == SuspensePillar.STORY_QUESTION

    def test_analyze_threat_no_llm(self):
        a = SuspenseAnalyzer()
        result = asyncio.get_event_loop().run_until_complete(
            a.analyze_threat_situations("content", {"name": "hero"})
        )
        assert result.pillar == SuspensePillar.THREAT_SITUATION

    def test_find_lit_fuses_no_llm(self):
        a = SuspenseAnalyzer()
        result = asyncio.get_event_loop().run_until_complete(
            a.find_lit_fuses("content")
        )
        assert result.pillar == SuspensePillar.LIT_FUSE

    def test_analyze_full_no_llm(self):
        a = SuspenseAnalyzer()
        result = asyncio.get_event_loop().run_until_complete(
            a.analyze_full("content", {"name": "hero"})
        )
        assert isinstance(result, SuspenseAnalysisResult)
        assert result.suspense_level in ("LOW", "MODERATE", "HIGH", "GRIPPING")

    # --- calculate_suspense_curve ---

    def test_suspense_curve_empty(self):
        a = SuspenseAnalyzer()
        curve = a.calculate_suspense_curve([])
        assert curve == []

    def test_suspense_curve_basic(self):
        a = SuspenseAnalyzer()
        scenes = [
            {"scene_id": "s1", "suspense_intensity": 3.0},
            {"scene_id": "s2", "suspense_intensity": 7.0},
            {"scene_id": "s3", "suspense_intensity": 9.0},
        ]
        curve = a.calculate_suspense_curve(scenes)
        assert len(curve) == 3
        assert curve[0] == ("s1", 3.0)
        assert curve[2] == ("s3", 9.0)

    def test_suspense_curve_default_intensity(self):
        a = SuspenseAnalyzer()
        scenes = [{"scene_id": "s1"}]
        curve = a.calculate_suspense_curve(scenes)
        assert curve[0] == ("s1", 5.0)

    def test_suspense_curve_unknown_id(self):
        a = SuspenseAnalyzer()
        scenes = [{"suspense_intensity": 8.0}]
        curve = a.calculate_suspense_curve(scenes)
        assert curve[0][0] == "unknown"

    # --- suggest_suspense_enhancement ---

    def test_suggest_all_low(self):
        a = SuspenseAnalyzer()
        result = SuspenseAnalysisResult(
            story_questions=SuspenseScore(pillar=SuspensePillar.STORY_QUESTION, score=3.0,
                                          suggestions=["add questions"]),
            threat_situations=SuspenseScore(pillar=SuspensePillar.THREAT_SITUATION, score=3.0,
                                            suggestions=["add threats"]),
            lit_fuses=SuspenseScore(pillar=SuspensePillar.LIT_FUSE, score=3.0,
                                    suggestions=["add fuses"]),
        )
        suggestions = a.suggest_suspense_enhancement(result)
        assert len(suggestions) >= 3

    def test_suggest_all_high(self):
        a = SuspenseAnalyzer()
        result = SuspenseAnalysisResult(
            story_questions=SuspenseScore(pillar=SuspensePillar.STORY_QUESTION, score=9.0),
            threat_situations=SuspenseScore(pillar=SuspensePillar.THREAT_SITUATION, score=9.0),
            lit_fuses=SuspenseScore(pillar=SuspensePillar.LIT_FUSE, score=9.0),
        )
        suggestions = a.suggest_suspense_enhancement(result)
        assert len(suggestions) == 0
