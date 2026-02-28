# -*- coding: utf-8 -*-
"""
Level5Coordinator Tests

Tests for CommandType, ExecutionStatus, Command, CommandChain,
ExecutionUnit, RequirementAnalysis, CoordinatorState,
Level5Coordinator (analyze_requirements, recommend_chain,
execute_chain, persist_state, load_state, helper methods).
"""

import json
import pytest
from unittest.mock import MagicMock, patch
from pathlib import Path

from src.workflow.levels.level5_coordinator import (
    CommandType,
    ExecutionStatus,
    Command,
    CommandChain,
    ExecutionUnit,
    RequirementAnalysis,
    CoordinatorState,
    Level5Coordinator,
    CHAIN_TEMPLATES,
)
from src.workflow.base_state import BaseState


# ============================================================
# CommandType & ExecutionStatus
# ============================================================

class TestEnums:

    def test_command_type_values(self):
        assert CommandType.ANALYZE.value == "analyze"
        assert CommandType.PLAN.value == "plan"
        assert CommandType.EXECUTE.value == "execute"
        assert CommandType.VERIFY.value == "verify"
        assert CommandType.REVISE.value == "revise"

    def test_execution_status_values(self):
        assert ExecutionStatus.PENDING.value == "pending"
        assert ExecutionStatus.COMPLETED.value == "completed"
        assert ExecutionStatus.FAILED.value == "failed"


# ============================================================
# Command
# ============================================================

class TestCommand:

    def test_to_dict(self):
        cmd = Command("c1", CommandType.ANALYZE, "analyze", "desc", "coordinator")
        d = cmd.to_dict()
        assert d["command_id"] == "c1"
        assert d["command_type"] == "analyze"
        assert d["agent"] == "coordinator"

    def test_from_dict(self):
        d = {"command_id": "c2", "command_type": "plan", "name": "plan", "description": "d", "agent": "architect"}
        cmd = Command.from_dict(d)
        assert cmd.command_id == "c2"
        assert cmd.command_type == CommandType.PLAN

    def test_roundtrip(self):
        cmd = Command("c1", CommandType.EXECUTE, "exec", "d", "writer", {"k": "v"})
        restored = Command.from_dict(cmd.to_dict())
        assert restored.command_id == cmd.command_id
        assert restored.parameters == {"k": "v"}


# ============================================================
# CommandChain
# ============================================================

class TestCommandChain:

    def test_add_command(self):
        chain = CommandChain(chain_id="ch1", name="test", description="d")
        cmd1 = Command("c1", CommandType.ANALYZE, "a", "d", "coordinator")
        cmd2 = Command("c2", CommandType.EXECUTE, "e", "d", "writer")
        chain.add_command(cmd1)
        chain.add_command(cmd2, depends_on=["c1"])
        assert len(chain.commands) == 2
        assert chain.execution_order == ["c1", "c2"]

    def test_get_command(self):
        chain = CommandChain(chain_id="ch1", name="test", description="d")
        cmd = Command("c1", CommandType.ANALYZE, "a", "d", "coordinator")
        chain.add_command(cmd)
        assert chain.get_command("c1") is cmd
        assert chain.get_command("nonexistent") is None

    def test_to_dict(self):
        chain = CommandChain(chain_id="ch1", name="test", description="d")
        d = chain.to_dict()
        assert d["chain_id"] == "ch1"
        assert d["commands"] == []

    def test_from_dict(self):
        d = {
            "chain_id": "ch2",
            "name": "n",
            "description": "d",
            "commands": [
                {"command_id": "c1", "command_type": "analyze", "name": "a", "description": "d", "agent": "coord"},
            ],
            "dependencies": {"c1": []},
            "execution_order": ["c1"],
            "estimated_duration": 60,
        }
        chain = CommandChain.from_dict(d)
        assert chain.chain_id == "ch2"
        assert len(chain.commands) == 1
        assert chain.estimated_duration == 60

    def test_topo_sort(self):
        chain = CommandChain(chain_id="ch1", name="test", description="d")
        c1 = Command("c1", CommandType.ANALYZE, "a", "d", "coord")
        c2 = Command("c2", CommandType.PLAN, "p", "d", "arch")
        c3 = Command("c3", CommandType.EXECUTE, "e", "d", "writer")
        chain.add_command(c1)
        chain.add_command(c2, depends_on=["c1"])
        chain.add_command(c3, depends_on=["c1", "c2"])
        assert chain.execution_order.index("c1") < chain.execution_order.index("c2")
        assert chain.execution_order.index("c2") < chain.execution_order.index("c3")


