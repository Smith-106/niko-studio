# -*- coding: utf-8 -*-
"""Level5Coordinator internal methods tests."""

import pytest
import json
from unittest.mock import MagicMock, patch
from pathlib import Path

from src.workflow.levels.level5_coordinator import (
    Level5Coordinator, Command, CommandType, CommandChain,
    ExecutionUnit, ExecutionStatus, CoordinatorState, RequirementAnalysis,
)


@pytest.fixture()
def coordinator():
    with patch("src.workflow.levels.level5_coordinator.SessionManager"):
        c = Level5Coordinator(config={})
    return c


class TestDetectTaskType:
    def test_novel(self, coordinator):
        assert coordinator._detect_task_type("写一部小说") == "novel_creation"

    def test_creation(self, coordinator):
        assert coordinator._detect_task_type("创作一个故事") == "novel_creation"

    def test_revision(self, coordinator):
        assert coordinator._detect_task_type("修订第三章") == "chapter_revision"

    def test_brainstorm(self, coordinator):
        assert coordinator._detect_task_type("头脑风暴讨论") == "brainstorm_synthesis"

    def test_default(self, coordinator):
        assert coordinator._detect_task_type("do something") == "chapter_revision"


class TestEstimateComplexity:
    def test_baseline(self, coordinator):
        assert coordinator._estimate_complexity("short", "") == 60

    def test_long_text(self, coordinator):
        assert coordinator._estimate_complexity("x" * 2001, "") == 80

    def test_medium_text(self, coordinator):
        assert coordinator._estimate_complexity("x" * 501, "") == 70

    def test_keywords(self, coordinator):
        result = coordinator._estimate_complexity("完整详细深入全面系统多章节", "")
        assert result == 90  # 60 + 6*5

    def test_cap_at_100(self, coordinator):
        result = coordinator._estimate_complexity("完整详细深入全面系统多章节" + "x" * 2001, "")
        assert result == 100


class TestDetermineRequiredAgents:
    def test_base(self, coordinator):
        agents = coordinator._determine_required_agents("chapter_revision", 60)
        assert "coordinator" in agents
        assert "writer" in agents

    def test_high_complexity(self, coordinator):
        agents = coordinator._determine_required_agents("chapter_revision", 85)
        assert "researcher" in agents
        assert "devil_advocate" in agents

    def test_brainstorm(self, coordinator):
        agents = coordinator._determine_required_agents("brainstorm_synthesis", 60)
        assert "optimist" in agents
        assert "realist" in agents


class TestExtractConstraints:
    def test_word_count(self, coordinator):
        assert "字数限制" in coordinator._extract_constraints("字数不超过1000")

    def test_exclusion(self, coordinator):
        assert "排除条件" in coordinator._extract_constraints("不要写爱情")

    def test_required(self, coordinator):
        assert "必要条件" in coordinator._extract_constraints("必须包含悬疑")

    def test_style(self, coordinator):
        assert "风格约束" in coordinator._extract_constraints("风格要轻松")

    def test_none(self, coordinator):
        assert coordinator._extract_constraints("plain text") == []


class TestAssessRisks:
    def test_high_complexity(self, coordinator):
        risks = coordinator._assess_risks("chapter_revision", 90)
        assert len(risks) > 0

    def test_novel_creation(self, coordinator):
        risks = coordinator._assess_risks("novel_creation", 60)
        assert len(risks) > 0

    def test_no_risks(self, coordinator):
        assert coordinator._assess_risks("chapter_revision", 60) == []


