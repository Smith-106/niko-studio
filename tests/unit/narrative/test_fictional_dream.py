"""
Fictional Dream Subsystem Tests

Tests for SympathyAnalyzer, IdentificationBuilder, EmpathyDeepener,
and ImmersionCatalyst — data models, scoring logic, and keyword detection.
"""

import pytest
from src.narrative.fictional_dream.sympathy import (
    SympathyTrigger,
    SympathyEvidence,
    SympathyAnalysisResult,
    SympathyAnalyzer,
)
from src.narrative.fictional_dream.identification import (
    IdentificationElement,
    GodfatherTechnique,
    IdentificationEvidence,
    IdentificationAnalysisResult,
    IdentificationBuilder,
)
from src.narrative.fictional_dream.empathy import (
    SenseType,
    SensoryDetail,
    CarrieTechnique,
    RedBadgeTechnique,
    EmpathyAnalysisResult,
    EmpathyDeepener,
)
from src.narrative.fictional_dream.immersion import (
    DilemmaType,
    InternalConflict,
    CarrieWaitingScene,
    RaskolnikovMoralWar,
    ImmersionAnalysisResult,
    ImmersionCatalyst,
)


# ============================================================
# Sympathy Enums & Dataclasses
# ============================================================

class TestSympathyTrigger:

    def test_values(self):
        assert SympathyTrigger.DANGER.value == "danger"
        assert SympathyTrigger.POVERTY_HUMILIATION.value == "poverty_humiliation"
        assert SympathyTrigger.LONELINESS_EXCLUSION.value == "loneliness_exclusion"
        assert SympathyTrigger.HELPLESSNESS.value == "helplessness"
        assert SympathyTrigger.INJUSTICE.value == "injustice"
        assert SympathyTrigger.LOSS.value == "loss"

    def test_six_triggers(self):
        assert len(SympathyTrigger) == 6


class TestSympathyEvidence:

    def test_fields(self):
        ev = SympathyEvidence(
            trigger_type=SympathyTrigger.DANGER,
            text_excerpt="他面临威胁",
            effectiveness=0.8,
            vulnerability_level=0.7,
            universality=0.6,
        )
        assert ev.trigger_type == SympathyTrigger.DANGER
        assert ev.effectiveness == 0.8


class TestSympathyAnalysisResult:

    def test_is_effective_true(self):
        result = SympathyAnalysisResult(
            overall_score=60, triggers_detected=[], vulnerability_display=0.5,
            universal_predicament=True, suggestions=[],
        )
        assert result.is_effective is True

    def test_is_effective_false(self):
        result = SympathyAnalysisResult(
            overall_score=59, triggers_detected=[], vulnerability_display=0.5,
            universal_predicament=False, suggestions=[],
        )
        assert result.is_effective is False


# ============================================================
# SympathyAnalyzer
# ============================================================

