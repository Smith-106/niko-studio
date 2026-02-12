# -*- coding: utf-8 -*-
"""
ConfigManager Tests

Tests for ConfigSource, ConfigValue, ConfigChangeEvent, ConfigFileHandler,
dataclass configs, ConfigManager (singleton, load, env, file, set/get,
listeners, reload, shutdown, to_dict), and convenience functions.
"""

import os
import time
import pytest
import yaml
from pathlib import Path
from unittest.mock import patch, MagicMock
from watchdog.events import FileModifiedEvent

from src.config import (
    ConfigSource,
    ConfigValue,
    ConfigChangeEvent,
    ConfigFileHandler,
    AgentConfig,
    MemoryConfig,
    WorkflowConfig,
    GraphConfig,
    WritingConfig,
    BackupConfig,
    TokenConfig,
    ObsidianConfig,
    AppConfig,
    ConfigManager,
    validate_environment,
    ensure_environment,
    init_config,
    get_config,
    get_config_value,
    set_config_value,
)


# ============================================================
# ConfigSource
# ============================================================

class TestConfigSource:

    def test_values(self):
        assert ConfigSource.DEFAULT.value == "default"
        assert ConfigSource.ENV.value == "environment"
        assert ConfigSource.FILE.value == "file"
        assert ConfigSource.OVERRIDE.value == "override"


# ============================================================
# ConfigValue
# ============================================================

class TestConfigValue:

    def test_creation(self):
        cv = ConfigValue(value="test", source=ConfigSource.DEFAULT, key="k")
        assert cv.value == "test"
        assert cv.source == ConfigSource.DEFAULT
        assert cv.key == "k"
        assert cv.timestamp > 0

    def test_repr(self):
        cv = ConfigValue(value=42, source=ConfigSource.ENV, key="num")
        r = repr(cv)
        assert "num" in r
        assert "42" in r
        assert "environment" in r


# ============================================================
# ConfigChangeEvent
# ============================================================

class TestConfigChangeEvent:

    def test_creation(self):
        evt = ConfigChangeEvent("key", "old", "new", ConfigSource.OVERRIDE)
        assert evt.key == "key"
        assert evt.old_value == "old"
        assert evt.new_value == "new"
        assert evt.source == ConfigSource.OVERRIDE
        assert evt.timestamp > 0


# ============================================================
# ConfigFileHandler
# ============================================================

class TestConfigFileHandler:

    def test_ignores_non_file_modified(self, tmp_path):
        mgr = MagicMock()
        handler = ConfigFileHandler(mgr, tmp_path / "config.yaml")
        from watchdog.events import DirModifiedEvent
        handler.on_modified(DirModifiedEvent(str(tmp_path)))
        mgr._reload_from_file.assert_not_called()

    def test_ignores_wrong_file(self, tmp_path):
        cfg = tmp_path / "config.yaml"
        cfg.touch()
        mgr = MagicMock()
        handler = ConfigFileHandler(mgr, cfg)
        other = tmp_path / "other.yaml"
        other.touch()
        handler.on_modified(FileModifiedEvent(str(other)))
        mgr._reload_from_file.assert_not_called()

    def test_debounce(self, tmp_path):
        cfg = tmp_path / "config.yaml"
        cfg.touch()
        mgr = MagicMock()
        handler = ConfigFileHandler(mgr, cfg)
        handler._debounce_seconds = 10
        # First call should trigger
        handler.on_modified(FileModifiedEvent(str(cfg)))
        assert mgr._reload_from_file.call_count == 1
        # Second call within debounce should not
        handler.on_modified(FileModifiedEvent(str(cfg)))
        assert mgr._reload_from_file.call_count == 1


# ============================================================
# Dataclass configs
# ============================================================

class TestDataclassConfigs:

    def test_agent_config_defaults(self):
        c = AgentConfig()
        assert c.default_model == "gpt-4o"
        assert c.max_cost_per_request == 1.0

    def test_memory_config_defaults(self):
        c = MemoryConfig()
        assert c.chunk_size == 1000
        assert c.cache_enabled is True

    def test_workflow_config_defaults(self):
        c = WorkflowConfig()
        assert c.session_timeout == 3600

    def test_graph_config_defaults(self):
        c = GraphConfig()
        assert c.max_connections == 10

    def test_writing_config_defaults(self):
        c = WritingConfig()
        assert c.scene_coherence_threshold == 0.8

    def test_backup_config_defaults(self):
        c = BackupConfig()
        assert c.compress is True
        assert c.webdav_enabled is False
        assert c.s3_enabled is False

    def test_token_config_defaults(self):
        c = TokenConfig()
        assert c.default_budget == 10.0

    def test_obsidian_config_defaults(self):
        c = ObsidianConfig()
        assert c.enabled is True
        assert c.auto_discover is True

    def test_app_config_defaults(self):
        c = AppConfig()
        assert c.app_name == "niko-studio"
        assert c.debug is False
        assert c.env == "development"
        assert isinstance(c.agent, AgentConfig)
        assert isinstance(c.memory, MemoryConfig)


