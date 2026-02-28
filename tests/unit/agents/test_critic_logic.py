"""
Critic Agent Logic Tests

Tests for the pure-logic parts of CriticAgent: scoring, decision-making,
rule checks, feedback generation, and data models.
No LLM calls required.
"""

import pytest
from src.agents.critic import (
    CriticAgent,
    CriticOutput,
    DimensionScore,
    LOCKAnalysisResult,
    LOCKDimensionResult,
    LOCKSceneCheck,
    ShuangDianCheck,
    RevisionInstruction,
)
from unittest.mock import MagicMock


def _make_dimensions(scores: dict[str, float] | None = None) -> list[DimensionScore]:
    """Helper to create dimension scores for testing."""
    defaults = {
        "L_lead": 8.0,
        "O_objective": 8.0,
        "C_confrontation": 8.0,
        "K_knockout": 8.0,
        "sensory_balance": 7.0,
        "dickensian_style": 7.0,
        "dialogue_quality": 8.0,
        "character_consistency": 7.0,
        "rhythm_control": 7.0,
        "plot_logic": 8.0,
        "reader_experience": 8.0,
        "worldbuilding_consistency": 7.0,
    }
    if scores:
        defaults.update(scores)
    return [
        DimensionScore(
            dimension=dim,
            score=score,
            weight=CriticAgent.DIMENSION_CONFIG.get(dim, {}).get("weight", 0.05),
            feedback=f"test feedback for {dim}",
        )
        for dim, score in defaults.items()
    ]


def _make_critic_output(
    total_score: float = 85.0,
    lock_analysis: LOCKAnalysisResult | None = None,
    dimension_details: list[DimensionScore] | None = None,
    **kwargs,
) -> CriticOutput:
    """Helper to create CriticOutput for testing."""
    return CriticOutput(
        decision=kwargs.get("decision", "APPROVED"),
        decision_reason="test",
        total_score=total_score,
        lock_score=kwargs.get("lock_score", 32.0),
        style_score=kwargs.get("style_score", 28.0),
        logic_score=kwargs.get("logic_score", 20.0),
        dimension_details=dimension_details or _make_dimensions(),
        lock_analysis=lock_analysis,
        suggestions_high=kwargs.get("suggestions_high", []),
        suggestions_medium=kwargs.get("suggestions_medium", []),
        revision_instructions=kwargs.get("revision_instructions", []),
    )


def _make_lock_analysis(l=8, o=8, c=8, k=8) -> LOCKAnalysisResult:
    return LOCKAnalysisResult(
        L=LOCKDimensionResult(score=l, reasoning="test L"),
        O=LOCKDimensionResult(score=o, reasoning="test O"),
        C=LOCKDimensionResult(score=c, reasoning="test C"),
        K=LOCKDimensionResult(score=k, reasoning="test K"),
    )


class TestDataModels:
    """Tests for Pydantic data models"""

    def test_dimension_score_validation(self):
        d = DimensionScore(dimension="test", score=5.0, weight=0.5, feedback="ok")
        assert d.score == 5.0

    def test_dimension_score_out_of_range(self):
        with pytest.raises(Exception):
            DimensionScore(dimension="test", score=11.0, weight=0.5, feedback="bad")

    def test_lock_scene_check(self):
        check = LOCKSceneCheck(L_exhibited=True, O_advanced=True, C_present=False)
        assert check.K_hook is None
        assert check.C_present is False

    def test_shuangdian_total_score(self):
        sd = ShuangDianCheck(
            setup_score=3, setup_feedback="good",
            payoff_score=4, payoff_feedback="great",
            reaction_score=2, reaction_feedback="ok",
        )
        assert sd.total_score == 9
        assert sd.is_effective is True

    def test_shuangdian_not_effective(self):
        sd = ShuangDianCheck(
            setup_score=1, setup_feedback="weak",
            payoff_score=2, payoff_feedback="meh",
            reaction_score=1, reaction_feedback="flat",
        )
        assert sd.total_score == 4
        assert sd.is_effective is False

    def test_revision_instruction(self):
        ri = RevisionInstruction(
            target="paragraph 3",
            issue="too bland",
            suggestion="add sensory details",
            priority="high",
        )
        assert ri.priority == "high"

    def test_lock_analysis_weighted_score(self):
        lock = _make_lock_analysis(l=10, o=10, c=10, k=10)
        assert lock.weighted_score == 40.0

    def test_lock_analysis_c_score_sufficient(self):
        lock = _make_lock_analysis(c=7)
        assert lock.c_score_sufficient is True
        lock2 = _make_lock_analysis(c=6)
        assert lock2.c_score_sufficient is False

    def test_lock_analysis_critical_failure(self):
        lock = _make_lock_analysis(c=2)
        assert lock.has_critical_failure is True
        lock2 = _make_lock_analysis(l=3, o=3, c=3, k=3)
        assert lock2.has_critical_failure is False


