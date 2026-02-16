# -*- coding: utf-8 -*-
"""
Level3Standard Tests

Tests for PlanPhase, Level3Standard (init, execute, plan, plan_verify,
_plan_phase, _verify_plan, _execute_phase, _critic_phase,
get_required_agents, lazy agent getters).
"""

import pytest
from unittest.mock import MagicMock, patch
from src.workflow.levels.level3_standard import PlanPhase, Level3Standard
from src.workflow.base_state import BaseState


# ============================================================
# PlanPhase
# ============================================================

class TestPlanPhase:

    def test_defaults(self):
        p = PlanPhase(phase=1, name="test", description="desc")
        assert p.status == "pending"
        assert p.output is None

    def test_custom(self):
        p = PlanPhase(phase=2, name="n", description="d", status="completed", output="out")
        assert p.status == "completed"
        assert p.output == "out"


# ============================================================
# Level3Standard class attributes
# ============================================================

class TestLevel3StandardClass:

    def test_class_attrs(self):
        assert Level3Standard.level == 3
        assert Level3Standard.name == "standard"
        assert len(Level3Standard.PLAN_PHASES) == 5

    def test_get_required_agents(self):
        l3 = Level3Standard()
        agents = l3.get_required_agents()
        assert "architect" in agents
        assert "writer" in agents
        assert "critic" in agents


# ============================================================
# Init with injected agents
# ============================================================

class TestLevel3StandardInit:

    def test_init_defaults(self):
        l3 = Level3Standard()
        assert l3._architect is None
        assert l3._writer is None
        assert l3._critic is None

    def test_init_with_agents(self):
        a, w, c = MagicMock(), MagicMock(), MagicMock()
        l3 = Level3Standard(architect=a, writer=w, critic=c)
        assert l3._architect is a
        assert l3._writer is w
        assert l3._critic is c

    def test_init_with_config(self):
        l3 = Level3Standard(config={"max_revisions": 5})
        assert l3.config["max_revisions"] == 5


# ============================================================
# _verify_plan
# ============================================================

class TestVerifyPlan:

    def test_empty_plan_fails(self):
        l3 = Level3Standard()
        state = BaseState()
        assert l3._verify_plan(state) is False

    def test_plan_with_no_phases(self):
        l3 = Level3Standard()
        state = BaseState()
        state["implementation_plan"] = {"steps": []}
        state["plan_phases"] = []
        assert l3._verify_plan(state) is False

    def test_plan_with_phases_no_output(self):
        l3 = Level3Standard()
        state = BaseState()
        state["implementation_plan"] = {"steps": [1]}
        state["plan_phases"] = [{"name": "phase1"}]  # dict without output
        assert l3._verify_plan(state) is False

    def test_plan_with_phases_with_output(self):
        l3 = Level3Standard()
        state = BaseState()
        state["implementation_plan"] = {"steps": [1]}
        state["plan_phases"] = [{"name": "phase1", "output": "done"}]
        assert l3._verify_plan(state) is True

    def test_plan_with_planphase_objects(self):
        l3 = Level3Standard()
        state = BaseState()
        state["implementation_plan"] = {"steps": [1]}
        # PlanPhase objects are not dicts, so isinstance check skips them
        state["plan_phases"] = [PlanPhase(1, "p", "d", output="x")]
        assert l3._verify_plan(state) is True


# ============================================================
# plan and plan_verify
# ============================================================

class TestPlanAndPlanVerify:

    def test_plan_returns_phases(self):
        architect = MagicMock()
        architect.run = MagicMock(return_value={"phases": [{"name": "p1"}]})
        l3 = Level3Standard(architect=architect)
        state = BaseState()
        phases = l3.plan(state)
        assert isinstance(phases, list)

    def test_plan_verify(self):
        l3 = Level3Standard()
        state = BaseState()
        state["implementation_plan"] = {"steps": [1]}
        state["plan_phases"] = [{"name": "p1", "output": "ok"}]
        result = l3.plan_verify(state)
        assert result["valid"] is True

    def test_plan_verify_invalid(self):
        l3 = Level3Standard()
        state = BaseState()
        result = l3.plan_verify(state)
        assert result["valid"] is False


