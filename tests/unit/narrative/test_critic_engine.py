# -*- coding: utf-8 -*-
"""
Tests for CriticEngine (Comprehensive Evaluation Engine).
"""

import pytest
from src.narrative.evaluators.critic_engine import CriticEngine, ComprehensiveReport
from src.narrative.evaluators.base import EvaluationResult, Severity, ScoreLevel


class TestComprehensiveReport:
    """Tests for ComprehensiveReport dataclass."""

    @pytest.fixture
    def sample_report(self):
        from src.narrative.evaluators.base import Issue
        return ComprehensiveReport(
            overall_score=75.0,
            overall_level=ScoreLevel.GOOD,
            module_scores={
                "fictional_dream": 80.0,
                "suspense": 70.0,
                "character": 75.0,
                "premise": 72.0,
                "voice": 78.0,
            },
            all_issues=[
                Issue(code="TEST_1", message="Test issue 1", severity=Severity.MAJOR),
                Issue(code="TEST_2", message="Test issue 2", severity=Severity.MINOR),
            ],
            critical_issues=[],
            top_3_issues=[
                Issue(code="TEST_1", message="Test issue 1", severity=Severity.MAJOR),
            ],
            module_results={},
            summary="Test summary",
            recommended_skills=["fictional-dream"]
        )

    def test_report_to_dict(self, sample_report):
        d = sample_report.to_dict()
        assert d["overall_score"] == 75.0
        assert d["overall_level"] == "good"
        assert d["issues_count"] == 2
        assert d["critical_count"] == 0
        assert len(d["top_3_issues"]) == 1
        assert d["summary"] == "Test summary"
        assert d["recommended_skills"] == ["fictional-dream"]

    def test_report_to_markdown(self, sample_report):
        md = sample_report.to_markdown()
        assert "# " in md  # Has header
        assert "75.0/100" in md
        assert "模块得分" in md
        assert "fictional_dream" in md
        assert "推荐技能包" in md


class TestCriticEngineInit:
    """Tests for CriticEngine initialization."""

    def test_init_without_llm(self):
        engine = CriticEngine()
        assert engine.llm_client is None
        assert len(engine.evaluators) == 5

    def test_init_with_llm(self, mock_llm_client):
        engine = CriticEngine(llm_client=mock_llm_client)
        assert engine.llm_client == mock_llm_client

    def test_evaluators_keys(self, mock_llm_client):
        engine = CriticEngine(llm_client=mock_llm_client)
        expected_keys = ["fictional_dream", "suspense", "character", "premise", "voice"]
        for key in expected_keys:
            assert key in engine.evaluators

    def test_weights_sum_to_one(self, mock_llm_client):
        engine = CriticEngine(llm_client=mock_llm_client)
        total_weight = sum(engine.weights.values())
        assert abs(total_weight - 1.0) < 0.001


class TestCriticEngineEvaluate:
    """Tests for CriticEngine.evaluate method."""

    @pytest.fixture
    def engine(self, mock_llm_client):
        return CriticEngine(llm_client=mock_llm_client)

    @pytest.mark.asyncio
    async def test_evaluate_returns_comprehensive_report(self, engine, sample_good_content):
        result = await engine.evaluate(sample_good_content)
        assert isinstance(result, ComprehensiveReport)

    @pytest.mark.asyncio
    async def test_evaluate_has_all_module_scores(self, engine, sample_good_content):
        result = await engine.evaluate(sample_good_content)
        expected_modules = ["fictional_dream", "suspense", "character", "premise", "voice"]
        for module in expected_modules:
            assert module in result.module_scores

    @pytest.mark.asyncio
    async def test_evaluate_score_range(self, engine, sample_good_content):
        result = await engine.evaluate(sample_good_content)
        assert 0 <= result.overall_score <= 100

    @pytest.mark.asyncio
    async def test_evaluate_has_summary(self, engine, sample_good_content):
        result = await engine.evaluate(sample_good_content)
        assert len(result.summary) > 0

    @pytest.mark.asyncio
    async def test_evaluate_with_specific_modules(self, engine, sample_good_content):
        result = await engine.evaluate(
            sample_good_content,
            modules=["fictional_dream", "suspense"]
        )
        assert "fictional_dream" in result.module_scores
        assert "suspense" in result.module_scores
        assert "character" not in result.module_scores

    @pytest.mark.asyncio
    async def test_evaluate_with_context(self, engine, sample_good_content, sample_context):
        result = await engine.evaluate(sample_good_content, context=sample_context)
        assert isinstance(result, ComprehensiveReport)

    @pytest.mark.asyncio
    async def test_evaluate_good_vs_poor_content(self, engine, sample_good_content, sample_poor_content):
        good_result = await engine.evaluate(sample_good_content)
        poor_result = await engine.evaluate(sample_poor_content)
        assert good_result.overall_score > poor_result.overall_score

    @pytest.mark.asyncio
    async def test_evaluate_poor_content_has_issues(self, engine, sample_poor_content):
        result = await engine.evaluate(sample_poor_content)
        assert len(result.all_issues) > 0

    @pytest.mark.asyncio
    async def test_evaluate_module_results_populated(self, engine, sample_good_content):
        result = await engine.evaluate(sample_good_content)
        assert len(result.module_results) == 5
        for module_name, module_result in result.module_results.items():
            assert isinstance(module_result, EvaluationResult)