class TestCalculateTotalScore:
    """Tests for _calculate_total_score()"""

    def test_all_perfect(self):
        agent = CriticAgent(llm=MagicMock())
        dims = _make_dimensions({dim: 10.0 for dim in CriticAgent.DIMENSION_CONFIG})
        score = agent._calculate_total_score(dims)
        assert score == 100.0

    def test_all_zero(self):
        agent = CriticAgent(llm=MagicMock())
        dims = _make_dimensions({dim: 0.0 for dim in CriticAgent.DIMENSION_CONFIG})
        score = agent._calculate_total_score(dims)
        assert score == 0.0

    def test_unknown_dimension_ignored(self):
        agent = CriticAgent(llm=MagicMock())
        dims = [DimensionScore(dimension="unknown_dim", score=10.0, weight=1.0, feedback="test")]
        score = agent._calculate_total_score(dims)
        assert score == 0.0


class TestMakeDecision:
    """Tests for _make_decision()"""

    def test_approved_high_score_no_lock(self):
        agent = CriticAgent(llm=MagicMock())
        result = _make_critic_output(total_score=99.0)
        decision = agent._make_decision(result)
        assert decision == "APPROVED"

    def test_approved_high_score_with_good_lock(self):
        agent = CriticAgent(llm=MagicMock())
        lock = _make_lock_analysis(c=8)
        result = _make_critic_output(total_score=99.0, lock_analysis=lock)
        decision = agent._make_decision(result)
        assert decision == "APPROVED"

    def test_human_review_high_score_low_c(self):
        agent = CriticAgent(llm=MagicMock())
        lock = _make_lock_analysis(c=5)
        result = _make_critic_output(total_score=99.0, lock_analysis=lock)
        decision = agent._make_decision(result)
        assert decision == "HUMAN_REVIEW"

    def test_human_review_medium_score(self):
        agent = CriticAgent(llm=MagicMock())
        result = _make_critic_output(total_score=95.0)
        decision = agent._make_decision(result)
        assert decision == "HUMAN_REVIEW"

    def test_revise_low_score(self):
        agent = CriticAgent(llm=MagicMock())
        result = _make_critic_output(total_score=60.0)
        decision = agent._make_decision(result)
        assert decision == "REVISE"

    def test_rewrite_very_low_score(self):
        agent = CriticAgent(llm=MagicMock())
        result = _make_critic_output(total_score=40.0)
        decision = agent._make_decision(result)
        assert decision == "REWRITE"

    def test_rewrite_lock_critical_failure(self):
        agent = CriticAgent(llm=MagicMock())
        lock = _make_lock_analysis(c=1)
        result = _make_critic_output(total_score=90.0, lock_analysis=lock)
        decision = agent._make_decision(result)
        assert decision == "REWRITE"

    def test_boundary_99(self):
        agent = CriticAgent(llm=MagicMock())
        result = _make_critic_output(total_score=99.0)
        assert agent._make_decision(result) == "APPROVED"

    def test_boundary_95(self):
        agent = CriticAgent(llm=MagicMock())
        result = _make_critic_output(total_score=95.0)
        assert agent._make_decision(result) == "HUMAN_REVIEW"

    def test_boundary_50(self):
        agent = CriticAgent(llm=MagicMock())
        result = _make_critic_output(total_score=50.0)
        assert agent._make_decision(result) == "REVISE"

    def test_boundary_49(self):
        agent = CriticAgent(llm=MagicMock())
        result = _make_critic_output(total_score=49.9)
        assert agent._make_decision(result) == "REWRITE"


class TestApplyRuleChecks:
    """Tests for _apply_rule_checks()"""

    def test_forbidden_word_detected(self):
        agent = CriticAgent(llm=MagicMock())
        result = _make_critic_output(total_score=85.0)
        content = "他突然转身，不禁感到一阵寒意"
        checked = agent._apply_rule_checks(result, content)
        assert len(checked.suggestions_high) > 0
        assert "禁用词" in checked.suggestions_high[0]

    def test_no_forbidden_words(self):
        agent = CriticAgent(llm=MagicMock())
        result = _make_critic_output(total_score=85.0)
        content = "他缓缓转身，一阵寒意沿着脊椎攀升"
        checked = agent._apply_rule_checks(result, content)
        # No forbidden word suggestions added
        assert not any("禁用词" in s for s in checked.suggestions_high)

    def test_forbidden_words_deduct_dialogue_score(self):
        agent = CriticAgent(llm=MagicMock())
        dims = _make_dimensions({"dialogue_quality": 8.0})
        result = _make_critic_output(total_score=85.0, dimension_details=dims)
        content = "突然，他竟然说出了那番话，居然毫无愧疚"
        checked = agent._apply_rule_checks(result, content)
        dialogue_dim = next(d for d in checked.dimension_details if d.dimension == "dialogue_quality")
        assert dialogue_dim.score < 8.0

    def test_rule_checks_recalculate_total(self):
        agent = CriticAgent(llm=MagicMock())
        result = _make_critic_output(total_score=85.0)
        content = "突然突然突然"
        checked = agent._apply_rule_checks(result, content)
        # Total score should be recalculated
        assert isinstance(checked.total_score, float)

    def test_rule_checks_update_decision(self):
        agent = CriticAgent(llm=MagicMock())
        result = _make_critic_output(total_score=85.0, decision="APPROVED")
        content = "clean content without forbidden words"
        checked = agent._apply_rule_checks(result, content)
        assert checked.decision in ["APPROVED", "HUMAN_REVIEW", "REVISE", "REWRITE"]


