"""
MCP Gateway Configuration Resolvers

Stateless configuration resolution functions for the MCP gateway.
All functions are pure and have no runtime dependencies.
"""

import os
from typing import Any, Iterable, List, Tuple

from src.config import get_config_value
from src.knowledge.services import get_services


def _is_production_env() -> bool:
    """Check if running in production environment."""
    env = str(os.getenv("NIKO_ENV") or get_config_value("env", "development")).lower()
    return env in {"prod", "production"}


def _resolve_reload_enabled() -> bool:
    """Resolve whether hot reload is enabled for development."""
    if _is_production_env():
        return False
    raw = os.getenv("NIKO_GATEWAY_RELOAD")
    if raw is not None:
        return str(raw).strip().lower() in {"true", "1", "yes", "on"}
    return bool(get_config_value("gateway.reload", True))


def _resolve_gateway_host_port() -> Tuple[str, int]:
    """Resolve gateway host and port from environment or config."""
    raw_host = os.getenv("NIKO_GATEWAY_HOST")
    if raw_host is None:
        raw_host = get_config_value("gateway.host", "0.0.0.0")
    host = str(raw_host).strip() or "0.0.0.0"

    raw_port = os.getenv("NIKO_GATEWAY_PORT")
    if raw_port is None:
        raw_port = get_config_value("gateway.port", 8000)

    try:
        port = int(str(raw_port).strip())
    except (TypeError, ValueError):
        port = 8000

    return host, port


def _is_llm_available() -> bool:
    """Check if LLM service is available."""
    try:
        services = get_services()
        health_checker = getattr(services, "is_healthy", None)
        if callable(health_checker):
            result = health_checker()
            if isinstance(result, bool):
                return result
            if isinstance(result, dict):
                status = str(result.get("status", "")).strip().lower()
                return status in {"ok", "healthy", "pass"}
        return True
    except Exception:
        return False


def _resolve_search_route_mode() -> str:
    """Resolve search routing mode."""
    raw = os.getenv("NIKO_SEARCH_ROUTE_MODE")
    if raw is None:
        raw = get_config_value("integration.search_route_mode", "legacy")
    mode = str(raw).strip().lower() if raw is not None else "legacy"
    if mode not in {"legacy", "elastic", "hybrid"}:
        return "legacy"
    return mode


def _resolve_search_elastic_timeout_ms() -> int:
    """Resolve Elasticsearch timeout in milliseconds."""
    raw = os.getenv("NIKO_SEARCH_ELASTIC_TIMEOUT_MS")
    if raw is None:
        raw = get_config_value("integration.search_elastic_timeout_ms", 300)
    try:
        timeout = int(raw)
    except (TypeError, ValueError):
        timeout = 300
    return max(timeout, 50)


def _resolve_redis_rate_limit() -> Tuple[int, int]:
    """Resolve Redis rate limit (limit, window_seconds)."""
    raw_limit = os.getenv("NIKO_REDIS_RATE_LIMIT")
    raw_window = os.getenv("NIKO_REDIS_RATE_LIMIT_WINDOW_SECONDS")

    if raw_limit is None:
        raw_limit = get_config_value("integration.redis_rate_limit", 120)
    if raw_window is None:
        raw_window = get_config_value("integration.redis_rate_limit_window_seconds", 60)

    try:
        limit = int(raw_limit)
    except (TypeError, ValueError):
        limit = 120

    try:
        window_seconds = int(raw_window)
    except (TypeError, ValueError):
        window_seconds = 60

    return max(limit, 1), max(window_seconds, 1)


def _resolve_langflow_flow_name() -> str:
    """Resolve Langflow flow name for orchestration hooks."""
    raw = os.getenv("NIKO_LANGFLOW_FLOW_NAME")
    if raw is None:
        raw = get_config_value("integration.langflow_flow_name", "niko-search-pilot")
    flow_name = str(raw).strip() if raw is not None else "niko-search-pilot"
    return flow_name or "niko-search-pilot"


def _resolve_governance_hook_enabled() -> bool:
    """Check if DBHub governance hook is enabled."""
    raw = os.getenv("NIKO_DBHUB_GOVERNANCE_ENABLED")
    if raw is not None:
        return str(raw).strip().lower() in {"1", "true", "yes", "on"}
    return bool(get_config_value("integration.dbhub_governance_enabled", False))


def _resolve_redis_cache_ttl_seconds() -> int:
    """Resolve Redis cache TTL in seconds."""
    raw = os.getenv("NIKO_REDIS_CACHE_TTL_SECONDS")
    if raw is None:
        raw = get_config_value("integration.redis_cache_ttl_seconds", 120)
    try:
        ttl = int(raw)
    except (TypeError, ValueError):
        ttl = 120
    return max(ttl, 1)


def _resolve_search_cache_key(query: str, scope: str, limit: int, profile: str | None) -> str:
    """Generate cache key for search results."""
    profile_part = profile or "default"
    return f"search:{scope}:{limit}:{profile_part}:{query.strip().lower()}"


def _resolve_ui_bridge_enabled() -> bool:
    """Check if UI bridge endpoints are enabled."""
    raw = os.getenv("NIKO_UI_BRIDGE_ENABLED")
    if raw is not None:
        return str(raw).strip().lower() in {"true", "1", "yes", "on"}
    return bool(get_config_value("gateway.ui_bridge_enabled", False))


def _ui_bridge_disabled_response():
    """Return standard response when UI bridge is disabled."""
    from starlette.responses import JSONResponse
    return JSONResponse(
        {
            "status": "disabled",
            "reason": "ui_bridge_disabled",
            "hint": "Set NIKO_UI_BRIDGE_ENABLED=1 or gateway.ui_bridge_enabled=true",
        },
        status_code=404,
    )


def _parse_origins(raw: Any) -> List[str]:
    """Parse CORS origins from string or iterable."""
    if isinstance(raw, str):
        return [item.strip() for item in raw.split(",") if item.strip()]
    if isinstance(raw, Iterable):
        return [str(item).strip() for item in raw if str(item).strip()]
    return []


def _resolve_cors_origins() -> List[str]:
    """Resolve CORS origins based on environment."""
    if _is_production_env():
        raw = os.getenv("NIKO_CORS_PROD_ORIGINS")
        origins = _parse_origins(raw) if raw is not None else _parse_origins(
            get_config_value("gateway.cors_prod_origins", [])
        )
    else:
        raw = os.getenv("NIKO_CORS_DEV_ORIGINS")
        origins = _parse_origins(raw) if raw is not None else _parse_origins(
            get_config_value("gateway.cors_dev_origins", ["*"])
        )

    if not origins:
        origins = ["*"] if not _is_production_env() else []

    if _is_production_env():
        forbidden = {"*", "http://localhost:3000", "http://127.0.0.1:3000"}
        origins = [origin for origin in origins if origin not in forbidden]
        if not origins:
            raise RuntimeError(
                "Production CORS origins are empty. Set NIKO_CORS_PROD_ORIGINS or gateway.cors_prod_origins."
            )

    return origins


__all__ = [
    "_is_production_env",
    "_resolve_reload_enabled",
    "_resolve_gateway_host_port",
    "_is_llm_available",
    "_resolve_search_route_mode",
    "_resolve_search_elastic_timeout_ms",
    "_resolve_redis_rate_limit",
    "_resolve_langflow_flow_name",
    "_resolve_governance_hook_enabled",
    "_resolve_redis_cache_ttl_seconds",
    "_resolve_search_cache_key",
    "_resolve_ui_bridge_enabled",
    "_parse_origins",
    "_resolve_cors_origins",
]
