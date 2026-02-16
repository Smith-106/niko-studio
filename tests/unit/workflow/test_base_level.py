# -*- coding: utf-8 -*-
"""
BaseLevel & LevelRegistry Tests

Tests for src/workflow/levels/base_level.py
"""

from src.workflow.base_state import BaseState
from src.workflow.levels.base_level import BaseLevel, LevelRegistry


class _Level1(BaseLevel):
    level = 1

    def execute(self, state: BaseState, **kwargs) -> BaseState:
        state["done"] = True
        return state

    def get_required_agents(self):
        return ["writer"]


class _Level3(BaseLevel):
    level = 3

    def execute(self, state: BaseState, **kwargs) -> BaseState:
        state["done"] = True
        return state

    def get_required_agents(self):
        return ["writer", "critic"]


class _LegacyCtorLevel(BaseLevel):
    level = 2

    def __init__(self, cfg=None):
        self.config = cfg or {}

    def execute(self, state: BaseState, **kwargs) -> BaseState:
        return state

    def get_required_agents(self):
        return []


class TestBaseLevel:
    def test_init_and_defaults(self):
        level = _Level1(config={"k": "v"})
        assert level.config["k"] == "v"
        cfg = level.get_default_config()
        assert cfg["max_revisions"] == 3
        assert cfg["pass_score"] == 80
        assert cfg["verbose"] is True

    def test_supports_resume_boundary(self):
        assert _Level1().supports_resume() is False
        assert _Level3().supports_resume() is True

    def test_requires_persistence_boundary(self):
        assert _Level1().requires_persistence() is False
        assert _LegacyCtorLevel().requires_persistence() is True

    def test_execute_and_required_agents(self):
        level = _Level1()
        state = BaseState()
        result = level.execute(state)
        assert result["done"] is True
        assert level.get_required_agents() == ["writer"]


class TestBaseLevelAbstractPassLines:
    def test_abstract_pass_lines_are_executable(self):
        dummy = object()
        assert BaseLevel.execute(dummy, {}) is None
        assert BaseLevel.get_required_agents(dummy) is None


class TestLevelRegistry:
    def setup_method(self):
        self._backup = dict(LevelRegistry._levels)

    def teardown_method(self):
        LevelRegistry._levels = dict(self._backup)

    def test_register_and_get(self):
        @LevelRegistry.register(91)
        class _R(_Level1):
            pass

        assert LevelRegistry.get(91) is _R

    def test_get_missing(self):
        assert LevelRegistry.get(9999) is None

    def test_create_missing_returns_none(self):
        assert LevelRegistry.create(9999) is None

    def test_create_uses_keyword_config(self):
        @LevelRegistry.register(92)
        class _Kw(_Level1):
            pass

        obj = LevelRegistry.create(92, config={"x": 1})
        assert isinstance(obj, _Kw)
        assert obj.config["x"] == 1

    def test_create_falls_back_to_positional_config(self):
        @LevelRegistry.register(93)
        class _Pos(_LegacyCtorLevel):
            pass

        obj = LevelRegistry.create(93, config={"y": 2})
        assert isinstance(obj, _Pos)
        assert obj.config["y"] == 2
