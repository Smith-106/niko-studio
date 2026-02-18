# -*- coding: utf-8 -*-
"""FictionalDream tests - DreamStrength, DreamLayerScore, FictionalDreamResult, dataclasses from submodules."""

import pytest
from src.narrative.fictional_dream.engine import (
    DreamStrength,
    DreamLayerScore,
    FictionalDreamResult,
    FictionalDreamEngine,
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




class TestFictionalDreamResultProperties:
    def test_is_dream_effective_boundary(self):
        r_ok = FictionalDreamResult(
            overall_score=60.0,
            dream_strength=DreamStrength.MODERATE,
            sympathy=SympathyAnalysisResult(60, [], 0.5, True, []),
            identification=IdentificationAnalysisResult(60, [], GodfatherTechnique(), 0.5, 0.5, []),
            empathy=EmpathyAnalysisResult(60, [], {}, CarrieTechnique(), RedBadgeTechnique(), 0.5, []),
            immersion=ImmersionAnalysisResult(60, [], CarrieWaitingScene(), RaskolnikovMoralWar(), 0.5, 0.5, []),
            layer_scores=[DreamLayerScore("L1", 60, True, [], [])],
            master_suggestions=[],
            dream_breakers=[],
        )
        r_bad = FictionalDreamResult(
            overall_score=59.9,
            dream_strength=DreamStrength.WEAK,
            sympathy=SympathyAnalysisResult(59, [], 0.5, False, []),
            identification=IdentificationAnalysisResult(59, [], GodfatherTechnique(), 0.5, 0.5, []),
            empathy=EmpathyAnalysisResult(59, [], {}, CarrieTechnique(), RedBadgeTechnique(), 0.5, []),
            immersion=ImmersionAnalysisResult(59, [], CarrieWaitingScene(), RaskolnikovMoralWar(), 0.5, 0.5, []),
            layer_scores=[DreamLayerScore("L1", 59, False, [], [])],
            master_suggestions=[],
            dream_breakers=[],
        )
        assert r_ok.is_dream_effective is True
        assert r_bad.is_dream_effective is False

    def test_weakest_layer_empty_returns_unknown(self):
        r = FictionalDreamResult(
            overall_score=10.0,
            dream_strength=DreamStrength.BROKEN,
            sympathy=SympathyAnalysisResult(0, [], 0.0, False, []),
            identification=IdentificationAnalysisResult(0, [], GodfatherTechnique(), 0.0, 0.0, []),
            empathy=EmpathyAnalysisResult(0, [], {}, CarrieTechnique(), RedBadgeTechnique(), 0.0, []),
            immersion=ImmersionAnalysisResult(0, [], CarrieWaitingScene(), RaskolnikovMoralWar(), 0.0, 0.0, []),
            layer_scores=[],
            master_suggestions=[],
            dream_breakers=[],
        )
        assert r.weakest_layer == "unknown"

    @pytest.fixture
    def fake_engine(self):
        engine = FictionalDreamEngine()

        class StubSympathy:
            async def analyze(self, *args, **kwargs):
                return SympathyAnalysisResult(
                    overall_score=65.0,
                    triggers_detected=[],
                    vulnerability_display=0.5,
                    universal_predicament=True,
                    suggestions=["s1", "s2", "s3", "s4"],
                )

            def detect_universal_predicament(self, text):
                return ["danger"] if "danger" in text else []

        class StubIdentification:
            async def analyze(self, *args, **kwargs):
                return IdentificationAnalysisResult(
                    overall_score=62.0,
                    elements_detected=[],
                    godfather_technique=GodfatherTechnique(),
                    goal_clarity=0.4,
                    goal_worthiness=0.5,
                    suggestions=["i1", "i2", "i3", "i4"],
                )

        class StubEmpathy:
            async def analyze(self, *args, **kwargs):
                return EmpathyAnalysisResult(
                    overall_score=58.0,
                    sensory_details=[],
                    sensory_coverage={},
                    carrie_technique=CarrieTechnique(),
                    red_badge_technique=RedBadgeTechnique(),
                    body_plant_score=33.0,
                    suggestions=["e1", "e2", "e3", "e4"],
                )

            def evaluate_body_plant(self, text):
                return 42.0 if text else 0.0

        class StubImmersion:
            async def analyze(self, *args, **kwargs):
                return ImmersionAnalysisResult(
                    overall_score=55.0,
                    internal_conflicts=[],
                    carrie_scene=CarrieWaitingScene(),
                    raskolnikov_war=RaskolnikovMoralWar(),
                    reader_participation=0.6,
                    choice_urgency=0.7,
                    suggestions=["m1", "m2", "m3", "m4"],
                )

            def detect_moral_dilemma(self, text):
                return "choose" in text

        engine.sympathy_analyzer = StubSympathy()
        engine.identification_builder = StubIdentification()
        engine.empathy_deepener = StubEmpathy()
        engine.immersion_catalyst = StubImmersion()
        return engine

    def test_calculate_overall_score_non_four_layers(self, fake_engine):
        score = fake_engine._calculate_overall_score([DreamLayerScore("x", 50, True, [], [])])
        assert score == 0.0

    @pytest.mark.parametrize(
        "score,expected",
        [
            (95, DreamStrength.HYPNOTIC),
            (80, DreamStrength.STRONG),
            (65, DreamStrength.MODERATE),
            (45, DreamStrength.WEAK),
            (20, DreamStrength.BROKEN),
        ],
    )
    def test_determine_strength_all_thresholds(self, fake_engine, score, expected):
        assert fake_engine._determine_strength(score) == expected

    @pytest.mark.asyncio
    async def test_detect_dream_breakers_both_branches(self, fake_engine):
        text = "读者会理解。首先其次第一第二总之"
        breakers = await fake_engine._detect_dream_breakers(text)
        assert len(breakers) == 2

    @pytest.mark.asyncio
    async def test_detect_dream_breakers_no_breakers(self, fake_engine):
        breakers = await fake_engine._detect_dream_breakers("normal story")
        assert breakers == []

    def test_generate_master_suggestions_strength_branches(self, fake_engine):
        layer_scores = [
            DreamLayerScore("L1", 30, False, [], ["a"]),
            DreamLayerScore("L2", 70, True, [], ["b"]),
            DreamLayerScore("L3", 80, True, [], ["c"]),
            DreamLayerScore("L4", 75, True, [], ["d"]),
        ]

        for strength in [
            DreamStrength.HYPNOTIC,
            DreamStrength.STRONG,
            DreamStrength.MODERATE,
            DreamStrength.WEAK,
            DreamStrength.BROKEN,
        ]:
            out = fake_engine._generate_master_suggestions(layer_scores, strength, ["breaker"])
            assert any("最需要加强" in s for s in out)
            assert any("梦境破坏者" in s for s in out)

    @pytest.mark.asyncio
    async def test_evaluate_end_to_end_and_layer_break_warning(self, fake_engine):
        result = await fake_engine.evaluate("danger choose", character_info={"name": "n"})
        assert result.overall_score > 0
        assert result.weakest_layer in {"同情 (Sympathy)", "认同 (Identification)", "移情 (Empathy)", "沉浸 (Immersion)"}
        assert len(result.layer_scores) == 4

    @pytest.mark.asyncio
    async def test_quick_evaluate_moral_dilemma_true_false(self, fake_engine):
        with_dilemma = await fake_engine.quick_evaluate("danger choose")
        without_dilemma = await fake_engine.quick_evaluate("plain")
        assert with_dilemma["immersion"] == 50
        assert without_dilemma["immersion"] == 20