class TestSympathyAnalyzer:

    @pytest.fixture
    def analyzer(self):
        return SympathyAnalyzer()

    def test_init(self, analyzer):
        assert analyzer.llm is None
        assert len(analyzer.predicament_keywords) == 6

    # --- _check_universality ---

    def test_check_universality_empty(self, analyzer):
        assert analyzer._check_universality([]) is False

    def test_check_universality_low(self, analyzer):
        ev = SympathyEvidence(
            trigger_type=SympathyTrigger.DANGER, text_excerpt="t",
            effectiveness=0.5, vulnerability_level=0.5, universality=0.5,
        )
        assert analyzer._check_universality([ev]) is False

    def test_check_universality_high(self, analyzer):
        ev = SympathyEvidence(
            trigger_type=SympathyTrigger.DANGER, text_excerpt="t",
            effectiveness=0.5, vulnerability_level=0.5, universality=0.7,
        )
        assert analyzer._check_universality([ev]) is True

    # --- _calculate_score ---

    def test_calculate_score_empty(self, analyzer):
        assert analyzer._calculate_score([], 0.0, False) == 0.0

    def test_calculate_score_with_triggers(self, analyzer):
        ev = SympathyEvidence(
            trigger_type=SympathyTrigger.DANGER, text_excerpt="t",
            effectiveness=0.8, vulnerability_level=0.6, universality=0.7,
        )
        score = analyzer._calculate_score([ev], 0.6, True)
        # trigger_score = min(1*15, 40) = 15
        # effectiveness_score = 0.8/1 * 30 = 24
        # vulnerability_score = 0.6 * 20 = 12
        # universality_bonus = 10
        assert score == pytest.approx(61.0)

    def test_calculate_score_capped(self, analyzer):
        evs = [
            SympathyEvidence(
                trigger_type=SympathyTrigger.DANGER, text_excerpt="t",
                effectiveness=1.0, vulnerability_level=1.0, universality=1.0,
            )
        ] * 5
        score = analyzer._calculate_score(evs, 1.0, True)
        assert score <= 100

    # --- detect_universal_predicament ---

    def test_detect_universal_predicament_none(self, analyzer):
        assert analyzer.detect_universal_predicament("今天天气不错") == []

    def test_detect_universal_predicament_danger(self, analyzer):
        result = analyzer.detect_universal_predicament("他面临生命威胁和危险")
        assert SympathyTrigger.DANGER in result

    def test_detect_universal_predicament_multiple(self, analyzer):
        text = "他陷入贫穷和孤独之中"
        result = analyzer.detect_universal_predicament(text)
        assert SympathyTrigger.POVERTY_HUMILIATION in result
        assert SympathyTrigger.LONELINESS_EXCLUSION in result

    # --- async analyze ---

    @pytest.mark.asyncio
    async def test_analyze_no_triggers(self, analyzer):
        result = await analyzer.analyze("今天天气很好，阳光明媚。")
        assert result.overall_score == 0.0
        assert len(result.triggers_detected) == 0

    @pytest.mark.asyncio
    async def test_analyze_with_danger(self, analyzer):
        result = await analyzer.analyze("他面临巨大的危险和威胁，生命岌岌可危。")
        assert result.overall_score > 0
        assert len(result.triggers_detected) > 0

    @pytest.mark.asyncio
    async def test_analyze_suggestions_low_score(self, analyzer):
        result = await analyzer.analyze("平淡的日常生活。")
        assert len(result.suggestions) > 0

    # --- _evaluate_vulnerability ---

    @pytest.mark.asyncio
    async def test_evaluate_vulnerability_empty(self, analyzer):
        v = await analyzer._evaluate_vulnerability("text", [])
        assert v == 0.0

    @pytest.mark.asyncio
    async def test_evaluate_vulnerability_avg(self, analyzer):
        evs = [
            SympathyEvidence(SympathyTrigger.DANGER, "t", 0.5, 0.4, 0.5),
            SympathyEvidence(SympathyTrigger.LOSS, "t", 0.5, 0.8, 0.5),
        ]
        v = await analyzer._evaluate_vulnerability("text", evs)
        assert v == pytest.approx(0.6)

    # --- _generate_suggestions ---

    @pytest.mark.asyncio
    async def test_suggestions_no_triggers(self, analyzer):
        suggestions = await analyzer._generate_suggestions("text", [], 0.5, 10)
        assert any("同情元素严重不足" in s for s in suggestions)

    @pytest.mark.asyncio
    async def test_suggestions_low_vulnerability(self, analyzer):
        ev = SympathyEvidence(SympathyTrigger.DANGER, "t", 0.5, 0.3, 0.5)
        suggestions = await analyzer._generate_suggestions("text", [ev], 0.3, 50)
        assert any("脆弱性展示不足" in s for s in suggestions)


# ============================================================
# Identification Enums & Dataclasses
# ============================================================

class TestIdentificationElement:

    def test_values(self):
        assert IdentificationElement.GOAL_SUPPORT.value == "goal_support"
        assert IdentificationElement.COURAGE_RECOGNITION.value == "courage_recognition"
        assert IdentificationElement.NOBLE_VALUE_BINDING.value == "noble_value_binding"
        assert IdentificationElement.JUSTICE_EMBODIMENT.value == "justice_embodiment"

    def test_four_elements(self):
        assert len(IdentificationElement) == 4


class TestGodfatherTechnique:

    def test_defaults(self):
        t = GodfatherTechnique()
        assert t.is_detected is False
        assert t.moral_flaw is None
        assert t.noble_goal is None
        assert t.effectiveness == 0.0


class TestIdentificationAnalysisResult:

    def test_is_effective(self):
        result = IdentificationAnalysisResult(
            overall_score=60, elements_detected=[], godfather_technique=GodfatherTechnique(),
            goal_clarity=0.5, goal_worthiness=0.5, suggestions=[],
        )
        assert result.is_effective is True


