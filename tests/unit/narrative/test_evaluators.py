# -*- coding: utf-8 -*-
"""
Tests for other evaluators: SuspenseEvaluator, CharacterEvaluator,
PremiseEvaluator, VoiceEvaluator, PyramidEvaluator, DeadlySinsChecker.
"""

import pytest
from src.narrative.evaluators.suspense_evaluator import SuspenseEvaluator
from src.narrative.evaluators.character_evaluator import CharacterEvaluator
from src.narrative.evaluators.premise_evaluator import PremiseEvaluator
from src.narrative.evaluators.voice_evaluator import VoiceEvaluator
from src.narrative.evaluators.pyramid_evaluator import PyramidEvaluator
from src.narrative.evaluators.deadly_sins_checker import DeadlySinsChecker, DeadlySin
from src.narrative.evaluators.base import EvaluationResult, Severity, ScoreLevel


# ============================================================
# SuspenseEvaluator Tests
# ============================================================

class TestSuspenseEvaluatorProperties:
    """Tests for SuspenseEvaluator properties."""

    @pytest.fixture
    def evaluator(self, mock_llm_client):
        return SuspenseEvaluator(llm_client=mock_llm_client)

    def test_name_property(self, evaluator):
        assert evaluator.name == "悬念评估器"

    def test_description_property(self, evaluator):
        assert "悬念" in evaluator.description
        assert "三大支柱" in evaluator.description

    def test_related_skill(self, evaluator):
        assert evaluator.related_skill == "suspense-craft"


class TestSuspenseEvaluatorEvaluate:
    """Tests for SuspenseEvaluator.evaluate method."""

    @pytest.fixture
    def evaluator(self, mock_llm_client):
        return SuspenseEvaluator(llm_client=mock_llm_client)

    @pytest.mark.asyncio
    async def test_evaluate_returns_result(self, evaluator, sample_suspenseful_content):
        result = await evaluator.evaluate(sample_suspenseful_content)
        assert isinstance(result, EvaluationResult)

    @pytest.mark.asyncio
    async def test_evaluate_has_three_metrics(self, evaluator, sample_suspenseful_content):
        result = await evaluator.evaluate(sample_suspenseful_content)
        assert "story_questions" in result.metrics
        assert "threat_situation" in result.metrics
        assert "fuse_effect" in result.metrics

    @pytest.mark.asyncio
    async def test_evaluate_suspenseful_content_high_score(self, evaluator, sample_suspenseful_content):
        result = await evaluator.evaluate(sample_suspenseful_content)
        assert result.score >= 50  # Suspense detection has strict thresholds

    @pytest.mark.asyncio
    async def test_evaluate_poor_content_low_score(self, evaluator, sample_poor_content):
        result = await evaluator.evaluate(sample_poor_content)
        assert result.score < 60
        assert len(result.issues) > 0

    def test_quick_scan_returns_result(self, evaluator, sample_good_content):
        result = evaluator.quick_scan(sample_good_content)
        assert isinstance(result, EvaluationResult)


class TestSuspenseEvaluatorPrivateMethods:
    """Tests for SuspenseEvaluator private methods."""

    @pytest.fixture
    def evaluator(self, mock_llm_client):
        return SuspenseEvaluator(llm_client=mock_llm_client)

    def test_evaluate_story_questions(self, evaluator):
        content = "究竟是谁做的？为什么会这样？他能否逃脱？"
        score = evaluator._evaluate_story_questions(content)
        assert score >= 50

    def test_evaluate_threat(self, evaluator):
        content = "危险逼近，死亡的威胁笼罩着他们。如果不行动，一切都会毁灭。"
        score = evaluator._evaluate_threat(content)
        assert score >= 50

    def test_evaluate_fuse(self, evaluator):
        content = "只剩下三分钟，倒计时开始。他必须立刻行动，马上！"
        score = evaluator._evaluate_fuse(content)
        assert score >= 60


# ============================================================
# CharacterEvaluator Tests
# ============================================================

class TestCharacterEvaluatorProperties:
    """Tests for CharacterEvaluator properties."""

    @pytest.fixture
    def evaluator(self, mock_llm_client):
        return CharacterEvaluator(llm_client=mock_llm_client)

    def test_name_property(self, evaluator):
        assert evaluator.name == "人物评估器"

    def test_related_skill(self, evaluator):
        assert evaluator.related_skill == "character-forge"