# ============================================================
# ConfigManager
# ============================================================

@pytest.fixture(autouse=True)
def reset_config_singleton():
    """Reset ConfigManager singleton before each test."""
    ConfigManager.reset_instance()
    import src.config as cfg_mod
    cfg_mod._config_manager = None
    yield
    ConfigManager.reset_instance()
    cfg_mod._config_manager = None


class TestConfigManagerInit:

    def test_creates_without_path(self):
        cm = ConfigManager(config_path=None, hot_reload=False)
        assert cm.config is not None
        assert cm.config.app_name == "niko-studio"

    def test_creates_default_file(self, tmp_path):
        cfg = tmp_path / "sub" / "config.yaml"
        cm = ConfigManager(config_path=str(cfg), hot_reload=False, auto_create=True)
        assert cfg.exists()
        content = yaml.safe_load(cfg.read_text(encoding="utf-8"))
        assert content["app_name"] == "niko-studio"

    def test_no_auto_create(self, tmp_path):
        cfg = tmp_path / "missing.yaml"
        cm = ConfigManager(config_path=str(cfg), hot_reload=False, auto_create=False)
        assert not cfg.exists()


class TestConfigManagerLoadFromFile:

    def test_loads_from_yaml(self, tmp_path):
        cfg = tmp_path / "config.yaml"
        cfg.write_text(yaml.dump({
            "app_name": "test-app",
            "debug": True,
            "env": "production",
            "agent": {"default_model": "gpt-3.5"},
            "memory": {"chunk_size": 500},
            "workflow": {"session_timeout": 7200},
            "graph": {"max_connections": 5},
            "writing": {"scene_coherence_threshold": 0.9},
        }), encoding="utf-8")
        cm = ConfigManager(config_path=str(cfg), hot_reload=False)
        assert cm.config.app_name == "test-app"
        assert cm.config.debug is True
        assert cm.config.env == "production"
        assert cm.config.agent.default_model == "gpt-3.5"
        assert cm.config.memory.chunk_size == 500
        assert cm.config.workflow.session_timeout == 7200
        assert cm.config.graph.max_connections == 5
        assert cm.config.writing.scene_coherence_threshold == 0.9

    def test_loads_data_dir(self, tmp_path):
        cfg = tmp_path / "config.yaml"
        cfg.write_text(yaml.dump({"data_dir": "/custom/data"}), encoding="utf-8")
        cm = ConfigManager(config_path=str(cfg), hot_reload=False)
        assert cm.config.data_dir == "/custom/data"

    def test_loads_version_from_file(self, tmp_path):
        cfg = tmp_path / "config.yaml"
        cfg.write_text(yaml.dump({"version": "9.9.9"}), encoding="utf-8")
        cm = ConfigManager(config_path=str(cfg), hot_reload=False)
        assert cm.config.version == "9.9.9"

    def test_bad_yaml_does_not_crash(self, tmp_path):
        cfg = tmp_path / "config.yaml"
        cfg.write_text("{bad yaml: [", encoding="utf-8")
        # Should not raise
        cm = ConfigManager(config_path=str(cfg), hot_reload=False)
        assert cm.config.app_name == "niko-studio"

    def test_empty_yaml(self, tmp_path):
        cfg = tmp_path / "config.yaml"
        cfg.write_text("", encoding="utf-8")
        cm = ConfigManager(config_path=str(cfg), hot_reload=False)
        assert cm.config.app_name == "niko-studio"