# ============================================================
# IdentificationBuilder
# ============================================================

class TestIdentificationBuilder:

    @pytest.fixture
    def builder(self):
        return IdentificationBuilder()

    def test_init(self, builder):
        assert builder.llm is None
        assert len(builder.noble_values) > 0
        assert len(builder.goal_keywords) > 0

    # --- _evaluate_goal_clarity ---

    @pytest.mark.asyncio
    async def test_goal_clarity_none(self, builder):
        c = await builder._evaluate_goal_clarity("平淡的文字")
        assert c == 0.0

    @pytest.mark.asyncio
    async def test_goal_clarity_some(self, builder):
        c = await builder._evaluate_goal_clarity("他必须完成目标，决心不动摇")
        assert c > 0

    @pytest.mark.asyncio
    async def test_goal_clarity_capped(self, builder):
        text = "必须一定要目标是为了决心"
        c = await builder._evaluate_goal_clarity(text)
        assert c <= 1.0

    # --- _evaluate_goal_worthiness ---

    @pytest.mark.asyncio
    async def test_worthiness_empty(self, builder):
        w = await builder._evaluate_goal_worthiness("text", [])
        assert w == 0.0

    @pytest.mark.asyncio
    async def test_worthiness_noble(self, builder):
        ev = IdentificationEvidence(
            element_type=IdentificationElement.NOBLE_VALUE_BINDING,
            text_excerpt="t", goal_worthiness=0.8, reader_support_level=0.6,
            noble_value="正义",
        )
        w = await builder._evaluate_goal_worthiness("text", [ev])
        assert w == 0.8

    @pytest.mark.asyncio
    async def test_worthiness_goal(self, builder):
        ev = IdentificationEvidence(
            element_type=IdentificationElement.GOAL_SUPPORT,
            text_excerpt="t", goal_worthiness=0.5, reader_support_level=0.5,
        )
        w = await builder._evaluate_goal_worthiness("text", [ev])
        assert w == 0.5

    # --- _calculate_score ---

    def test_calculate_score_empty(self, builder):
        s = builder._calculate_score([], GodfatherTechnique(), 0, 0, 0)
        assert s == 0.0

    def test_calculate_score_with_elements(self, builder):
        ev = IdentificationEvidence(
            element_type=IdentificationElement.GOAL_SUPPORT,
            text_excerpt="t", goal_worthiness=0.5, reader_support_level=0.5,
        )
        s = builder._calculate_score([ev], GodfatherTechnique(), 0.5, 0.5, 50)
        assert s > 0

    def test_calculate_score_capped(self, builder):
        evs = [
            IdentificationEvidence(
                IdentificationElement.GOAL_SUPPORT, "t", 1.0, 1.0,
            )
        ] * 10
        gt = GodfatherTechnique(is_detected=True, effectiveness=1.0)
        s = builder._calculate_score(evs, gt, 1.0, 1.0, 100)
        assert s <= 100

    # --- detect_godfather_potential ---

    def test_godfather_no_flaw(self, builder):
        assert builder.detect_godfather_potential(False, "拯救世界") is False

    def test_godfather_flaw_no_noble(self, builder):
        assert builder.detect_godfather_potential(True, "吃饭睡觉") is False

    def test_godfather_flaw_with_noble(self, builder):
        assert builder.detect_godfather_potential(True, "追求正义") is True

    # --- async analyze ---

    @pytest.mark.asyncio
    async def test_analyze_no_elements(self, builder):
        result = await builder.analyze("平淡的文字")
        assert result.overall_score == 0.0

    @pytest.mark.asyncio
    async def test_analyze_with_goal(self, builder):
        result = await builder.analyze("他必须拯救家人，这是他的使命。为了正义，他决心奋斗。")
        assert result.overall_score > 0
        assert len(result.elements_detected) > 0


# ============================================================
# Empathy (SenseType, dataclasses)
# ============================================================

class TestSenseType:

    def test_values(self):
        assert SenseType.VISUAL.value == "visual"
        assert SenseType.AUDITORY.value == "auditory"
        assert SenseType.TACTILE.value == "tactile"
        assert SenseType.OLFACTORY.value == "olfactory"
        assert SenseType.GUSTATORY.value == "gustatory"
        assert SenseType.KINESTHETIC.value == "kinesthetic"

    def test_six_types(self):
        assert len(SenseType) == 6