class TestCriticEngineQuickScan:
    """Tests for CriticEngine.quick_scan method."""

    @pytest.fixture
    def engine(self, mock_llm_client):
        return CriticEngine(llm_client=mock_llm_client)

    @pytest.mark.asyncio
    async def test_quick_scan_returns_report(self, engine, sample_good_content):
        result = await engine.quick_scan(sample_good_content)
        assert isinstance(result, ComprehensiveReport)

    @pytest.mark.asyncio
    async def test_quick_scan_has_module_scores(self, engine, sample_good_content):
        result = await engine.quick_scan(sample_good_content)
        assert len(result.module_scores) == 5

    @pytest.mark.asyncio
    async def test_quick_scan_score_range(self, engine, sample_good_content):
        result = await engine.quick_scan(sample_good_content)
        assert 0 <= result.overall_score <= 100


class TestCriticEnginePrivateMethods:
    """Tests for CriticEngine private helper methods."""

    @pytest.fixture
    def engine(self, mock_llm_client):
        return CriticEngine(llm_client=mock_llm_client)

    def test_score_to_level_excellent(self, engine):
        assert engine._score_to_level(95) == ScoreLevel.EXCELLENT
        assert engine._score_to_level(90) == ScoreLevel.EXCELLENT

    def test_score_to_level_good(self, engine):
        assert engine._score_to_level(80) == ScoreLevel.GOOD
        assert engine._score_to_level(75) == ScoreLevel.GOOD

    def test_score_to_level_fair(self, engine):
        assert engine._score_to_level(65) == ScoreLevel.FAIR
        assert engine._score_to_level(60) == ScoreLevel.FAIR

    def test_score_to_level_poor(self, engine):
        assert engine._score_to_level(50) == ScoreLevel.POOR
        assert engine._score_to_level(40) == ScoreLevel.POOR

    def test_score_to_level_critical(self, engine):
        assert engine._score_to_level(30) == ScoreLevel.CRITICAL
        assert engine._score_to_level(0) == ScoreLevel.CRITICAL

    def test_generate_summary_includes_score(self, engine):
        from src.narrative.evaluators.base import Issue
        summary = engine._generate_summary(
            score=75.0,
            level=ScoreLevel.GOOD,
            module_scores={"fictional_dream": 80, "suspense": 70},
            top_issues=[Issue(code="T", message="Test", severity=Severity.MAJOR)]
        )
        assert "75.0" in summary
        assert "良好" in summary

    def test_generate_summary_identifies_weakest(self, engine):
        from src.narrative.evaluators.base import Issue
        summary = engine._generate_summary(
            score=75.0,
            level=ScoreLevel.GOOD,
            module_scores={"fictional_dream": 80, "suspense": 60, "character": 70},
            top_issues=[]
        )
        assert "最弱" in summary
        assert "suspense" in summary

    def test_generate_summary_identifies_strongest(self, engine):
        from src.narrative.evaluators.base import Issue
        summary = engine._generate_summary(
            score=75.0,
            level=ScoreLevel.GOOD,
            module_scores={"fictional_dream": 90, "suspense": 60, "character": 70},
            top_issues=[]
        )
        assert "最强" in summary
        assert "fictional_dream" in summary

    def test_generate_summary_includes_top_issue(self, engine):
        from src.narrative.evaluators.base import Issue
        summary = engine._generate_summary(
            score=60.0,
            level=ScoreLevel.FAIR,
            module_scores={"test": 60},
            top_issues=[Issue(code="T", message="首要问题描述", severity=Severity.MAJOR)]
        )
        assert "首要问题" in summary


class TestCriticEngineIntegration:
    """Integration tests for CriticEngine with all evaluators."""

    @pytest.fixture
    def engine(self, mock_llm_client):
        return CriticEngine(llm_client=mock_llm_client)

    @pytest.mark.asyncio
    async def test_full_evaluation_flow(self, engine, sample_good_content, sample_context):
        """Test complete evaluation workflow."""
        result = await engine.evaluate(sample_good_content, context=sample_context)

        # Verify structure
        assert isinstance(result, ComprehensiveReport)
        assert result.overall_score > 0
        assert result.overall_level in ScoreLevel

        # Verify all modules evaluated
        assert len(result.module_scores) == 5
        assert len(result.module_results) == 5

        # Verify issues collected
        assert isinstance(result.all_issues, list)
        assert isinstance(result.critical_issues, list)
        assert isinstance(result.top_3_issues, list)
        assert len(result.top_3_issues) <= 3

        # Verify recommended skills
        assert isinstance(result.recommended_skills, list)

        # Verify summary
        assert len(result.summary) > 0

    @pytest.mark.asyncio
    async def test_markdown_report_generation(self, engine, sample_good_content):
        """Test markdown report can be generated."""
        result = await engine.evaluate(sample_good_content)
        markdown = result.to_markdown()

        assert "# " in markdown
        assert "模块得分" in markdown
        assert "|" in markdown  # Table

    @pytest.mark.asyncio
    async def test_dict_serialization(self, engine, sample_good_content):
        """Test result can be serialized to dict."""
        result = await engine.evaluate(sample_good_content)
        d = result.to_dict()

        assert "overall_score" in d
        assert "overall_level" in d
        assert "module_scores" in d
        assert "issues_count" in d
        assert "summary" in d