class TestConfigManagerLoadFromEnv:

    def test_env_debug(self):
        with patch.dict(os.environ, {"NIKO_DEBUG": "true"}, clear=False):
            cm = ConfigManager(config_path=None, hot_reload=False)
            assert cm.config.debug is True

    def test_env_model(self):
        with patch.dict(os.environ, {"NIKO_DEFAULT_MODEL": "claude-3"}, clear=False):
            cm = ConfigManager(config_path=None, hot_reload=False)
            assert cm.config.agent.default_model == "claude-3"

    def test_env_vector_db_path(self):
        with patch.dict(os.environ, {"NIKO_VECTOR_DB_PATH": "/vec"}, clear=False):
            cm = ConfigManager(config_path=None, hot_reload=False)
            assert cm.config.memory.vector_db_path == "/vec"

    def test_env_graph_db_path(self):
        with patch.dict(os.environ, {"NIKO_GRAPH_DB_PATH": "/graph"}, clear=False):
            cm = ConfigManager(config_path=None, hot_reload=False)
            assert cm.config.graph.db_path == "/graph"

    def test_env_niko_env(self):
        with patch.dict(os.environ, {"NIKO_ENV": "staging"}, clear=False):
            cm = ConfigManager(config_path=None, hot_reload=False)
            assert cm.config.env == "staging"

    def test_env_cost_limits(self):
        with patch.dict(os.environ, {
            "NIKO_MAX_COST_PER_REQUEST": "2.5",
            "NIKO_MAX_COST_PER_SESSION": "25.0",
        }, clear=False):
            cm = ConfigManager(config_path=None, hot_reload=False)
            assert cm.config.agent.max_cost_per_request == 2.5
            assert cm.config.agent.max_cost_per_session == 25.0

    def test_env_api_keys(self):
        with patch.dict(os.environ, {
            "GOOGLE_API_KEY": "gkey",
            "OPENAI_API_KEY": "okey",
        }, clear=False):
            cm = ConfigManager(config_path=None, hot_reload=False)
            assert cm.config.agent.google_api_key == "gkey"
            assert cm.config.agent.openai_api_key == "okey"

    def test_env_embedding_model(self):
        with patch.dict(os.environ, {"NIKO_EMBEDDING_MODEL": "ada-002"}, clear=False):
            cm = ConfigManager(config_path=None, hot_reload=False)
            assert cm.config.memory.embedding_model == "ada-002"

    def test_env_gateway_overrides(self):
        with patch.dict(os.environ, {
            "NIKO_GATEWAY_HOST": "127.0.0.1",
            "NIKO_GATEWAY_PORT": "9000",
            "NIKO_GATEWAY_RELOAD": "false",
            "NIKO_CORS_DEV_ORIGINS": "http://localhost:3000,http://127.0.0.1:3000",
            "NIKO_CORS_PROD_ORIGINS": "https://app.example.com,https://gray.example.com",
            "NIKO_GATEWAY_METRICS_ENABLED": "false",
        }, clear=False):
            cm = ConfigManager(config_path=None, hot_reload=False)
            assert cm.config.gateway.host == "127.0.0.1"
            assert cm.config.gateway.port == 9000
            assert cm.config.gateway.reload is False
            assert cm.config.gateway.cors_dev_origins == ["http://localhost:3000", "http://127.0.0.1:3000"]
            assert cm.config.gateway.cors_prod_origins == ["https://app.example.com", "https://gray.example.com"]
            assert cm.config.gateway.metrics_enabled is False


class TestConfigManagerGetSet:

    def test_get_simple(self):
        cm = ConfigManager(config_path=None, hot_reload=False)
        assert cm.get("app_name") == "niko-studio"

    def test_get_nested(self):
        cm = ConfigManager(config_path=None, hot_reload=False)
        assert cm.get("agent.default_model") == "gpt-4o"

    def test_get_default(self):
        cm = ConfigManager(config_path=None, hot_reload=False)
        assert cm.get("nonexistent.key", "fallback") == "fallback"

    def test_set_simple(self):
        cm = ConfigManager(config_path=None, hot_reload=False)
        cm.set("debug", True)
        assert cm.config.debug is True

    def test_set_nested(self):
        cm = ConfigManager(config_path=None, hot_reload=False)
        cm.set("agent.default_model", "new-model")
        assert cm.config.agent.default_model == "new-model"

    def test_set_nonexistent_parent(self):
        cm = ConfigManager(config_path=None, hot_reload=False)
        # Should not raise
        cm.set("nonexistent.deep.key", "val")

    def test_set_nonexistent_key(self):
        cm = ConfigManager(config_path=None, hot_reload=False)
        cm.set("agent.nonexistent_field", "val")
        # Should not raise, no effect


class TestConfigManagerListeners:

    def test_add_and_notify(self):
        cm = ConfigManager(config_path=None, hot_reload=False)
        events = []
        cm.add_listener(lambda e: events.append(e))
        cm.set("debug", True)
        assert len(events) == 1
        assert events[0].key == "debug"

    def test_remove_listener(self):
        cm = ConfigManager(config_path=None, hot_reload=False)
        events = []
        listener = lambda e: events.append(e)
        cm.add_listener(listener)
        cm.remove_listener(listener)
        cm.set("debug", True)
        assert len(events) == 0

    def test_remove_nonexistent_listener(self):
        cm = ConfigManager(config_path=None, hot_reload=False)
        cm.remove_listener(lambda e: None)  # Should not raise

    def test_listener_exception_handled(self):
        cm = ConfigManager(config_path=None, hot_reload=False)
        cm.add_listener(lambda e: (_ for _ in ()).throw(ValueError("boom")))
        # Should not raise
        cm.set("debug", True)


