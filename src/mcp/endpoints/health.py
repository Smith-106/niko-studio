"""
Health Check Endpoints

Health check, metrics, and tool/model listing endpoints.
"""

import logging
from typing import Dict, List

from starlette.responses import JSONResponse

from src.mcp.gateway import (
    __version__,
    get_config_value,
    load_services_config,
    get_memory_engine,
    get_graph_engine,
    get_search_engine,
    get_workflow_engine,
    get_critic_engine,
    _get_metrics_snapshot,
    _utc_now_iso,
    _RUNTIME_SESSION_ID,
    _RUNTIME_LAST_PROBE_AT,
    _RUNTIME_RECONNECT_ATTEMPTS,
    _RUNTIME_LAST_ERROR,
    _to_runtime_connection_state,
    _to_runtime_reconnect_state,
    _build_runtime_servers,
    _get_observability_snapshot,
    _MCP_SERVICE_CONFIGS,
    _RUNTIME_SERVER_ORDER,
    _serialize_service_config,
    _refresh_service_health_cache,
    _service_runtime_status,
)

logger = logging.getLogger("niko-gateway")


async def health_check(request):
    """健康检查"""
    from src.mcp.gateway import (
        __version__,
        get_memory_engine,
        get_graph_engine,
        get_search_engine,
        get_workflow_engine,
        get_critic_engine,
        _utc_now_iso,
        _RUNTIME_SESSION_ID,
        _RUNTIME_LAST_PROBE_AT,
        _RUNTIME_RECONNECT_ATTEMPTS,
        _RUNTIME_LAST_ERROR,
        _to_runtime_connection_state,
        _to_runtime_reconnect_state,
        _build_runtime_servers,
        _get_observability_snapshot,
        _MCP_SERVICE_CONFIGS,
        _RUNTIME_SERVER_ORDER,
        _serialize_service_config,
        _refresh_service_health_cache,
        _service_runtime_status,
    )
    global _RUNTIME_LAST_PROBE_AT, _RUNTIME_RECONNECT_ATTEMPTS, _RUNTIME_LAST_ERROR

    engine_health = {}
    dependency_getters = (
        ("memory", get_memory_engine),
        ("graph", get_graph_engine),
        ("search", get_search_engine),
        ("workflow", get_workflow_engine),
        ("critic", get_critic_engine),
    )

    for name, getter in dependency_getters:
        try:
            engine = getter()
            if hasattr(engine, "health_check"):
                health = await engine.health_check()
                if isinstance(health, dict):
                    normalized = dict(health)
                    if "status" not in normalized:
                        db_ok = normalized.get("db_ok")
                        if db_ok is False:
                            normalized["status"] = "error"
                        else:
                            normalized["status"] = "ok"
                    engine_health[name] = normalized
                else:
                    engine_health[name] = {"status": "ok"}
            else:
                engine_health[name] = {"status": "ok"}
        except Exception as exc:
            engine_health[name] = {"status": "error", "error": str(exc)}

    core_dependencies = ["memory", "graph", "search", "workflow", "critic"]
    degraded = any(engine_health.get(name, {}).get("status") != "ok" for name in core_dependencies)
    status = "degraded" if degraded else "healthy"

    services = {
        "memory": engine_health["memory"].get("status", "ok"),
        "graph": engine_health["graph"].get("status", "ok"),
        "search": engine_health["search"].get("status", "ok"),
        "workflow": engine_health["workflow"].get("status", "ok"),
        "critic": engine_health["critic"].get("status", "ok"),
        "agent": "ok",
        "skills": "ok",
    }

    for service_id, config in _MCP_SERVICE_CONFIGS.items():
        if not config.enabled:
            services[service_id] = "disabled"

    _refresh_service_health_cache(services)

    _RUNTIME_LAST_PROBE_AT = _utc_now_iso()
    failing_services = [
        f"{name}:{_service_runtime_status(name, services)}"
        for name in _RUNTIME_SERVER_ORDER
        if _service_runtime_status(name, services) not in {"ok", "disabled"}
    ]
    if failing_services:
        _RUNTIME_LAST_ERROR = "; ".join(failing_services)
        _RUNTIME_RECONNECT_ATTEMPTS += 1
    else:
        _RUNTIME_LAST_ERROR = None
        _RUNTIME_RECONNECT_ATTEMPTS = 0

    connection_state = _to_runtime_connection_state(status, services)
    reconnect_state = _to_runtime_reconnect_state(connection_state)

    response = JSONResponse({
        "status": status,
        "version": __version__,
        "services": services,
        "engine_health": engine_health,
        "observability": _get_observability_snapshot(services, engine_health),
        "agents": ["commander", "architect", "writer", "critic", "worldbuilding", "character", "plot"],
        "skills_count": 40,
        "mcp_runtime": {
            "session_id": _RUNTIME_SESSION_ID,
            "connection_state": connection_state,
            "reconnect_state": reconnect_state,
            "last_probe_at": _RUNTIME_LAST_PROBE_AT,
            "reconnect_attempts": _RUNTIME_RECONNECT_ATTEMPTS,
            "last_error": _RUNTIME_LAST_ERROR,
            "servers": _build_runtime_servers(services, connection_state, _RUNTIME_LAST_ERROR),
            "service_configs": [
                _serialize_service_config(config, services)
                for config in _MCP_SERVICE_CONFIGS.values()
            ],
        },
    })
    return response