class TestSelectExecutionBranch:
    def test_lite(self, coordinator):
        cmd = Command("c1", CommandType.EXECUTE, "exec", "desc", "writer",
                      parameters={"workflow_branch": "lite"})
        assert coordinator._select_execution_branch(cmd) == "lite"

    def test_brainstorm_param(self, coordinator):
        cmd = Command("c1", CommandType.EXECUTE, "exec", "desc", "writer",
                      parameters={"workflow_branch": "brainstorm"})
        assert coordinator._select_execution_branch(cmd) == "brainstorm"

    def test_brainstorm_from_analysis(self, coordinator):
        cmd = Command("c1", CommandType.EXECUTE, "exec", "desc", "writer")
        coordinator._coordinator_state = CoordinatorState(
            session_id="s1", created_at="", updated_at=""
        )
        coordinator._coordinator_state.requirement_analysis = RequirementAnalysis(
            task_type="brainstorm_synthesis", complexity=60,
            estimated_steps=3, required_agents=[],
            suggested_chain="brainstorm_synthesis",
            constraints=[], risks=[],
        )
        assert coordinator._select_execution_branch(cmd) == "brainstorm"

    def test_default_standard(self, coordinator):
        cmd = Command("c1", CommandType.EXECUTE, "exec", "desc", "writer")
        coordinator._coordinator_state = None
        assert coordinator._select_execution_branch(cmd) == "standard"


class TestAllUnitsCompleted:
    def test_all_completed(self, coordinator):
        u1 = MagicMock(state=ExecutionStatus.COMPLETED)
        u2 = MagicMock(state=ExecutionStatus.SKIPPED)
        coordinator._coordinator_state = MagicMock(execution_units=[u1, u2])
        assert coordinator._all_units_completed() is True

    def test_not_all(self, coordinator):
        u1 = MagicMock(state=ExecutionStatus.COMPLETED)
        u2 = MagicMock(state=ExecutionStatus.RUNNING)
        coordinator._coordinator_state = MagicMock(execution_units=[u1, u2])
        assert coordinator._all_units_completed() is False


class TestCheckDependenciesCompleted:
    def test_deps_met(self, coordinator):
        u1 = MagicMock()
        u1.command.command_id = "d1"
        u1.state = ExecutionStatus.COMPLETED
        assert coordinator._check_dependencies_completed(["d1"], [u1]) is True

    def test_deps_not_met(self, coordinator):
        u1 = MagicMock()
        u1.command.command_id = "d1"
        u1.state = ExecutionStatus.RUNNING
        assert coordinator._check_dependencies_completed(["d1"], [u1]) is False

    def test_no_deps(self, coordinator):
        assert coordinator._check_dependencies_completed([], []) is True


class TestCreateDefaultChain:
    def test_creates_chain(self, coordinator):
        chain = coordinator._create_default_chain()
        assert isinstance(chain, CommandChain)
        assert len(chain.commands) == 3


class TestPersistAndLoadState:
    def test_persist_and_load(self, coordinator, tmp_path):
        coordinator.persist_dir = tmp_path
        cs = CoordinatorState(
            session_id="test-sess", created_at="2024-01-01", updated_at="2024-01-01"
        )
        with patch("src.workflow.levels.level5_coordinator.SessionManager"):
            sid = coordinator.persist_state(cs)
        assert sid == "test-sess"
        assert (tmp_path / "test-sess.json").exists()

        with patch("src.workflow.levels.level5_coordinator.SessionManager") as mock_sm:
            mock_sm.return_value.read.return_value = None
            loaded = coordinator.load_state("test-sess")
        assert loaded is not None
        assert loaded.session_id == "test-sess"

    def test_load_nonexistent(self, coordinator, tmp_path):
        coordinator.persist_dir = tmp_path
        with patch("src.workflow.levels.level5_coordinator.SessionManager") as mock_sm:
            mock_sm.return_value.read.return_value = None
            assert coordinator.load_state("nonexistent") is None

    def test_persist_session_manager_failure(self, coordinator, tmp_path):
        coordinator.persist_dir = tmp_path
        cs = CoordinatorState(
            session_id="test-fail", created_at="2024-01-01", updated_at="2024-01-01"
        )
        with patch("src.workflow.levels.level5_coordinator.SessionManager") as mock_sm:
            mock_sm.return_value.write.side_effect = RuntimeError("fail")
            sid = coordinator.persist_state(cs)
        assert sid == "test-fail"
        assert (tmp_path / "test-fail.json").exists()


class TestSuggestChainTemplate:
    def test_known_type(self, coordinator):
        result = coordinator._suggest_chain_template("novel_creation", 60)
        assert result == "novel_creation"

    def test_unknown_type(self, coordinator):
        result = coordinator._suggest_chain_template("unknown_xyz", 60)
        assert result == "chapter_revision"