# ============================================================
# _plan_phase
# ============================================================

class TestPlanPhaseMethod:

    def test_with_architect(self):
        architect = MagicMock()
        architect.run = MagicMock(return_value={
            "phases": [{"name": "p1"}],
            "plan": {"detail": True},
        })
        l3 = Level3Standard(architect=architect)
        state = BaseState()
        state["user_request"] = "write chapter"
        result = l3._plan_phase(state)
        assert result["plan_phases"] == [{"name": "p1"}]
        assert result["implementation_plan"] == {"detail": True}

    def test_architect_failure(self):
        architect = MagicMock()
        architect.run = MagicMock(side_effect=RuntimeError("fail"))
        l3 = Level3Standard(architect=architect)
        state = BaseState()
        result = l3._plan_phase(state)
        assert "errors" in result
        assert any("計劃失敗" in e for e in result["errors"])
        assert result["plan_phases"] == Level3Standard.PLAN_PHASES


# ============================================================
# _execute_phase
# ============================================================

class TestExecutePhaseMethod:

    def test_with_writer(self):
        writer = MagicMock()
        writer.run = MagicMock(return_value={"content": "chapter text"})
        l3 = Level3Standard(writer=writer)
        state = BaseState()
        result = l3._execute_phase(state)
        assert result["draft_content"] == "chapter text"
        assert result["draft_version"] == 1

    def test_writer_failure(self):
        writer = MagicMock()
        writer.run = MagicMock(side_effect=RuntimeError("fail"))
        l3 = Level3Standard(writer=writer)
        state = BaseState()
        result = l3._execute_phase(state)
        assert "errors" in result
        assert any("執行失敗" in e for e in result["errors"])

    def test_version_increments(self):
        writer = MagicMock()
        writer.run = MagicMock(return_value={"content": "v2"})
        l3 = Level3Standard(writer=writer)
        state = BaseState()
        state["draft_version"] = 1
        result = l3._execute_phase(state)
        assert result["draft_version"] == 2


# ============================================================
# _critic_phase
# ============================================================

class TestCriticPhaseMethod:

    def test_with_critic(self):
        critic = MagicMock()
        critic.run = MagicMock(return_value={
            "score": 85,
            "decision": "APPROVED",
            "feedback": "good",
        })
        l3 = Level3Standard(critic=critic)
        state = BaseState()
        result = l3._critic_phase(state)
        assert result["score"] == 85
        assert result["decision"] == "APPROVED"
        assert result["feedback_context"] == "good"

    def test_critic_failure(self):
        critic = MagicMock()
        critic.run = MagicMock(side_effect=RuntimeError("fail"))
        l3 = Level3Standard(critic=critic)
        state = BaseState()
        result = l3._critic_phase(state)
        assert result["decision"] == "HUMAN_REVIEW"
        assert "errors" in result


# ============================================================
# execute (full workflow)
# ============================================================

