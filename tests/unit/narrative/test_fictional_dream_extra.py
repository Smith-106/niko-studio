# -*- coding: utf-8 -*-
"""FictionalDream tests - DreamStrength, DreamLayerScore, FictionalDreamResult, dataclasses from submodules."""

import pytest
from src.narrative.fictional_dream.engine import (
    DreamStrength,
    DreamLayerScore,
    FictionalDreamResult,
)
from src.narrative.fictional_dream.sympathy import (
    SympathyTrigger,
    SympathyEvidence,
    SympathyAnalysisResult,
)
from src.narrative.fictional_dream.identification import (
    IdentificationElement,
    IdentificationEvidence,
    IdentificationAnalysisResult,
    GodfatherTechnique,
)
from src.narrative.fictional_dream.empathy import (
    SenseType,
    SensoryDetail,
    EmpathyAnalysisResult,
    CarrieTechnique,
    RedBadgeTechnique,
)
from src.narrative.fictional_dream.immersion import (
    DilemmaType,
    InternalConflict,
    ImmersionAnalysisResult,
    CarrieWaitingScene,
    RaskolnikovMoralWar,
)
from src.narrative.fictional_dream.evaluator import QuickDreamReport


class TestDreamStrength:
    def test_values(self):
        assert DreamStrength.HYPNOTIC.value == "hypnotic"
        assert DreamStrength.BROKEN.value == "broken"


class TestDreamLayerScore:
    def test_basic(self):
        s = DreamLayerScore(layer_name="sympathy", score=75.0, is_effective=True, key_findings=["f1"], suggestions=["s1"])
        assert s.layer_name == "sympathy"
        assert s.is_effective is True


class TestSympathyDataclasses:
    def test_trigger_enum(self):
        assert SympathyTrigger.DANGER.value == "danger"
        assert SympathyTrigger.LOSS.value == "loss"

    def test_evidence(self):
        e = SympathyEvidence(
            trigger_type=SympathyTrigger.HELPLESSNESS,
            text_excerpt="he was alone",
            effectiveness=0.8, vulnerability_level=0.7, universality=0.9,
        )
        assert e.effectiveness == 0.8

    def test_analysis_result_effective(self):
        r = SympathyAnalysisResult(
            overall_score=70.0, triggers_detected=[], vulnerability_display=0.5,
            universal_predicament=True, suggestions=[],
        )
        assert r.is_effective is True

    def test_analysis_result_not_effective(self):
        r = SympathyAnalysisResult(
            overall_score=40.0, triggers_detected=[], vulnerability_display=0.3,
            universal_predicament=False, suggestions=["add danger"],
        )
        assert r.is_effective is False


class TestIdentificationDataclasses:
    def test_element_enum(self):
        assert IdentificationElement.GOAL_SUPPORT.value == "goal_support"

    def test_evidence(self):
        e = IdentificationEvidence(
            element_type=IdentificationElement.GOAL_SUPPORT,
            text_excerpt="he wanted freedom", goal_worthiness=0.8, reader_support_level=0.7,
        )
        assert e.goal_worthiness == 0.8

    def test_godfather_technique(self):
        gt = GodfatherTechnique(is_detected=True, moral_flaw="greed", noble_goal="family", effectiveness=0.9)
        assert gt.is_detected is True

    def test_analysis_result(self):
        r = IdentificationAnalysisResult(
            overall_score=65.0, elements_detected=[],
            godfather_technique=GodfatherTechnique(),
            goal_clarity=0.7, goal_worthiness=0.6, suggestions=[],
        )
        assert r.is_effective is True


class TestEmpathyDataclasses:
    def test_sense_type_enum(self):
        assert SenseType.VISUAL.value == "visual"
        assert SenseType.KINESTHETIC.value == "kinesthetic"

    def test_sensory_detail(self):
        sd = SensoryDetail(sense_type=SenseType.VISUAL, content="red light", emotion_evoked="fear", body_plant_effect=0.9, text_location="p1")
        assert sd.sense_type == SenseType.VISUAL

    def test_carrie_technique(self):
        ct = CarrieTechnique(is_detected=True, effectiveness=0.8)
        assert ct.is_detected is True

    def test_analysis_result(self):
        r = EmpathyAnalysisResult(
            overall_score=55.0, sensory_details=[], sensory_coverage={},
            carrie_technique=CarrieTechnique(), red_badge_technique=RedBadgeTechnique(),
            body_plant_score=0.5, suggestions=[],
        )
        assert r.is_effective is False


