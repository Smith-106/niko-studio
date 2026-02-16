# -*- coding: utf-8 -*-
"""
DreamEvaluator & CodeAdapter Tests

Tests for QuickDreamReport, DreamEvaluator (_determine_strength,
_assess_health, _diagnose_layers, _get_master_comparisons,
_create_improvement_plan), CodeAdapter (domain_type, state_class,
create_initial_state, evaluate, create_graph).
"""

import asyncio
import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from dataclasses import dataclass

from src.narrative.fictional_dream.evaluator import (
    QuickDreamReport,
    DreamEvaluator,
)
from src.narrative.fictional_dream.engine import DreamStrength


# ============================================================
# QuickDreamReport
# ============================================================

class TestQuickDreamReport:

    def test_basic(self):
        r = QuickDreamReport(
            strength=DreamStrength.STRONG,
            score=80.0,
            weakest_layer="sympathy",
            top_3_issues=["issue1"],
            quick_wins=["win1"],
        )
        assert r.strength == DreamStrength.STRONG
        assert r.score == 80.0
        assert r.weakest_layer == "sympathy"
        assert len(r.top_3_issues) == 1
        assert len(r.quick_wins) == 1


# ============================================================
# DreamEvaluator._determine_strength
# ============================================================

class TestDetermineStrength:

    @pytest.fixture
    def evaluator(self):
        return DreamEvaluator(llm_client=None)

    def test_hypnotic(self, evaluator):
        assert evaluator._determine_strength(95) == DreamStrength.HYPNOTIC

    def test_strong(self, evaluator):
        assert evaluator._determine_strength(80) == DreamStrength.STRONG

    def test_moderate(self, evaluator):
        assert evaluator._determine_strength(65) == DreamStrength.MODERATE

    def test_weak(self, evaluator):
        assert evaluator._determine_strength(45) == DreamStrength.WEAK

    def test_broken(self, evaluator):
        assert evaluator._determine_strength(30) == DreamStrength.BROKEN

    def test_boundary_90(self, evaluator):
        assert evaluator._determine_strength(90) == DreamStrength.HYPNOTIC

    def test_boundary_75(self, evaluator):
        assert evaluator._determine_strength(75) == DreamStrength.STRONG

    def test_boundary_60(self, evaluator):
        assert evaluator._determine_strength(60) == DreamStrength.MODERATE

    def test_boundary_40(self, evaluator):
        assert evaluator._determine_strength(40) == DreamStrength.WEAK

    def test_boundary_0(self, evaluator):
        assert evaluator._determine_strength(0) == DreamStrength.BROKEN


# ============================================================
# DreamEvaluator._assess_health
# ============================================================

class TestAssessHealth:

    @pytest.fixture
    def evaluator(self):
        return DreamEvaluator(llm_client=None)

    def _make_result(self, strength):
        r = MagicMock()
        r.dream_strength = strength
        return r

    def test_hypnotic(self, evaluator):
        result = evaluator._assess_health(self._make_result(DreamStrength.HYPNOTIC))
        assert "优秀" in result

    def test_strong(self, evaluator):
        result = evaluator._assess_health(self._make_result(DreamStrength.STRONG))
        assert "良好" in result

    def test_moderate(self, evaluator):
        result = evaluator._assess_health(self._make_result(DreamStrength.MODERATE))
        assert "一般" in result

    def test_weak(self, evaluator):
        result = evaluator._assess_health(self._make_result(DreamStrength.WEAK))
        assert "较差" in result

    def test_broken(self, evaluator):
        result = evaluator._assess_health(self._make_result(DreamStrength.BROKEN))
        assert "严重" in result


# ============================================================
# DreamEvaluator._diagnose_layers
# ============================================================

class TestDiagnoseLayers:

    @pytest.fixture
    def evaluator(self):
        return DreamEvaluator(llm_client=None)

    def _make_layer(self, name, score, effective):
        l = MagicMock()
        l.layer_name = name
        l.score = score
        l.is_effective = effective
        l.key_findings = ["finding1"]
        l.suggestions = ["suggestion1"]
        return l

    def test_high_score(self, evaluator):
        result = MagicMock()
        result.layer_scores = [self._make_layer("sympathy", 85, True)]
        diagnoses = evaluator._diagnose_layers(result)
        assert len(diagnoses) == 1
        assert diagnoses[0]["status"] == "✅"
        assert diagnoses[0]["priority"] == "LOW"

    def test_medium_score(self, evaluator):
        result = MagicMock()
        result.layer_scores = [self._make_layer("empathy", 55, False)]
        diagnoses = evaluator._diagnose_layers(result)
        assert diagnoses[0]["status"] == "❌"
        assert diagnoses[0]["priority"] == "MEDIUM"

    def test_low_score(self, evaluator):
        result = MagicMock()
        result.layer_scores = [self._make_layer("immersion", 30, False)]
        diagnoses = evaluator._diagnose_layers(result)
        assert diagnoses[0]["priority"] == "HIGH"

    def test_multiple_layers(self, evaluator):
        result = MagicMock()
        result.layer_scores = [
            self._make_layer("sympathy", 90, True),
            self._make_layer("empathy", 40, False),
            self._make_layer("immersion", 60, True),
        ]
        diagnoses = evaluator._diagnose_layers(result)
        assert len(diagnoses) == 3


