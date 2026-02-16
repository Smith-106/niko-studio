"""
Revision Loop Tests

Tests for RevisionDecision, RevisionConfig, RevisionState,
RevisionLoop (should_continue, update_from_critic, _determine_decision,
get_feedback_for_writer, get_summary, reset), and run_revision_loop.
"""

import pytest
from src.workflow.revision_loop import (
    RevisionDecision,
    RevisionConfig,
    RevisionState,
    RevisionLoop,
    run_revision_loop,
)


# ============================================================
# Enum & Dataclass Tests
# ============================================================

class TestRevisionDecision:

    def test_all_values(self):
        assert RevisionDecision.APPROVED.value == "APPROVED"
        assert RevisionDecision.REVISE.value == "REVISE"
        assert RevisionDecision.REWRITE.value == "REWRITE"
        assert RevisionDecision.HUMAN_REVIEW.value == "HUMAN_REVIEW"

    def test_four_decisions(self):
        assert len(RevisionDecision) == 4


class TestRevisionConfig:

    def test_defaults(self):
        cfg = RevisionConfig()
        assert cfg.max_revisions == 3
        assert cfg.pass_score == 80.0
        assert cfg.min_c_score == 7.0
        assert cfg.human_review_score == 70.0
        assert cfg.score_improvement_threshold == 5.0

    def test_custom(self):
        cfg = RevisionConfig(max_revisions=5, pass_score=90.0)
        assert cfg.max_revisions == 5
        assert cfg.pass_score == 90.0


class TestRevisionState:

    def test_defaults(self):
        state = RevisionState()
        assert state.revision_count == 0
        assert state.current_score == 0.0
        assert state.previous_score == 0.0
        assert state.decision == RevisionDecision.REVISE
        assert state.feedback == ""
        assert state.history == []
        assert state.stagnant_count == 0


# ============================================================
# RevisionLoop Tests
# ============================================================

