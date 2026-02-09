# -*- coding: utf-8 -*-
"""
Tests for base evaluator classes.
"""

import pytest
from src.narrative.evaluators.base import (
    Severity, ScoreLevel, Issue, EvaluationResult, BaseEvaluator
)


class TestSeverity:
    """Tests for Severity enum."""

    def test_severity_values(self):
        """Test all severity enum values exist."""
        assert Severity.CRITICAL.value == "critical"
        assert Severity.MAJOR.value == "major"
        assert Severity.MINOR.value == "minor"
        assert Severity.INFO.value == "info"

    def test_severity_count(self):
        """Test there are exactly 4 severity levels."""
        assert len(Severity) == 4


class TestScoreLevel:
    """Tests for ScoreLevel enum."""

    def test_score_level_values(self):
        """Test all score level enum values exist."""
        assert ScoreLevel.EXCELLENT.value == "excellent"
        assert ScoreLevel.GOOD.value == "good"
        assert ScoreLevel.FAIR.value == "fair"
        assert ScoreLevel.POOR.value == "poor"
        assert ScoreLevel.CRITICAL.value == "critical"

    def test_score_level_count(self):
        """Test there are exactly 5 score levels."""
        assert len(ScoreLevel) == 5


class TestIssue:
    """Tests for Issue dataclass."""

    def test_issue_creation_minimal(self):
        """Test creating an issue with minimal required fields."""
        issue = Issue(
            code="TEST_001",
            message="Test issue message",
            severity=Severity.MAJOR
        )
        assert issue.code == "TEST_001"
        assert issue.message == "Test issue message"
        assert issue.severity == Severity.MAJOR
        assert issue.location is None
        assert issue.suggestion is None
        assert issue.related_skill is None

    def test_issue_creation_full(self):
        """Test creating an issue with all fields."""
        issue = Issue(
            code="TEST_002",
            message="Full test issue",
            severity=Severity.CRITICAL,
            location="paragraph 1",
            suggestion="Fix this issue",
            related_skill="fictional-dream"
        )
        assert issue.code == "TEST_002"
        assert issue.severity == Severity.CRITICAL
        assert issue.location == "paragraph 1"
        assert issue.suggestion == "Fix this issue"
        assert issue.related_skill == "fictional-dream"


class TestEvaluationResult:
    """Tests for EvaluationResult dataclass."""

    def test_result_creation_minimal(self):
        """Test creating result with minimal fields."""
        result = EvaluationResult(
            evaluator_name="test_evaluator",
            score=75.0,
            level=ScoreLevel.GOOD
        )
        assert result.evaluator_name == "test_evaluator"
        assert result.score == 75.0
        assert result.level == ScoreLevel.GOOD
        assert result.issues == []
        assert result.metrics == {}
        assert result.summary == ""

    def test_critical_issues_property(self):
        """Test filtering critical issues."""
        issues = [
            Issue(code="A", message="A", severity=Severity.CRITICAL),
            Issue(code="B", message="B", severity=Severity.MAJOR),
            Issue(code="C", message="C", severity=Severity.CRITICAL),
            Issue(code="D", message="D", severity=Severity.MINOR),
        ]
        result = EvaluationResult(
            evaluator_name="test",
            score=50.0,
            level=ScoreLevel.FAIR,
            issues=issues
        )
        critical = result.critical_issues
        assert len(critical) == 2
        assert all(i.severity == Severity.CRITICAL for i in critical)

    def test_major_issues_property(self):
        """Test filtering major issues."""
        issues = [
            Issue(code="A", message="A", severity=Severity.CRITICAL),
            Issue(code="B", message="B", severity=Severity.MAJOR),
            Issue(code="C", message="C", severity=Severity.MAJOR),
        ]
        result = EvaluationResult(
            evaluator_name="test",
            score=50.0,
            level=ScoreLevel.FAIR,
            issues=issues
        )
        major = result.major_issues
        assert len(major) == 2
        assert all(i.severity == Severity.MAJOR for i in major)

    def test_has_critical_issues_true(self):
        """Test has_critical_issues returns True when critical issues exist."""
        issues = [
            Issue(code="A", message="A", severity=Severity.CRITICAL),
        ]
        result = EvaluationResult(
            evaluator_name="test",
            score=50.0,
            level=ScoreLevel.FAIR,
            issues=issues
        )
        assert result.has_critical_issues is True

    def test_has_critical_issues_false(self):
        """Test has_critical_issues returns False when no critical issues."""
        issues = [
            Issue(code="A", message="A", severity=Severity.MAJOR),
            Issue(code="B", message="B", severity=Severity.MINOR),
        ]
        result = EvaluationResult(
            evaluator_name="test",
            score=70.0,
            level=ScoreLevel.FAIR,
            issues=issues
        )
        assert result.has_critical_issues is False

    def test_to_dict(self):
        """Test serialization to dictionary."""
        issues = [
            Issue(
                code="TEST_001",
                message="Test issue",
                severity=Severity.MAJOR,
                location="para 1",
                suggestion="Fix it",
                related_skill="skill-1"
            )
        ]
        result = EvaluationResult(
            evaluator_name="test_evaluator",
            score=80.0,
            level=ScoreLevel.GOOD,
            issues=issues,
            metrics={"metric1": 85.0},
            summary="Test summary"
        )
        d = result.to_dict()

        assert d["evaluator"] == "test_evaluator"
        assert d["score"] == 80.0
        assert d["level"] == "good"
        assert d["summary"] == "Test summary"
        assert d["metrics"] == {"metric1": 85.0}
        assert len(d["issues"]) == 1
        assert d["issues"][0]["code"] == "TEST_001"
        assert d["issues"][0]["severity"] == "major"