class TestCarrieTechnique:

    def test_defaults(self):
        t = CarrieTechnique()
        assert t.is_detected is False
        assert t.physical_state_descriptions == []
        assert t.effectiveness == 0.0


class TestRedBadgeTechnique:

    def test_defaults(self):
        t = RedBadgeTechnique()
        assert t.is_detected is False
        assert t.sensory_chain == []
        assert t.immersive_effect == 0.0


class TestEmpathyAnalysisResult:

    def test_is_effective(self):
        result = EmpathyAnalysisResult(
            overall_score=60, sensory_details=[], sensory_coverage={},
            carrie_technique=CarrieTechnique(), red_badge_technique=RedBadgeTechnique(),
            body_plant_score=0, suggestions=[],
        )
        assert result.is_effective is True

    def test_not_effective(self):
        result = EmpathyAnalysisResult(
            overall_score=59, sensory_details=[], sensory_coverage={},
            carrie_technique=CarrieTechnique(), red_badge_technique=RedBadgeTechnique(),
            body_plant_score=0, suggestions=[],
        )
        assert result.is_effective is False


# ============================================================
# EmpathyDeepener
# ============================================================

class TestEmpathyDeepener:

    @pytest.fixture
    def deepener(self):
        return EmpathyDeepener()

    def test_init(self, deepener):
        assert deepener.llm is None
        assert len(deepener.sensory_keywords) == 6
        assert len(deepener.body_state_keywords) > 0

    # --- _calculate_coverage ---

    def test_coverage_empty(self, deepener):
        cov = deepener._calculate_coverage([])
        assert all(v == 0 for v in cov.values())

    def test_coverage_counts(self, deepener):
        details = [
            SensoryDetail(SenseType.VISUAL, "c", "e", 0.5, "loc"),
            SensoryDetail(SenseType.VISUAL, "c", "e", 0.5, "loc"),
            SensoryDetail(SenseType.AUDITORY, "c", "e", 0.5, "loc"),
        ]
        cov = deepener._calculate_coverage(details)
        assert cov[SenseType.VISUAL] == 2
        assert cov[SenseType.AUDITORY] == 1
        assert cov[SenseType.TACTILE] == 0

    # --- _calculate_body_plant_score ---

    def test_body_plant_empty(self, deepener):
        score = deepener._calculate_body_plant_score([], CarrieTechnique(), RedBadgeTechnique())
        assert score == 0

    def test_body_plant_details_only(self, deepener):
        details = [SensoryDetail(SenseType.VISUAL, "c", "e", 0.5, "loc")] * 3
        score = deepener._calculate_body_plant_score(details, CarrieTechnique(), RedBadgeTechnique())
        assert score == 15  # 3 * 5 = 15

    def test_body_plant_with_carrie(self, deepener):
        ct = CarrieTechnique(is_detected=True, effectiveness=0.5)
        score = deepener._calculate_body_plant_score([], ct, RedBadgeTechnique())
        assert score == 15  # 0.5 * 30

    def test_body_plant_with_red_badge(self, deepener):
        rb = RedBadgeTechnique(is_detected=True, immersive_effect=0.6)
        score = deepener._calculate_body_plant_score([], CarrieTechnique(), rb)
        assert score == 18  # 0.6 * 30

    def test_body_plant_capped(self, deepener):
        details = [SensoryDetail(SenseType.VISUAL, "c", "e", 0.5, "loc")] * 20
        ct = CarrieTechnique(is_detected=True, effectiveness=1.0)
        rb = RedBadgeTechnique(is_detected=True, immersive_effect=1.0)
        score = deepener._calculate_body_plant_score(details, ct, rb)
        assert score <= 100

    # --- _calculate_score ---

    def test_score_empty(self, deepener):
        cov = {s: 0 for s in SenseType}
        score = deepener._calculate_score([], cov, 0, 0)
        assert score == 0

    def test_score_with_details(self, deepener):
        details = [SensoryDetail(SenseType.VISUAL, "c", "e", 0.5, "loc")]
        cov = {s: 0 for s in SenseType}
        cov[SenseType.VISUAL] = 1
        score = deepener._calculate_score(details, cov, 50, 80)
        assert score > 0

    # --- evaluate_body_plant ---

    def test_evaluate_body_plant_none(self, deepener):
        score = deepener.evaluate_body_plant("平淡文字")
        assert score == 0

    def test_evaluate_body_plant_some(self, deepener):
        score = deepener.evaluate_body_plant("他的心跳加速，手心出汗，呼吸急促")
        assert score > 0

    # --- async analyze ---

    @pytest.mark.asyncio
    async def test_analyze_plain(self, deepener):
        result = await deepener.analyze("今天天气不错。")
        assert result.overall_score >= 0

    @pytest.mark.asyncio
    async def test_analyze_sensory(self, deepener):
        text = "他看见远处的光线。听见沙沙的声音。感觉到冰冷的触摸。闻到刺鼻的气味。"
        result = await deepener.analyze(text)
        assert len(result.sensory_details) > 0
        # Multiple senses covered
        covered = sum(1 for v in result.sensory_coverage.values() if v > 0)
        assert covered >= 3

    @pytest.mark.asyncio
    async def test_analyze_carrie(self, deepener):
        text = "他的心跳加速。手心出汗。呼吸急促。额头冒汗。脊背发凉。"
        result = await deepener.analyze(text)
        assert result.carrie_technique.is_detected is True

    @pytest.mark.asyncio
    async def test_analyze_red_badge(self, deepener):
        text = "他看见闪烁的光。听见轰鸣的声音。感觉到颤抖的身体。闻到弥漫的气味。"
        result = await deepener.analyze(text)
        # 4 consecutive sensory sentences → red badge detected
        assert result.red_badge_technique.is_detected is True