# ============================================================
# ExecutionUnit
# ============================================================

class TestExecutionUnit:

    def test_start(self):
        cmd = Command("c1", CommandType.ANALYZE, "a", "d", "coord")
        unit = ExecutionUnit(unit_id="u1", command=cmd)
        unit.start()
        assert unit.state == ExecutionStatus.RUNNING
        assert unit.started_at is not None

    def test_complete(self):
        cmd = Command("c1", CommandType.ANALYZE, "a", "d", "coord")
        unit = ExecutionUnit(unit_id="u1", command=cmd)
        unit.start()
        unit.complete({"output": "done"})
        assert unit.state == ExecutionStatus.COMPLETED
        assert unit.result == {"output": "done"}
        assert unit.completed_at is not None

    def test_fail(self):
        cmd = Command("c1", CommandType.ANALYZE, "a", "d", "coord")
        unit = ExecutionUnit(unit_id="u1", command=cmd)
        unit.start()
        unit.fail("error message")
        assert unit.state == ExecutionStatus.FAILED
        assert unit.error == "error message"

    def test_can_retry(self):
        cmd = Command("c1", CommandType.ANALYZE, "a", "d", "coord")
        unit = ExecutionUnit(unit_id="u1", command=cmd, max_retries=2)
        assert unit.can_retry() is True
        unit.retry_count = 2
        assert unit.can_retry() is False

    def test_to_dict(self):
        cmd = Command("c1", CommandType.ANALYZE, "a", "d", "coord")
        unit = ExecutionUnit(unit_id="u1", command=cmd)
        d = unit.to_dict()
        assert d["unit_id"] == "u1"
        assert d["state"] == "pending"

    def test_from_dict(self):
        d = {
            "unit_id": "u2",
            "command": {"command_id": "c1", "command_type": "plan", "name": "p", "description": "d", "agent": "a"},
            "state": "completed",
            "result": {"x": 1},
            "error": None,
            "started_at": "2025-01-01T00:00:00",
            "completed_at": "2025-01-01T00:01:00",
            "retry_count": 1,
            "max_retries": 3,
        }
        unit = ExecutionUnit.from_dict(d)
        assert unit.unit_id == "u2"
        assert unit.state == ExecutionStatus.COMPLETED
        assert unit.retry_count == 1


# ============================================================
# RequirementAnalysis
# ============================================================

class TestRequirementAnalysis:

    def test_to_dict(self):
        ra = RequirementAnalysis(
            task_type="novel_creation",
            complexity=80,
            estimated_steps=7,
            required_agents=["architect"],
            suggested_chain="novel_creation",
            constraints=["字数限制"],
            risks=["高复杂度"],
        )
        d = ra.to_dict()
        assert d["task_type"] == "novel_creation"
        assert d["complexity"] == 80

    def test_from_dict(self):
        d = {
            "task_type": "chapter_revision",
            "complexity": 60,
            "estimated_steps": 4,
            "required_agents": ["writer"],
            "suggested_chain": "chapter_revision",
            "constraints": [],
            "risks": [],
        }
        ra = RequirementAnalysis.from_dict(d)
        assert ra.task_type == "chapter_revision"


# ============================================================
# CoordinatorState
# ============================================================