class TestBaseEvaluatorScoreToLevel:
    """Tests for BaseEvaluator._score_to_level method."""

    @pytest.fixture
    def concrete_evaluator(self, mock_llm_client):
        """Create a concrete implementation for testing."""
        class ConcreteEvaluator(BaseEvaluator):
            @property
            def name(self):
                return "concrete_evaluator"

            @property
            def description(self):
                return "A concrete evaluator for testing"

            async def evaluate(self, content, context=None):
                return EvaluationResult(
                    evaluator_name=self.name,
                    score=50.0,
                    level=ScoreLevel.FAIR
                )

        return ConcreteEvaluator(mock_llm_client)

    def test_score_to_level_excellent(self, concrete_evaluator):
        """Test score >= 90 returns EXCELLENT."""
        assert concrete_evaluator._score_to_level(90) == ScoreLevel.EXCELLENT
        assert concrete_evaluator._score_to_level(95) == ScoreLevel.EXCELLENT
        assert concrete_evaluator._score_to_level(100) == ScoreLevel.EXCELLENT

    def test_score_to_level_good(self, concrete_evaluator):
        """Test score 75-89 returns GOOD."""
        assert concrete_evaluator._score_to_level(75) == ScoreLevel.GOOD
        assert concrete_evaluator._score_to_level(80) == ScoreLevel.GOOD
        assert concrete_evaluator._score_to_level(89) == ScoreLevel.GOOD

    def test_score_to_level_fair(self, concrete_evaluator):
        """Test score 60-74 returns FAIR."""
        assert concrete_evaluator._score_to_level(60) == ScoreLevel.FAIR
        assert concrete_evaluator._score_to_level(67) == ScoreLevel.FAIR
        assert concrete_evaluator._score_to_level(74) == ScoreLevel.FAIR

    def test_score_to_level_poor(self, concrete_evaluator):
        """Test score 40-59 returns POOR."""
        assert concrete_evaluator._score_to_level(40) == ScoreLevel.POOR
        assert concrete_evaluator._score_to_level(50) == ScoreLevel.POOR
        assert concrete_evaluator._score_to_level(59) == ScoreLevel.POOR

    def test_score_to_level_critical(self, concrete_evaluator):
        """Test score < 40 returns CRITICAL."""
        assert concrete_evaluator._score_to_level(0) == ScoreLevel.CRITICAL
        assert concrete_evaluator._score_to_level(20) == ScoreLevel.CRITICAL
        assert concrete_evaluator._score_to_level(39) == ScoreLevel.CRITICAL

    def test_score_to_level_boundaries(self, concrete_evaluator):
        """Test exact boundary values."""
        assert concrete_evaluator._score_to_level(89.9) == ScoreLevel.GOOD
        assert concrete_evaluator._score_to_level(90.0) == ScoreLevel.EXCELLENT
        assert concrete_evaluator._score_to_level(74.9) == ScoreLevel.FAIR
        assert concrete_evaluator._score_to_level(75.0) == ScoreLevel.GOOD
