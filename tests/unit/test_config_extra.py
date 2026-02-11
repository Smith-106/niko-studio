# -*- coding: utf-8 -*-
"""ConfigManager extra tests - _apply_dict_to_config coverage,
_start_file_watcher, _create_default_config_file content, _load_from_env edge cases."""

import os
import yaml
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock

from src.config import (
    ConfigManager,
    AppConfig,
    BackupConfig,
    TokenConfig,
    ObsidianConfig,
    ConfigSource,
    ConfigChangeEvent,
    ConfigValue,
)


@pytest.fixture(autouse=True)
def reset_singleton():
    """Reset ConfigManager singleton between tests."""
    ConfigManager._instance = None
    yield
    if ConfigManager._instance is not None:
        try:
            ConfigManager._instance.shutdown()
        except Exception:
            pass
        ConfigManager._instance = None


class TestApplyDictToConfig:
    """Test _apply_dict_to_config for all supported sections."""

    def test_agent_section(self, tmp_path):
        cfg_file = tmp_path / "config.yaml"
        cfg_file.write_text(yaml.dump({
            "agent": {"default_model": "claude-3", "log_level": "DEBUG"}
        }), encoding="utf-8")
        mgr = ConfigManager(config_path=str(cfg_file), hot_reload=False)
        assert mgr.config.agent.default_model == "claude-3"
        assert mgr.config.agent.log_level == "DEBUG"

    def test_memory_section(self, tmp_path):
        cfg_file = tmp_path / "config.yaml"
        cfg_file.write_text(yaml.dump({
            "memory": {"chunk_size": 500, "chunk_overlap": 100}
        }), encoding="utf-8")
        mgr = ConfigManager(config_path=str(cfg_file), hot_reload=False)
        assert mgr.config.memory.chunk_size == 500
        assert mgr.config.memory.chunk_overlap == 100

    def test_workflow_section(self, tmp_path):
        cfg_file = tmp_path / "config.yaml"
        cfg_file.write_text(yaml.dump({
            "workflow": {"session_timeout": 7200, "max_concurrent_sessions": 5}
        }), encoding="utf-8")
        mgr = ConfigManager(config_path=str(cfg_file), hot_reload=False)
        assert mgr.config.workflow.session_timeout == 7200
        assert mgr.config.workflow.max_concurrent_sessions == 5

    def test_graph_section(self, tmp_path):
        cfg_file = tmp_path / "config.yaml"
        cfg_file.write_text(yaml.dump({
            "graph": {"max_connections": 20, "relation_depth": 5}
        }), encoding="utf-8")
        mgr = ConfigManager(config_path=str(cfg_file), hot_reload=False)
        assert mgr.config.graph.max_connections == 20
        assert mgr.config.graph.relation_depth == 5

    def test_writing_section(self, tmp_path):
        cfg_file = tmp_path / "config.yaml"
        cfg_file.write_text(yaml.dump({
            "writing": {"character_depth_dimensions": 8, "max_character_traits": 30}
        }), encoding="utf-8")
        mgr = ConfigManager(config_path=str(cfg_file), hot_reload=False)
        assert mgr.config.writing.character_depth_dimensions == 8
        assert mgr.config.writing.max_character_traits == 30

    def test_base_fields(self, tmp_path):
        cfg_file = tmp_path / "config.yaml"
        cfg_file.write_text(yaml.dump({
            "app_name": "custom-app",
            "version": "9.0.0",
            "debug": True,
            "env": "production",
            "data_dir": "/custom/data",
        }), encoding="utf-8")
        mgr = ConfigManager(config_path=str(cfg_file), hot_reload=False)
        assert mgr.config.app_name == "custom-app"
        assert mgr.config.version == "9.0.0"
        assert mgr.config.debug is True
        assert mgr.config.env == "production"
        assert mgr.config.data_dir == "/custom/data"

    def test_unknown_agent_key_ignored(self, tmp_path):
        cfg_file = tmp_path / "config.yaml"
        cfg_file.write_text(yaml.dump({
            "agent": {"nonexistent_key": "value", "default_model": "test"}
        }), encoding="utf-8")
        mgr = ConfigManager(config_path=str(cfg_file), hot_reload=False)
        assert mgr.config.agent.default_model == "test"
        assert not hasattr(mgr.config.agent, "nonexistent_key")

    def test_backup_token_obsidian_not_applied(self, tmp_path):
        """Verify backup/token/obsidian sections are NOT handled by _apply_dict_to_config."""
        cfg_file = tmp_path / "config.yaml"
        cfg_file.write_text(yaml.dump({
            "backup": {"max_backups": 10},
            "token": {"default_budget": 20.0},
            "obsidian": {"enabled": False},
        }), encoding="utf-8")
        mgr = ConfigManager(config_path=str(cfg_file), hot_reload=False)
        # These remain at defaults because _apply_dict_to_config doesn't handle them
        assert mgr.config.backup.max_backups == 50  # default
        assert mgr.config.token.default_budget == 10.0  # default
        assert mgr.config.obsidian.enabled is True  # default

    def test_all_supported_sections_together(self, tmp_path):
        cfg_file = tmp_path / "config.yaml"
        cfg_file.write_text(yaml.dump({
            "app_name": "full-test",
            "agent": {"default_model": "claude"},
            "memory": {"chunk_size": 500},
            "workflow": {"session_timeout": 7200},
            "graph": {"max_connections": 20},
            "writing": {"character_depth_dimensions": 8},
        }), encoding="utf-8")
        mgr = ConfigManager(config_path=str(cfg_file), hot_reload=False)
        assert mgr.config.app_name == "full-test"
        assert mgr.config.agent.default_model == "claude"
        assert mgr.config.memory.chunk_size == 500
        assert mgr.config.workflow.session_timeout == 7200
        assert mgr.config.graph.max_connections == 20
        assert mgr.config.writing.character_depth_dimensions == 8