class TestCharacterEvaluatorEvaluate:
    """Tests for CharacterEvaluator.evaluate method."""

    @pytest.fixture
    def evaluator(self, mock_llm_client):
        return CharacterEvaluator(llm_client=mock_llm_client)

    @pytest.mark.asyncio
    async def test_evaluate_returns_result(self, evaluator, sample_good_content):
        result = await evaluator.evaluate(sample_good_content)
        assert isinstance(result, EvaluationResult)

    @pytest.mark.asyncio
    async def test_evaluate_has_character_metrics(self, evaluator, sample_good_content):
        result = await evaluator.evaluate(sample_good_content)
        assert "competence" in result.metrics
        assert "eccentricity" in result.metrics
        assert "inner_conflict" in result.metrics

    @pytest.mark.asyncio
    async def test_evaluate_content_with_skills(self, evaluator):
        content = "他擅长剑术，精通医学，技艺高超，游刃有余地处理一切。"
        result = await evaluator.evaluate(content)
        assert result.metrics["competence"] >= 70

    @pytest.mark.asyncio
    async def test_evaluate_content_with_quirks(self, evaluator):
        content = "他有一个古怪的习惯，总是从不喝冷水，必须用左手开门。"
        result = await evaluator.evaluate(content)
        assert result.metrics["eccentricity"] >= 70

    @pytest.mark.asyncio
    async def test_evaluate_content_with_inner_conflict(self, evaluator):
        content = "他内心挣扎着，一方面想要报仇，另一方面又害怕失去自己。矛盾让他痛苦。"
        result = await evaluator.evaluate(content)
        assert result.metrics["inner_conflict"] >= 70


# ============================================================
# PremiseEvaluator Tests
# ============================================================

class TestPremiseEvaluatorProperties:
    """Tests for PremiseEvaluator properties."""

    @pytest.fixture
    def evaluator(self, mock_llm_client):
        return PremiseEvaluator(llm_client=mock_llm_client)

    def test_name_property(self, evaluator):
        assert evaluator.name == "预设评估器"

    def test_related_skill(self, evaluator):
        assert evaluator.related_skill == "premise-magic"


class TestPremiseEvaluatorEvaluate:
    """Tests for PremiseEvaluator.evaluate method."""

    @pytest.fixture
    def evaluator(self, mock_llm_client):
        return PremiseEvaluator(llm_client=mock_llm_client)

    @pytest.mark.asyncio
    async def test_evaluate_returns_result(self, evaluator, sample_good_content):
        result = await evaluator.evaluate(sample_good_content)
        assert isinstance(result, EvaluationResult)

    @pytest.mark.asyncio
    async def test_evaluate_has_premise_metrics(self, evaluator, sample_good_content):
        result = await evaluator.evaluate(sample_good_content)
        assert "causality" in result.metrics
        assert "irony" in result.metrics
        assert "consistency" in result.metrics

    @pytest.mark.asyncio
    async def test_evaluate_with_causality(self, evaluator):
        content = "因为他迟到了，所以错过了机会。导致他后来非常后悔，因此决定改变。"
        result = await evaluator.evaluate(content)
        assert result.metrics["causality"] >= 60

    @pytest.mark.asyncio
    async def test_evaluate_with_irony(self, evaluator):
        content = "他努力追求财富，却在成功后发现竟然失去了所有朋友。讽刺的是，没想到他最终选择了放弃。"
        result = await evaluator.evaluate(content)
        assert result.metrics["irony"] >= 50

    @pytest.mark.asyncio
    async def test_evaluate_with_premise_context(self, evaluator):
        content = "贪婪让他失去了爱情，最终孤独终老。"
        context = {"premise": "贪婪导致失去爱情最终孤独"}
        result = await evaluator.evaluate(content, context)
        assert result.metrics["consistency"] >= 60


# ============================================================
# VoiceEvaluator Tests
# ============================================================

class TestVoiceEvaluatorProperties:
    """Tests for VoiceEvaluator properties."""

    @pytest.fixture
    def evaluator(self, mock_llm_client):
        return VoiceEvaluator(llm_client=mock_llm_client)

    def test_name_property(self, evaluator):
        assert evaluator.name == "叙事语气评估器"

    def test_related_skill(self, evaluator):
        assert evaluator.related_skill == "voice-workshop"