# ============================================================
# Immersion (DilemmaType, dataclasses)
# ============================================================

class TestDilemmaType:

    def test_values(self):
        assert DilemmaType.MORAL.value == "moral"
        assert DilemmaType.DUTY_CONFLICT.value == "duty_conflict"
        assert DilemmaType.VALUE_CHOICE.value == "value_choice"
        assert DilemmaType.EMOTIONAL.value == "emotional"
        assert DilemmaType.TRUST.value == "trust"

    def test_five_types(self):
        assert len(DilemmaType) == 5


class TestCarrieWaitingScene:

    def test_defaults(self):
        s = CarrieWaitingScene()
        assert s.is_detected is False
        assert s.hope_fear_tension == ""
        assert s.reader_participation == 0.0


class TestRaskolnikovMoralWar:

    def test_defaults(self):
        r = RaskolnikovMoralWar()
        assert r.is_detected is False
        assert r.conscience_vs_need == ""
        assert r.moral_torment == 0.0


class TestImmersionAnalysisResult:

    def test_is_effective(self):
        result = ImmersionAnalysisResult(
            overall_score=60, internal_conflicts=[], carrie_scene=CarrieWaitingScene(),
            raskolnikov_war=RaskolnikovMoralWar(), reader_participation=0,
            choice_urgency=0, suggestions=[],
        )
        assert result.is_effective is True


# ============================================================
# ImmersionCatalyst
# ============================================================

