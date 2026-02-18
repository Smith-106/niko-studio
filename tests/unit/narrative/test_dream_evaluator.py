# -*- coding: utf-8 -*-
"""
Tests for DreamEvaluator (Fictional Dream Evaluator).
"""

import pytest
from src.narrative.evaluators.dream_evaluator import DreamEvaluator
from src.narrative.evaluators.base import EvaluationResult, Severity, ScoreLevel


class TestDreamEvaluatorProperties:
    """Tests for DreamEvaluator properties."""

    @pytest.fixture
    def evaluator(self, mock_llm_client):
        return DreamEvaluator(llm_client=mock_llm_client)

    def test_name_property(self, evaluator):
        """Test evaluator name."""
        assert evaluator.name == "虚构梦境评估器"

    def test_description_property(self, evaluator):
        """Test evaluator description."""
        assert "情感沉浸" in evaluator.description
        assert "四层情感递进" in evaluator.description

    def test_related_skill(self, evaluator):
        """Test related skill reference."""
        assert evaluator.related_skill == "fictional-dream"


class TestDreamEvaluatorKeywords:
    """Tests for DreamEvaluator keyword dictionaries."""

    @pytest.fixture
    def evaluator(self, mock_llm_client):
        return DreamEvaluator(llm_client=mock_llm_client)

    def test_sympathy_triggers_categories(self, evaluator):
        """Test sympathy triggers has expected categories."""
        expected_categories = ["danger", "poverty", "humiliation", "loneliness", "helplessness"]
        for cat in expected_categories:
            assert cat in evaluator.SYMPATHY_TRIGGERS

    def test_sensory_patterns_categories(self, evaluator):
        """Test sensory patterns has all senses."""
        expected_senses = ["visual", "auditory", "tactile", "olfactory", "gustatory", "kinesthetic"]
        for sense in expected_senses:
            assert sense in evaluator.SENSORY_PATTERNS

    def test_conflict_markers_not_empty(self, evaluator):
        """Test conflict markers list is populated."""
        assert len(evaluator.CONFLICT_MARKERS) > 10


class TestDreamEvaluatorEvaluate:
    """Tests for DreamEvaluator.evaluate method."""

    @pytest.fixture
    def evaluator(self, mock_llm_client):
        return DreamEvaluator(llm_client=mock_llm_client)

    @pytest.mark.asyncio
    async def test_evaluate_returns_result(self, evaluator, sample_good_content):
        """Test evaluate returns EvaluationResult."""
        result = await evaluator.evaluate(sample_good_content)
        assert isinstance(result, EvaluationResult)

    @pytest.mark.asyncio
    async def test_evaluate_score_range(self, evaluator, sample_good_content):
        """Test score is within valid range."""
        result = await evaluator.evaluate(sample_good_content)
        assert 0 <= result.score <= 100

    @pytest.mark.asyncio
    async def test_evaluate_has_metrics(self, evaluator, sample_good_content):
        """Test evaluate returns all four layer metrics."""
        result = await evaluator.evaluate(sample_good_content)
        assert "sympathy" in result.metrics
        assert "identification" in result.metrics
        assert "empathy" in result.metrics
        assert "immersion" in result.metrics

    @pytest.mark.asyncio
    async def test_evaluate_good_content_higher_score(self, evaluator, sample_good_content, sample_poor_content):
        """Test good content scores higher than poor content."""
        good_result = await evaluator.evaluate(sample_good_content)
        poor_result = await evaluator.evaluate(sample_poor_content)
        assert good_result.score > poor_result.score

    @pytest.mark.asyncio
    async def test_evaluate_poor_content_has_issues(self, evaluator, sample_poor_content):
        """Test poor content generates issues."""
        result = await evaluator.evaluate(sample_poor_content)
        assert len(result.issues) > 0

    @pytest.mark.asyncio
    async def test_evaluate_with_context(self, evaluator, sample_good_content, sample_context):
        """Test evaluate works with context."""
        result = await evaluator.evaluate(sample_good_content, context=sample_context)
        assert isinstance(result, EvaluationResult)
        # Context with character_goal should boost identification score
        assert result.metrics["identification"] >= 50

    @pytest.mark.asyncio
    async def test_evaluate_summary_contains_weakest_layer(self, evaluator, sample_good_content):
        """Test summary mentions weakest layer."""
        result = await evaluator.evaluate(sample_good_content)
        assert "最薄弱层级" in result.summary

    @pytest.mark.asyncio
    async def test_evaluate_raw_analysis(self, evaluator, sample_good_content):
        """Test raw_analysis contains expected data."""
        result = await evaluator.evaluate(sample_good_content)
        assert result.raw_analysis is not None
        assert "weakest_layer" in result.raw_analysis
        assert "layer_scores" in result.raw_analysis


