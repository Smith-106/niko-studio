# -*- coding: utf-8 -*-
"""ConfigLoader tests - env substitution, from_dict, from_env, from_yaml, parse helpers."""

import pytest
import os
from unittest.mock import patch
from pathlib import Path

from src.knowledge.services.config import ConfigLoader, ConfigError
from src.knowledge.services.models import ProviderType, ModelTier


class TestEnvSubstitution:
    def test_substitute_env_var_set(self):
        with patch.dict(os.environ, {"MY_VAR": "hello"}):
            result = ConfigLoader._substitute_env_vars("${MY_VAR}")
            assert result == "hello"

    def test_substitute_env_var_not_set_no_default(self):
        result = ConfigLoader._substitute_env_vars("${NONEXISTENT_VAR_XYZ}")
        assert result is None

    def test_substitute_env_var_with_default(self):
        result = ConfigLoader._substitute_env_vars("${NONEXISTENT_VAR_XYZ:fallback}")
        assert result == "fallback"

    def test_substitute_env_var_set_ignores_default(self):
        with patch.dict(os.environ, {"MY_VAR": "real"}):
            result = ConfigLoader._substitute_env_vars("${MY_VAR:fallback}")
            assert result == "real"

    def test_substitute_partial(self):
        with patch.dict(os.environ, {"HOST": "localhost"}):
            result = ConfigLoader._substitute_env_vars("http://${HOST}:8080")
            assert result == "http://localhost:8080"

    def test_substitute_partial_missing(self):
        result = ConfigLoader._substitute_env_vars("prefix_${MISSING_XYZ}_suffix")
        assert result == "prefix__suffix"

    def test_substitute_partial_with_default(self):
        result = ConfigLoader._substitute_env_vars("prefix_${MISSING_XYZ:val}_suffix")
        assert result == "prefix_val_suffix"

    def test_substitute_plain_string(self):
        result = ConfigLoader._substitute_env_vars("no_env_vars_here")
        assert result == "no_env_vars_here"


class TestEnvSubstitutionRecursive:
    def test_recursive_dict(self):
        with patch.dict(os.environ, {"K": "v"}):
            result = ConfigLoader._substitute_env_vars_recursive({"a": "${K}"})
            assert result == {"a": "v"}

    def test_recursive_list(self):
        with patch.dict(os.environ, {"K": "v"}):
            result = ConfigLoader._substitute_env_vars_recursive(["${K}", "plain"])
            assert result == ["v", "plain"]

    def test_recursive_nested(self):
        with patch.dict(os.environ, {"X": "1"}):
            result = ConfigLoader._substitute_env_vars_recursive({"a": {"b": "${X}"}})
            assert result == {"a": {"b": "1"}}

    def test_recursive_non_string(self):
        result = ConfigLoader._substitute_env_vars_recursive(42)
        assert result == 42


class TestParseProviderType:
    def test_valid_openai(self):
        assert ConfigLoader._parse_provider_type("openai") == ProviderType.OPENAI

    def test_valid_anthropic_uppercase(self):
        assert ConfigLoader._parse_provider_type("ANTHROPIC") == ProviderType.ANTHROPIC

    def test_valid_with_spaces(self):
        assert ConfigLoader._parse_provider_type("  azure  ") == ProviderType.AZURE

    def test_invalid(self):
        with pytest.raises(ConfigError):
            ConfigLoader._parse_provider_type("invalid_provider")


class TestFromDict:
    def test_empty_dict(self):
        cfg = ConfigLoader.from_dict({})
        assert cfg.providers == []

    def test_with_provider(self):
        data = {
            "providers": {
                "openai": {
                    "type": "openai",
                    "api_key": "sk-test",
                    "models": {"fast": "gpt-4o-mini", "default": "gpt-4o", "powerful": "gpt-4-turbo"},
                    "embedding_model": "text-embedding-3-small",
                }
            },
            "default_llm_provider": "openai",
        }
        cfg = ConfigLoader.from_dict(data)
        assert len(cfg.providers) == 1
        assert cfg.providers[0].provider == ProviderType.OPENAI
        assert cfg.providers[0].api_key == "sk-test"
        assert cfg.providers[0].model_mapping[ModelTier.FAST] == "gpt-4o-mini"

    def test_with_cache_and_retry(self):
        data = {
            "cache": {"enabled": False, "ttl": 3600, "max_size": 500},
            "retry": {"max_retries": 5, "base_delay": 2.0, "max_delay": 120.0},
        }
        cfg = ConfigLoader.from_dict(data)
        assert cfg.embedding_cache_enabled is False
        assert cfg.embedding_cache_ttl == 3600
        assert cfg.retry_max_attempts == 5

    def test_none_provider_skipped(self):
        data = {"providers": {"openai": None}}
        cfg = ConfigLoader.from_dict(data)
        assert len(cfg.providers) == 0


class TestFromEnv:
    @patch.dict(os.environ, {
        "OPENAI_API_KEY": "sk-test",
        "LLM_DEFAULT_PROVIDER": "openai",
    }, clear=False)
    def test_openai_from_env(self):
        cfg = ConfigLoader.from_env()
        openai_providers = [p for p in cfg.providers if p.provider == ProviderType.OPENAI]
        assert len(openai_providers) == 1
        assert openai_providers[0].api_key == "sk-test"

    @patch.dict(os.environ, {
        "ANTHROPIC_API_KEY": "sk-ant-test",
    }, clear=False)
    def test_anthropic_from_env(self):
        cfg = ConfigLoader.from_env()
        ant_providers = [p for p in cfg.providers if p.provider == ProviderType.ANTHROPIC]
        assert len(ant_providers) >= 1

    @patch.dict(os.environ, {}, clear=True)
    def test_no_env_vars(self):
        cfg = ConfigLoader.from_env()
        assert cfg.providers == []


class TestFromYaml:
    def test_file_not_found(self):
        with pytest.raises(ConfigError, match="不存在"):
            ConfigLoader.from_yaml("/nonexistent/path.yaml")

    def test_valid_yaml(self, tmp_path):
        yaml_file = tmp_path / "config.yaml"
        yaml_file.write_text(
            "providers:\n  openai:\n    type: openai\n    api_key: sk-yaml\n    models:\n      fast: gpt-mini\n      default: gpt-4o\n      powerful: gpt-turbo\n",
            encoding="utf-8",
        )
        cfg = ConfigLoader.from_yaml(str(yaml_file))
        assert len(cfg.providers) == 1
        assert cfg.providers[0].api_key == "sk-yaml"

    def test_empty_yaml(self, tmp_path):
        yaml_file = tmp_path / "empty.yaml"
        yaml_file.write_text("", encoding="utf-8")
        cfg = ConfigLoader.from_yaml(str(yaml_file))
        assert cfg.providers == []

    def test_invalid_yaml(self, tmp_path):
        yaml_file = tmp_path / "bad.yaml"
        yaml_file.write_text(":\n  :\n    - [invalid", encoding="utf-8")
        with pytest.raises(ConfigError):
            ConfigLoader.from_yaml(str(yaml_file))
