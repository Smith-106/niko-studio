# -*- coding: utf-8 -*-

import pytest

import src.mcp.config as mcp_config


def test_is_production_env_from_env(monkeypatch):
    monkeypatch.setenv("NIKO_ENV", "production")
    assert mcp_config._is_production_env() is True


def test_is_production_env_from_config(monkeypatch):
    monkeypatch.delenv("NIKO_ENV", raising=False)
    monkeypatch.setattr(mcp_config, "get_config_value", lambda key, default=None: "Prod" if key == "env" else default)
    assert mcp_config._is_production_env() is True


def test_resolve_reload_enabled_production_short_circuit(monkeypatch):
    monkeypatch.setenv("NIKO_ENV", "production")
    monkeypatch.setenv("NIKO_GATEWAY_RELOAD", "true")
    assert mcp_config._resolve_reload_enabled() is False


def test_resolve_reload_enabled_from_env_and_config(monkeypatch):
    monkeypatch.setenv("NIKO_ENV", "development")

    monkeypatch.setenv("NIKO_GATEWAY_RELOAD", "yes")
    assert mcp_config._resolve_reload_enabled() is True

    monkeypatch.setenv("NIKO_GATEWAY_RELOAD", "0")
    assert mcp_config._resolve_reload_enabled() is False

    monkeypatch.delenv("NIKO_GATEWAY_RELOAD", raising=False)
    monkeypatch.setattr(mcp_config, "get_config_value", lambda key, default=None: False if key == "gateway.reload" else default)
    assert mcp_config._resolve_reload_enabled() is False


def test_resolve_gateway_host_port_invalid_port(monkeypatch):
    monkeypatch.setenv("NIKO_GATEWAY_HOST", "  ")
    monkeypatch.setenv("NIKO_GATEWAY_PORT", "bad")
    host, port = mcp_config._resolve_gateway_host_port()
    assert host == "0.0.0.0"
    assert port == 8000


def test_is_llm_available_variants(monkeypatch):
    class _SvcBool:
        def is_healthy(self):
            return False

    monkeypatch.setattr(mcp_config, "get_services", lambda: _SvcBool())
    assert mcp_config._is_llm_available() is False

    class _SvcDictOk:
        def is_healthy(self):
            return {"status": "ok"}

    monkeypatch.setattr(mcp_config, "get_services", lambda: _SvcDictOk())
    assert mcp_config._is_llm_available() is True

    class _SvcDictBad:
        def is_healthy(self):
            return {"status": "down"}

    monkeypatch.setattr(mcp_config, "get_services", lambda: _SvcDictBad())
    assert mcp_config._is_llm_available() is False

    monkeypatch.setattr(mcp_config, "get_services", lambda: object())
    assert mcp_config._is_llm_available() is True

    def _raise():
        raise RuntimeError("boom")

    monkeypatch.setattr(mcp_config, "get_services", _raise)
    assert mcp_config._is_llm_available() is False


def test_resolve_localhost_only_enabled_from_env_and_config(monkeypatch):
    monkeypatch.setenv("NIKO_GATEWAY_LOCALHOST_ONLY", "on")
    assert mcp_config._resolve_localhost_only_enabled() is True

    monkeypatch.setenv("NIKO_GATEWAY_LOCALHOST_ONLY", "no")
    assert mcp_config._resolve_localhost_only_enabled() is False

    monkeypatch.delenv("NIKO_GATEWAY_LOCALHOST_ONLY", raising=False)
    monkeypatch.setattr(mcp_config, "get_config_value", lambda key, default=None: "yes" if key == "gateway.localhost_only" else default)
    assert mcp_config._resolve_localhost_only_enabled() is True


def test_resolve_localhost_only_exempt_paths_normalization(monkeypatch):
    monkeypatch.setenv("NIKO_GATEWAY_LOCALHOST_ONLY_EXEMPT_PATHS", "health,/metrics/,  , tools")
    assert mcp_config._resolve_localhost_only_exempt_paths() == ["/health", "/metrics", "/tools"]

    monkeypatch.delenv("NIKO_GATEWAY_LOCALHOST_ONLY_EXEMPT_PATHS", raising=False)
    monkeypatch.setattr(mcp_config, "get_config_value", lambda key, default=None: ["x/", " /y "] if key == "gateway.localhost_only_exempt_paths" else default)
    assert mcp_config._resolve_localhost_only_exempt_paths() == ["/x", "/y"]