class TestExecuteWorkflow:

    def _make_l3(self, plan_result=None, write_result=None, critic_result=None):
        architect = MagicMock()
        architect.run = MagicMock(return_value=plan_result or {
            "phases": [{"name": "p1", "output": "done"}],
            "plan": {"steps": [1]},
        })
        writer = MagicMock()
        writer.run = MagicMock(return_value=write_result or {"content": "text"})
        critic = MagicMock()
        critic.run = MagicMock(return_value=critic_result or {
            "score": 90,
            "decision": "APPROVED",
            "feedback": "",
        })
        return Level3Standard(architect=architect, writer=writer, critic=critic)

    def test_approved_first_try(self):
        l3 = self._make_l3()
        state = BaseState()
        state["user_request"] = "write"
        result = l3.execute(state)
        assert result["decision"] == "APPROVED"

    def test_revise_then_approve(self):
        critic = MagicMock()
        # First call: REVISE, second: APPROVED
        critic.run = MagicMock(side_effect=[
            {"score": 50, "decision": "REVISE", "feedback": "fix it"},
            {"score": 90, "decision": "APPROVED", "feedback": ""},
        ])
        l3 = self._make_l3(critic_result=None)
        l3._critic = critic
        state = BaseState()
        state["user_request"] = "write"
        result = l3.execute(state)
        assert result["decision"] == "APPROVED"

    def test_max_revisions_human_review(self):
        critic = MagicMock()
        critic.run = MagicMock(return_value={
            "score": 30, "decision": "REVISE", "feedback": "bad",
        })
        l3 = self._make_l3()
        l3._critic = critic
        l3.config = {"max_revisions": 2}
        state = BaseState()
        state["user_request"] = "write"
        result = l3.execute(state)
        assert result["decision"] == "HUMAN_REVIEW"
        assert result.get("requires_human_intervention") is True

    def test_plan_verify_fails(self):
        architect = MagicMock()
        # Return plan without phases output => verify fails
        architect.run = MagicMock(return_value={
            "phases": [{"name": "p1"}],  # No output field
            "plan": {"steps": [1]},
        })
        l3 = Level3Standard(architect=architect)
        state = BaseState()
        state["user_request"] = "write"
        result = l3.execute(state)
        assert result["decision"] == "HUMAN_REVIEW"

    def test_human_review_from_critic(self):
        critic = MagicMock()
        critic.run = MagicMock(return_value={
            "score": 40, "decision": "HUMAN_REVIEW", "feedback": "needs review",
        })
        l3 = self._make_l3()
        l3._critic = critic
        state = BaseState()
        state["user_request"] = "write"
        result = l3.execute(state)
        assert result["decision"] == "HUMAN_REVIEW"

    def test_score_threshold_approves(self):
        critic = MagicMock()
        critic.run = MagicMock(return_value={
            "score": 85, "decision": "REVISE", "feedback": "",
        })
        l3 = self._make_l3()
        l3._critic = critic
        l3.config = {"pass_score": 80}
        state = BaseState()
        state["user_request"] = "write"
        result = l3.execute(state)
        assert result["decision"] == "APPROVED"


# ============================================================
# Lazy agent getters
# ============================================================


    def test_get_architect_from_container_attr(self):
        l3 = Level3Standard()
        fake_architect = MagicMock()
        fake_container = MagicMock()
        fake_container.architect = fake_architect

        l3._get_container = MagicMock(return_value=fake_container)
        assert l3._get_architect() is fake_architect

    @patch("src.agents.architect.ArchitectAgent")
    def test_get_architect_fallback_create(self, mock_architect_cls):
        l3 = Level3Standard()
        fake_container = MagicMock(spec=[])
        created_architect = MagicMock()
        mock_architect_cls.return_value = created_architect

        l3._get_container = MagicMock(return_value=fake_container)
        assert l3._get_architect() is created_architect
        mock_architect_cls.assert_called_once_with(name="standard_architect")

    def test_get_critic_from_container_attr(self):
        l3 = Level3Standard()
        fake_critic = MagicMock()
        fake_container = MagicMock()
        fake_container.critic_agent = fake_critic

        l3._get_container = MagicMock(return_value=fake_container)
        assert l3._get_critic() is fake_critic

    @patch("src.agents.critic.CriticAgent")
    def test_get_critic_fallback_create(self, mock_critic_cls):
        l3 = Level3Standard()
        fake_container = MagicMock(spec=[])
        created_critic = MagicMock()
        mock_critic_cls.return_value = created_critic

        l3._get_container = MagicMock(return_value=fake_container)
        assert l3._get_critic() is created_critic
        mock_critic_cls.assert_called_once_with(name="standard_critic")


class TestLazyAgentGettersExtra:

    @patch("src.container.get_container")
    def test_get_container_delegates_to_global(self, mock_get_container):
        l3 = Level3Standard()
        fake_container = MagicMock()
        mock_get_container.return_value = fake_container

        result = l3._get_container()
        assert result is fake_container

    def test_get_writer_from_container(self):
        l3 = Level3Standard()
        fake_writer = MagicMock()
        fake_container = MagicMock()
        fake_container.writer = fake_writer

        l3._get_container = MagicMock(return_value=fake_container)
        assert l3._get_writer() is fake_writer
