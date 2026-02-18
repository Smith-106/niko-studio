"""
RerankerFactory Tests

Tests for RerankerFactory create, from_dict, from_env, detection, and helpers.
"""

import os
import pytest
from unittest.mock import patch
from src.services.reranker.models import RerankerConfig, RerankerError, RerankerType
from src.services.reranker.factory import RerankerFactory
from src.services.reranker.strategies import (
    JinaReranker,
    VoyageReranker,
    TEIReranker,
    BailianReranker,
)


# ============================================================
# create()
# ============================================================

class TestCreate:

    def test_create_jina(self):
        config = RerankerConfig(reranker_type=RerankerType.JINA, api_key="k")
        reranker = RerankerFactory.create(config)
        assert isinstance(reranker, JinaReranker)

    def test_create_voyage(self):
        config = RerankerConfig(reranker_type=RerankerType.VOYAGE, api_key="k")
        reranker = RerankerFactory.create(config)
        assert isinstance(reranker, VoyageReranker)

    def test_create_tei(self):
        config = RerankerConfig(reranker_type=RerankerType.TEI, base_url="http://localhost")
        reranker = RerankerFactory.create(config)
        assert isinstance(reranker, TEIReranker)

    def test_create_bailian(self):
        config = RerankerConfig(reranker_type=RerankerType.BAILIAN, api_key="k")
        reranker = RerankerFactory.create(config)
        assert isinstance(reranker, BailianReranker)

    def test_create_unsupported_type_branch(self):
        class UnsupportedType:
            value = "unsupported"

        config = RerankerConfig(reranker_type=RerankerType.JINA, api_key="k")
        config.reranker_type = UnsupportedType()

        with pytest.raises(RerankerError) as exc_info:
            RerankerFactory.create(config)

        assert "Unsupported reranker type" in str(exc_info.value)


# ============================================================
# from_dict()
# ============================================================

class TestFromDict:

    def test_basic(self):
        data = {"type": "jina", "api_key": "k"}
        reranker = RerankerFactory.from_dict(data)
        assert isinstance(reranker, JinaReranker)

    def test_default_type(self):
        data = {"api_key": "k"}
        reranker = RerankerFactory.from_dict(data)
        assert isinstance(reranker, JinaReranker)

    def test_case_insensitive(self):
        data = {"type": "VOYAGE", "api_key": "k"}
        reranker = RerankerFactory.from_dict(data)
        assert isinstance(reranker, VoyageReranker)

    def test_invalid_type(self):
        with pytest.raises(RerankerError) as exc_info:
            RerankerFactory.from_dict({"type": "invalid"})
        assert "Invalid reranker type" in str(exc_info.value)

    def test_all_config_fields(self):
        data = {
            "type": "tei",
            "api_key": "key",
            "base_url": "http://example.com",
            "model": "model-v1",
            "timeout": 60.0,
            "max_retries": 5,
            "batch_size": 50,
        }
        reranker = RerankerFactory.from_dict(data)
        assert reranker.config.timeout == 60.0
        assert reranker.config.max_retries == 5
        assert reranker.config.batch_size == 50


# ============================================================
# from_env()
# ============================================================