class TestDreamEvaluatorQuickScan:
    """Tests for DreamEvaluator.quick_scan method."""

    @pytest.fixture
    def evaluator(self, mock_llm_client):
        return DreamEvaluator(llm_client=mock_llm_client)

    def test_quick_scan_returns_result(self, evaluator, sample_good_content):
        """Test quick_scan returns EvaluationResult."""
        result = evaluator.quick_scan(sample_good_content)
        assert isinstance(result, EvaluationResult)

    def test_quick_scan_score_range(self, evaluator, sample_good_content):
        """Test quick_scan score is within valid range."""
        result = evaluator.quick_scan(sample_good_content)
        assert 0 <= result.score <= 100

    def test_quick_scan_poor_content_flags_sensory(self, evaluator, sample_poor_content):
        """Test quick_scan flags sensory lacking issue for poor content."""
        result = evaluator.quick_scan(sample_poor_content)
        issue_codes = [i.code for i in result.issues]
        assert "DREAM_SENSORY_LACKING" in issue_codes


class TestDreamEvaluatorPrivateMethods:
    """Tests for DreamEvaluator private evaluation methods."""

    @pytest.fixture
    def evaluator(self, mock_llm_client):
        return DreamEvaluator(llm_client=mock_llm_client)

    def test_evaluate_sympathy_with_danger(self, evaluator):
        """Test sympathy detection with danger keywords."""
        content = "他感到极大的危险，死亡的威胁笼罩着他。"
        score = evaluator._evaluate_sympathy(content)
        assert score > 50

    def test_evaluate_sympathy_with_multiple_categories(self, evaluator):
        """Test sympathy score increases with multiple categories."""
        content = "他贫穷潦倒，被人嘲笑，独自一人面对无助的处境。"
        score = evaluator._evaluate_sympathy(content)
        assert score >= 65

    def test_evaluate_empathy_with_sensory_details(self, evaluator):
        """Test empathy detection with sensory details."""
        content = "他看到远方的光线，听到海浪的声音，感觉到冰冷的海水触摸着他的皮肤。"
        score = evaluator._evaluate_empathy(content)
        assert score >= 60

    def test_evaluate_empathy_empty_content(self, evaluator):
        """Test empathy returns 0 for empty content."""
        score = evaluator._evaluate_empathy("")
        assert score == 0

    def test_evaluate_immersion_with_conflicts(self, evaluator):
        """Test immersion detection with conflict markers."""
        content = "他犹豫着，一方面想要前进，另一方面却又害怕。他既想说出真相，又怕伤害她。"
        score = evaluator._evaluate_immersion(content)
        assert score >= 60

    def test_evaluate_immersion_empty_content(self, evaluator):
        """Test immersion returns 0 for empty content."""
        score = evaluator._evaluate_immersion("")
        assert score == 0

    def test_evaluate_empathy_density_medium_high_branch(self, evaluator):
        content = ("看到" * 6) + ("x" * 988)
        score = evaluator._evaluate_empathy(content)
        assert score == 80

    def test_evaluate_empathy_density_medium_branch(self, evaluator):
        content = ("看到" * 3) + ("x" * 994)
        score = evaluator._evaluate_empathy(content)
        assert score == 60

    def test_evaluate_immersion_density_medium_high_branch(self, evaluator):
        content = ("但是" * 5) + ("x" * 990)
        score = evaluator._evaluate_immersion(content)
        assert score == 80

    def test_evaluate_immersion_density_medium_branch(self, evaluator):
        content = ("但是" * 3) + ("x" * 994)
        score = evaluator._evaluate_immersion(content)
        assert score == 60

    def test_evaluate_identification_with_goals(self, evaluator):
        """Test identification with goal-related words."""
        content = "他的目标很明确，他要保护家人，追求正义，完成使命。"
        score = evaluator._evaluate_identification(content)
        assert score >= 70

    def test_evaluate_identification_with_context(self, evaluator):
        """Test identification score boost with context."""
        content = "他继续前进。"
        context = {"character_goal": "拯救世界"}
        score = evaluator._evaluate_identification(content, context)
        assert score >= 60