class TestCreateDefaultConfigFile:
    def test_default_config_content(self, tmp_path):
        cfg_file = tmp_path / "sub" / "config.yaml"
        mgr = ConfigManager(config_path=str(cfg_file), hot_reload=False, auto_create=True)
        assert cfg_file.exists()
        content = yaml.safe_load(cfg_file.read_text(encoding="utf-8"))
        assert content["app_name"] == "niko-studio"
        assert "agent" in content
        assert "memory" in content
        assert "workflow" in content
        assert "graph" in content
        assert "writing" in content
        assert content["debug"] is False

    def test_no_create_when_disabled(self, tmp_path):
        cfg_file = tmp_path / "no_create.yaml"
        mgr = ConfigManager(config_path=str(cfg_file), hot_reload=False, auto_create=False)
        assert not cfg_file.exists()

    def test_no_create_without_path(self):
        mgr = ConfigManager(config_path=None, hot_reload=False)
        # Should not raise, just skip creation


class TestStartFileWatcher:
    def test_watcher_started_with_hot_reload(self, tmp_path):
        cfg_file = tmp_path / "config.yaml"
        cfg_file.write_text(yaml.dump({"app_name": "test"}), encoding="utf-8")
        with patch("src.config.Observer") as MockObs:
            mock_observer = MagicMock()
            MockObs.return_value = mock_observer
            mgr = ConfigManager(config_path=str(cfg_file), hot_reload=True)
        mock_observer.schedule.assert_called_once()
        mock_observer.start.assert_called_once()

    def test_watcher_not_started_without_hot_reload(self, tmp_path):
        cfg_file = tmp_path / "config.yaml"
        cfg_file.write_text(yaml.dump({"app_name": "test"}), encoding="utf-8")
        with patch("src.config.Observer") as MockObs:
            mgr = ConfigManager(config_path=str(cfg_file), hot_reload=False)
        MockObs.return_value.start.assert_not_called()


