"""
Evaluator Base Tests

Tests for Severity, ScoreLevel enums, Issue dataclass,
EvaluationResult (properties, to_dict), BaseEvaluator (_score_to_level).
"""

import pytest
from src.narrative.evaluators.base import (
    Severity,
    ScoreLevel,
    Issue,
    EvaluationResult,
    BaseEvaluator,
)


# ============================================================
# Enum Tests
# ============================================================

class TestSeverity:

    def test_values(self):
        assert Severity.CRITICAL.value == "critical"
        assert Severity.MAJOR.value == "major"
        assert Severity.MINOR.value == "minor"
        assert Severity.INFO.value == "info"

    def test_four_levels(self):
        assert len(Severity) == 4


class TestScoreLevel:

    def test_values(self):
        assert ScoreLevel.EXCELLENT.value == "excellent"
        assert ScoreLevel.GOOD.value == "good"
        assert ScoreLevel.FAIR.value == "fair"
        assert ScoreLevel.POOR.value == "poor"
        assert ScoreLevel.CRITICAL.value == "critical"

    def test_five_levels(self):
        assert len(ScoreLevel) == 5


# ============================================================
# Issue Tests
# ============================================================

class TestIssue:

    def test_required_fields(self):
        issue = Issue(code="TEST_001", message="Test issue", severity=Severity.MAJOR)
        assert issue.code == "TEST_001"
        assert issue.message == "Test issue"
        assert issue.severity == Severity.MAJOR

    def test_optional_fields_defaults(self):
        issue = Issue(code="T", message="m", severity=Severity.INFO)
        assert issue.location is None
        assert issue.suggestion is None
        assert issue.related_skill is None

    def test_all_fields(self):
        issue = Issue(
            code="T",
            message="m",
            severity=Severity.CRITICAL,
            location="paragraph 1",
            suggestion="fix it",
            related_skill="skill-1",
        )
        assert issue.location == "paragraph 1"
        assert issue.suggestion == "fix it"
        assert issue.related_skill == "skill-1"


# ============================================================
# EvaluationResult Tests
# ============================================================

class TestEvaluationResult:

    def test_defaults(self):
        result = EvaluationResult(
            evaluator_name="test",
            score=80.0,
            level=ScoreLevel.GOOD,
        )
        assert result.issues == []
        assert result.metrics == {}
        assert result.summary == ""
        assert result.raw_analysis is None

    def test_critical_issues(self):
        issues = [
            Issue(code="C1", message="crit", severity=Severity.CRITICAL),
            Issue(code="M1", message="major", severity=Severity.MAJOR),
            Issue(code="C2", message="crit2", severity=Severity.CRITICAL),
        ]
        result = EvaluationResult(
            evaluator_name="test", score=50, level=ScoreLevel.POOR, issues=issues
        )
        assert len(result.critical_issues) == 2

    def test_major_issues(self):
        issues = [
            Issue(code="M1", message="major", severity=Severity.MAJOR),
            Issue(code="I1", message="info", severity=Severity.INFO),
        ]
        result = EvaluationResult(
            evaluator_name="test", score=70, level=ScoreLevel.FAIR, issues=issues
        )
        assert len(result.major_issues) == 1

    def test_has_critical_issues_true(self):
        issues = [Issue(code="C1", message="crit", severity=Severity.CRITICAL)]
        result = EvaluationResult(
            evaluator_name="test", score=30, level=ScoreLevel.CRITICAL, issues=issues
        )
        assert result.has_critical_issues is True

    def test_has_critical_issues_false(self):
        result = EvaluationResult(
            evaluator_name="test", score=90, level=ScoreLevel.EXCELLENT
        )
        assert result.has_critical_issues is False

    def test_top_issues_sorted(self):
        issues = [
            Issue(code="I1", message="info", severity=Severity.INFO),
            Issue(code="C1", message="crit", severity=Severity.CRITICAL),
            Issue(code="M1", message="major", severity=Severity.MAJOR),
        ]
        result = EvaluationResult(
            evaluator_name="test", score=50, level=ScoreLevel.POOR, issues=issues
        )
        top = result.top_issues
        assert top[0].severity == Severity.CRITICAL
        assert top[1].severity == Severity.MAJOR

    def test_to_dict(self):
        issue = Issue(code="T1", message="msg", severity=Severity.MINOR)
        result = EvaluationResult(
            evaluator_name="test_eval",
            score=75.0,
            level=ScoreLevel.GOOD,
            issues=[issue],
            metrics={"depth": 0.8},
            summary="Good result",
        )
        d = result.to_dict()
        assert d["evaluator"] == "test_eval"
        assert d["score"] == 75.0
        assert d["level"] == "good"
        assert len(d["issues"]) == 1
        assert d["issues"][0]["code"] == "T1"
        assert d["issues"][0]["severity"] == "minor"
        assert d["metrics"] == {"depth": 0.8}
        assert d["summary"] == "Good result"

    def test_to_dict_empty_issues(self):
        result = EvaluationResult(
            evaluator_name="test", score=100, level=ScoreLevel.EXCELLENT
        )
        d = result.to_dict()
        assert d["issues"] == []


# ============================================================
# BaseEvaluator Tests (via concrete subclass)
# ============================================================

class _ConcreteEvaluator(BaseEvaluator):
    @property
    def name(self):
        return "concrete"

    @property
    def description(self):
        return "test evaluator"

    async def evaluate(self, content, context=None):
        return EvaluationResult(
            evaluator_name=self.name, score=50, level=ScoreLevel.FAIR
        )


class TestBaseEvaluator:

    def test_score_to_level_excellent(self):
        e = _ConcreteEvaluator()
        assert e._score_to_level(95) == ScoreLevel.EXCELLENT
        assert e._score_to_level(90) == ScoreLevel.EXCELLENT

    def test_score_to_level_good(self):
        e = _ConcreteEvaluator()
        assert e._score_to_level(89) == ScoreLevel.GOOD
        assert e._score_to_level(75) == ScoreLevel.GOOD

    def test_score_to_level_fair(self):
        e = _ConcreteEvaluator()
        assert e._score_to_level(74) == ScoreLevel.FAIR
        assert e._score_to_level(60) == ScoreLevel.FAIR

    def test_score_to_level_poor(self):
        e = _ConcreteEvaluator()
        assert e._score_to_level(59) == ScoreLevel.POOR
        assert e._score_to_level(40) == ScoreLevel.POOR

    def test_score_to_level_critical(self):
        e = _ConcreteEvaluator()
        assert e._score_to_level(39) == ScoreLevel.CRITICAL
        assert e._score_to_level(0) == ScoreLevel.CRITICAL

    def test_related_skill_default(self):
        e = _ConcreteEvaluator()
        assert e.related_skill is None

    def test_quick_scan_default(self):
        e = _ConcreteEvaluator()
        result = e.quick_scan("test content")
        assert result.evaluator_name == "concrete"
        assert result.score == 0

    @pytest.mark.asyncio
    async def test_base_abstract_stubs_executable(self):
        e = _ConcreteEvaluator()
        assert BaseEvaluator.name.fget(e) is None
        assert BaseEvaluator.description.fget(e) is None
        assert await BaseEvaluator.evaluate(e, "content") is None

    def test_llm_client_stored(self):
        mock = object()
        e = _ConcreteEvaluator(llm_client=mock)
        assert e.llm_client is mock