class TestRevisionLoop:

    def test_init_default_config(self):
        loop = RevisionLoop()
        assert loop.config.max_revisions == 3
        assert loop.state.revision_count == 0

    def test_init_custom_config(self):
        cfg = RevisionConfig(max_revisions=5)
        loop = RevisionLoop(cfg)
        assert loop.config.max_revisions == 5

    def test_should_continue_initial(self):
        loop = RevisionLoop()
        assert loop.should_continue() is True

    def test_should_continue_approved(self):
        loop = RevisionLoop()
        loop.state.decision = RevisionDecision.APPROVED
        assert loop.should_continue() is False

    def test_should_continue_human_review(self):
        loop = RevisionLoop()
        loop.state.decision = RevisionDecision.HUMAN_REVIEW
        assert loop.should_continue() is False

    def test_should_continue_max_revisions(self):
        loop = RevisionLoop()
        loop.state.revision_count = 3
        assert loop.should_continue() is False

    def test_should_continue_stagnant(self):
        loop = RevisionLoop()
        loop.state.stagnant_count = 2
        assert loop.should_continue() is False

    def test_update_from_critic_approved(self):
        loop = RevisionLoop()
        result = {
            "total_score": 85,
            "decision": "APPROVED",
            "actionable_feedback": "Good work",
            "lock_analysis": {"C": {"score": 8}},
        }
        decision = loop.update_from_critic(result)
        assert decision == RevisionDecision.APPROVED
        assert loop.state.current_score == 85
        assert loop.state.revision_count == 1

    def test_update_from_critic_approved_low_score(self):
        loop = RevisionLoop()
        result = {
            "total_score": 70,
            "decision": "APPROVED",
            "lock_analysis": {"C": {"score": 8}},
        }
        decision = loop.update_from_critic(result)
        # Score < pass_score, downgraded to REVISE
        assert decision == RevisionDecision.REVISE

    def test_update_from_critic_approved_low_c_score(self):
        loop = RevisionLoop()
        result = {
            "total_score": 90,
            "decision": "APPROVED",
            "lock_analysis": {"C": {"score": 5}},
        }
        decision = loop.update_from_critic(result)
        # C score < min_c_score, downgraded to REVISE
        assert decision == RevisionDecision.REVISE

    def test_update_from_critic_revise(self):
        loop = RevisionLoop()
        result = {
            "total_score": 60,
            "decision": "REVISE",
            "actionable_feedback": "Need more detail",
        }
        decision = loop.update_from_critic(result)
        assert decision == RevisionDecision.REVISE

    def test_update_from_critic_rewrite(self):
        loop = RevisionLoop()
        result = {
            "total_score": 30,
            "decision": "REWRITE",
        }
        decision = loop.update_from_critic(result)
        assert decision == RevisionDecision.REWRITE

    def test_update_from_critic_rewrite_at_max(self):
        cfg = RevisionConfig(max_revisions=1)
        loop = RevisionLoop(cfg)
        # First revision
        loop.update_from_critic({"total_score": 50, "decision": "REVISE"})
        # At max, REWRITE escalates to HUMAN_REVIEW
        decision = loop.update_from_critic({"total_score": 30, "decision": "REWRITE"})
        assert decision == RevisionDecision.HUMAN_REVIEW

    def test_update_from_critic_human_review(self):
        loop = RevisionLoop()
        result = {
            "total_score": 50,
            "decision": "HUMAN_REVIEW",
        }
        decision = loop.update_from_critic(result)
        assert decision == RevisionDecision.HUMAN_REVIEW

    def test_stagnation_detection(self):
        loop = RevisionLoop()
        # First revision: score 60
        loop.update_from_critic({"total_score": 60, "decision": "REVISE"})
        assert loop.state.stagnant_count == 0

        # Second revision: score 61 (improvement < 5)
        loop.update_from_critic({"total_score": 61, "decision": "REVISE"})
        assert loop.state.stagnant_count == 1

        # Third revision: score 62 (still stagnant)
        loop.update_from_critic({"total_score": 62, "decision": "REVISE"})
        assert loop.state.stagnant_count == 2
        # Stagnant count >= 2 triggers HUMAN_REVIEW
        assert loop.state.decision == RevisionDecision.HUMAN_REVIEW

    def test_stagnation_reset_on_improvement(self):
        loop = RevisionLoop()
        loop.update_from_critic({"total_score": 60, "decision": "REVISE"})
        loop.update_from_critic({"total_score": 61, "decision": "REVISE"})
        assert loop.state.stagnant_count == 1

        # Big improvement resets stagnation
        loop.update_from_critic({"total_score": 70, "decision": "REVISE"})
        assert loop.state.stagnant_count == 0

    def test_history_tracking(self):
        loop = RevisionLoop()
        loop.update_from_critic({
            "total_score": 60,
            "decision": "REVISE",
            "actionable_feedback": "Fix the plot holes",
        })
        assert len(loop.state.history) == 1
        assert loop.state.history[0]["revision"] == 1
        assert loop.state.history[0]["score"] == 60

    def test_get_feedback_for_writer(self):
        loop = RevisionLoop()
        loop.update_from_critic({
            "total_score": 60,
            "decision": "REVISE",
            "actionable_feedback": "Add more conflict",
        })
        feedback = loop.get_feedback_for_writer()
        assert feedback["feedback"] == "Add more conflict"
        assert feedback["revision_count"] == 1
        assert feedback["current_score"] == 60

    def test_get_summary(self):
        loop = RevisionLoop()
        loop.update_from_critic({"total_score": 60, "decision": "REVISE"})
        loop.update_from_critic({"total_score": 85, "decision": "APPROVED",
                                  "lock_analysis": {"C": {"score": 8}}})
        summary = loop.get_summary()
        assert summary["total_revisions"] == 2
        assert summary["final_score"] == 85
        assert summary["final_decision"] == "APPROVED"
        assert summary["score_trend"] == [60, 85]

    def test_reset(self):
        loop = RevisionLoop()
        loop.update_from_critic({"total_score": 60, "decision": "REVISE"})
        loop.reset()
        assert loop.state.revision_count == 0
        assert loop.state.current_score == 0.0
        assert loop.state.history == []

    def test_determine_decision_no_lock_analysis(self):
        loop = RevisionLoop()
        result = {
            "total_score": 90,
            "decision": "APPROVED",
        }
        decision = loop.update_from_critic(result)
        # No lock_analysis means default c_score=10 (满分)
        assert decision == RevisionDecision.APPROVED

    def test_revise_at_max_escalates(self):
        cfg = RevisionConfig(max_revisions=2)
        loop = RevisionLoop(cfg)
        loop.update_from_critic({"total_score": 50, "decision": "REVISE"})
        loop.update_from_critic({"total_score": 55, "decision": "REVISE"})
        # At max_revisions, REVISE escalates to HUMAN_REVIEW
        assert loop.state.decision == RevisionDecision.HUMAN_REVIEW

    def test_stagnant_branch_human_review_before_max(self):
        cfg = RevisionConfig(max_revisions=10, score_improvement_threshold=5.0)
        loop = RevisionLoop(cfg)

        loop.update_from_critic({"total_score": 60, "decision": "REVISE"})
        loop.update_from_critic({"total_score": 61, "decision": "REVISE"})
        loop.update_from_critic({"total_score": 62, "decision": "REVISE"})

        assert loop.state.revision_count == 3
        assert loop.state.stagnant_count >= 2
        assert loop.state.decision == RevisionDecision.HUMAN_REVIEW