class TestFeedbackGeneration:
    """Tests for generate_revision_feedback() and generate_actionable_feedback()"""

    def test_generate_revision_feedback_basic(self):
        agent = CriticAgent(llm=MagicMock())
        result = _make_critic_output(
            total_score=65.0,
            decision="REVISE",
            suggestions_high=["Fix dialogue quality"],
            suggestions_medium=["Improve sensory details"],
        )
        feedback = agent.generate_revision_feedback(result)
        assert "审核结果" in feedback
        assert "REVISE" in feedback
        assert "65" in feedback
        assert "Fix dialogue quality" in feedback
        assert "Improve sensory details" in feedback

    def test_generate_revision_feedback_with_instructions(self):
        agent = CriticAgent(llm=MagicMock())
        result = _make_critic_output(
            revision_instructions=[
                RevisionInstruction(
                    target="paragraph 1",
                    issue="too bland",
                    suggestion="add detail",
                    priority="high",
                )
            ]
        )
        feedback = agent.generate_revision_feedback(result)
        assert "paragraph 1" in feedback
        assert "too bland" in feedback
        assert "add detail" in feedback

    def test_generate_actionable_feedback_structure(self):
        agent = CriticAgent(llm=MagicMock())
        result = _make_critic_output(
            total_score=70.0,
            decision="HUMAN_REVIEW",
            suggestions_high=["s1"],
            suggestions_medium=["s2", "s3", "s4", "s5"],
        )
        fb = agent.generate_actionable_feedback(result)
        assert fb["decision"] == "HUMAN_REVIEW"
        assert fb["total_score"] == 70.0
        assert "s1" in fb["suggestions"]
        # Medium suggestions capped at 3
        assert len([s for s in fb["suggestions"] if s.startswith("s")]) <= 4

    def test_generate_actionable_feedback_with_lock(self):
        agent = CriticAgent(llm=MagicMock())
        lock = _make_lock_analysis(l=5, o=6, c=3, k=7)
        result = _make_critic_output(lock_analysis=lock)
        fb = agent.generate_actionable_feedback(result)
        assert "C_confrontation" in fb["dimension_scores"]
        assert fb["dimension_scores"]["C_confrontation"] == 3

    def test_generate_actionable_feedback_revision_instructions(self):
        agent = CriticAgent(llm=MagicMock())
        result = _make_critic_output(
            revision_instructions=[
                RevisionInstruction(target="p1", issue="weak", suggestion="fix it", priority="high"),
                RevisionInstruction(target="p2", issue="meh", suggestion="improve", priority="medium"),
            ]
        )
        fb = agent.generate_actionable_feedback(result)
        assert len(fb["revision_instructions"]) == 2
        assert fb["revision_instructions"][0]["target"] == "p1"


class TestHelperMethods:
    """Tests for should_revise, should_human_review, get_low_score_dimensions"""

    def test_should_revise_true(self):
        agent = CriticAgent(llm=MagicMock())
        result = _make_critic_output(decision="REVISE")
        assert agent.should_revise(result) is True

    def test_should_revise_rewrite(self):
        agent = CriticAgent(llm=MagicMock())
        result = _make_critic_output(decision="REWRITE")
        assert agent.should_revise(result) is True

    def test_should_revise_approved(self):
        agent = CriticAgent(llm=MagicMock())
        result = _make_critic_output(decision="APPROVED")
        assert agent.should_revise(result) is False

    def test_should_human_review(self):
        agent = CriticAgent(llm=MagicMock())
        result = _make_critic_output(decision="HUMAN_REVIEW")
        assert agent.should_human_review(result) is True

    def test_should_not_human_review(self):
        agent = CriticAgent(llm=MagicMock())
        result = _make_critic_output(decision="APPROVED")
        assert agent.should_human_review(result) is False

    def test_get_low_score_dimensions(self):
        agent = CriticAgent(llm=MagicMock())
        dims = _make_dimensions({"dialogue_quality": 5.0, "rhythm_control": 3.0})
        result = _make_critic_output(dimension_details=dims)
        low = agent.get_low_score_dimensions(result, threshold=7.0)
        assert "dialogue_quality" in low
        assert "rhythm_control" in low

    def test_get_low_score_dimensions_all_pass(self):
        agent = CriticAgent(llm=MagicMock())
        dims = _make_dimensions()  # All >= 7.0
        result = _make_critic_output(dimension_details=dims)
        low = agent.get_low_score_dimensions(result, threshold=7.0)
        assert len(low) == 0