class TestLoadFromEnvEdgeCases:
    def test_env_cost_overrides(self, tmp_path):
        cfg_file = tmp_path / "config.yaml"
        cfg_file.write_text(yaml.dump({"app_name": "test"}), encoding="utf-8")
        env = {
            "NIKO_MAX_COST_PER_REQUEST": "2.5",
            "NIKO_MAX_COST_PER_SESSION": "25.0",
            "NIKO_VECTOR_DB_PATH": "/custom/vec",
            "NIKO_GRAPH_DB_PATH": "/custom/graph",
            "NIKO_EMBEDDING_MODEL": "custom-embed",
        }
        with patch.dict(os.environ, env, clear=False):
            mgr = ConfigManager(config_path=str(cfg_file), hot_reload=False)
        assert mgr.config.agent.max_cost_per_request == 2.5
        assert mgr.config.agent.max_cost_per_session == 25.0
        assert mgr.config.memory.vector_db_path == "/custom/vec"
        assert mgr.config.graph.db_path == "/custom/graph"
        assert mgr.config.memory.embedding_model == "custom-embed"

    def test_env_debug_true(self, tmp_path):
        cfg_file = tmp_path / "config.yaml"
        cfg_file.write_text(yaml.dump({"app_name": "test"}), encoding="utf-8")
        with patch.dict(os.environ, {"NIKO_DEBUG": "true", "NIKO_ENV": "production"}, clear=False):
            mgr = ConfigManager(config_path=str(cfg_file), hot_reload=False)
        assert mgr.config.debug is True
        assert mgr.config.env == "production"

    def test_env_model_override(self, tmp_path):
        cfg_file = tmp_path / "config.yaml"
        cfg_file.write_text(yaml.dump({"app_name": "test"}), encoding="utf-8")
        with patch.dict(os.environ, {"NIKO_DEFAULT_MODEL": "gpt-5"}, clear=False):
            mgr = ConfigManager(config_path=str(cfg_file), hot_reload=False)
        assert mgr.config.agent.default_model == "gpt-5"


class TestReloadFromFile:
    def test_reload_notifies_listeners(self, tmp_path):
        cfg_file = tmp_path / "config.yaml"
        cfg_file.write_text(yaml.dump({"app_name": "v1"}), encoding="utf-8")
        mgr = ConfigManager(config_path=str(cfg_file), hot_reload=False)
        listener = MagicMock()
        mgr.add_listener(listener)

        cfg_file.write_text(yaml.dump({"app_name": "v2"}), encoding="utf-8")
        mgr._reload_from_file()

        assert listener.called
        assert mgr.config.app_name == "v2"


class TestLoadFromFileError:
    def test_invalid_yaml(self, tmp_path):
        cfg_file = tmp_path / "config.yaml"
        cfg_file.write_text("{{invalid yaml", encoding="utf-8")
        # Should not raise, just log error
        mgr = ConfigManager(config_path=str(cfg_file), hot_reload=False)
        assert mgr.config.app_name == "niko-studio"  # default


class TestConfigValueRepr:
    def test_repr(self):
        cv = ConfigValue(value="test", source=ConfigSource.ENV, key="app_name")
        r = repr(cv)
        assert "app_name" in r
        assert "test" in r
        assert "environment" in r


class TestConfigChangeEvent:
    def test_fields(self):
        evt = ConfigChangeEvent(key="debug", old_value=False, new_value=True, source=ConfigSource.OVERRIDE)
        assert evt.key == "debug"
        assert evt.old_value is False
        assert evt.new_value is True
        assert evt.source == ConfigSource.OVERRIDE
        assert evt.timestamp > 0


class TestDataclassDefaults:
    def test_backup_config_defaults(self):
        bc = BackupConfig()
        assert bc.backup_dir == ".writing/backups"
        assert bc.compress is True
        assert bc.max_backups == 50
        assert bc.webdav_enabled is False
        assert bc.s3_enabled is False

    def test_token_config_defaults(self):
        tc = TokenConfig()
        assert tc.db_path == ".writing/token_usage.db"
        assert tc.default_model == "gpt-4o"
        assert tc.default_budget == 10.0

    def test_obsidian_config_defaults(self):
        oc = ObsidianConfig()
        assert oc.enabled is True
        assert oc.auto_discover is True
        assert oc.sync_on_startup is False
        assert oc.file_patterns == ["*.md"]

    def test_app_config_has_all_sub_configs(self):
        ac = AppConfig()
        assert isinstance(ac.backup, BackupConfig)
        assert isinstance(ac.token, TokenConfig)
        assert isinstance(ac.obsidian, ObsidianConfig)