class TestVoiceEvaluatorEvaluate:
    """Tests for VoiceEvaluator.evaluate method."""

    @pytest.fixture
    def evaluator(self, mock_llm_client):
        return VoiceEvaluator(llm_client=mock_llm_client)

    @pytest.mark.asyncio
    async def test_evaluate_returns_result(self, evaluator, sample_good_content):
        result = await evaluator.evaluate(sample_good_content)
        assert isinstance(result, EvaluationResult)

    @pytest.mark.asyncio
    async def test_evaluate_has_voice_metrics(self, evaluator, sample_good_content):
        result = await evaluator.evaluate(sample_good_content)
        assert "specificity" in result.metrics
        assert "vagueness_penalty" in result.metrics
        assert "narrator_presence" in result.metrics

    @pytest.mark.asyncio
    async def test_evaluate_vague_content_penalized(self, evaluator, sample_medium_content):
        result = await evaluator.evaluate(sample_medium_content)
        assert result.metrics["vagueness_penalty"] > 0

    @pytest.mark.asyncio
    async def test_evaluate_specific_content_rewarded(self, evaluator):
        content = "他穿着一件深蓝色的外套，手里拿着iPhone 15。距离目的地还有3公里，他已经走了25分钟。"
        result = await evaluator.evaluate(content)
        assert result.metrics["specificity"] >= 55  # Specificity baseline is 50

    @pytest.mark.asyncio
    async def test_evaluate_narrator_presence(self, evaluator):
        content = "显然，他做出了错误的选择。讽刺的是，毫无疑问这一切本可以避免。"
        result = await evaluator.evaluate(content)
        assert result.metrics["narrator_presence"] >= 50


# ============================================================
# PyramidEvaluator Tests
# ============================================================

class TestPyramidEvaluatorProperties:
    """Tests for PyramidEvaluator properties."""

    @pytest.fixture
    def evaluator(self, mock_llm_client):
        return PyramidEvaluator(llm_client=mock_llm_client)

    def test_name_property(self, evaluator):
        assert evaluator.name == "pyramid_evaluator"

    def test_related_skill(self, evaluator):
        assert evaluator.related_skill == "pyramid-structure"


class TestPyramidEvaluatorEvaluate:
    """Tests for PyramidEvaluator.evaluate method."""

    @pytest.fixture
    def evaluator(self, mock_llm_client):
        return PyramidEvaluator(llm_client=mock_llm_client)

    @pytest.mark.asyncio
    async def test_evaluate_returns_result(self, evaluator, sample_pyramid_content):
        result = await evaluator.evaluate(sample_pyramid_content)
        assert isinstance(result, EvaluationResult)

    @pytest.mark.asyncio
    async def test_evaluate_has_pyramid_metrics(self, evaluator, sample_pyramid_content):
        result = await evaluator.evaluate(sample_pyramid_content)
        assert "conclusion_first" in result.metrics
        assert "vertical_structure" in result.metrics
        assert "horizontal_structure" in result.metrics
        assert "mece_compliance" in result.metrics

    @pytest.mark.asyncio
    async def test_evaluate_good_structure_high_score(self, evaluator, sample_pyramid_content):
        result = await evaluator.evaluate(sample_pyramid_content)
        assert result.score >= 70

    @pytest.mark.asyncio
    async def test_evaluate_poor_structure_low_score(self, evaluator, sample_poor_content):
        result = await evaluator.evaluate(sample_poor_content)
        assert result.score < 70

    def test_quick_scan_returns_result(self, evaluator, sample_pyramid_content):
        result = evaluator.quick_scan(sample_pyramid_content)
        assert isinstance(result, EvaluationResult)

    def test_quick_scan_detects_conclusion(self, evaluator, sample_pyramid_content):
        result = evaluator.quick_scan(sample_pyramid_content)
        # Should not have NO_CONCLUSION_FIRST issue for good content
        issue_codes = [i.code for i in result.issues]
        assert "PYRAMID_NO_CONCLUSION_FIRST" not in issue_codes


# ============================================================
# DeadlySinsChecker Tests
# ============================================================

class TestDeadlySinEnum:
    """Tests for DeadlySin enum."""

    def test_deadly_sin_values(self):
        assert DeadlySin.STRUCTURAL_DRIFT.value == "structural_drift"
        assert DeadlySin.EMOTIONAL_VACUUM.value == "emotional_vacuum"
        assert DeadlySin.NARRATIVE_STAGNATION.value == "narrative_stagnation"
        assert DeadlySin.APATHETIC_COWARD.value == "apathetic_coward"
        assert DeadlySin.AIMLESS_PLOTTING.value == "aimless_plotting"
        assert DeadlySin.FACELESS_NARRATION.value == "faceless_narration"
        assert DeadlySin.CHAOTIC_PRESENTATION.value == "chaotic_presentation"

    def test_deadly_sin_count(self):
        assert len(DeadlySin) == 7


