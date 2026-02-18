# -*- coding: utf-8 -*-
"""Extra branch tests for ConfigLoader convenience helpers."""

import os
from pathlib import Path
from unittest.mock import patch

import pytest

from src.knowledge.services.config import ConfigLoader, ConfigError, load_config
from src.knowledge.services.models import ModelTier, ProviderType


def test_parse_model_tier_success_with_spaces():
    assert ConfigLoader._parse_model_tier("  FAST  ") == ModelTier.FAST


def test_parse_model_tier_invalid_raises_config_error():
    with pytest.raises(ConfigError, match="无效的模型层级"):
        ConfigLoader._parse_model_tier("invalid")


def test_load_config_with_explicit_path_without_fallback_raises(tmp_path):
    bad_file = tmp_path / "bad.yaml"
    bad_file.write_text("providers:\n  openai:\n    type: unknown\n", encoding="utf-8")

    with pytest.raises(ConfigError):
        load_config(path=bad_file, env_fallback=False)


def test_load_config_with_explicit_path_falls_back_to_env(tmp_path):
    bad_file = tmp_path / "bad.yaml"
    bad_file.write_text("providers:\n  openai:\n    type: unknown\n", encoding="utf-8")

    with patch.dict(os.environ, {}, clear=True):
        config = load_config(path=bad_file, env_fallback=True)

    assert config.providers == []


def test_load_config_uses_first_existing_default_candidate(tmp_path):
    config_dir = tmp_path / "config"
    config_dir.mkdir()
    yaml_path = config_dir / "services.yaml"
    yaml_path.write_text(
        "providers:\n"
        "  openai:\n"
        "    type: openai\n"
        "    api_key: sk-test\n"
        "    models:\n"
        "      fast: gpt-mini\n"
        "      default: gpt-4o\n"
        "      powerful: gpt-turbo\n",
        encoding="utf-8",
    )

    cwd = Path.cwd()
    try:
        os.chdir(tmp_path)
        cfg = load_config(path=None, env_fallback=True)
    finally:
        os.chdir(cwd)

    assert len(cfg.providers) == 1
    assert cfg.providers[0].provider == ProviderType.OPENAI




def test_from_env_includes_azure_when_api_key_present():
    with patch.dict(os.environ, {"AZURE_OPENAI_API_KEY": "azure-key"}, clear=True):
        cfg = ConfigLoader.from_env()

    providers = [p.provider for p in cfg.providers]
    assert ProviderType.AZURE in providers


def test_from_env_includes_local_when_base_url_present():
    with patch.dict(os.environ, {"LOCAL_LLM_BASE_URL": "http://localhost:11434"}, clear=True):
        cfg = ConfigLoader.from_env()

    providers = [p.provider for p in cfg.providers]
    assert ProviderType.LOCAL in providers


def test_from_env_includes_azure_and_local_together():
    env = {
        "AZURE_OPENAI_API_KEY": "azure-key",
        "LOCAL_LLM_BASE_URL": "http://localhost:11434",
    }
    with patch.dict(os.environ, env, clear=True):
        cfg = ConfigLoader.from_env()

    providers = [p.provider for p in cfg.providers]
    assert ProviderType.AZURE in providers
    assert ProviderType.LOCAL in providers