class TestCoordinatorState:

    def test_to_dict(self):
        cs = CoordinatorState(session_id="s1", created_at="t1", updated_at="t2")
        d = cs.to_dict()
        assert d["session_id"] == "s1"
        assert d["phase"] == "init"
        assert d["overall_progress"] == 0.0

    def test_from_dict(self):
        d = {
            "session_id": "s2",
            "created_at": "t1",
            "updated_at": "t2",
            "phase": "executing",
            "overall_progress": 50.0,
            "errors": ["err1"],
        }
        cs = CoordinatorState.from_dict(d)
        assert cs.session_id == "s2"
        assert cs.phase == "executing"
        assert cs.errors == ["err1"]

    def test_roundtrip_with_analysis(self):
        ra = RequirementAnalysis(
            task_type="novel_creation", complexity=80,
            estimated_steps=7, required_agents=["arch"],
            suggested_chain="novel_creation",
        )
        cs = CoordinatorState(session_id="s1", created_at="t", updated_at="t", requirement_analysis=ra)
        d = cs.to_dict()
        restored = CoordinatorState.from_dict(d)
        assert restored.requirement_analysis.task_type == "novel_creation"

    def test_roundtrip_with_chain(self):
        chain = CommandChain(chain_id="ch1", name="test", description="d")
        cs = CoordinatorState(session_id="s1", created_at="t", updated_at="t", command_chain=chain)
        d = cs.to_dict()
        restored = CoordinatorState.from_dict(d)
        assert restored.command_chain.chain_id == "ch1"


# ============================================================
# CHAIN_TEMPLATES
# ============================================================

class TestChainTemplates:

    def test_novel_creation_exists(self):
        assert "novel_creation" in CHAIN_TEMPLATES
        assert len(CHAIN_TEMPLATES["novel_creation"].commands) == 7

    def test_chapter_revision_exists(self):
        assert "chapter_revision" in CHAIN_TEMPLATES
        assert len(CHAIN_TEMPLATES["chapter_revision"].commands) == 4

    def test_brainstorm_synthesis_exists(self):
        assert "brainstorm_synthesis" in CHAIN_TEMPLATES


# ============================================================
# Level5Coordinator class attributes
# ============================================================

class TestLevel5CoordinatorClass:

    def test_class_attrs(self):
        assert Level5Coordinator.level == 5
        assert Level5Coordinator.name == "coordinator"

    def test_get_required_agents(self):
        with patch("src.workflow.levels.level5_coordinator.Path.mkdir"):
            l5 = Level5Coordinator(config={"persist_dir": "/tmp/test_l5"})
        agents = l5.get_required_agents()
        assert "coordinator" in agents
        assert "architect" in agents

    def test_get_default_config(self):
        with patch("src.workflow.levels.level5_coordinator.Path.mkdir"):
            l5 = Level5Coordinator(config={"persist_dir": "/tmp/test_l5"})
        cfg = l5.get_default_config()
        assert cfg["max_revisions"] == 10
        assert cfg["pass_score"] == 90
        assert cfg["retrieval_profile"] == "coordinator_quality"


# ============================================================
# analyze_requirements
# ============================================================

class TestAnalyzeRequirements:

    def test_novel_creation(self):
        with patch("src.workflow.levels.level5_coordinator.Path.mkdir"):
            l5 = Level5Coordinator(config={"persist_dir": "/tmp/test_l5"})
        result = l5.analyze_requirements({"user_request": "写一部长篇小说"})
        assert result.task_type == "novel_creation"
        assert result.suggested_chain == "novel_creation"
        assert result.estimated_steps == 7

    def test_chapter_revision(self):
        with patch("src.workflow.levels.level5_coordinator.Path.mkdir"):
            l5 = Level5Coordinator(config={"persist_dir": "/tmp/test_l5"})
        result = l5.analyze_requirements({"user_request": "修订第三章"})
        assert result.task_type == "chapter_revision"

    def test_brainstorm(self):
        with patch("src.workflow.levels.level5_coordinator.Path.mkdir"):
            l5 = Level5Coordinator(config={"persist_dir": "/tmp/test_l5"})
        result = l5.analyze_requirements({"user_request": "头脑风暴讨论剧情"})
        assert result.task_type == "brainstorm_synthesis"

    def test_high_complexity(self):
        with patch("src.workflow.levels.level5_coordinator.Path.mkdir"):
            l5 = Level5Coordinator(config={"persist_dir": "/tmp/test_l5"})
        long_text = "完整详细深入全面系统多章节" + "x" * 2500
        result = l5.analyze_requirements({"user_request": long_text})
        assert result.complexity > 80