class TestImmersionDataclasses:
    def test_dilemma_type_enum(self):
        assert DilemmaType.MORAL.value == "moral"

    def test_internal_conflict(self):
        ic = InternalConflict(
            dilemma="save one or many", option_a="save one", option_b="save many",
            stakes="lives", honor_involved=True, dilemma_type=DilemmaType.MORAL, intensity=0.9,
        )
        assert ic.intensity == 0.9

    def test_analysis_result(self):
        r = ImmersionAnalysisResult(
            overall_score=80.0, internal_conflicts=[],
            carrie_scene=CarrieWaitingScene(), raskolnikov_war=RaskolnikovMoralWar(),
            reader_participation=0.7, choice_urgency=0.8, suggestions=[],
        )
        assert r.is_effective is True


class TestQuickDreamReport:
    def test_basic(self):
        r = QuickDreamReport(
            strength=DreamStrength.MODERATE, score=65.0,
            weakest_layer="sympathy", top_3_issues=["i1"], quick_wins=["w1"],
        )
        assert r.strength == DreamStrength.MODERATE


def _make_results(s_score, i_score, e_score, im_score):
    sympathy = SympathyAnalysisResult(overall_score=s_score, triggers_detected=[], vulnerability_display=0.5, universal_predicament=True, suggestions=[])
    identification = IdentificationAnalysisResult(overall_score=i_score, elements_detected=[], godfather_technique=GodfatherTechnique(), goal_clarity=0.5, goal_worthiness=0.5, suggestions=[])
    empathy = EmpathyAnalysisResult(overall_score=e_score, sensory_details=[], sensory_coverage={}, carrie_technique=CarrieTechnique(), red_badge_technique=RedBadgeTechnique(), body_plant_score=0.5, suggestions=[])
    immersion = ImmersionAnalysisResult(overall_score=im_score, internal_conflicts=[], carrie_scene=CarrieWaitingScene(), raskolnikov_war=RaskolnikovMoralWar(), reader_participation=0.5, choice_urgency=0.5, suggestions=[])
    return sympathy, identification, empathy, immersion


class TestFictionalDreamResult:
    def test_is_dream_effective_true(self):
        s, i, e, im = _make_results(70, 70, 70, 70)
        layers = [DreamLayerScore("sympathy", 70, True, [], [])]
        r = FictionalDreamResult(
            overall_score=70.0, dream_strength=DreamStrength.STRONG,
            sympathy=s, identification=i, empathy=e, immersion=im,
            layer_scores=layers, master_suggestions=[], dream_breakers=[],
        )
        assert r.is_dream_effective is True

    def test_is_dream_effective_false(self):
        s, i, e, im = _make_results(30, 30, 30, 30)
        r = FictionalDreamResult(
            overall_score=30.0, dream_strength=DreamStrength.BROKEN,
            sympathy=s, identification=i, empathy=e, immersion=im,
            layer_scores=[], master_suggestions=[], dream_breakers=[],
        )
        assert r.is_dream_effective is False

    def test_weakest_layer(self):
        s, i, e, im = _make_results(70, 70, 70, 70)
        layers = [
            DreamLayerScore("sympathy", 80, True, [], []),
            DreamLayerScore("empathy", 40, False, [], []),
            DreamLayerScore("immersion", 70, True, [], []),
        ]
        r = FictionalDreamResult(
            overall_score=60.0, dream_strength=DreamStrength.MODERATE,
            sympathy=s, identification=i, empathy=e, immersion=im,
            layer_scores=layers, master_suggestions=[], dream_breakers=[],
        )
        assert r.weakest_layer == "empathy"

    def test_weakest_layer_empty(self):
        s, i, e, im = _make_results(50, 50, 50, 50)
        r = FictionalDreamResult(
            overall_score=50.0, dream_strength=DreamStrength.WEAK,
            sympathy=s, identification=i, empathy=e, immersion=im,
            layer_scores=[], master_suggestions=[], dream_breakers=[],
        )
        assert r.weakest_layer == "unknown"
