# -*- coding: utf-8 -*-
"""
Level1Rapid Tests

Tests for Level1Rapid (class attributes, init, execute,
get_required_agents, _build_prompt, _get_writer).
"""

import pytest
from unittest.mock import MagicMock, patch

from src.workflow.levels.level1_rapid import Level1Rapid
from src.workflow.base_state import BaseState
from src.agents.base import AgentType


# ============================================================
# Class attributes
# ============================================================

class TestLevel1RapidClass:

    def test_class_attrs(self):
        assert Level1Rapid.level == 1
        assert Level1Rapid.name == "rapid"

    def test_get_required_agents(self):
        l1 = Level1Rapid()
        agents = l1.get_required_agents()
        assert agents == ["writer"]


# ============================================================
# Init
# ============================================================

class TestLevel1RapidInit:

    def test_default_init(self):
        l1 = Level1Rapid()
        assert l1._writer is None

    def test_injected_writer(self):
        w = MagicMock()
        l1 = Level1Rapid(writer=w)
        assert l1._writer is w

    def test_with_config(self):
        l1 = Level1Rapid(config={"key": "val"})
        assert l1.config["key"] == "val"

    def test_with_container(self):
        container = MagicMock()
        l1 = Level1Rapid(container=container)
        assert l1._container is container


# ============================================================
# _get_writer
# ============================================================

class TestGetWriter:

    def test_returns_injected(self):
        w = MagicMock()
        l1 = Level1Rapid(writer=w)
        assert l1._get_writer() is w

    def test_lazy_loads_from_container(self):
        mock_writer = MagicMock()
        mock_container = MagicMock()
        mock_container.get_agent = MagicMock(return_value=mock_writer)

        l1 = Level1Rapid(container=mock_container)
        writer = l1._get_writer()

        mock_container.get_agent.assert_called_once_with(AgentType.WRITER)
        assert writer is mock_writer


# ============================================================
# _build_prompt
# ============================================================

class TestBuildPrompt:

    def test_basic(self):
        l1 = Level1Rapid()
        prompt = l1._build_prompt("修正错字")
        assert "修正错字" in prompt
        assert "直接" in prompt

    def test_with_context(self):
        l1 = Level1Rapid()
        prompt = l1._build_prompt("任务", "背景信息")
        assert "背景信息" in prompt
        assert "上下文" in prompt

    def test_without_context(self):
        l1 = Level1Rapid()
        prompt = l1._build_prompt("任务", "")
        assert "上下文" not in prompt


# ============================================================
# execute
# ============================================================

class TestExecute:

    def test_success(self):
        writer = MagicMock()
        writer.run = MagicMock(return_value={"content": "result text"})
        l1 = Level1Rapid(writer=writer)
        state = BaseState()
        state["user_request"] = "fix typo"
        result = l1.execute(state)
        assert result["decision"] == "APPROVED"
        assert result["final_output"] == "result text"

    def test_failure(self):
        writer = MagicMock()
        writer.run = MagicMock(side_effect=RuntimeError("fail"))
        l1 = Level1Rapid(writer=writer)
        state = BaseState()
        state["user_request"] = "fix"
        result = l1.execute(state)
        assert result["decision"] == "FAILED"
        assert "errors" in result
        assert any("fail" in e for e in result["errors"])

    def test_with_context(self):
        writer = MagicMock()
        writer.run = MagicMock(return_value={"content": "ok"})
        l1 = Level1Rapid(writer=writer)
        state = BaseState()
        state["user_request"] = "task"
        state["context"] = "extra info"
        result = l1.execute(state)
        assert result["decision"] == "APPROVED"
        # Verify context was passed in prompt
        call_args = writer.run.call_args[0][0]
        assert "extra info" in call_args["prompt"]

    def test_empty_content(self):
        writer = MagicMock()
        writer.run = MagicMock(return_value={})
        l1 = Level1Rapid(writer=writer)
        state = BaseState()
        state["user_request"] = "test"
        result = l1.execute(state)
        assert result["decision"] == "APPROVED"
        assert result["final_output"] == ""