class TestConfigManagerReload:

    def test_reload(self, tmp_path):
        cfg = tmp_path / "config.yaml"
        cfg.write_text(yaml.dump({"debug": False}), encoding="utf-8")
        cm = ConfigManager(config_path=str(cfg), hot_reload=False)
        assert cm.config.debug is False

        ConfigManager.reset_instance()
        cfg.write_text(yaml.dump({"debug": True}), encoding="utf-8")
        cm = ConfigManager(config_path=str(cfg), hot_reload=False)
        assert cm.config.debug is True

    def test_reload_from_file_notifies_listeners(self, tmp_path):
        cfg = tmp_path / "config.yaml"
        cfg.write_text(yaml.dump({"debug": False}), encoding="utf-8")
        cm = ConfigManager(config_path=str(cfg), hot_reload=False)
        events = []
        cm.add_listener(lambda e: events.append(e))
        cm._reload_from_file()
        assert len(events) == 1
        assert events[0].key == "*"


class TestConfigManagerOther:

    def test_to_dict(self):
        cm = ConfigManager(config_path=None, hot_reload=False)
        d = cm.to_dict()
        assert d["app_name"] == "niko-studio"
        assert "agent" in d
        assert "memory" in d

    def test_shutdown_no_observer(self):
        cm = ConfigManager(config_path=None, hot_reload=False)
        cm.shutdown()  # Should not raise

    def test_overrides_applied_on_reload(self, tmp_path):
        cfg = tmp_path / "config.yaml"
        cfg.write_text(yaml.dump({"debug": False}), encoding="utf-8")
        cm = ConfigManager(config_path=str(cfg), hot_reload=False)
        cm.set("debug", True)
        assert cm.config.debug is True
        cm.reload()
        # Overrides should be re-applied
        assert cm.config.debug is True


# ============================================================
# Convenience functions
# ============================================================

class TestConvenienceFunctions:

    def test_get_config(self):
        cfg = get_config()
        assert cfg.app_name == "niko-studio"

    def test_get_config_value(self):
        val = get_config_value("agent.default_model")
        assert isinstance(val, str)

    def test_get_config_value_default(self):
        val = get_config_value("nonexistent", "fallback")
        assert val == "fallback"

    def test_set_config_value(self):
        set_config_value("debug", True)
        assert get_config().debug is True

    def test_init_config_with_path(self, tmp_path):
        cfg = tmp_path / "config.yaml"
        cfg.write_text(yaml.dump({"app_name": "test"}), encoding="utf-8")
        cm = init_config(config_path=str(cfg), hot_reload=False)
        assert cm.config.app_name == "test"

    def test_init_config_no_path(self, tmp_path, monkeypatch):
        monkeypatch.chdir(tmp_path)
        cm = init_config(config_path=None, hot_reload=False)
        assert cm.config is not None


class TestValidateEnvironment:

    def test_missing_keys(self):
        with patch.dict(os.environ, {}, clear=False):
            # Ensure no API keys set
            env = os.environ.copy()
            env.pop("GOOGLE_API_KEY", None)
            env.pop("OPENAI_API_KEY", None)
            with patch.dict(os.environ, env, clear=True):
                ConfigManager.reset_instance()
                import src.config as cfg_mod
                cfg_mod._config_manager = None
                errors = validate_environment()
                assert any("LLM" in e or "凭证" in e for e in errors)

    def test_with_google_key(self):
        with patch.dict(os.environ, {"GOOGLE_API_KEY": "testkey"}, clear=False):
            ConfigManager.reset_instance()
            import src.config as cfg_mod
            cfg_mod._config_manager = None
            errors = validate_environment()
            assert not any("LLM" in e or "凭证" in e for e in errors)


class TestEnsureEnvironment:

    def test_dev_mode_warns(self):
        with patch.dict(os.environ, {}, clear=False):
            env = os.environ.copy()
            env.pop("GOOGLE_API_KEY", None)
            env.pop("OPENAI_API_KEY", None)
            with patch.dict(os.environ, env, clear=True):
                ConfigManager.reset_instance()
                import src.config as cfg_mod
                cfg_mod._config_manager = None
                # In dev mode should not raise
                ensure_environment(strict=False)

    def test_strict_raises(self):
        with patch.dict(os.environ, {"NIKO_ENV": "production"}, clear=False):
            env = os.environ.copy()
            env.pop("GOOGLE_API_KEY", None)
            env.pop("OPENAI_API_KEY", None)
            env["NIKO_ENV"] = "production"
            with patch.dict(os.environ, env, clear=True):
                ConfigManager.reset_instance()
                import src.config as cfg_mod
                cfg_mod._config_manager = None
                with pytest.raises(RuntimeError):
                    ensure_environment(strict=True)