# ============================================================
# _detect_task_type
# ============================================================

class TestDetectTaskType:

    def test_novel(self):
        with patch("src.workflow.levels.level5_coordinator.Path.mkdir"):
            l5 = Level5Coordinator(config={"persist_dir": "/tmp/test_l5"})
        assert l5._detect_task_type("写一部小说") == "novel_creation"

    def test_revision(self):
        with patch("src.workflow.levels.level5_coordinator.Path.mkdir"):
            l5 = Level5Coordinator(config={"persist_dir": "/tmp/test_l5"})
        assert l5._detect_task_type("修订这个章节") == "chapter_revision"

    def test_brainstorm(self):
        with patch("src.workflow.levels.level5_coordinator.Path.mkdir"):
            l5 = Level5Coordinator(config={"persist_dir": "/tmp/test_l5"})
        assert l5._detect_task_type("头脑风暴") == "brainstorm_synthesis"

    def test_default(self):
        with patch("src.workflow.levels.level5_coordinator.Path.mkdir"):
            l5 = Level5Coordinator(config={"persist_dir": "/tmp/test_l5"})
        assert l5._detect_task_type("random text") == "chapter_revision"


# ============================================================
# _estimate_complexity
# ============================================================

class TestEstimateComplexity:

    def test_base(self):
        with patch("src.workflow.levels.level5_coordinator.Path.mkdir"):
            l5 = Level5Coordinator(config={"persist_dir": "/tmp/test_l5"})
        c = l5._estimate_complexity("short", "")
        assert c == 60

    def test_long_text(self):
        with patch("src.workflow.levels.level5_coordinator.Path.mkdir"):
            l5 = Level5Coordinator(config={"persist_dir": "/tmp/test_l5"})
        c = l5._estimate_complexity("x" * 2500, "")
        assert c >= 80

    def test_complex_keywords(self):
        with patch("src.workflow.levels.level5_coordinator.Path.mkdir"):
            l5 = Level5Coordinator(config={"persist_dir": "/tmp/test_l5"})
        c = l5._estimate_complexity("完整详细深入", "")
        assert c >= 75

    def test_max_100(self):
        with patch("src.workflow.levels.level5_coordinator.Path.mkdir"):
            l5 = Level5Coordinator(config={"persist_dir": "/tmp/test_l5"})
        c = l5._estimate_complexity("完整详细深入全面系统多章节" + "x" * 3000, "")
        assert c <= 100


# ============================================================
# _determine_required_agents
# ============================================================

class TestDetermineRequiredAgents:

    def test_base_agents(self):
        with patch("src.workflow.levels.level5_coordinator.Path.mkdir"):
            l5 = Level5Coordinator(config={"persist_dir": "/tmp/test_l5"})
        agents = l5._determine_required_agents("novel_creation", 60)
        assert "coordinator" in agents
        assert "architect" in agents

    def test_high_complexity_adds_agents(self):
        with patch("src.workflow.levels.level5_coordinator.Path.mkdir"):
            l5 = Level5Coordinator(config={"persist_dir": "/tmp/test_l5"})
        agents = l5._determine_required_agents("novel_creation", 90)
        assert "researcher" in agents
        assert "devil_advocate" in agents

    def test_brainstorm_adds_roles(self):
        with patch("src.workflow.levels.level5_coordinator.Path.mkdir"):
            l5 = Level5Coordinator(config={"persist_dir": "/tmp/test_l5"})
        agents = l5._determine_required_agents("brainstorm_synthesis", 60)
        assert "optimist" in agents
        assert "realist" in agents


# ============================================================
# _extract_constraints
# ============================================================

class TestExtractConstraints:

    def test_finds_constraints(self):
        with patch("src.workflow.levels.level5_coordinator.Path.mkdir"):
            l5 = Level5Coordinator(config={"persist_dir": "/tmp/test_l5"})
        constraints = l5._extract_constraints("字数限制5000，不要太长，风格偏幽默，必须包含对话")
        assert "字数限制" in constraints
        assert "排除条件" in constraints
        assert "风格约束" in constraints
        assert "必要条件" in constraints

    def test_no_constraints(self):
        with patch("src.workflow.levels.level5_coordinator.Path.mkdir"):
            l5 = Level5Coordinator(config={"persist_dir": "/tmp/test_l5"})
        constraints = l5._extract_constraints("random text")
        assert constraints == []


