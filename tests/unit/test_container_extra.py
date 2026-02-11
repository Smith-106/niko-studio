# -*- coding: utf-8 -*-
"""ServiceContainer tests - get_container, reset, mock injection, engine loading, plugins."""

import pytest
from unittest.mock import MagicMock, patch

from src.container import ServiceContainer, get_container, reset_container


@pytest.fixture(autouse=True)
def clean_container():
    reset_container()
    yield
    reset_container()


class TestContainerGlobals:
    def test_get_container_singleton(self):
        c1 = get_container()
        c2 = get_container()
        assert c1 is c2

    def test_reset_container(self):
        c1 = get_container()
        reset_container()
        c2 = get_container()
        assert c1 is not c2


class TestServiceContainer:
    def test_init(self):
        sc = ServiceContainer()
        assert sc._engines == {}
        assert sc._mocks == {}
        assert sc._initialized is False

    def test_reset(self):
        sc = ServiceContainer()
        sc._engines["test"] = "value"
        sc._mocks["mock"] = "m"
        sc._engine_plugins_cache["k"] = []
        sc.reset()
        assert sc._engines == {}
        assert sc._mocks == {}
        assert sc._engine_plugins_cache == {}
        assert sc._initialized is False

    def test_register_mock(self):
        sc = ServiceContainer()
        mock = MagicMock()
        sc.register_mock("memory", mock)
        assert sc._mocks["memory"] is mock

    def test_get_or_create_returns_mock(self):
        sc = ServiceContainer()
        mock = MagicMock()
        sc.register_mock("test_engine", mock)
        result = sc._get_or_create("test_engine", lambda: "real")
        assert result is mock

    def test_get_or_create_creates_engine(self):
        sc = ServiceContainer()
        result = sc._get_or_create("eng", lambda: "created")
        assert result == "created"

    def test_get_or_create_caches(self):
        sc = ServiceContainer()
        call_count = 0
        def factory():
            nonlocal call_count
            call_count += 1
            return f"engine_{call_count}"
        r1 = sc._get_or_create("eng", factory)
        r2 = sc._get_or_create("eng", factory)
        assert r1 == r2
        assert call_count == 1

    def test_load_engine_plugins_disabled(self):
        sc = ServiceContainer()
        config = MagicMock()
        config.enabled = False
        result = sc._load_engine_plugins(config)
        assert result == []

    def test_load_engine_plugins_cached(self):
        sc = ServiceContainer()
        sc._engine_plugins_cache["mod1.Cls"] = ["cached"]
        config = MagicMock()
        config.enabled = True
        config.modules = ["mod1.Cls"]
        result = sc._load_engine_plugins(config)
        assert result == ["cached"]

    def test_load_engine_plugins_import_error(self):
        sc = ServiceContainer()
        config = MagicMock()
        config.enabled = True
        config.modules = ["nonexistent.module.Plugin"]
        result = sc._load_engine_plugins(config)
        assert result == []

    @patch("src.config.get_config_value", return_value=False)
    def test_load_gateway_engine_config(self, mock_gcv):
        sc = ServiceContainer()
        cfg = sc._load_gateway_engine_config()
        assert cfg.memory_plugins.enabled is False
        assert cfg.graph_plugins.enabled is False
        assert cfg.critic_plugins.enabled is False