def test_search_route_mode_and_timeout_and_rate_limit(monkeypatch):
    monkeypatch.setenv("NIKO_SEARCH_ROUTE_MODE", "invalid")
    assert mcp_config._resolve_search_route_mode() == "legacy"

    monkeypatch.setenv("NIKO_SEARCH_ELASTIC_TIMEOUT_MS", "bad")
    assert mcp_config._resolve_search_elastic_timeout_ms() == 300

    monkeypatch.setenv("NIKO_SEARCH_ELASTIC_TIMEOUT_MS", "1")
    assert mcp_config._resolve_search_elastic_timeout_ms() == 50

    monkeypatch.setenv("NIKO_REDIS_RATE_LIMIT", "bad")
    monkeypatch.setenv("NIKO_REDIS_RATE_LIMIT_WINDOW_SECONDS", "bad")
    assert mcp_config._resolve_redis_rate_limit() == (120, 60)

    monkeypatch.setenv("NIKO_REDIS_RATE_LIMIT", "0")
    monkeypatch.setenv("NIKO_REDIS_RATE_LIMIT_WINDOW_SECONDS", "0")
    assert mcp_config._resolve_redis_rate_limit() == (1, 1)


def test_langflow_and_governance_and_cache_ttl(monkeypatch):
    monkeypatch.setenv("NIKO_LANGFLOW_FLOW_NAME", " ")
    assert mcp_config._resolve_langflow_flow_name() == "niko-search-pilot"

    monkeypatch.setenv("NIKO_DBHUB_GOVERNANCE_ENABLED", "yes")
    assert mcp_config._resolve_governance_hook_enabled() is True

    monkeypatch.setenv("NIKO_REDIS_CACHE_TTL_SECONDS", "bad")
    assert mcp_config._resolve_redis_cache_ttl_seconds() == 120

    monkeypatch.setenv("NIKO_REDIS_CACHE_TTL_SECONDS", "0")
    assert mcp_config._resolve_redis_cache_ttl_seconds() == 1


def test_search_cache_key(monkeypatch):
    assert (
        mcp_config._resolve_search_cache_key(query="  Hello ", scope="all", limit=3, profile=None)
        == "search:all:3:default:hello"
    )


def test_ui_bridge_enabled_and_disabled_response(monkeypatch):
    monkeypatch.setenv("NIKO_UI_BRIDGE_ENABLED", "1")
    assert mcp_config._resolve_ui_bridge_enabled() is True

    monkeypatch.setenv("NIKO_UI_BRIDGE_ENABLED", "0")
    assert mcp_config._resolve_ui_bridge_enabled() is False

    monkeypatch.delenv("NIKO_UI_BRIDGE_ENABLED", raising=False)
    monkeypatch.setattr(mcp_config, "get_config_value", lambda key, default=None: True if key == "gateway.ui_bridge_enabled" else default)
    assert mcp_config._resolve_ui_bridge_enabled() is True

    response = mcp_config._ui_bridge_disabled_response()
    assert response.status_code == 404


def test_parse_origins_and_resolve_cors_origins_prod(monkeypatch):
    # dev default
    monkeypatch.setenv("NIKO_ENV", "development")
    monkeypatch.delenv("NIKO_CORS_DEV_ORIGINS", raising=False)
    monkeypatch.setattr(mcp_config, "get_config_value", lambda key, default=None: ["*"] if key == "gateway.cors_dev_origins" else default)
    assert mcp_config._resolve_cors_origins() == ["*"]

    # prod forbids localhost and * and raises when empty
    monkeypatch.setenv("NIKO_ENV", "production")
    monkeypatch.delenv("NIKO_CORS_PROD_ORIGINS", raising=False)
    monkeypatch.setattr(mcp_config, "get_config_value", lambda key, default=None: ["*", "http://localhost:3000"] if key == "gateway.cors_prod_origins" else default)
    with pytest.raises(RuntimeError):
        mcp_config._resolve_cors_origins()

    # prod ok when has non-forbidden
    monkeypatch.setattr(mcp_config, "get_config_value", lambda key, default=None: ["https://prod.example.com"] if key == "gateway.cors_prod_origins" else default)
    assert mcp_config._resolve_cors_origins() == ["https://prod.example.com"]


def test_resolve_gateway_host_port_from_config(monkeypatch):
    monkeypatch.delenv("NIKO_GATEWAY_HOST", raising=False)
    monkeypatch.delenv("NIKO_GATEWAY_PORT", raising=False)

    def _get(key, default=None):
        if key == "gateway.host":
            return "  "
        if key == "gateway.port":
            return "9001"
        return default

    monkeypatch.setattr(mcp_config, "get_config_value", _get)
    host, port = mcp_config._resolve_gateway_host_port()
    assert host == "0.0.0.0"
    assert port == 9001


def test_parse_origins_iterable_and_non_iterable_branches():
    assert mcp_config._parse_origins([None, " a ", ""]) == ["None", "a"]
    assert mcp_config._parse_origins(123) == []


def test_resolve_cors_origins_dev_empty_falls_back_to_wildcard(monkeypatch):
    monkeypatch.setenv("NIKO_ENV", "development")
    monkeypatch.setenv("NIKO_CORS_DEV_ORIGINS", "")
    assert mcp_config._resolve_cors_origins() == ["*"]