class TestFromEnv:

    def test_explicit_type_string(self):
        with patch.dict(os.environ, {}, clear=True):
            reranker = RerankerFactory.from_env(reranker_type="jina")
            assert isinstance(reranker, JinaReranker)

    def test_explicit_type_enum(self):
        with patch.dict(os.environ, {}, clear=True):
            reranker = RerankerFactory.from_env(reranker_type=RerankerType.VOYAGE)
            assert isinstance(reranker, VoyageReranker)

    def test_from_reranker_type_env(self):
        with patch.dict(os.environ, {"RERANKER_TYPE": "tei"}, clear=True):
            reranker = RerankerFactory.from_env()
            assert isinstance(reranker, TEIReranker)

    def test_auto_detect_jina(self):
        with patch.dict(os.environ, {"JINA_API_KEY": "key"}, clear=True):
            reranker = RerankerFactory.from_env()
            assert isinstance(reranker, JinaReranker)

    def test_auto_detect_voyage(self):
        with patch.dict(os.environ, {"VOYAGE_API_KEY": "key"}, clear=True):
            reranker = RerankerFactory.from_env()
            assert isinstance(reranker, VoyageReranker)

    def test_auto_detect_tei(self):
        with patch.dict(os.environ, {"TEI_BASE_URL": "http://localhost"}, clear=True):
            reranker = RerankerFactory.from_env()
            assert isinstance(reranker, TEIReranker)

    def test_auto_detect_bailian(self):
        with patch.dict(os.environ, {"DASHSCOPE_API_KEY": "key"}, clear=True):
            reranker = RerankerFactory.from_env()
            assert isinstance(reranker, BailianReranker)

    def test_default_when_no_env(self):
        with patch.dict(os.environ, {}, clear=True):
            reranker = RerankerFactory.from_env()
            assert isinstance(reranker, JinaReranker)

    def test_env_model_and_timeout(self):
        env = {
            "RERANKER_TYPE": "jina",
            "RERANKER_MODEL": "jina-reranker-v2",
            "RERANKER_TIMEOUT": "45.0",
            "RERANKER_MAX_RETRIES": "2",
        }
        with patch.dict(os.environ, env, clear=True):
            reranker = RerankerFactory.from_env()
            assert reranker.config.model == "jina-reranker-v2"
            assert reranker.config.timeout == 45.0
            assert reranker.config.max_retries == 2

    def test_api_key_for_type(self):
        env = {"RERANKER_TYPE": "jina", "JINA_API_KEY": "my-key"}
        with patch.dict(os.environ, env, clear=True):
            reranker = RerankerFactory.from_env()
            assert reranker.config.api_key == "my-key"

    def test_base_url_for_type(self):
        env = {"RERANKER_TYPE": "tei", "TEI_BASE_URL": "http://host:8080"}
        with patch.dict(os.environ, env, clear=True):
            reranker = RerankerFactory.from_env()
            assert reranker.config.base_url == "http://host:8080"


# ============================================================
# available_types()
# ============================================================

class TestAvailableTypes:

    def test_returns_all(self):
        types = RerankerFactory.available_types()
        assert set(types) == {
            RerankerType.JINA,
            RerankerType.VOYAGE,
            RerankerType.TEI,
            RerankerType.BAILIAN,
        }

    def test_returns_list(self):
        types = RerankerFactory.available_types()
        assert isinstance(types, list)


# ============================================================
# _detect_reranker_type()
# ============================================================

class TestDetectRerankerType:

    def test_no_env_defaults_jina(self):
        with patch.dict(os.environ, {}, clear=True):
            result = RerankerFactory._detect_reranker_type()
            assert result == RerankerType.JINA

    def test_priority_first_match(self):
        # JINA_API_KEY comes first in _ENV_KEY_MAPPING
        env = {"JINA_API_KEY": "k1", "VOYAGE_API_KEY": "k2"}
        with patch.dict(os.environ, env, clear=True):
            result = RerankerFactory._detect_reranker_type()
            assert result == RerankerType.JINA


# ============================================================
# Helper methods
# ============================================================

class TestHelpers:

    def test_get_api_key_jina(self):
        with patch.dict(os.environ, {"JINA_API_KEY": "jk"}, clear=True):
            assert RerankerFactory._get_api_key_for_type(RerankerType.JINA) == "jk"

    def test_get_api_key_voyage(self):
        with patch.dict(os.environ, {"VOYAGE_API_KEY": "vk"}, clear=True):
            assert RerankerFactory._get_api_key_for_type(RerankerType.VOYAGE) == "vk"

    def test_get_api_key_bailian(self):
        with patch.dict(os.environ, {"DASHSCOPE_API_KEY": "dk"}, clear=True):
            assert RerankerFactory._get_api_key_for_type(RerankerType.BAILIAN) == "dk"

    def test_get_api_key_missing(self):
        with patch.dict(os.environ, {}, clear=True):
            assert RerankerFactory._get_api_key_for_type(RerankerType.JINA) is None

    def test_get_base_url_tei(self):
        with patch.dict(os.environ, {"TEI_BASE_URL": "http://tei"}, clear=True):
            assert RerankerFactory._get_base_url_for_type(RerankerType.TEI) == "http://tei"

    def test_get_base_url_missing(self):
        with patch.dict(os.environ, {}, clear=True):
            assert RerankerFactory._get_base_url_for_type(RerankerType.JINA) is None
