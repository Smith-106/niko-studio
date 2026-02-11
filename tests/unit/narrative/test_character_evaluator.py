"""
Character Evaluator Tests

Tests for CharacterEvaluator evaluate and internal scoring methods.
"""

import pytest
from src.narrative.evaluators.character_evaluator import CharacterEvaluator
from src.narrative.evaluators.base import Severity, ScoreLevel


class TestCharacterEvaluator:

    @pytest.fixture
    def evaluator(self):
        return CharacterEvaluator()

    def test_name(self, evaluator):
        assert evaluator.name == "人物评估器"

    def test_related_skill(self, evaluator):
        assert evaluator.related_skill == "character-forge"

    @pytest.mark.asyncio
    async def test_low_scores_all_issues(self, evaluator):
        content = "一个普通人走在路上。"
        result = await evaluator.evaluate(content)
        codes = [i.code for i in result.issues]
        assert "CHAR_COMPETENCE_WEAK" in codes
        assert "CHAR_BLAND" in codes
        assert "CHAR_STATIC" in codes

    @pytest.mark.asyncio
    async def test_high_competence(self, evaluator):
        content = "他擅长剑术，精通多种语言，技艺高超，轻而易举地击败了对手。"
        result = await evaluator.evaluate(content)
        assert result.metrics["competence"] >= 70
        codes = [i.code for i in result.issues]
        assert "CHAR_COMPETENCE_WEAK" not in codes

    @pytest.mark.asyncio
    async def test_high_eccentricity(self, evaluator):
        content = "她有个奇怪的习惯，总是与众不同，从不按常理出牌。"
        result = await evaluator.evaluate(content)
        assert result.metrics["eccentricity"] >= 70

    @pytest.mark.asyncio
    async def test_high_inner_conflict(self, evaluator):
        content = "他一方面想要保护家人，另一方面又怕牵连无辜。内心充满挣扎和矛盾。"
        result = await evaluator.evaluate(content)
        assert result.metrics["inner_conflict"] >= 70

    @pytest.mark.asyncio
    async def test_total_score_average(self, evaluator):
        content = "普通内容"
        result = await evaluator.evaluate(content)
        expected = (
            result.metrics["competence"]
            + result.metrics["eccentricity"]
            + result.metrics["inner_conflict"]
        ) / 3
        assert result.score == pytest.approx(expected)

    @pytest.mark.asyncio
    async def test_score_capped_at_100(self, evaluator):
        # Many markers
        content = "擅长精通高超娴熟专业技艺轻而易举游刃有余得心应手"
        result = await evaluator.evaluate(content)
        assert result.metrics["competence"] <= 100

    def test_evaluate_competence(self, evaluator):
        assert evaluator._evaluate_competence("他很擅长") >= 50
        assert evaluator._evaluate_competence("普通") == 40

    def test_evaluate_eccentricity(self, evaluator):
        assert evaluator._evaluate_eccentricity("奇怪的习惯") >= 60
        assert evaluator._evaluate_eccentricity("普通") == 40

    def test_evaluate_inner_conflict(self, evaluator):
        assert evaluator._evaluate_inner_conflict("内心挣扎矛盾") >= 60
        assert evaluator._evaluate_inner_conflict("普通") == 40
