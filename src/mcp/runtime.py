"""
MCP Gateway Runtime State

Runtime state management and health observability for the MCP gateway.
"""

import time
from typing import Any, Dict, Optional

from src.integrations.adapters import create_integration_adapters
from src.mcp.service_config import (
    _MCP_SERVICE_CONFIGS,
    _RUNTIME_SERVER_ORDER,
    _service_runtime_status,
)


# ============ Runtime State ============

_RUNTIME_SESSION_ID = f"gw-{int(time.time() * 1000)}"
_RUNTIME_LAST_PROBE_AT: Optional[str] = None
_RUNTIME_RECONNECT_ATTEMPTS = 0
_RUNTIME_LAST_ERROR: Optional[str] = None
_INTEGRATION_ADAPTERS = create_integration_adapters()


# ============ Runtime State Helpers ============

def _to_runtime_connection_state(status: str, services: Dict[str, str]) -> str:
    """Convert health status to connection state."""
    if status == "healthy":
        return "connected"
    core_services = ["memory", "graph", "search", "workflow", "critic"]
    core_statuses = [services.get(name, "unknown") for name in core_services]
    if any(value == "ok" for value in core_statuses):
        return "degraded"
    return "disconnected"


def _to_runtime_reconnect_state(connection_state: str) -> str:
    """Convert connection state to reconnect state."""
    if connection_state == "connected":
        return "idle"
    if connection_state == "degraded":
        return "probing"
    return "failed"


def _to_server_runtime_state(service_status: str, connection_state: str) -> str:
    """Convert service status and connection state to runtime state."""
    if service_status == "ok":
        return "connected"
    if connection_state == "degraded":
        return "degraded"
    if connection_state == "disconnected":
        return "disconnected"
    return "reconnecting"


def _build_runtime_servers(services: Dict[str, str], connection_state: str, last_error: Optional[str]) -> Dict[str, Dict[str, Any]]:
    """Build runtime server status for all services."""
    return {
        name: {
            "state": _to_server_runtime_state(services.get(name, "unknown"), connection_state),
            "loading": False,
            "last_error": last_error if _service_runtime_status(name, services) not in {"ok", "disabled"} else None,
            "enabled": _MCP_SERVICE_CONFIGS.get(name).enabled if name in _MCP_SERVICE_CONFIGS else True,
        }
        for name in _RUNTIME_SERVER_ORDER
    }


def _service_is_ready(service_id: str, services: Dict[str, str]) -> bool:
    """Check if a service is ready."""
    config = _MCP_SERVICE_CONFIGS.get(service_id)
    if config and not config.enabled:
        return False
    return services.get(service_id, "unknown") == "ok"


def _get_observability_snapshot(services: Dict[str, str], engine_health: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    """Get observability snapshot for health endpoint."""
    runtime_ready = sum(1 for name in _RUNTIME_SERVER_ORDER if _service_is_ready(name, services))
    runtime_total = len(_RUNTIME_SERVER_ORDER)

    layer_status = {
        "memory": services.get("memory", "unknown"),
        "retrieval": services.get("search", "unknown"),
        "workflow": services.get("workflow", "unknown"),
    }

    layer_health = {
        "memory": engine_health.get("memory", {}),
        "retrieval": engine_health.get("search", {}),
        "workflow": engine_health.get("workflow", {}),
    }

    return {
        "runtime": {
            "ready": runtime_ready,
            "total": runtime_total,
            "health_ratio": round(runtime_ready / runtime_total, 4) if runtime_total else 0.0,
        },
        "layers": {
            "status": layer_status,
            "health": layer_health,
        },
    }


__all__ = [
    # Runtime state
    "_RUNTIME_SESSION_ID",
    "_RUNTIME_LAST_PROBE_AT",
    "_RUNTIME_RECONNECT_ATTEMPTS",
    "_RUNTIME_LAST_ERROR",
    "_INTEGRATION_ADAPTERS",
    # Runtime state helpers
    "_to_runtime_connection_state",
    "_to_runtime_reconnect_state",
    "_to_server_runtime_state",
    "_build_runtime_servers",
    "_service_is_ready",
    "_get_observability_snapshot",
]