# ============================================================
# run_revision_loop Tests
# ============================================================

class TestRunRevisionLoop:

    @pytest.mark.asyncio
    async def test_immediate_approval(self):
        async def mock_critic(draft, scene_card):
            return {
                "total_score": 90,
                "decision": "APPROVED",
                "actionable_feedback": "",
                "lock_analysis": {"C": {"score": 9}},
            }

        async def mock_writer(draft, feedback):
            return "revised"

        result = await run_revision_loop(
            draft="initial draft",
            scene_card={},
            writer_fn=mock_writer,
            critic_fn=mock_critic,
            verbose=False,
        )
        assert result["final_decision"] == "APPROVED"
        assert result["total_revisions"] == 1
        assert result["final_draft"] == "initial draft"

    @pytest.mark.asyncio
    async def test_revision_then_approval(self):
        call_count = 0

        async def mock_critic(draft, scene_card):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return {"total_score": 60, "decision": "REVISE",
                        "actionable_feedback": "Fix it"}
            return {"total_score": 90, "decision": "APPROVED",
                    "lock_analysis": {"C": {"score": 9}}}

        async def mock_writer(draft, feedback):
            return "revised draft"

        result = await run_revision_loop(
            draft="initial",
            scene_card={},
            writer_fn=mock_writer,
            critic_fn=mock_critic,
            verbose=False,
        )
        assert result["final_decision"] == "APPROVED"
        assert result["total_revisions"] == 2
        assert result["final_draft"] == "revised draft"

    @pytest.mark.asyncio
    async def test_max_revisions_reached(self):
        async def mock_critic(draft, scene_card):
            return {"total_score": 50, "decision": "REVISE",
                    "actionable_feedback": "Still bad"}

        async def mock_writer(draft, feedback):
            return "revised"

        cfg = RevisionConfig(max_revisions=2)
        result = await run_revision_loop(
            draft="initial",
            scene_card={},
            writer_fn=mock_writer,
            critic_fn=mock_critic,
            config=cfg,
            verbose=False,
        )
        assert result["final_decision"] == "HUMAN_REVIEW"
        assert result["total_revisions"] <= 3

    @pytest.mark.asyncio
    async def test_custom_config(self):
        async def mock_critic(draft, scene_card):
            return {"total_score": 95, "decision": "APPROVED",
                    "lock_analysis": {"C": {"score": 10}}}

        async def mock_writer(draft, feedback):
            return "revised"

        cfg = RevisionConfig(pass_score=95.0)
        result = await run_revision_loop(
            draft="initial",
            scene_card={},
            writer_fn=mock_writer,
            critic_fn=mock_critic,
            config=cfg,
            verbose=False,
        )
        assert result["final_decision"] == "APPROVED"

    @pytest.mark.asyncio
    async def test_verbose_branches_and_writer_called(self, capsys):
        call_count = {"n": 0}

        async def mock_critic(draft, scene_card):
            call_count["n"] += 1
            if call_count["n"] == 1:
                return {
                    "total_score": 60,
                    "decision": "REVISE",
                    "actionable_feedback": "补充细节",
                }
            return {
                "total_score": 90,
                "decision": "APPROVED",
                "lock_analysis": {"C": {"score": 8}},
            }

        async def mock_writer(draft, feedback):
            assert "feedback" in feedback
            return draft + "\nrevised"

        result = await run_revision_loop(
            draft="initial",
            scene_card={"scene": "x"},
            writer_fn=mock_writer,
            critic_fn=mock_critic,
            verbose=True,
        )

        out = capsys.readouterr().out
        assert "第 1 次评估" in out
        assert "第 1 次修订" in out
        assert "修订循环完成" in out
        assert "最终决策: APPROVED" in out
        assert result["total_revisions"] == 2