# ============================================================
# _assess_risks
# ============================================================

class TestAssessRisksL5:

    def test_high_complexity_risk(self):
        with patch("src.workflow.levels.level5_coordinator.Path.mkdir"):
            l5 = Level5Coordinator(config={"persist_dir": "/tmp/test_l5"})
        risks = l5._assess_risks("novel_creation", 90)
        assert any("复杂度" in r for r in risks)
        assert any("一致性" in r for r in risks)

    def test_no_risks(self):
        with patch("src.workflow.levels.level5_coordinator.Path.mkdir"):
            l5 = Level5Coordinator(config={"persist_dir": "/tmp/test_l5"})
        risks = l5._assess_risks("chapter_revision", 60)
        assert risks == []


# ============================================================
# recommend_chain
# ============================================================

class TestRecommendChain:

    def test_known_template(self):
        with patch("src.workflow.levels.level5_coordinator.Path.mkdir"):
            l5 = Level5Coordinator(config={"persist_dir": "/tmp/test_l5"})
        ra = RequirementAnalysis(
            task_type="novel_creation", complexity=80,
            estimated_steps=7, required_agents=["arch"],
            suggested_chain="novel_creation",
        )
        chain = l5.recommend_chain(ra)
        assert len(chain.commands) == 7
        assert chain.chain_id.startswith("chain_")
        assert len(chain.execution_order) == 7

    def test_unknown_template_defaults(self):
        with patch("src.workflow.levels.level5_coordinator.Path.mkdir"):
            l5 = Level5Coordinator(config={"persist_dir": "/tmp/test_l5"})
        ra = RequirementAnalysis(
            task_type="unknown", complexity=50,
            estimated_steps=3, required_agents=["writer"],
            suggested_chain="nonexistent",
        )
        chain = l5.recommend_chain(ra)
        assert len(chain.commands) == 3  # default chain


# ============================================================
# _select_execution_branch
# ============================================================

class TestSelectExecutionBranch:

    def test_lite_param(self):
        with patch("src.workflow.levels.level5_coordinator.Path.mkdir"):
            l5 = Level5Coordinator(config={"persist_dir": "/tmp/test_l5"})
        cmd = Command("c1", CommandType.EXECUTE, "e", "d", "w", {"workflow_branch": "lite"})
        assert l5._select_execution_branch(cmd) == "lite"

    def test_brainstorm_param(self):
        with patch("src.workflow.levels.level5_coordinator.Path.mkdir"):
            l5 = Level5Coordinator(config={"persist_dir": "/tmp/test_l5"})
        cmd = Command("c1", CommandType.EXECUTE, "e", "d", "w", {"workflow_branch": "brainstorm"})
        assert l5._select_execution_branch(cmd) == "brainstorm"

    def test_default_standard(self):
        with patch("src.workflow.levels.level5_coordinator.Path.mkdir"):
            l5 = Level5Coordinator(config={"persist_dir": "/tmp/test_l5"})
        cmd = Command("c1", CommandType.EXECUTE, "e", "d", "w")
        assert l5._select_execution_branch(cmd) == "standard"

    def test_brainstorm_from_requirement(self):
        with patch("src.workflow.levels.level5_coordinator.Path.mkdir"):
            l5 = Level5Coordinator(config={"persist_dir": "/tmp/test_l5"})
        l5._coordinator_state = CoordinatorState(
            session_id="s", created_at="t", updated_at="t",
            requirement_analysis=RequirementAnalysis(
                task_type="brainstorm_synthesis", complexity=70,
                estimated_steps=5, required_agents=["arch"],
                suggested_chain="brainstorm_synthesis",
            ),
        )
        cmd = Command("c1", CommandType.EXECUTE, "e", "d", "w")
        assert l5._select_execution_branch(cmd) == "brainstorm"


# ============================================================
# persist_state & load_state
# ============================================================