# ============================================================
# DreamEvaluator._get_master_comparisons
# ============================================================

class TestGetMasterComparisons:

    @pytest.fixture
    def evaluator(self):
        return DreamEvaluator(llm_client=None)

    def test_all_high_no_comparisons(self, evaluator):
        result = MagicMock()
        result.sympathy.overall_score = 80
        result.empathy.overall_score = 80
        result.immersion.overall_score = 80
        comparisons = evaluator._get_master_comparisons(result)
        assert len(comparisons) == 0

    def test_low_sympathy(self, evaluator):
        result = MagicMock()
        result.sympathy.overall_score = 40
        result.empathy.overall_score = 80
        result.immersion.overall_score = 80
        comparisons = evaluator._get_master_comparisons(result)
        assert len(comparisons) == 1
        assert comparisons[0]["layer"] == "同情"
        assert "悲惨世界" in comparisons[0]["master_work"]

    def test_low_empathy(self, evaluator):
        result = MagicMock()
        result.sympathy.overall_score = 80
        result.empathy.overall_score = 40
        result.immersion.overall_score = 80
        comparisons = evaluator._get_master_comparisons(result)
        assert len(comparisons) == 1
        assert comparisons[0]["layer"] == "移情"

    def test_low_immersion(self, evaluator):
        result = MagicMock()
        result.sympathy.overall_score = 80
        result.empathy.overall_score = 80
        result.immersion.overall_score = 40
        comparisons = evaluator._get_master_comparisons(result)
        assert len(comparisons) == 1
        assert comparisons[0]["layer"] == "沉浸"

    def test_all_low(self, evaluator):
        result = MagicMock()
        result.sympathy.overall_score = 30
        result.empathy.overall_score = 30
        result.immersion.overall_score = 30
        comparisons = evaluator._get_master_comparisons(result)
        assert len(comparisons) == 3


# ============================================================
# DreamEvaluator._create_improvement_plan
# ============================================================

class TestCreateImprovementPlan:

    @pytest.fixture
    def evaluator(self):
        return DreamEvaluator(llm_client=None)

    def _make_layer(self, name, score):
        l = MagicMock()
        l.layer_name = name
        l.score = score
        l.suggestions = ["fix1", "fix2", "fix3"]
        return l

    def test_all_above_80_empty(self, evaluator):
        result = MagicMock()
        result.layer_scores = [self._make_layer("sym", 85)]
        plan = evaluator._create_improvement_plan(result)
        assert len(plan) == 0

    def test_below_50_priority_1(self, evaluator):
        result = MagicMock()
        result.layer_scores = [self._make_layer("sym", 30)]
        plan = evaluator._create_improvement_plan(result)
        assert len(plan) == 1
        assert plan[0]["priority"] == 1
        assert plan[0]["estimated_effort"] == "HIGH"

    def test_below_70_priority_2(self, evaluator):
        result = MagicMock()
        result.layer_scores = [self._make_layer("emp", 60)]
        plan = evaluator._create_improvement_plan(result)
        assert plan[0]["priority"] == 2
        assert plan[0]["estimated_effort"] == "MEDIUM"

    def test_below_80_priority_3(self, evaluator):
        result = MagicMock()
        result.layer_scores = [self._make_layer("imm", 75)]
        plan = evaluator._create_improvement_plan(result)
        assert plan[0]["priority"] == 3

    def test_sorted_by_priority(self, evaluator):
        result = MagicMock()
        result.layer_scores = [
            self._make_layer("high", 75),   # priority 3
            self._make_layer("low", 30),    # priority 1
            self._make_layer("mid", 60),    # priority 2
        ]
        plan = evaluator._create_improvement_plan(result)
        assert plan[0]["priority"] <= plan[1]["priority"] <= plan[2]["priority"]

    def test_actions_limited_to_2(self, evaluator):
        result = MagicMock()
        result.layer_scores = [self._make_layer("sym", 40)]
        plan = evaluator._create_improvement_plan(result)
        assert len(plan[0]["actions"]) <= 2


# ============================================================
# CodeAdapter
# ============================================================

