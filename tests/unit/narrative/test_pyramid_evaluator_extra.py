# -*- coding: utf-8 -*-
"""Extra branch tests for src.narrative.evaluators.pyramid_evaluator."""

import pytest

from src.narrative.evaluators.base import Issue, Severity
from src.narrative.evaluators.pyramid_evaluator import PyramidEvaluator


@pytest.fixture
def evaluator():
    return PyramidEvaluator()


def test_description_property(evaluator):
    assert "金字塔原理" in evaluator.description


def test_evaluate_conclusion_first_empty_inputs(evaluator):
    score, issues = evaluator._evaluate_conclusion_first("", [], [])

    assert score == 50
    assert issues == []


def test_evaluate_conclusion_first_buried_and_structure_preview(evaluator):
    content = "首先让我们看看背景。将从三个方面展开讨论。"
    paragraphs = [content]
    sentences = ["首先让我们看看背景", "将从三个方面展开讨论"]

    score, issues = evaluator._evaluate_conclusion_first(content, paragraphs, sentences)
    issue_codes = {i.code for i in issues}

    assert score == 55
    assert "PYRAMID_BURIED_CONCLUSION" in issue_codes
    assert "PYRAMID_NO_CONCLUSION_FIRST" in issue_codes


def test_evaluate_vertical_structure_single_causal_why_and_progressive(evaluator):
    content = "因为前提成立，结论有效。原因是证据完整。此外还有辅助数据。更重要的是逻辑闭环。"

    score, issues = evaluator._evaluate_vertical_structure(content, [content])

    assert score == 90
    assert issues == []


def test_evaluate_horizontal_structure_two_markers_and_parallel(evaluator):
    content = "第一，先定义问题。第二，提出方案。一方面强调收益，另一方面控制成本。"

    score, issues = evaluator._evaluate_horizontal_structure(content, [content])

    assert score == 85
    assert issues == []


def test_evaluate_mece_with_framework_signal(evaluator):
    content = "这个方案可以分为三个维度：效率、质量、成本。"

    score, issues = evaluator._evaluate_mece(content, [content])

    assert score == 85
    assert issues == []


def test_evaluate_mece_overlap_branch(evaluator):
    repeated = "alpha beta gamma delta " * 5
    tail = " ".join(f"u{i}" for i in range(40))
    content = f"{repeated}{tail}"

    score, issues = evaluator._evaluate_mece(content, [content])
    issue_codes = {i.code for i in issues}

    assert score == 60
    assert "PYRAMID_NO_CLEAR_FRAMEWORK" in issue_codes
    assert "PYRAMID_POSSIBLE_OVERLAP" in issue_codes


def test_generate_summary_with_critical_issue(evaluator):
    issues = [Issue(code="X", message="m", severity=Severity.CRITICAL)]
    summary = evaluator._generate_summary(
        score=55,
        metrics={
            "conclusion_first": 40,
            "vertical_structure": 60,
            "horizontal_structure": 70,
            "mece_compliance": 80,
        },
        issues=issues,
    )

    assert "严重结构问题" in summary


def test_quick_scan_without_conclusion_and_structure(evaluator):
    result = evaluator.quick_scan("这段文字没有结构标记也没有结论信号")
    issue_codes = {i.code for i in result.issues}

    assert result.score == 50
    assert "PYRAMID_NO_CONCLUSION_FIRST" in issue_codes
    assert "PYRAMID_NO_STRUCTURE_MARKERS" in issue_codes