class TestPersistAndLoad:

    def test_roundtrip(self, tmp_path):
        with patch("src.workflow.levels.level5_coordinator.SessionManager"):
            l5 = Level5Coordinator(config={"persist_dir": str(tmp_path)})
            cs = CoordinatorState(session_id="test_session", created_at="t1", updated_at="t2", phase="executing")
            sid = l5.persist_state(cs)
            assert sid == "test_session"

            loaded = l5.load_state("test_session")
            assert loaded is not None
            assert loaded.session_id == "test_session"
            assert loaded.phase == "executing"

    def test_load_nonexistent(self, tmp_path):
        with patch("src.workflow.levels.level5_coordinator.SessionManager"):
            l5 = Level5Coordinator(config={"persist_dir": str(tmp_path)})
            assert l5.load_state("nonexistent") is None


# ============================================================
# _all_units_completed
# ============================================================

class TestAllUnitsCompleted:

    def test_all_completed(self):
        with patch("src.workflow.levels.level5_coordinator.Path.mkdir"):
            l5 = Level5Coordinator(config={"persist_dir": "/tmp/test_l5"})
        cmd = Command("c1", CommandType.ANALYZE, "a", "d", "coord")
        u1 = ExecutionUnit(unit_id="u1", command=cmd, state=ExecutionStatus.COMPLETED)
        u2 = ExecutionUnit(unit_id="u2", command=cmd, state=ExecutionStatus.SKIPPED)
        l5._coordinator_state = CoordinatorState(session_id="s", created_at="t", updated_at="t")
        l5._coordinator_state.execution_units = [u1, u2]
        assert l5._all_units_completed() is True

    def test_not_completed(self):
        with patch("src.workflow.levels.level5_coordinator.Path.mkdir"):
            l5 = Level5Coordinator(config={"persist_dir": "/tmp/test_l5"})
        cmd = Command("c1", CommandType.ANALYZE, "a", "d", "coord")
        u1 = ExecutionUnit(unit_id="u1", command=cmd, state=ExecutionStatus.RUNNING)
        l5._coordinator_state = CoordinatorState(session_id="s", created_at="t", updated_at="t")
        l5._coordinator_state.execution_units = [u1]
        assert l5._all_units_completed() is False


# ============================================================
# _check_dependencies_completed
# ============================================================

class TestCheckDependenciesCompleted:

    def test_deps_met(self):
        with patch("src.workflow.levels.level5_coordinator.Path.mkdir"):
            l5 = Level5Coordinator(config={"persist_dir": "/tmp/test_l5"})
        cmd1 = Command("c1", CommandType.ANALYZE, "a", "d", "coord")
        u1 = ExecutionUnit(unit_id="u1", command=cmd1, state=ExecutionStatus.COMPLETED)
        assert l5._check_dependencies_completed(["c1"], [u1]) is True

    def test_deps_not_met(self):
        with patch("src.workflow.levels.level5_coordinator.Path.mkdir"):
            l5 = Level5Coordinator(config={"persist_dir": "/tmp/test_l5"})
        cmd1 = Command("c1", CommandType.ANALYZE, "a", "d", "coord")
        u1 = ExecutionUnit(unit_id="u1", command=cmd1, state=ExecutionStatus.PENDING)
        assert l5._check_dependencies_completed(["c1"], [u1]) is False

    def test_no_deps(self):
        with patch("src.workflow.levels.level5_coordinator.Path.mkdir"):
            l5 = Level5Coordinator(config={"persist_dir": "/tmp/test_l5"})
        assert l5._check_dependencies_completed([], []) is True


# ============================================================
# _create_default_chain
# ============================================================

class TestCreateDefaultChain:

    def test_returns_chain(self):
        with patch("src.workflow.levels.level5_coordinator.Path.mkdir"):
            l5 = Level5Coordinator(config={"persist_dir": "/tmp/test_l5"})
        chain = l5._create_default_chain()
        assert len(chain.commands) == 3
        types = [c.command_type for c in chain.commands]
        assert CommandType.ANALYZE in types
        assert CommandType.EXECUTE in types
        assert CommandType.VERIFY in types
