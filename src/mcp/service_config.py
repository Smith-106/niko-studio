"""
MCP Gateway Service Configuration

Service configuration dataclass and management functions for MCP services.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, Optional


@dataclass
class McpServiceConfig:
    """MCP service configuration."""
    service_id: str
    name: str
    path: str
    enabled: bool = True
    builtin: bool = False
    health_url: Optional[str] = None
    transport: str = "streamable-http"


# MCP service configuration registry
_MCP_SERVICE_CONFIGS: Dict[str, McpServiceConfig] = {
    "memory": McpServiceConfig(service_id="memory", name="Memory", path="/memory", enabled=True, builtin=True),
    "graph": McpServiceConfig(service_id="graph", name="Graph", path="/graph", enabled=True, builtin=True),
    "search": McpServiceConfig(service_id="search", name="Search", path="/search", enabled=True, builtin=True),
    "workflow": McpServiceConfig(service_id="workflow", name="Workflow", path="/workflow", enabled=True, builtin=True),
    "critic": McpServiceConfig(service_id="critic", name="Critic", path="/critic", enabled=True, builtin=True),
    "agent": McpServiceConfig(service_id="agent", name="Agent", path="/agent", enabled=True, builtin=True),
    "skills": McpServiceConfig(service_id="skills", name="Skills", path="/skills", enabled=True, builtin=True),
}

# Service health status cache
_MCP_SERVICE_HEALTH_CACHE: Dict[str, str] = {service_id: "unknown" for service_id in _MCP_SERVICE_CONFIGS}

# Runtime server order for consistent display
_RUNTIME_SERVER_ORDER = ["memory", "graph", "search", "workflow", "critic", "agent", "skills"]


def _serialize_service_config(config: McpServiceConfig, services: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    """Serialize service config to JSON-serializable dict."""
    runtime_status = "unknown"
    if services is not None:
        runtime_status = _service_runtime_status(config.service_id, services)
    elif config.service_id in _MCP_SERVICE_HEALTH_CACHE:
        runtime_status = _MCP_SERVICE_HEALTH_CACHE[config.service_id]

    return {
        "id": config.service_id,
        "name": config.name,
        "path": config.path,
        "enabled": config.enabled,
        "builtin": config.builtin,
        "transport": config.transport,
        "health_url": config.health_url,
        "status": runtime_status,
    }


def _normalize_service_config_payload(service_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize and validate service config payload."""
    normalized = {
        "service_id": service_id.strip().lower(),
        "name": str(body.get("name") or service_id).strip(),
        "path": str(body.get("path") or f"/{service_id}").strip(),
        "enabled": bool(body.get("enabled", True)),
        "builtin": bool(body.get("builtin", False)),
        "health_url": body.get("health_url"),
        "transport": str(body.get("transport") or "streamable-http").strip() or "streamable-http",
    }

    if not normalized["service_id"]:
        raise ValueError("service_id is required")

    if not normalized["path"]:
        raise ValueError("path is required")

    if not normalized["path"].startswith("/"):
        normalized["path"] = f"/{normalized['path']}"

    if normalized["health_url"] is not None:
        normalized["health_url"] = str(normalized["health_url"]).strip() or None

    return normalized


def _update_service_config(service_id: str, body: Dict[str, Any], *, create_if_missing: bool = False) -> McpServiceConfig:
    """Update or create service configuration."""
    current = _MCP_SERVICE_CONFIGS.get(service_id)
    if current is None and not create_if_missing:
        raise KeyError(service_id)

    if current is not None:
        if current.builtin and body.get("path") is not None:
            raise ValueError("builtin service path is immutable")
        if current.builtin and body.get("builtin") is False:
            raise ValueError("builtin service cannot be downgraded")

    payload = _normalize_service_config_payload(service_id, body)

    if current is None:
        updated = McpServiceConfig(**payload)
    else:
        updated = McpServiceConfig(
            service_id=current.service_id,
            name=payload["name"],
            path=current.path if current.builtin else payload["path"],
            enabled=payload["enabled"],
            builtin=current.builtin,
            health_url=payload["health_url"],
            transport=payload["transport"],
        )

    _MCP_SERVICE_CONFIGS[updated.service_id] = updated
    _MCP_SERVICE_HEALTH_CACHE.setdefault(updated.service_id, "unknown")
    return updated


def _set_service_enabled(service_id: str, enabled: bool) -> McpServiceConfig:
    """Enable or disable a service."""
    config = _MCP_SERVICE_CONFIGS.get(service_id)
    if config is None:
        raise KeyError(service_id)

    if config.builtin and not enabled:
        raise ValueError("builtin service cannot be disabled")

    updated = McpServiceConfig(
        service_id=config.service_id,
        name=config.name,
        path=config.path,
        enabled=enabled,
        builtin=config.builtin,
        health_url=config.health_url,
        transport=config.transport,
    )
    _MCP_SERVICE_CONFIGS[service_id] = updated
    return updated


def _refresh_service_health_cache(services: Dict[str, str]) -> None:
    """Refresh the service health status cache."""
    for service_id in _MCP_SERVICE_CONFIGS:
        _MCP_SERVICE_HEALTH_CACHE[service_id] = _service_runtime_status(service_id, services)


def _service_runtime_status(service_id: str, services: Dict[str, str]) -> str:
    """Get service runtime status from health check results."""
    config = _MCP_SERVICE_CONFIGS.get(service_id)
    if config and not config.enabled:
        return "disabled"
    return services.get(service_id, "unknown")


__all__ = [
    "McpServiceConfig",
    "_MCP_SERVICE_CONFIGS",
    "_MCP_SERVICE_HEALTH_CACHE",
    "_RUNTIME_SERVER_ORDER",
    "_serialize_service_config",
    "_normalize_service_config_payload",
    "_update_service_config",
    "_set_service_enabled",
    "_refresh_service_health_cache",
    "_service_runtime_status",
]