async def metrics_endpoint(request):
    """最小指标端点"""
    from src.mcp.gateway import get_config_value, _get_metrics_snapshot, _RUNTIME_SESSION_ID, _RUNTIME_RECONNECT_ATTEMPTS, _RUNTIME_LAST_PROBE_AT, _RUNTIME_LAST_ERROR

    metrics_enabled = bool(get_config_value("gateway.metrics_enabled", True))
    if not metrics_enabled:
        return JSONResponse({"status": "disabled"}, status_code=404)

    return JSONResponse({
        "status": "ok",
        "metrics": _get_metrics_snapshot(),
        "runtime": {
            "session_id": _RUNTIME_SESSION_ID,
            "reconnect_attempts": _RUNTIME_RECONNECT_ATTEMPTS,
            "last_probe_at": _RUNTIME_LAST_PROBE_AT,
            "last_error": _RUNTIME_LAST_ERROR,
        },
    })


async def list_tools(request):
    """列出所有可用工具"""
    tools = {
        "memory": [
            "memory_add", "memory_search", "memory_get_temporal",
            "memory_get_conflicts", "memory_resolve_conflict"
        ],
        "graph": [
            "graph_query", "graph_get_character", "graph_get_relationships",
            "graph_get_foreshadows", "graph_add_entity", "graph_add_relation"
        ],
        "search": [
            "search_hybrid", "search_iterative", "search_context"
        ],
        "workflow": [
            "workflow_route", "workflow_plan", "workflow_execute",
            "checkpoint_create", "checkpoint_restore", "checkpoint_list"
        ],
        "critic": [
            "evaluate_content", "get_improvement_suggestions", "compare_versions"
        ],
        "agent": [
            "agent_route", "agent_write", "agent_revise", "agent_get_context"
        ],
        "skills": [
            "skills_list", "skills_match", "skills_load", "skills_get_chain"
        ],
        "writing_helper": [
            "process_writing_helper"
        ]
    }
    return JSONResponse(tools)


async def list_models(request):
    """列出模型配置（支持按 provider 过滤）"""
    from src.mcp.gateway import load_services_config

    provider_filter = (request.query_params.get("provider") or "").strip().lower()

    try:
        service_config = load_services_config()
    except Exception as exc:
        logger.error(f"Load services config failed: {exc}")
        return JSONResponse({"error": str(exc)}, status_code=500)

    provider_models: Dict[str, List[str]] = {}
    for provider_cfg in service_config.providers:
        provider_id = provider_cfg.provider.value
        candidates = [
            provider_cfg.model_mapping.get(tier, "")
            for tier in provider_cfg.model_mapping
        ]
        if provider_cfg.embedding_model:
            candidates.append(provider_cfg.embedding_model)

        models = list(dict.fromkeys([model for model in candidates if model]))
        provider_models[provider_id] = models

    if provider_filter:
        if provider_filter not in provider_models:
            return JSONResponse({"status": "not_found", "provider": provider_filter, "models": []}, status_code=404)
        return JSONResponse({
            "status": "ok",
            "provider": provider_filter,
            "models": provider_models[provider_filter],
        })

    merged_models = list(dict.fromkeys([m for models in provider_models.values() for m in models]))
    return JSONResponse({
        "status": "ok",
        "models": merged_models,
        "providers": provider_models,
    })


__all__ = [
    "health_check",
    "metrics_endpoint",
    "list_tools",
    "list_models",
]