class TestCodeAdapter:

    @pytest.fixture
    def adapter(self):
        from src.workflow.adapters.code_adapter import CodeAdapter
        return CodeAdapter()

    def test_domain_type(self, adapter):
        assert adapter.get_domain_type() == "code"

    def test_state_class(self, adapter):
        from src.workflow.base_state import BaseState
        assert adapter.get_state_class() is BaseState

    def test_create_initial_state(self, adapter):
        state = adapter.create_initial_state("Build a CLI tool")
        assert state["user_request"] == "Build a CLI tool"
        assert state["domain"] == "code"
        assert "session_id" in state

    def test_create_initial_state_with_metadata(self, adapter):
        state = adapter.create_initial_state(
            "test",
            metadata={"key": "val"},
        )
        assert state["metadata"]["key"] == "val"

    def test_create_initial_state_with_resume(self):
        from src.workflow.adapters.code_adapter import CodeAdapter
        adapter = CodeAdapter()
        resume = MagicMock()
        state = adapter.create_initial_state(
            "test",
            metadata={"existing": True},
            resume_decision=resume,
        )
        assert "resume_decision" in state["metadata"]

    def test_evaluate_defaults_to_revise(self, adapter):
        state = {}
        result = adapter.evaluate(state)
        assert result.decision == "REVISE"
        assert result.total_score < 80

    def test_evaluate_approved_when_all_signals_pass(self, adapter):
        state = {
            "tests_passed": True,
            "lint_passed": True,
            "build_passed": True,
            "coverage": 85,
        }
        result = adapter.evaluate(state)
        assert result.decision == "APPROVED"
        assert result.total_score >= 80

    def test_evaluate_revise_when_tests_fail(self, adapter):
        state = {
            "tests_passed": False,
            "lint_passed": True,
            "build_passed": True,
            "coverage": 95,
        }
        result = adapter.evaluate(state)
        assert result.decision == "REVISE"
        assert any(item["target"] == "tests" for item in result.revision_instructions)

    def test_evaluate_human_review_after_max_revisions(self):
        from src.workflow.adapters.code_adapter import CodeAdapter

        adapter = CodeAdapter(config={"max_revisions": 3})
        state = {
            "revision_count": 3,
            "tests_passed": False,
            "lint_passed": False,
            "build_passed": True,
            "coverage": 90,
        }
        result = adapter.evaluate(state)
        assert result.decision == "HUMAN_REVIEW"

    def test_evaluate_reads_metadata_quality_signals(self, adapter):
        state = {
            "metadata": {
                "quality_signals": {
                    "tests_passed": "true",
                    "lint_passed": "true",
                    "build_passed": "true",
                    "coverage": "82%",
                }
            }
        }
        result = adapter.evaluate(state)
        assert result.decision == "APPROVED"


    def test_evaluate_with_errors_adds_error_instruction(self, adapter):
        state = {
            "errors": ["runtime error"],
            "tests_passed": True,
            "lint_passed": True,
            "build_passed": True,
            "coverage": 90,
        }
        result = adapter.evaluate(state)
        assert result.decision == "REVISE"
        assert any(item["target"] == "error" for item in result.revision_instructions)

    def test_evaluate_revise_when_build_fails(self, adapter):
        state = {
            "tests_passed": True,
            "lint_passed": True,
            "build_passed": False,
            "coverage": 95,
        }
        result = adapter.evaluate(state)
        assert result.decision == "REVISE"
        assert any(item["target"] == "build" for item in result.revision_instructions)

    def test_evaluate_revise_when_coverage_below_threshold(self):
        from src.workflow.adapters.code_adapter import CodeAdapter

        adapter = CodeAdapter(config={"code_coverage_threshold": 85})
        state = {
            "tests_passed": True,
            "lint_passed": True,
            "build_passed": True,
            "coverage": 70,
        }
        result = adapter.evaluate(state)
        assert result.decision == "REVISE"
        assert any(item["target"] == "coverage" for item in result.revision_instructions)

    def test_evaluate_reads_coverage_from_metadata(self, adapter):
        state = {
            "tests_passed": True,
            "lint_passed": True,
            "build_passed": True,
            "metadata": {
                "coverage": "88%",
            },
        }
        result = adapter.evaluate(state)
        assert result.decision == "APPROVED"

    def test_evaluate_invalid_coverage_string_returns_none_branch(self, adapter):
        state = {
            "tests_passed": True,
            "lint_passed": True,
            "build_passed": True,
            "metadata": {
                "coverage": "invalid-value",
            },
        }
        result = adapter.evaluate(state)
        assert result.dimension_scores["coverage"] == 8.0

    def test_to_optional_bool_numeric_and_string_branches(self):
        from src.workflow.adapters.code_adapter import CodeAdapter

        assert CodeAdapter._to_optional_bool(2) is True
        assert CodeAdapter._to_optional_bool("0") is False
        assert CodeAdapter._to_optional_bool("maybe") is None
