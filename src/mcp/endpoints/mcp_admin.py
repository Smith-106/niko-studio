"""
MCP Admin Endpoints

MCP service configuration CRUD endpoints.
"""

import logging
from typing import Dict

from starlette.responses import JSONResponse

from src.mcp.gateway import (
    _MCP_SERVICE_CONFIGS,
    _MCP_SERVICE_HEALTH_CACHE,
    _serialize_service_config,
    _update_service_config,
    _set_service_enabled,
    _utc_now_iso,
)

logger = logging.getLogger("niko-gateway")


async def list_mcp_services(request):
    """列出 MCP 服务配置与运行状态"""
    services = request.query_params.get("services")
    runtime_services: Dict[str, str] = None
    if services:
        runtime_services = {k: v for k, v in [item.split(":", 1) for item in services.split(",") if ":" in item]}

    payload = [
        _serialize_service_config(config, runtime_services)
        for config in _MCP_SERVICE_CONFIGS.values()
    ]
    return JSONResponse({"services": payload})


async def create_mcp_service(request):
    """新增 MCP 服务配置（不挂载运行时路由）"""
    from src.mcp.gateway import _MCP_SERVICE_CONFIGS, _update_service_config, _serialize_service_config

    body = await request.json()
    raw_service_id = str(body.get("id") or body.get("service_id") or "").strip().lower()
    if not raw_service_id:
        return JSONResponse({"error": "id is required"}, status_code=400)
    if raw_service_id in _MCP_SERVICE_CONFIGS:
        return JSONResponse({"error": f"service '{raw_service_id}' already exists"}, status_code=409)

    try:
        config = _update_service_config(raw_service_id, body, create_if_missing=True)
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=400)

    return JSONResponse({"service": _serialize_service_config(config)}, status_code=201)


async def update_mcp_service(request):
    """更新 MCP 服务配置"""
    from src.mcp.gateway import _update_service_config, _serialize_service_config

    service_id = request.path_params.get("service_id", "").strip().lower()
    if not service_id:
        return JSONResponse({"error": "service_id is required"}, status_code=400)

    body = await request.json()
    body.setdefault("service_id", service_id)

    try:
        config = _update_service_config(service_id, body, create_if_missing=False)
    except KeyError:
        return JSONResponse({"error": f"service '{service_id}' not found"}, status_code=404)
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=400)

    return JSONResponse({"service": _serialize_service_config(config)})


async def delete_mcp_service(request):
    """删除 MCP 服务配置"""
    from src.mcp.gateway import _MCP_SERVICE_CONFIGS, _MCP_SERVICE_HEALTH_CACHE

    service_id = request.path_params.get("service_id", "").strip().lower()
    if not service_id:
        return JSONResponse({"error": "service_id is required"}, status_code=400)

    config = _MCP_SERVICE_CONFIGS.get(service_id)
    if config is None:
        return JSONResponse({"error": f"service '{service_id}' not found"}, status_code=404)

    if config.builtin:
        return JSONResponse({"error": "cannot delete builtin service"}, status_code=400)

    del _MCP_SERVICE_CONFIGS[service_id]
    _MCP_SERVICE_HEALTH_CACHE.pop(service_id, None)

    return JSONResponse({"status": "deleted", "service_id": service_id})


async def set_mcp_service_enabled(request):
    """启用/禁用 MCP 服务"""
    from src.mcp.gateway import _set_service_enabled, _serialize_service_config

    service_id = request.path_params.get("service_id", "").strip().lower()
    if not service_id:
        return JSONResponse({"error": "service_id is required"}, status_code=400)

    body = await request.json()
    enabled = body.get("enabled")
    if not isinstance(enabled, bool):
        return JSONResponse({"error": "enabled must be boolean"}, status_code=400)

    try:
        config = _set_service_enabled(service_id, enabled)
    except KeyError:
        return JSONResponse({"error": f"service '{service_id}' not found"}, status_code=404)
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=400)

    return JSONResponse({"service": _serialize_service_config(config)})


async def probe_mcp_service_health(request):
    """探测 MCP 服务健康态（模拟探测，不触发真实网络调用）"""
    from src.mcp.gateway import _MCP_SERVICE_CONFIGS, _MCP_SERVICE_HEALTH_CACHE, _utc_now_iso

    service_id = request.path_params.get("service_id", "").strip().lower()
    config = _MCP_SERVICE_CONFIGS.get(service_id)
    if config is None:
        return JSONResponse({"error": f"service '{service_id}' not found"}, status_code=404)

    status = "ok" if config.enabled else "disabled"
    _MCP_SERVICE_HEALTH_CACHE[service_id] = status
    return JSONResponse({
        "service": {
            "id": service_id,
            "status": status,
            "enabled": config.enabled,
            "checked_at": _utc_now_iso(),
        }
    })


__all__ = [
    "list_mcp_services",
    "create_mcp_service",
    "update_mcp_service",
    "delete_mcp_service",
    "set_mcp_service_enabled",
    "probe_mcp_service_health",
]