class TestImmersionCatalyst:

    @pytest.fixture
    def catalyst(self):
        return ImmersionCatalyst()

    def test_init(self, catalyst):
        assert catalyst.llm is None
        assert len(catalyst.conflict_keywords) > 0

    # --- _evaluate_reader_participation ---

    def test_participation_empty(self, catalyst):
        p = catalyst._evaluate_reader_participation(
            [], CarrieWaitingScene(), RaskolnikovMoralWar()
        )
        assert p == 0.0

    def test_participation_with_conflicts(self, catalyst):
        c = InternalConflict("d", "a", "b", "s", False, DilemmaType.EMOTIONAL, 0.5)
        p = catalyst._evaluate_reader_participation(
            [c], CarrieWaitingScene(), RaskolnikovMoralWar()
        )
        assert p == 15  # 1 * 15

    def test_participation_with_carrie(self, catalyst):
        c = InternalConflict("d", "a", "b", "s", False, DilemmaType.EMOTIONAL, 0.5)
        cs = CarrieWaitingScene(is_detected=True, reader_participation=0.7)
        p = catalyst._evaluate_reader_participation([c], cs, RaskolnikovMoralWar())
        assert p == 29  # 15 + 0.7*20 = 29

    def test_participation_capped(self, catalyst):
        conflicts = [
            InternalConflict("d", "a", "b", "s", False, DilemmaType.EMOTIONAL, 0.5)
        ] * 10
        cs = CarrieWaitingScene(is_detected=True, reader_participation=1.0)
        rm = RaskolnikovMoralWar(is_detected=True, moral_torment=1.0)
        p = catalyst._evaluate_reader_participation(conflicts, cs, rm)
        assert p <= 100

    # --- _evaluate_choice_urgency ---

    def test_urgency_none(self, catalyst):
        u = catalyst._evaluate_choice_urgency("平淡文字", [])
        assert u == 0.0

    def test_urgency_some(self, catalyst):
        u = catalyst._evaluate_choice_urgency("必须立刻行动，否则来不及了", [])
        assert u > 0

    def test_urgency_capped(self, catalyst):
        text = "必须立刻马上现在不能等来不及最后唯一只有否则"
        u = catalyst._evaluate_choice_urgency(text, [])
        assert u <= 1.0

    # --- _calculate_score ---

    def test_score_empty(self, catalyst):
        s = catalyst._calculate_score([], 0, 0, 0)
        assert s == 0.0

    def test_score_with_conflicts(self, catalyst):
        c = InternalConflict("d", "a", "b", "s", True, DilemmaType.MORAL, 0.6)
        s = catalyst._calculate_score([c], 50, 0.5, 80)
        assert s > 0

    def test_score_capped(self, catalyst):
        conflicts = [
            InternalConflict("d", "a", "b", "s", True, DilemmaType.MORAL, 1.0)
        ] * 10
        s = catalyst._calculate_score(conflicts, 100, 1.0, 100)
        assert s <= 100

    # --- detect_moral_dilemma ---

    def test_moral_dilemma_none(self, catalyst):
        assert catalyst.detect_moral_dilemma("今天天气不错") is False

    def test_moral_dilemma_moral_only(self, catalyst):
        assert catalyst.detect_moral_dilemma("这是正义的") is False

    def test_moral_dilemma_conflict_only(self, catalyst):
        assert catalyst.detect_moral_dilemma("他很犹豫挣扎") is False

    def test_moral_dilemma_both(self, catalyst):
        assert catalyst.detect_moral_dilemma("他犹豫着，这是否正义") is True

    # --- async _detect_conflicts ---

    @pytest.mark.asyncio
    async def test_detect_conflicts_empty(self, catalyst):
        result = await catalyst._detect_conflicts("平淡文字")
        assert len(result) == 0

    @pytest.mark.asyncio
    async def test_detect_conflicts_found(self, catalyst):
        text = "他内心犹豫挣扎，一方面想要另一方面又害怕"
        result = await catalyst._detect_conflicts(text)
        assert len(result) > 0

    # --- async _analyze_carrie_technique ---

    @pytest.mark.asyncio
    async def test_carrie_not_detected(self, catalyst):
        result = await catalyst._analyze_carrie_technique("平淡文字")
        assert result.is_detected is False

    @pytest.mark.asyncio
    async def test_carrie_detected(self, catalyst):
        result = await catalyst._analyze_carrie_technique("他渴望成功，但又害怕失败，希望一切顺利却担心出错")
        assert result.is_detected is True

    # --- async _analyze_raskolnikov_technique ---

    @pytest.mark.asyncio
    async def test_raskolnikov_not_detected(self, catalyst):
        result = await catalyst._analyze_raskolnikov_technique("平淡文字")
        assert result.is_detected is False

    @pytest.mark.asyncio
    async def test_raskolnikov_detected(self, catalyst):
        result = await catalyst._analyze_raskolnikov_technique("这难道是对的吗？他的良心应该不安")
        assert result.is_detected is True

    # --- async analyze ---

    @pytest.mark.asyncio
    async def test_analyze_plain(self, catalyst):
        result = await catalyst.analyze("今天天气真好。")
        assert result.overall_score >= 0

    @pytest.mark.asyncio
    async def test_analyze_with_conflict(self, catalyst):
        text = "他犹豫着，内心挣扎不已。一方面他渴望自由，另一方面他害怕未知。这难道是正义的选择吗？"
        result = await catalyst.analyze(text)
        assert result.overall_score > 0
        assert len(result.internal_conflicts) > 0
