from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from src.agents.critic import (
    CriticAgent,
    CriticOutput,
    DimensionScore,
    LOCKAnalysisResult,
    LOCKDimensionResult,
)


def _build_basic_output(total_score=82.0):
    return CriticOutput(
        total_score=total_score,
        lock_score=30.0,
        style_score=30.0,
        logic_score=22.0,
        decision="APPROVED",
        decision_reason="ok",
        dimension_details=[
            DimensionScore(
                dimension="dialogue_quality",
                score=8,
                weight=0.1,
                feedback="good",
                issues=[],
            )
        ],
        suggestions_high=[],
        suggestions_medium=[],
        suggestions_low=[],
        revision_instructions=[],
        actionable_feedback="",
    )


@pytest.mark.asyncio
async def test_evaluate_narrative_report_success():
    agent = CriticAgent(MagicMock())

    report_obj = SimpleNamespace(
        overall_score=88.5,
        overall_level=SimpleNamespace(value="good"),
        module_scores={"voice": 80.0},
        summary="summary",
        recommended_skills=["voice-workshop"],
        all_issues=[1, 2],
        critical_issues=[1],
    )
    agent.narrative_engine = SimpleNamespace(evaluate=AsyncMock(return_value=report_obj))

    report = await agent._evaluate_narrative_report("text", {}, [], {})

    assert report is not None
    assert report["overall_score"] == 88.5
    assert report["overall_level"] == "good"
    assert report["issues_count"] == 2
    assert report["critical_count"] == 1


@pytest.mark.asyncio
async def test_evaluate_narrative_report_exception_returns_none():
    agent = CriticAgent(MagicMock())
    agent.narrative_engine = SimpleNamespace(evaluate=AsyncMock(side_effect=RuntimeError("boom")))

    report = await agent._evaluate_narrative_report("text", {}, [], {})

    assert report is None


def test_make_decision_respects_lock_conflict_threshold():
    agent = CriticAgent(MagicMock())
    output = _build_basic_output(total_score=85.0)
    output.lock_analysis = LOCKAnalysisResult(
        L=LOCKDimensionResult(score=8, reasoning="", improvement=None),
        O=LOCKDimensionResult(score=8, reasoning="", improvement=None),
        C=LOCKDimensionResult(score=6, reasoning="", improvement=None),
        K=LOCKDimensionResult(score=8, reasoning="", improvement=None),
    )

    decision = agent._make_decision(output)
    assert decision == "HUMAN_REVIEW"


def test_apply_rule_checks_updates_score_and_decision():
    agent = CriticAgent(MagicMock())
    output = _build_basic_output(total_score=82.0)

    updated = agent._apply_rule_checks(output, "他突然开口，竟然还笑了。")

    assert updated.suggestions_high
    assert "禁用词" in updated.suggestions_high[0]
    assert updated.dimension_details[0].score == 6
    assert updated.decision in {"APPROVED", "HUMAN_REVIEW", "REVISE", "REWRITE"}


def test_generate_actionable_feedback_includes_lock_scores():
    agent = CriticAgent(MagicMock())
    output = _build_basic_output(total_score=70.0)
    output.lock_analysis = LOCKAnalysisResult(
        L=LOCKDimensionResult(score=7, reasoning="", improvement=None),
        O=LOCKDimensionResult(score=7, reasoning="", improvement=None),
        C=LOCKDimensionResult(score=8, reasoning="", improvement=None),
        K=LOCKDimensionResult(score=7, reasoning="", improvement=None),
    )

    payload = agent.generate_actionable_feedback(output)

    assert payload["dimension_scores"]["L_lead"] == 7
    assert payload["dimension_scores"]["C_confrontation"] == 8
    assert payload["total_score"] == 70.0