class TestDeadlySinsCheckerProperties:
    """Tests for DeadlySinsChecker properties."""

    @pytest.fixture
    def checker(self, mock_llm_client):
        return DeadlySinsChecker(llm_client=mock_llm_client)

    def test_name_property(self, checker):
        assert checker.name == "deadly_sins_checker"

    def test_sin_info_complete(self, checker):
        for sin in DeadlySin:
            assert sin in checker.SIN_INFO
            assert "name_cn" in checker.SIN_INFO[sin]
            assert "skill" in checker.SIN_INFO[sin]
            assert "question" in checker.SIN_INFO[sin]


class TestDeadlySinsCheckerEvaluate:
    """Tests for DeadlySinsChecker.evaluate method."""

    @pytest.fixture
    def checker(self, mock_llm_client):
        return DeadlySinsChecker(llm_client=mock_llm_client)

    @pytest.mark.asyncio
    async def test_evaluate_returns_result(self, checker, sample_good_content):
        result = await checker.evaluate(sample_good_content)
        assert isinstance(result, EvaluationResult)

    @pytest.mark.asyncio
    async def test_evaluate_has_seven_metrics(self, checker, sample_good_content):
        result = await checker.evaluate(sample_good_content)
        assert len(result.metrics) == 7

    @pytest.mark.asyncio
    async def test_evaluate_metrics_keys(self, checker, sample_good_content):
        result = await checker.evaluate(sample_good_content)
        for sin in DeadlySin:
            assert sin.value in result.metrics

    @pytest.mark.asyncio
    async def test_evaluate_good_content_high_score(self, checker, sample_good_content):
        result = await checker.evaluate(sample_good_content)
        assert result.score >= 50

    @pytest.mark.asyncio
    async def test_evaluate_poor_content_has_issues(self, checker, sample_poor_content):
        result = await checker.evaluate(sample_poor_content)
        assert len(result.issues) > 0

    @pytest.mark.asyncio
    async def test_evaluate_raw_analysis_contains_sin_results(self, checker, sample_good_content):
        result = await checker.evaluate(sample_good_content)
        assert result.raw_analysis is not None
        assert "sin_results" in result.raw_analysis
        assert len(result.raw_analysis["sin_results"]) == 7

    def test_quick_scan_returns_result(self, checker, sample_good_content):
        result = checker.quick_scan(sample_good_content)
        assert isinstance(result, EvaluationResult)


class TestDeadlySinsCheckerPrivateMethods:
    """Tests for DeadlySinsChecker private check methods."""

    @pytest.fixture
    def checker(self, mock_llm_client):
        return DeadlySinsChecker(llm_client=mock_llm_client)

    def test_check_structural_drift_with_conclusion(self, checker):
        content = "我们建议采用这个方案。第一，它简单。第二，它高效。"
        result = checker._check_structural_drift(content, {})
        assert result.score >= 70
        assert result.detected is False

    def test_check_structural_drift_without_conclusion(self, checker):
        content = "让我们先看看背景。历史上，这个问题一直存在。众所周知，它很复杂。"
        result = checker._check_structural_drift(content, {})
        assert result.detected is True

    def test_check_emotional_vacuum_with_sensory(self, checker):
        content = "他看到远方的光线，听到鸟鸣声，感觉到温暖的阳光触摸着他的脸。"
        result = checker._check_emotional_vacuum(content, {})
        assert result.score >= 60

    def test_check_emotional_vacuum_without_sensory(self, checker):
        content = "他很高兴。她很难过。他们都很激动。"
        result = checker._check_emotional_vacuum(content, {})
        assert result.detected is True

    def test_check_narrative_stagnation_with_suspense(self, checker):
        content = "究竟是谁？为什么会这样？危险逼近，他必须立刻行动，否则一切都来不及了。"
        result = checker._check_narrative_stagnation(content, {})
        assert result.score >= 60

    def test_check_apathetic_coward_with_active_character(self, checker):
        content = "他决定行动，选择面对困难。他拒绝放弃，坚持到底。"
        result = checker._check_apathetic_coward(content, {})
        assert result.score >= 70

    def test_check_aimless_plotting_with_premise(self, checker):
        content = "贪婪导致他失去了一切。因为贪心，所以最终孤独。于是他后悔了。"
        context = {"premise": "贪婪导致失去一切"}
        result = checker._check_aimless_plotting(content, context)
        assert result.score >= 40  # Premise matching has strict criteria
