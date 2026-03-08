"""
Niko-Studio MCP Gateway - 统一入口，支持多模型并行调用

运行方式:
    # 开发环境（默认支持 reload）
    uvicorn src.mcp.gateway:app --host 0.0.0.0 --port 8000 --reload
    # 生产环境（默认关闭 reload）
    NIKO_ENV=production uvicorn src.mcp.gateway:app --host 0.0.0.0 --port 8000

客户端连接:
    - http://localhost:8000/memory   (记忆服务)
    - http://localhost:8000/graph    (图谱服务)
    - http://localhost:8000/search   (搜索服务)
    - http://localhost:8000/workflow (工作流服务)
    - http://localhost:8000/critic   (评估服务)

注意: Skills 不再是 MCP 服务！
    - Skills 是静态知识文件，直接本地读取
    - 使用 src.skills.load_skill() 加载
    - 使用 @skill:name 引用语法

支持的模型客户端:
    - Claude Code (主写作)
    - Codex CLI (评审)
    - Gemini Agent (规划)
    - Qwen Agent (翻译)
    - 任何支持 MCP 的客户端
"""

import contextlib
import logging
import asyncio
import time
import os
import math
import inspect
import io
import base64
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Iterable
from pathlib import Path

from src import __version__
from src.config import get_config_value
from src.integrations.adapters import create_integration_adapters
from src.knowledge.services import get_services
from src.knowledge.services.config import load_config as load_services_config
from src.workflow.state import (
    NOVEL_PASS_SCORE,
    NOVEL_HUMAN_REVIEW_SCORE,
)
from src.cli.commands.genre_profile import genre_to_generation_recommendation


def _merge_recommendations_with_genre(
    recommendations: Optional[List[Dict[str, Any]]],
    genre: Optional[str],
) -> Optional[List[Dict[str, Any]]]:
    merged: List[Dict[str, Any]] = []
    if isinstance(recommendations, list):
        merged = list(recommendations)

    genre_recommendation = genre_to_generation_recommendation(str(genre or "none"))
    if genre_recommendation is None:
        return merged if merged else recommendations

    merged.append(genre_recommendation)
    return merged


from starlette.applications import Starlette
from starlette.routing import Mount, Route
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, StreamingResponse
from mcp.server.fastmcp import FastMCP

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("niko-gateway")

# ============ 网关运行时指标 ============

_METRICS = {
    "requests_total": 0,
    "requests_failed_total": 0,
    "latency_ms_total": 0.0,
    "latency_ms_max": 0.0,
}

_RUNTIME_SERVER_ORDER = ["memory", "graph", "search", "workflow", "critic", "agent", "skills"]


@dataclass
class McpServiceConfig:
    service_id: str
    name: str
    path: str
    enabled: bool = True
    builtin: bool = False
    health_url: Optional[str] = None
    transport: str = "streamable-http"


_MCP_SERVICE_CONFIGS: Dict[str, McpServiceConfig] = {
    "memory": McpServiceConfig(service_id="memory", name="Memory", path="/memory", enabled=True, builtin=True),
    "graph": McpServiceConfig(service_id="graph", name="Graph", path="/graph", enabled=True, builtin=True),
    "search": McpServiceConfig(service_id="search", name="Search", path="/search", enabled=True, builtin=True),
    "workflow": McpServiceConfig(service_id="workflow", name="Workflow", path="/workflow", enabled=True, builtin=True),
    "critic": McpServiceConfig(service_id="critic", name="Critic", path="/critic", enabled=True, builtin=True),
    "agent": McpServiceConfig(service_id="agent", name="Agent", path="/agent", enabled=True, builtin=True),
    "skills": McpServiceConfig(service_id="skills", name="Skills", path="/skills", enabled=True, builtin=True),
}

_MCP_SERVICE_HEALTH_CACHE: Dict[str, str] = {service_id: "unknown" for service_id in _MCP_SERVICE_CONFIGS}

_RUNTIME_SESSION_ID = f"gw-{int(time.time() * 1000)}"
_RUNTIME_LAST_PROBE_AT: Optional[str] = None
_RUNTIME_RECONNECT_ATTEMPTS = 0
_RUNTIME_LAST_ERROR: Optional[str] = None
_INTEGRATION_ADAPTERS = create_integration_adapters()


def _record_request_metrics(status_code: int, latency_ms: float) -> None:
    _METRICS["requests_total"] += 1
    if status_code >= 400:
        _METRICS["requests_failed_total"] += 1
    _METRICS["latency_ms_total"] += latency_ms
    if latency_ms > _METRICS["latency_ms_max"]:
        _METRICS["latency_ms_max"] = latency_ms


def _get_metrics_snapshot() -> dict:
    requests_total = _METRICS["requests_total"]
    requests_failed = _METRICS["requests_failed_total"]
    latency_total = _METRICS["latency_ms_total"]
    avg_latency = latency_total / requests_total if requests_total else 0.0
    return {
        "requests_total": requests_total,
        "requests_failed_total": requests_failed,
        "requests_success_total": requests_total - requests_failed,
        "latency_ms_avg": round(avg_latency, 2),
        "latency_ms_max": round(_METRICS["latency_ms_max"], 2),
    }


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _to_runtime_connection_state(status: str, services: Dict[str, str]) -> str:
    if status == "healthy":
        return "connected"
    core_services = ["memory", "graph", "search", "workflow", "critic"]
    core_statuses = [services.get(name, "unknown") for name in core_services]
    if any(value == "ok" for value in core_statuses):
        return "degraded"
    return "disconnected"


def _to_runtime_reconnect_state(connection_state: str) -> str:
    if connection_state == "connected":
        return "idle"
    if connection_state == "degraded":
        return "probing"
    return "failed"


def _to_server_runtime_state(service_status: str, connection_state: str) -> str:
    if service_status == "ok":
        return "connected"
    if connection_state == "degraded":
        return "degraded"
    if connection_state == "disconnected":
        return "disconnected"
    return "reconnecting"


def _build_runtime_servers(services: Dict[str, str], connection_state: str, last_error: Optional[str]) -> Dict[str, Dict[str, Any]]:
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
    config = _MCP_SERVICE_CONFIGS.get(service_id)
    if config and not config.enabled:
        return False
    return services.get(service_id, "unknown") == "ok"


def _service_runtime_status(service_id: str, services: Dict[str, str]) -> str:
    config = _MCP_SERVICE_CONFIGS.get(service_id)
    if config and not config.enabled:
        return "disabled"
    return services.get(service_id, "unknown")


def _get_observability_snapshot(services: Dict[str, str], engine_health: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
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


def _serialize_service_config(config: McpServiceConfig, services: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
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
    for service_id in _MCP_SERVICE_CONFIGS:
        _MCP_SERVICE_HEALTH_CACHE[service_id] = _service_runtime_status(service_id, services)


def _is_production_env() -> bool:
    env = str(os.getenv("NIKO_ENV") or get_config_value("env", "development")).lower()
    return env in {"prod", "production"}



def _resolve_reload_enabled() -> bool:
    if _is_production_env():
        return False
    raw = os.getenv("NIKO_GATEWAY_RELOAD")
    if raw is not None:
        return str(raw).strip().lower() in {"true", "1", "yes", "on"}
    return bool(get_config_value("gateway.reload", True))


def _resolve_gateway_host_port() -> tuple[str, int]:
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
    raw = os.getenv("NIKO_SEARCH_ROUTE_MODE")
    if raw is None:
        raw = get_config_value("integration.search_route_mode", "legacy")
    mode = str(raw).strip().lower() if raw is not None else "legacy"
    if mode not in {"legacy", "elastic", "hybrid"}:
        return "legacy"
    return mode


def _resolve_search_elastic_timeout_ms() -> int:
    raw = os.getenv("NIKO_SEARCH_ELASTIC_TIMEOUT_MS")
    if raw is None:
        raw = get_config_value("integration.search_elastic_timeout_ms", 300)
    try:
        timeout = int(raw)
    except (TypeError, ValueError):
        timeout = 300
    return max(timeout, 50)


def _resolve_redis_rate_limit() -> tuple[int, int]:
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
    raw = os.getenv("NIKO_LANGFLOW_FLOW_NAME")
    if raw is None:
        raw = get_config_value("integration.langflow_flow_name", "niko-search-pilot")
    flow_name = str(raw).strip() if raw is not None else "niko-search-pilot"
    return flow_name or "niko-search-pilot"


def _resolve_governance_hook_enabled() -> bool:
    raw = os.getenv("NIKO_DBHUB_GOVERNANCE_ENABLED")
    if raw is not None:
        return str(raw).strip().lower() in {"1", "true", "yes", "on"}
    return bool(get_config_value("integration.dbhub_governance_enabled", False))


def _resolve_redis_cache_ttl_seconds() -> int:
    raw = os.getenv("NIKO_REDIS_CACHE_TTL_SECONDS")
    if raw is None:
        raw = get_config_value("integration.redis_cache_ttl_seconds", 120)
    try:
        ttl = int(raw)
    except (TypeError, ValueError):
        ttl = 120
    return max(ttl, 1)


def _resolve_search_cache_key(query: str, scope: str, limit: int, profile: str | None) -> str:
    profile_part = profile or "default"
    return f"search:{scope}:{limit}:{profile_part}:{query.strip().lower()}"


def _resolve_ui_bridge_enabled() -> bool:
    raw = os.getenv("NIKO_UI_BRIDGE_ENABLED")
    if raw is not None:
        return str(raw).strip().lower() in {"true", "1", "yes", "on"}
    return bool(get_config_value("gateway.ui_bridge_enabled", False))


def _ui_bridge_disabled_response() -> JSONResponse:
    return JSONResponse(
        {
            "status": "disabled",
            "reason": "ui_bridge_disabled",
            "hint": "Set NIKO_UI_BRIDGE_ENABLED=1 or gateway.ui_bridge_enabled=true",
        },
        status_code=404,
    )


def _parse_origins(raw: Any) -> list[str]:
    if isinstance(raw, str):
        return [item.strip() for item in raw.split(",") if item.strip()]
    if isinstance(raw, Iterable):
        return [str(item).strip() for item in raw if str(item).strip()]
    return []


def _resolve_cors_origins() -> list[str]:
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


class GatewayMetricsMiddleware(BaseHTTPMiddleware):
    """网关请求指标采集中间件"""

    async def dispatch(self, request, call_next):
        start = time.perf_counter()
        response = None
        try:
            response = await call_next(request)
            return response
        finally:
            elapsed_ms = (time.perf_counter() - start) * 1000
            status_code = response.status_code if response is not None else 500
            _record_request_metrics(status_code, elapsed_ms)


# ============ 延迟导入引擎 (通过 ServiceContainer) ============

from src.container import get_container, reset_container
from src.workflow.base_state import create_base_state
from src.workflow.levels.level5_coordinator import Level5Coordinator
from src.workflow.levels.types import ANALYSIS_SCHEMA_VERSION, LEGACY_DECISION_MAP, ensure_contract_payload
from src.workflow.novel_quality import evaluate_novel_quality
from src.services.document_loader import DocumentLoader
from src.services.writing_helper import process_writing_helper


def _with_contract(payload: Dict[str, Any]) -> Dict[str, Any]:
    return ensure_contract_payload(payload)


def _with_terminal_contract(payload: Dict[str, Any]) -> Dict[str, Any]:
    normalized = _with_contract(payload)
    if "decision" not in normalized:
        normalized["decision"] = "go"
    if "terminal" not in normalized:
        normalized["terminal"] = "done"

    terminal = normalized.get("terminal")
    legacy_terminal = terminal
    if terminal == "interrupted":
        legacy_terminal = "aborted"
    elif terminal == "recovered":
        legacy_terminal = "done"

    legacy_fields = normalized.get("legacy_contract_fields")
    if not isinstance(legacy_fields, dict):
        legacy_fields = {}
    legacy_fields.setdefault("decision", normalized.get("decision"))
    legacy_fields.setdefault("terminal", legacy_terminal)
    legacy_fields.setdefault("terminal_state", legacy_terminal)
    normalized["legacy_contract_fields"] = legacy_fields
    normalized.setdefault("terminal_state", legacy_terminal)
    return normalized


_PROHIBITED_DETECTION_KEYS = {
    "anti_detection",
    "bypass_detector",
    "pass_gptzero",
    "detector_bypass",
    "humanize_for_detector",
}

_PROHIBITED_DETECTION_TERMS = (
    "ai detection",
    "ai detector",
    "bypass detector",
    "bypass ai detector",
    "evade detector",
    "avoid detection",
    "pass gptzero",
    "检测对抗",
    "反检测",
    "规避检测",
)


def _contains_detection_evasion_intent(value: Any) -> bool:
    if isinstance(value, dict):
        for key, nested in value.items():
            key_str = str(key).lower()
            if key_str in _PROHIBITED_DETECTION_KEYS:
                return True
            if _contains_detection_evasion_intent(nested):
                return True
        return False

    if isinstance(value, list):
        return any(_contains_detection_evasion_intent(item) for item in value)

    if isinstance(value, str):
        lowered = value.lower()
        return any(term in lowered for term in _PROHIBITED_DETECTION_TERMS)

    return False


def _resolve_detection_evasion_guard_enabled() -> bool:
    raw = os.getenv("NIKO_DETECTION_EVASION_GUARD")
    if raw is not None:
        return str(raw).strip().lower() in {"1", "true", "yes", "on"}
    return bool(get_config_value("gateway.detection_evasion_guard", True))


def _guard_detection_evasion_payload(
    payload: Dict[str, Any],
    enabled_override: Optional[bool] = None,
) -> Optional[JSONResponse]:
    guard_enabled = _resolve_detection_evasion_guard_enabled() if enabled_override is None else bool(enabled_override)
    if not guard_enabled:
        return None
    if _contains_detection_evasion_intent(payload):
        return JSONResponse(
            {
                "error": "DETECTION_EVASION_BLOCKED",
                "code": "COMPLIANCE_DETECTION_EVASION_BLOCKED",
                "message": "检测规避相关请求已被拦截。请改用质量增强目标（自然表达、可读性、风格一致性、逻辑连贯与可执行编辑建议）。",
            },
            status_code=400,
        )
    return None

def _quality_default_payload() -> Dict[str, Any]:
    return {
        "analysis_schema_version": ANALYSIS_SCHEMA_VERSION,
        "quality_score": 0.0,
        "issues": [],
        "metrics": {
            "dialogue_ratio": 0.0,
            "conflict_points": 0,
            "visual_details": 0,
            "template_sentence_ratio": 0.0,
            "dimension_scores": {
                "repetition": 0.0,
                "tone": 0.0,
                "clarity": 0.0,
                "causality": 0.0,
                "detail": 0.0,
                "factuality": 0.0,
            },
            "retrieval": {
                "stage1_candidates": 0,
                "stage2_selected": 0,
                "cited_count": 0,
                "effective_hit_rate": 0.0,
            },
            "context_budget": {
                "token_total": 0,
                "token_effective": 0,
                "utilization": 0.0,
            },
            "self_learning": {
                "strategy_adoption_rate": 0.0,
                "reflector_triggered": False,
                "curator_applied": False,
            },
        },
        "publish_recommendation": "revise",
    }


def _normalize_self_learning_metrics(value: Any, fallback: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(value, dict):
        value = {}
    return {
        "strategy_adoption_rate": _normalize_ratio(
            value.get("strategy_adoption_rate"),
            fallback.get("strategy_adoption_rate", 0.0),
        ),
        "reflector_triggered": bool(value.get("reflector_triggered", fallback.get("reflector_triggered", False))),
        "curator_applied": bool(value.get("curator_applied", fallback.get("curator_applied", False))),
    }


def _normalize_quality_payload(payload: Any) -> Dict[str, Any]:
    fallback = _quality_default_payload()
    if not isinstance(payload, dict):
        payload = {}

    raw_metrics = payload.get("metrics")
    if not isinstance(raw_metrics, dict):
        raw_metrics = {}

    raw_dim_scores = raw_metrics.get("dimension_scores")
    if not isinstance(raw_dim_scores, dict):
        raw_dim_scores = {}

    fallback_metrics = fallback["metrics"]
    fallback_dim_scores = fallback_metrics["dimension_scores"]

    normalized_dim_scores = {
        key: _normalize_quality_score(raw_dim_scores.get(key), default)
        for key, default in fallback_dim_scores.items()
    }

    normalized_metrics = {
        "dialogue_ratio": _normalize_ratio(raw_metrics.get("dialogue_ratio"), fallback_metrics["dialogue_ratio"]),
        "conflict_points": _normalize_count(raw_metrics.get("conflict_points"), fallback_metrics["conflict_points"]),
        "visual_details": _normalize_count(raw_metrics.get("visual_details"), fallback_metrics["visual_details"]),
        "template_sentence_ratio": _normalize_ratio(
            raw_metrics.get("template_sentence_ratio"),
            fallback_metrics["template_sentence_ratio"],
        ),
        "dimension_scores": normalized_dim_scores,
        "retrieval": _normalize_retrieval_metrics(raw_metrics.get("retrieval"), fallback_metrics["retrieval"]),
        "context_budget": _normalize_context_budget_metrics(
            raw_metrics.get("context_budget"),
            fallback_metrics["context_budget"],
        ),
        "self_learning": _normalize_self_learning_metrics(
            raw_metrics.get("self_learning"),
            fallback_metrics["self_learning"],
        ),
    }

    raw_issues = payload.get("issues")
    if not isinstance(raw_issues, list):
        raw_issues = []
    normalized_issues = [_normalize_issue_item(item) for item in raw_issues if isinstance(item, dict)]

    contract_payload = ensure_contract_payload(payload)
    if not isinstance(contract_payload, dict):
        contract_payload = {}
    schema_version = _normalize_schema_version(payload, contract_payload)

    return {
        "analysis_schema_version": schema_version,
        "quality_score": _normalize_quality_score(payload.get("quality_score"), fallback["quality_score"]),
        "issues": normalized_issues,
        "metrics": normalized_metrics,
        "publish_recommendation": _normalize_publish_recommendation(payload, fallback["publish_recommendation"]),
    }


def _normalize_schema_version(payload: Dict[str, Any], contract_payload: Dict[str, Any]) -> str:
    candidates = [
        payload.get("analysis_schema_version"),
        payload.get("contract_version"),
        contract_payload.get("analysis_schema_version"),
        ANALYSIS_SCHEMA_VERSION,
    ]
    for candidate in candidates:
        if candidate is None:
            continue
        normalized = str(candidate).strip()
        if normalized:
            return normalized
    return ANALYSIS_SCHEMA_VERSION


def _normalize_publish_recommendation(payload: Dict[str, Any], fallback: str) -> str:
    decision_to_publish = {
        "go": "pass",
        "soft_go": "revise",
        "no_go": "block",
    }

    candidates = [
        payload.get("publish_recommendation"),
        payload.get("decision"),
        payload.get("decision_result"),
    ]
    for candidate in candidates:
        if not isinstance(candidate, str):
            continue
        normalized = candidate.strip().lower()
        if normalized in {"pass", "revise", "block"}:
            return normalized
        mapped_decision = LEGACY_DECISION_MAP.get(normalized)
        if mapped_decision in decision_to_publish:
            return decision_to_publish[mapped_decision]

    return fallback


def _normalize_retrieval_metrics(value: Any, fallback: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(value, dict):
        value = {}
    return {
        "stage1_candidates": _normalize_count(value.get("stage1_candidates"), fallback.get("stage1_candidates", 0)),
        "stage2_selected": _normalize_count(value.get("stage2_selected"), fallback.get("stage2_selected", 0)),
        "cited_count": _normalize_count(value.get("cited_count"), fallback.get("cited_count", 0)),
        "effective_hit_rate": _normalize_ratio(value.get("effective_hit_rate"), fallback.get("effective_hit_rate", 0.0)),
    }


def _normalize_context_budget_metrics(value: Any, fallback: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(value, dict):
        value = {}
    return {
        "token_total": _normalize_count(value.get("token_total"), fallback.get("token_total", 0)),
        "token_effective": _normalize_count(value.get("token_effective"), fallback.get("token_effective", 0)),
        "utilization": _normalize_ratio(value.get("utilization"), fallback.get("utilization", 0.0)),
    }


def _merge_quality_sidecar(
    result: Any,
    retrieval_metadata: Any,
    context_budget: Any,
    self_learning: Any = None,
) -> Dict[str, Any]:
    payload = result if isinstance(result, dict) else {}
    merged = dict(payload)

    metrics = merged.get("metrics")
    if not isinstance(metrics, dict):
        metrics = {}
    metrics = dict(metrics)

    if isinstance(retrieval_metadata, dict):
        metrics["retrieval"] = retrieval_metadata
    if isinstance(context_budget, dict):
        metrics["context_budget"] = context_budget
    if isinstance(self_learning, dict):
        metrics["self_learning"] = self_learning

    merged["metrics"] = metrics
    return merged


def _normalize_issue_item(issue: Dict[str, Any]) -> Dict[str, str]:
    return {
        "severity": _normalize_issue_severity(issue.get("severity")),
        "type": _normalize_issue_text(issue.get("type"), "unknown"),
        "evidence": _normalize_issue_text(issue.get("evidence"), ""),
        "suggestion": _normalize_issue_text(issue.get("suggestion"), ""),
    }


def _normalize_issue_severity(value: Any) -> str:
    normalized = _normalize_issue_text(value, "medium").lower()
    if normalized in {"low", "medium", "high"}:
        return normalized
    return "medium"


def _normalize_issue_text(value: Any, default: str) -> str:
    if value is None:
        return default
    normalized = str(value).strip()
    return normalized if normalized else default


def _normalize_quality_score(value: Any, default: float) -> float:
    return _clamp_float(_safe_float(value, default), 0.0, 100.0)


def _normalize_ratio(value: Any, default: float) -> float:
    return _clamp_float(_safe_float(value, default), 0.0, 1.0)


def _normalize_count(value: Any, default: int) -> int:
    return max(0, _safe_int(value, default))


def _clamp_float(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _safe_float(value: Any, default: float) -> float:
    if isinstance(value, bool):
        return float(default)
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return float(default)
    if not math.isfinite(parsed):
        return float(default)
    return parsed


def _safe_int(value: Any, default: int) -> int:
    if isinstance(value, bool):
        return int(default)
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return int(default)
    return parsed


def get_memory_engine():
    """Get memory engine (delegates to container)."""
    return get_container().memory


def get_graph_engine():
    """Get graph engine (delegates to container)."""
    return get_container().graph


def get_search_engine():
    """Get search engine (delegates to container)."""
    return get_container().search


def get_workflow_engine():
    """Get workflow engine (delegates to container)."""
    return get_container().workflow


def get_critic_engine():
    """Get critic engine (delegates to container)."""
    return get_container().critic


async def prewarm_engines():
    """
    Pre-warm critical engines at startup using parallel initialization.

    This reduces cold start latency by initializing engines before first request.
    """
    await get_container().initialize_all()


# ============ 1. 记忆服务 MCP ============

memory_mcp = FastMCP("NikoMemory", stateless_http=True)


@memory_mcp.tool()
async def memory_add(
    content: str,
    layer: str = "session",
    dimension: str = None,
    entity_id: str = None,
    valid_from: str = None,
    valid_until: str = None,
    importance: float = 0.5,
    tags: list = None
) -> dict:
    """
    添加记忆到系统
    
    Args:
        content: 记忆内容
        layer: 记忆层级 (ephemeral/session/user/project)
        dimension: 记忆维度 (timeline/context/character/worldview/preference/experience)
        entity_id: 关联实体ID (用于时序追踪)
        valid_from: 生效时间 (ISO格式)
        valid_until: 失效时间 (ISO格式)
        importance: 重要性 (0-1)
        tags: 标签列表
    
    Returns:
        {"id": "xxx", "status": "created"}
    """
    engine = get_memory_engine()
    return await engine.add(
        content=content,
        layer=layer,
        dimension=dimension,
        entity_id=entity_id,
        valid_from=valid_from,
        valid_until=valid_until,
        importance=importance,
        tags=tags or []
    )


@memory_mcp.tool()
async def memory_search(
    query: str,
    layer: str = None,
    dimensions: list = None,
    entity_id: str = None,
    at_time: str = None,
    limit: int = 10
) -> list:
    """
    搜索记忆
    
    Args:
        query: 搜索查询
        layer: 限定层级
        dimensions: 限定维度列表
        entity_id: 限定实体
        at_time: 时序查询时间点
        limit: 返回数量
    
    Returns:
        [{"id": "xxx", "content": "...", "score": 0.95}, ...]
    """
    engine = get_memory_engine()
    return await engine.search(
        query=query,
        layer=layer,
        dimensions=dimensions,
        entity_id=entity_id,
        at_time=at_time,
        limit=limit
    )


@memory_mcp.tool()
async def memory_get_temporal(
    entity_id: str,
    at_time: str = None
) -> list:
    """
    获取实体在特定时间点的事实 (时序追踪)
    
    Args:
        entity_id: 实体ID
        at_time: 查询时间点 (默认当前)
    
    Returns:
        实体在该时间点有效的所有记忆
    """
    engine = get_memory_engine()
    return await engine.get_temporal_facts(entity_id, at_time)


@memory_mcp.tool()
async def memory_get_conflicts(entity_id: str) -> list:
    """
    获取实体的冲突记忆
    
    Args:
        entity_id: 实体ID
    
    Returns:
        [{"memory_a": {...}, "memory_b": {...}, "conflict_type": "..."}]
    """
    engine = get_memory_engine()
    return await engine.detect_conflicts(entity_id)


@memory_mcp.tool()
async def memory_resolve_conflict(
    memory_id_a: str,
    memory_id_b: str,
    resolution: str = "auto"
) -> dict:
    """
    解决记忆冲突
    
    Args:
        memory_id_a: 记忆A的ID
        memory_id_b: 记忆B的ID
        resolution: 解决策略 (auto/keep_a/keep_b/merge)
    
    Returns:
        解决结果
    """
    engine = get_memory_engine()
    return await engine.resolve_conflict(memory_id_a, memory_id_b, resolution)


# ============ 2. 知识图谱服务 MCP ============

graph_mcp = FastMCP("NikoGraph", stateless_http=True)


@graph_mcp.tool()
async def graph_query(cypher: str) -> list:
    """
    执行 Cypher 查询
    
    Args:
        cypher: Cypher 查询语句
    
    Returns:
        查询结果列表
    """
    engine = get_graph_engine()
    return await engine.execute_cypher(cypher)


@graph_mcp.tool()
async def graph_get_character(
    name: str,
    include_relations: bool = True,
    include_timeline: bool = False
) -> dict:
    """
    获取角色信息
    
    Args:
        name: 角色名称
        include_relations: 是否包含关系
        include_timeline: 是否包含时间线
    
    Returns:
        角色完整信息
    """
    engine = get_graph_engine()
    return await engine.get_character(name, include_relations, include_timeline)


@graph_mcp.tool()
async def graph_get_relationships(
    character: str,
    relationship_type: str = None,
    depth: int = 1
) -> list:
    """
    获取角色关系网络
    
    Args:
        character: 角色名称
        relationship_type: 关系类型过滤
        depth: 查询深度
    
    Returns:
        关系列表
    """
    engine = get_graph_engine()
    return await engine.get_relationships(character, relationship_type, depth)


@graph_mcp.tool()
async def graph_get_foreshadows(
    status: str = "pending",
    chapter: int = None
) -> list:
    """
    获取伏笔状态
    
    Args:
        status: 状态过滤 (pending/resolved/abandoned)
        chapter: 章节过滤
    
    Returns:
        伏笔列表
    """
    engine = get_graph_engine()
    return await engine.get_foreshadows(status, chapter)


@graph_mcp.tool()
async def graph_add_entity(
    entity_type: str,
    name: str,
    properties: dict = None
) -> dict:
    """
    添加实体到图谱
    
    Args:
        entity_type: 实体类型 (Character/Location/Event/Item/Foreshadow)
        name: 实体名称
        properties: 属性字典
    
    Returns:
        {"id": "xxx", "status": "created"}
    """
    engine = get_graph_engine()
    return await engine.create_entity(entity_type, name, properties or {})


@graph_mcp.tool()
async def graph_add_relation(
    from_name: str,
    to_name: str,
    relation_type: str,
    properties: dict = None
) -> dict:
    """
    添加关系
    
    Args:
        from_name: 起始实体名称
        to_name: 目标实体名称
        relation_type: 关系类型
        properties: 关系属性
    
    Returns:
        {"status": "created"}
    """
    engine = get_graph_engine()
    return await engine.create_relation(from_name, to_name, relation_type, properties or {})


# ============ 3. 搜索服务 MCP ============

search_mcp = FastMCP("NikoSearch", stateless_http=True)


@search_mcp.tool()
async def search_hybrid(
    query: str,
    scope: str = "all",
    limit: int = 10,
    profile: str | None = None,
    min_score: float | None = None,
    budget_tokens: int | None = None,
    rerank: bool = False,
    route_mode: str | None = None,
) -> list:
    """
    混合搜索 (向量 + 关键词 + 图谱)

    Args:
        query: 搜索查询
        scope: 搜索范围 (all/memory/graph/files)
        limit: 返回数量
        profile: 检索 profile 名称（可选）
        min_score: 最小分数阈值（可选）
        budget_tokens: 上下文预算 token（可选）
        rerank: 是否启用重排（可选）
        route_mode: 搜索路由 (legacy/elastic/hybrid, 可选)

    Returns:
        搜索结果列表
    """
    flags = _INTEGRATION_ADAPTERS.flags

    if flags.redis_cache_enabled:
        rate_limit, window_seconds = _resolve_redis_rate_limit()
        allowed = await _INTEGRATION_ADAPTERS.cache_rate_limit.allow_request(
            key=f"search:rate:{scope}",
            limit=rate_limit,
            window_seconds=window_seconds,
        )
        if not allowed:
            logger.warning("Redis rate-limit denied request, fallback safe response returned")
            return []

    cache_key = _resolve_search_cache_key(query=query, scope=scope, limit=limit, profile=profile)
    if flags.redis_cache_enabled:
        cached = await _INTEGRATION_ADAPTERS.cache_rate_limit.cache_get(cache_key)
        if isinstance(cached, dict) and isinstance(cached.get("results"), list):
            return cached["results"]

    effective_route_mode = route_mode or _resolve_search_route_mode()
    effective_timeout_ms = _resolve_search_elastic_timeout_ms()

    engine = get_search_engine()
    hybrid_kwargs = {
        "query": query,
        "scope": scope,
        "limit": limit,
        "profile": profile,
        "min_score": min_score,
        "budget_tokens": budget_tokens,
        "rerank": rerank,
    }
    if route_mode is not None or effective_route_mode != "legacy" or effective_timeout_ms != 300:
        hybrid_kwargs["route_mode"] = effective_route_mode
        hybrid_kwargs["elastic_timeout_ms"] = effective_timeout_ms
    results = await engine.hybrid_search(**hybrid_kwargs)


    if flags.redis_cache_enabled:
        ttl_seconds = _resolve_redis_cache_ttl_seconds()
        await _INTEGRATION_ADAPTERS.cache_rate_limit.cache_set(
            cache_key,
            {"results": results},
            ttl_seconds=ttl_seconds,
        )

    if flags.elasticsearch_enabled:
        async def _index_results_async() -> None:
            for item in results[: min(len(results), 10)]:
                if not isinstance(item, dict):
                    continue
                try:
                    await _INTEGRATION_ADAPTERS.search.index_document(item)
                except Exception as exc:
                    logger.warning("Elasticsearch async indexing failed: %s", exc)

        asyncio.create_task(_index_results_async())

    if flags.langflow_enabled:
        try:
            await _INTEGRATION_ADAPTERS.orchestration.run(
                flow_name=_resolve_langflow_flow_name(),
                payload={
                    "query": query,
                    "scope": scope,
                    "limit": limit,
                    "result_count": len(results),
                    "route_mode": effective_route_mode,
                },
            )
        except Exception as exc:
            logger.warning("Langflow orchestration hook failed, continue local-first: %s", exc)

    return results


@search_mcp.tool()
async def search_iterative(
    query: str,
    max_iterations: int = 3,
    confidence_threshold: float = 0.8,
    profile: str | None = None,
    min_score: float | None = None,
    budget_tokens: int | None = None,
    rerank: bool = False,
) -> dict:
    """
    迭代检索 (GAM 模式)

    Args:
        query: 初始查询
        max_iterations: 最大迭代次数
        confidence_threshold: 置信度阈值
        profile: 检索 profile 名称（可选）
        min_score: 最小分数阈值（可选）
        budget_tokens: 上下文预算 token（可选）
        rerank: 是否启用重排（可选）

    Returns:
        {"answer": "...", "sources": [...], "iterations": 2}
    """
    engine = get_search_engine()
    return await engine.iterative_retrieve(
        query=query,
        max_iterations=max_iterations,
        confidence_threshold=confidence_threshold,
        profile=profile,
        min_score=min_score,
        budget_tokens=budget_tokens,
        rerank=rerank,
    )


@search_mcp.tool()
async def search_context(text: str) -> str:
    """
    解析 @引用 并返回上下文
    
    支持的引用类型:
    - @character:名称  → 角色信息
    - @chapter:编号    → 章节内容
    - @memory:查询     → 相关记忆
    - @skill:技能名    → 技能包内容 (本地文件)
    
    Args:
        text: 包含 @引用 的文本
    
    Returns:
        解析后的完整上下文
    
    示例:
        输入: "根据@character:张三的性格，使用@skill:fictional-dream..."
        输出: "[角色:张三] 性格:内向... [技能包:fictional-dream] 内容..."
    """
    engine = get_search_engine()
    return await engine.resolve_context(text)


# ============ 4. 工作流服务 MCP ============

workflow_mcp = FastMCP("NikoWorkflow", stateless_http=True)


@workflow_mcp.tool()
async def workflow_route(task: str) -> dict:
    """
    路由任务到合适的工作流级别 (L1-L5)
    
    Args:
        task: 任务描述
    
    Returns:
        {"level": "L3", "reason": "...", "suggested_workflow": "..."}
    
    级别说明:
        L1: 简单问答
        L2: 段落生成
        L3: 章节创作
        L4: 多章连续
        L5: 全书规划
    """
    engine = get_workflow_engine()
    return await engine.route(task)


@workflow_mcp.tool()
async def workflow_plan(
    task: str,
    level: str = None,
    recommendations: list = None,
    genre: Optional[str] = None,
) -> dict:
    """
    生成执行计划 (Plan 模式)
    
    Args:
        task: 任务描述
        level: 指定级别 (可选)
    
    Returns:
        {"plan_id": "...", "steps": [...], "dependencies": [...]}
    """
    merged_recommendations = _merge_recommendations_with_genre(recommendations, genre)

    if _resolve_governance_hook_enabled():
        try:
            await _INTEGRATION_ADAPTERS.governance.on_schema_workflow(
                event="workflow_plan_requested",
                payload={
                    "task": task,
                    "level": level,
                    "recommendations_count": len(merged_recommendations or []),
                },
            )
        except Exception as exc:
            logger.warning("dbhub governance hook failed, continue local-first: %s", exc)

    engine = get_workflow_engine()
    return await engine.plan(task, level, recommendations=merged_recommendations)


@workflow_mcp.tool()
async def workflow_execute(
    plan_id: str,
    step_id: str = None,
    recommendations: list = None,
    confirm_token: str = None,
) -> dict:
    """
    执行计划 (Act 模式)

    Args:
        plan_id: 计划ID
        step_id: 指定步骤ID (可选,默认执行下一步)

    Returns:
        执行结果
    """
    engine = get_workflow_engine()
    return await engine.execute(
        plan_id,
        step_id,
        recommendations=recommendations,
        confirm_token=confirm_token,
    )


@workflow_mcp.tool()
async def workflow_quick_rollback(
    plan_id: str,
    checkpoint_id: str,
    reason: str = "",
) -> dict:
    """执行快速撤销，恢复到指定 checkpoint。"""
    engine = get_workflow_engine()
    return await engine.quick_rollback(plan_id=plan_id, checkpoint_id=checkpoint_id, reason=reason)


@workflow_mcp.tool()
async def workflow_lifecycle(
    plan_id: str,
    action: str = "status"
) -> dict:
    """
    loop-runner 生命周期控制。

    支持动作:
      - start
      - pause
      - resume
      - stop
      - status
    """
    engine = get_workflow_engine()
    return await engine.lifecycle(plan_id, action)



@workflow_mcp.tool()
async def checkpoint_create(
    description: str = "",
    auto_commit: bool = True
) -> dict:
    """
    创建检查点 (Git-based)
    
    Args:
        description: 检查点描述
        auto_commit: 是否自动提交
    
    Returns:
        {"checkpoint_id": "...", "commit_hash": "..."}
    """
    engine = get_workflow_engine()
    return await engine.create_checkpoint(description, auto_commit)


@workflow_mcp.tool()
async def checkpoint_restore(checkpoint_id: str, confirm_token: str = None) -> dict:
    """
    恢复到检查点

    Args:
        checkpoint_id: 检查点ID

    Returns:
        恢复结果
    """
    engine = get_workflow_engine()
    return await engine.restore_checkpoint(checkpoint_id, confirm_token=confirm_token)


@workflow_mcp.tool()
async def checkpoint_list(limit: int = 10) -> list:
    """
    列出最近的检查点
    
    Args:
        limit: 返回数量
    
    Returns:
        检查点列表
    """
    engine = get_workflow_engine()
    return await engine.list_checkpoints(limit)


# ============ 5. 评估服务 MCP ============

critic_mcp = FastMCP("NikoCritic", stateless_http=True)


@critic_mcp.tool()
async def evaluate_content(
    content: str,
    scene_card: dict = None,
    dimensions: list = None
) -> dict:
    """
    多维度评估内容 (整合 Critic Agent)

    Args:
        content: 待评估内容
        scene_card: 场景卡片 (兼容参数，当前未使用)
        dimensions: 评估维度 (默认全部)
            - lock: LOCK系统 (L/O/C/K)
            - style: 风格质量 (感官/狄更斯/对话/人设/节奏)
            - logic: 逻辑体验 (剧情/读者/设定)

    Returns:
        {
            "decision": "APPROVED/REVISE/REWRITE/HUMAN_REVIEW",
            "total_score": 85.0,
            "lock_score": 32.0,
            "style_score": 30.0,
            "logic_score": 23.0,
            "actionable_feedback": "...",
            "suggestions": [...]
        }
    """
    engine = get_critic_engine()

    # 当前容器中的 CriticEngine.evaluate 签名为 evaluate(content, dimensions=None)
    raw = await engine.evaluate(content, dimensions)

    # 兼容两种结果结构：
    # 1) legacy: total_score/lock_score/style_score/logic_score/actionable_feedback
    # 2) narrative engine: overall_score/dimensions/issues/recommended_skills
    if isinstance(raw, dict) and "total_score" in raw and "actionable_feedback" in raw:
        return raw

    dim_result = raw.get("dimensions", {}) if isinstance(raw, dict) else {}

    def _dim_score(name: str) -> float:
        value = dim_result.get(name, {}).get("score", 0)
        try:
            return float(value)
        except (TypeError, ValueError):
            return 0.0

    # 将 0-10 维度分映射到前端现有 0-100 结构
    lock_score = _dim_score("dream") * 4
    style_score = _dim_score("voice") * 3.5
    logic_score = ((_dim_score("suspense") + _dim_score("character") + _dim_score("premise")) / 3 if dim_result else 0) * 2.5

    overall_score = raw.get("overall_score", 0) if isinstance(raw, dict) else 0
    total_score = float(overall_score) * 10

    issue_list = raw.get("issues", []) if isinstance(raw, dict) else []
    feedback = "；".join(issue_list[:3]) if issue_list else "评估完成"

    suggestions = raw.get("recommended_skills", []) if isinstance(raw, dict) else []

    decision = (
        "APPROVED"
        if total_score >= NOVEL_PASS_SCORE
        else "REVISE"
        if total_score >= NOVEL_HUMAN_REVIEW_SCORE
        else "REWRITE"
    )

    return {
        "decision": decision,
        "total_score": round(total_score, 1),
        "lock_score": round(lock_score, 1),
        "style_score": round(style_score, 1),
        "logic_score": round(logic_score, 1),
        "actionable_feedback": feedback,
        "suggestions": suggestions,
    }


@critic_mcp.tool()
async def get_improvement_suggestions(
    content: str,
    issues: list = None,
    max_suggestions: int = 5
) -> list:
    """
    获取改进建议

    Args:
        content: 待改进内容
        issues: 已识别的问题
        max_suggestions: 最大建议数

    Returns:
        [{"issue": "...", "suggestion": "...", "skill": "...", "priority": "high"}]
    """
    engine = get_critic_engine()
    return await engine.suggest_improvements(content, issues, max_suggestions)


@critic_mcp.tool()
async def compare_versions(
    version_a: str,
    version_b: str
) -> dict:
    """
    比较两个版本的质量差异

    Args:
        version_a: 版本A内容
        version_b: 版本B内容

    Returns:
        对比分析结果
    """
    engine = get_critic_engine()
    return await engine.compare(version_a, version_b)


# ============ 6. Agent 服务 MCP (新增) ============

agent_mcp = FastMCP("NikoAgent", stateless_http=True)


def get_commander_agent():
    """Get commander agent (delegates to container)."""
    return get_container().commander


def get_writer_agent():
    """Get writer agent (delegates to container)."""
    return get_container().writer


@agent_mcp.tool()
async def agent_route(task: str) -> dict:
    """
    使用 Commander Agent 路由任务

    Args:
        task: 任务描述

    Returns:
        {
            "workflow_level": "L3",
            "workflow_level_slug": "standard",
            "scene_type": "dialogue",
            "dispatched_skills": ["dialogue-system", ...],
            "task_assignments": [...]
        }
    """
    agent = get_commander_agent()
    from src.workflow.levels.types import WorkflowLevel, to_workflow_label, to_workflow_slug
    level = WorkflowLevel.from_label(agent.route(task))
    if not isinstance(level, WorkflowLevel):
        level = WorkflowLevel.from_label(level)
    scene_type = agent.detect_scene_type(task)
    skills = agent.dispatch_skills(scene_type)
    assignments = agent.dispatch_tasks(task, level)

    return {
        "workflow_level": to_workflow_label(level),
        "workflow_level_slug": to_workflow_slug(level),
        "scene_type": scene_type.value,
        "dispatched_skills": skills,
        "task_assignments": [a.model_dump(mode="json") for a in assignments]
    }


@agent_mcp.tool()
async def agent_write(
    scene_card: dict,
    skills: list = None,
    word_target: int = 2000,
    allow_llm_fallback: bool = True,
    quality_goals: Optional[dict] = None,
) -> dict:
    """
    使用 Writer Agent 生成内容

    Args:
        scene_card: 场景卡片
        skills: 注入的技能列表
        word_target: 目标字数
        allow_llm_fallback: 是否允许 LLM 降级

    Returns:
        {
            "content": "...",
            "wordcount": 2000,
            "sensory_types": ["visual", "auditory"],
            "forbidden_words_found": []
        }
    """
    from src.agents.writer import WriterAgent, WriterInput

    agent = get_writer_agent()

    if skills:
        agent.inject_skills(skills)

    writer_input = WriterInput(
        scene_id=scene_card.get("scene_id", "CH01-SC01"),
        chapter_num=scene_card.get("chapter_num", 1),
        pov_character=scene_card.get("pov_character", ""),
        objective=scene_card.get("objective", ""),
        conflict=scene_card.get("conflict", ""),
        outcome=scene_card.get("outcome", "+"),
        plot_beat=scene_card.get("plot_beat", ""),
        emotional_arc=scene_card.get("emotional_arc", "平静→变化"),
        sensory_guidance=scene_card.get("sensory_guidance", {}),
        word_target=word_target
    )

    result = await agent.write(writer_input, allow_llm_fallback=allow_llm_fallback)

    return {
        "content": result.content,
        "wordcount": result.wordcount,
        "sensory_types": result.sensory_types_used,
        "forbidden_words_found": result.forbidden_words_found,
        "sections_needing_review": result.sections_needing_review
    }


@agent_mcp.tool()
async def agent_revise(
    draft: str,
    feedback: dict,
    allow_llm_fallback: bool = True,
    quality_goals: Optional[dict] = None,
) -> dict:
    """
    使用 Writer Agent 修订内容

    Args:
        draft: 原始草稿
        feedback: Critic 反馈 (issues, suggestions, dimension_scores)
        allow_llm_fallback: 是否允许 LLM 降级

    Returns:
        修订后的内容
    """
    agent = get_writer_agent()
    revise_kwargs = {
        "allow_llm_fallback": allow_llm_fallback,
    }
    if quality_goals is not None:
        revise_kwargs["quality_goals"] = quality_goals

    result = await agent.revise(
        draft,
        feedback,
        **revise_kwargs,
    )

    return {
        "content": result.content,
        "wordcount": result.wordcount,
        "forbidden_words_found": result.forbidden_words_found
    }


@agent_mcp.tool()
async def agent_get_context(
    scene_info: dict,
    context_types: list = None
) -> dict:
    """
    获取场景上下文 (Worldbuilding + Character + Plot)

    Args:
        scene_info: 场景信息
        context_types: 上下文类型 ["world", "character", "plot"]

    Returns:
        综合上下文信息
    """
    context_types = context_types or ["world", "character", "plot"]
    result = {}

    if "world" in context_types:
        from src.agents.worldbuilding import WorldbuildingAgent
        world_agent = WorldbuildingAgent()
        world_ctx = await world_agent.get_context(scene_info)
        result["world"] = world_ctx.model_dump()

    if "character" in context_types:
        from src.agents.character import CharacterAgent
        char_agent = CharacterAgent()
        char_ctx = await char_agent.get_context(scene_info)
        result["character"] = char_ctx.model_dump()

    if "plot" in context_types:
        from src.agents.plot import PlotAgent
        plot_agent = PlotAgent()
        plot_ctx = await plot_agent.get_context(scene_info)
        result["plot"] = plot_ctx.model_dump()

    return result


# ============ 7. 技能服务端点 (新增) ============

skills_mcp = FastMCP("NikoSkills", stateless_http=True)


@skills_mcp.tool()
async def skills_list(category: str = None) -> list:
    """
    列出所有技能包

    Args:
        category: 类别过滤 (character/structure/suspense/description/evaluation)

    Returns:
        技能列表
    """
    from src.agents.skill_router import SkillRouter

    router = SkillRouter()
    all_skills = router.list_all_skills()

    result = []
    for skill_id, info in all_skills.items():
        if category and info.get("category", "") != category:
            continue
        skill_entry = {
            "id": skill_id,
            "name": info.get("name", skill_id),
            "description": info.get("description", ""),
            "keywords": info.get("keywords", [])
        }
        result.append(skill_entry)

    return result


@skills_mcp.tool()
async def skills_match(
    task_type: str = None,
    keywords: list = None,
    issue: str = None
) -> list:
    """
    匹配技能包

    Args:
        task_type: 任务类型 (character_creation/dialogue/climax_writing 等)
        keywords: 关键词列表
        issue: 问题描述

    Returns:
        匹配的技能列表，按相关度排序
    """
    from src.agents.skill_router import SkillRouter, TaskType

    router = SkillRouter()

    if task_type:
        try:
            tt = TaskType(task_type)
            recommendations = router.route_by_task_type(tt)
        except ValueError:
            recommendations = []
    elif keywords:
        recommendations = router.route_by_keywords(keywords)
    elif issue:
        recommendations = router.route_by_issue(issue)
    else:
        recommendations = []

    return [
        {
            "skill_id": r.skill_id,
            "skill_name": r.skill_name,
            "relevance": r.relevance,
            "reason": r.reason,
            "priority": r.priority
        }
        for r in recommendations
    ]


@skills_mcp.tool()
async def skills_load(skill_id: str) -> dict:
    """
    加载技能包内容

    Args:
        skill_id: 技能ID

    Returns:
        技能包完整内容
    """
    from src.skills.skill_loader import SkillLoader

    loader = SkillLoader()
    skill = loader.load_skill(skill_id)

    if skill:
        return {
            "id": skill_id,
            "content": skill.get("content", ""),
            "metadata": skill.get("metadata", {})
        }

    return {"error": f"Skill '{skill_id}' not found"}


@skills_mcp.tool()
async def skills_get_chain(task_type: str) -> list:
    """
    获取技能链 (按执行顺序)

    Args:
        task_type: 任务类型

    Returns:
        按执行顺序排列的技能链
    """
    from src.agents.skill_router import SkillRouter, TaskType

    router = SkillRouter()

    try:
        tt = TaskType(task_type)
        chain = router.get_skill_chain(tt)
        return [
            {
                "skill_id": r.skill_id,
                "skill_name": r.skill_name,
                "step": r.priority,
                "reason": r.reason
            }
            for r in chain
        ]
    except ValueError:
        return []

# ============ Chat 统一入口 ============

from starlette.requests import Request

async def chat_endpoint(request: Request):
    """
    统一聊天入口 - Desktop 应用主接口

    接收用户消息，通过 Commander 路由到正确的工作流，返回结果。
    支持五种模式：
    - L1: 快速修复/润色
    - L2: 轻量扩写/短文
    - L3: 标准章节创作
    - L4: 头脑风暴
    - L5: 深度编排
    """
    try:
        body = await request.json()
        messages = body.get("messages", [])
        from src.workflow.levels.types import WorkflowLevel, to_workflow_label, to_workflow_slug
        has_explicit_workflow_level = "workflowLevel" in body
        if has_explicit_workflow_level:
            raw_workflow_level = body.get("workflowLevel")
            if not isinstance(raw_workflow_level, (str, int)) or not WorkflowLevel.is_valid_label(raw_workflow_level):
                return JSONResponse(
                    {"error": "Invalid workflowLevel. Expected one of: L1, L2, L3, L4, L5"},
                    status_code=400,
                )
            workflow_level = WorkflowLevel.from_label(raw_workflow_level)
        else:
            workflow_level = None
        skills = body.get("skills", [])
        context = body.get("context", {})
        allow_llm_fallback = bool(body.get("allowLlmFallback", True))
        raw_comparison = body.get("comparison", {})
        comparison = raw_comparison if isinstance(raw_comparison, dict) else {}
        comparison_enabled = bool(comparison.get("enabled"))
        control_model = str(comparison.get("controlModel") or "control")
        primary_model = str(comparison.get("primaryModel") or "primary")

        if comparison_enabled and not control_model.strip():
            return JSONResponse({"error": "comparison.controlModel is required when comparison is enabled"}, status_code=400)

        if not allow_llm_fallback and not _is_llm_available():
            return JSONResponse({"error": "LLM unavailable and fallback disabled"}, status_code=503)

        if not messages:
            return JSONResponse({"error": "No messages provided"}, status_code=400)

        # 获取最新用户消息
        user_message = next(
            (m["content"] for m in reversed(messages) if m["role"] == "user"),
            ""
        )

        if not user_message:
            return JSONResponse({"error": "No user message found"}, status_code=400)

        # 使用 Commander Agent 处理
        commander = get_commander_agent()
        from src.workflow.levels.types import WorkflowLevel, to_workflow_label, to_workflow_slug

        # 路由任务
        level = workflow_level if workflow_level is not None else commander.route(user_message)
        if not isinstance(level, WorkflowLevel):
            level = WorkflowLevel.from_label(level)
        scene_type = commander.detect_scene_type(user_message)
        dispatched_skills = commander.dispatch_skills(scene_type)

        # 合并用户选择的技能
        all_skills = list(set(dispatched_skills + skills))

        # 获取任务分配
        assignments = commander.dispatch_tasks(user_message, level)

        # 根据工作流级别执行不同逻辑
        response_content = ""
        evaluation_result = {"score": 0, "feedback": ""}
        writer_metadata: Optional[Dict[str, Any]] = None
        steps_completed = 0

        try:
            # 获取 Writer Agent
            writer = get_writer_agent()

            # 注入技能
            if all_skills:
                writer.inject_skills(all_skills[:5])

            # L1: 快速模式 - 直接续写/润色
            if level == WorkflowLevel.L1_RAPID:
                from src.agents.writer import WriterInput

                # 简单续写
                result = await writer.continue_writing(
                    existing_content=user_message,
                    continuation_hint="继续发展情节",
                    word_target=500,
                    allow_llm_fallback=allow_llm_fallback
                )
                response_content = result
                steps_completed = 1

            # L5: 协调者模式 - 专属执行链路
            elif level == WorkflowLevel.L5_COORDINATOR:
                coordinator_state = create_base_state(
                    user_request=user_message,
                    domain=context.get("domain", "novel"),
                    workflow_level=5,
                    metadata=context.get("metadata", {}),
                )
                coordinator_state["context"] = context.get("context", "")
                if context.get("session_id"):
                    coordinator_state["session_id"] = context.get("session_id")

                coordinator = Level5Coordinator()
                result_state = coordinator.execute(coordinator_state)

                response_content = result_state.get("final_output") or result_state.get("draft_content", "")
                evaluation_result = {
                    "score": result_state.get("score", 0),
                    "feedback": result_state.get("feedback_context", "") or result_state.get("decision_reason", ""),
                }
                steps_completed = len(getattr(coordinator._coordinator_state, "execution_units", [])) or 1

            # L2/L3/L4: 保持现有 Writer 路径
            else:
                from src.agents.writer import WriterInput

                # 构建场景输入
                writer_input = WriterInput(
                    scene_id=context.get("scene_id", "CH01-SC01"),
                    chapter_num=context.get("chapter_num", 1),
                    pov_character=context.get("pov_character", "主角"),
                    objective=user_message[:100],
                    conflict=context.get("conflict", "内心挣扎"),
                    outcome=context.get("outcome", "+"),
                    plot_beat=user_message,
                    emotional_arc=context.get("emotional_arc", "平静→紧张"),
                    sensory_guidance={
                        "location": context.get("location", "未知地点"),
                        "time": context.get("time", "某个时刻"),
                        "atmosphere": context.get("atmosphere", "神秘")
                    },
                    word_target=context.get("word_target", 2000)
                )

                # 执行写作
                result = await writer.write(writer_input, allow_llm_fallback=allow_llm_fallback)
                response_content = result.content
                writer_metadata = result.metadata if isinstance(result.metadata, dict) else None
                steps_completed = 4  # 4-chain prompt

                # 调用 Critic 评估 (如果可用)
                try:
                    critic_engine = get_critic_engine()
                    eval_result = await critic_engine.evaluate(
                        content=result.content,
                        scene_card=None,
                        dimensions=None
                    )
                    evaluation_result = {
                        "score": eval_result.get("total_score", 0),
                        "feedback": eval_result.get("actionable_feedback", "")
                    }
                except Exception as e:
                    if not allow_llm_fallback:
                        raise RuntimeError("Critic evaluation failed with fallback disabled") from e
                    logger.warning(f"Critic evaluation failed: {e}")
                    evaluation_result = {
                        "score": 75,
                        "feedback": f"自检: 使用了 {len(result.sensory_types_used)} 种感官描写"
                    }

        except Exception as e:
            if not allow_llm_fallback:
                raise RuntimeError("Writer execution failed with fallback disabled") from e
            logger.warning(f"Writer execution failed, falling back to analysis: {e}")
            # 回退到分析模式
            response_content = f"""## 任务分析

**工作流级别**: {to_workflow_label(level)}
**场景类型**: {scene_type.value}
**调用技能**: {', '.join(all_skills[:5])}

### 执行计划

"""
            for i, task in enumerate(assignments, 1):
                response_content += f"{i}. **{task.agent_type.upper()}**: {task.instruction[:50]}...\n"

            response_content += f"""
### 提示

检测到您的请求需要 LLM 支持。请确保：
1. 已配置有效的 LLM API 密钥
2. LLM 服务可用

您可以在设置中配置 Claude/OpenAI/Gemini API。
"""
            steps_completed = 1

        comparison_payload = None
        if comparison_enabled:
            comparison_payload = {
                "enabled": True,
                "primary": {
                    "model": primary_model,
                    "content": response_content,
                },
                "control": {
                    "model": control_model,
                    "content": response_content,
                },
            }

        return JSONResponse(_with_contract({
            "content": response_content,
            "skills_used": all_skills[:5],
            "comparison": comparison_payload,
            "writer_metadata": writer_metadata,
            "workflow_info": {
                "level": to_workflow_label(level),
                "level_slug": to_workflow_slug(level),
                "scene_type": scene_type.value,
                "steps_completed": steps_completed,
                "total_steps": len(assignments)
            },
            "workflow_level": to_workflow_label(level),
            "workflow_level_slug": to_workflow_slug(level),
            "evaluation": evaluation_result
        }))

    except Exception as e:
        logger.error(f"Chat endpoint error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)


# ============ SSE 流式聊天端点 ============

import json
import asyncio
import re


def adaptive_chunk_content(
    content: str,
    max_chunk_size: int = 500,
    min_chunk_size: int = 50
) -> list:
    """
    按句子边界自适应分块内容。

    优化策略:
    - 在句子边界(。！？!?.\\n)处分割
    - 最大块大小 500 字符
    - 最小块大小 50 字符 (避免过于碎片化)

    Args:
        content: 要分块的内容
        max_chunk_size: 最大块大小
        min_chunk_size: 最小块大小

    Returns:
        分块后的内容列表
    """
    if not content:
        return []

    # 中英文句子结束符
    sentence_endings = re.compile(r'([。！？!?.\n])')

    chunks = []
    current_chunk = ""

    # 按句子边界分割
    parts = sentence_endings.split(content)

    for i, part in enumerate(parts):
        if not part:
            continue

        # 如果是标点符号，追加到当前块
        if sentence_endings.match(part):
            current_chunk += part
            continue

        # 检查是否会超过最大大小
        if len(current_chunk) + len(part) > max_chunk_size:
            # 当前块已有内容且超过最小大小，先保存
            if current_chunk and len(current_chunk) >= min_chunk_size:
                chunks.append(current_chunk)
                current_chunk = part
            elif current_chunk:
                # 当前块太小，继续追加
                current_chunk += part
            else:
                # 单个 part 超过最大大小，强制分割
                while len(part) > max_chunk_size:
                    chunks.append(part[:max_chunk_size])
                    part = part[max_chunk_size:]
                current_chunk = part
        else:
            current_chunk += part

        # 如果当前块在句子边界且达到合理大小
        if (current_chunk.endswith(('。', '！', '？', '!', '?', '.', '\n'))
                and len(current_chunk) >= min_chunk_size):
            chunks.append(current_chunk)
            current_chunk = ""

    # 保存剩余内容
    if current_chunk:
        chunks.append(current_chunk)

    return chunks


async def chat_stream_endpoint(request: Request):
    """
    SSE 流式聊天入口 - 实时返回生成内容

    使用 Server-Sent Events 协议，支持：
    - 实时内容流式输出
    - 进度状态更新
    - 评估结果推送
    """
    try:
        body = await request.json()
        messages = body.get("messages", [])
        from src.workflow.levels.types import WorkflowLevel, to_workflow_label, to_workflow_slug
        has_explicit_workflow_level = "workflowLevel" in body
        if has_explicit_workflow_level:
            raw_workflow_level = body.get("workflowLevel")
            if not isinstance(raw_workflow_level, (str, int)) or not WorkflowLevel.is_valid_label(raw_workflow_level):
                return JSONResponse(
                    {"error": "Invalid workflowLevel. Expected one of: L1, L2, L3, L4, L5"},
                    status_code=400,
                )
            workflow_level = WorkflowLevel.from_label(raw_workflow_level)
        else:
            workflow_level = None
        skills = body.get("skills", [])
        context = body.get("context", {})
        allow_llm_fallback = bool(body.get("allowLlmFallback", True))

        if not allow_llm_fallback and not _is_llm_available():
            return JSONResponse({"error": "LLM unavailable and fallback disabled"}, status_code=503)

        if not messages:
            return JSONResponse({"error": "No messages provided"}, status_code=400)

        user_message = next(
            (m["content"] for m in reversed(messages) if m["role"] == "user"),
            ""
        )

        if not user_message:
            return JSONResponse({"error": "No user message found"}, status_code=400)

        async def generate_stream():
            """SSE 事件生成器"""
            stream_diagnostics = {
                "fallback_reason": None,
                "failure_reason": None,
                "error_type": None,
            }
            try:
                # 1. 发送开始事件
                start_payload = _with_contract({
                    "status": "started",
                    "diagnostics": stream_diagnostics,
                })
                yield f"event: start\ndata: {json.dumps(start_payload)}\n\n"

                # 2. 路由分析
                commander = get_commander_agent()
                level = workflow_level if workflow_level is not None else commander.route(user_message)
                if not isinstance(level, WorkflowLevel):
                    level = WorkflowLevel.from_label(level)
                scene_type = commander.detect_scene_type(user_message)
                dispatched_skills = commander.dispatch_skills(scene_type)
                all_skills = list(set(dispatched_skills + skills))

                yield f"event: routing\ndata: {json.dumps({'level': to_workflow_label(level), 'level_slug': to_workflow_slug(level), 'scene_type': scene_type.value, 'skills': all_skills[:5]})}\n\n"

                # 3. 获取 Writer Agent
                writer = get_writer_agent()
                if all_skills:
                    writer.inject_skills(all_skills[:5])

                yield f"event: progress\ndata: {json.dumps({'step': 1, 'total': 4, 'message': '准备写作环境...'})}\n\n"

                # 4. 执行写作 (模拟分段输出)
                if level == WorkflowLevel.L1_RAPID:
                    # L1 快速模式
                    yield f"event: progress\ndata: {json.dumps({'step': 2, 'total': 4, 'message': '快速续写中...'})}\n\n"

                    try:
                        result = await writer.continue_writing(
                            existing_content=user_message,
                            continuation_hint="继续发展情节",
                            word_target=500,
                            allow_llm_fallback=allow_llm_fallback
                        )
                        content = result if isinstance(result, str) else result.content

                        # 自适应分块流式输出 (按句子边界)
                        chunks = adaptive_chunk_content(content, max_chunk_size=500, min_chunk_size=50)
                        for i, chunk in enumerate(chunks):
                            yield f"event: content\ndata: {json.dumps({'chunk': chunk, 'index': i})}\n\n"
                            # 仅在块之间添加最小延迟以保持流式效果
                            if i < len(chunks) - 1:
                                await asyncio.sleep(0.005)

                        yield f"event: progress\ndata: {json.dumps({'step': 4, 'total': 4, 'message': '完成'})}\n\n"

                    except Exception as e:
                        if not allow_llm_fallback:
                            raise RuntimeError("Writer execution failed with fallback disabled") from e
                        logger.warning(f"Writer failed: {e}")
                        stream_diagnostics["fallback_reason"] = "writer_unavailable_l1"
                        stream_diagnostics["failure_reason"] = str(e)
                        yield f"event: content\ndata: {json.dumps({'chunk': f'[写作服务暂时不可用，请检查 LLM 配置]'})}\n\n"

                elif level == WorkflowLevel.L5_COORDINATOR:
                    # L5 协调者模式
                    yield f"event: progress\ndata: {json.dumps({'step': 2, 'total': 4, 'message': '协调器分析中...'})}\n\n"

                    coordinator_state = create_base_state(
                        user_request=user_message,
                        domain=context.get("domain", "novel"),
                        workflow_level=5,
                        metadata=context.get("metadata", {}),
                    )
                    coordinator_state["context"] = context.get("context", "")
                    if context.get("session_id"):
                        coordinator_state["session_id"] = context.get("session_id")

                    coordinator = Level5Coordinator()
                    result_state = coordinator.execute(coordinator_state)
                    content = result_state.get("final_output") or result_state.get("draft_content", "")

                    yield f"event: progress\ndata: {json.dumps({'step': 3, 'total': 4, 'message': '生成结果中...'})}\n\n"

                    chunks = adaptive_chunk_content(content, max_chunk_size=500, min_chunk_size=80)
                    for i, chunk in enumerate(chunks):
                        yield f"event: content\ndata: {json.dumps({'chunk': chunk, 'index': i})}\n\n"
                        if i < len(chunks) - 1:
                            await asyncio.sleep(0.005)

                    yield f"event: progress\ndata: {json.dumps({'step': 4, 'total': 4, 'message': '质量评估...'})}\n\n"
                    yield f"event: evaluation\ndata: {json.dumps({'score': result_state.get('score', 0), 'feedback': result_state.get('feedback_context', '') or result_state.get('decision_reason', '')})}\n\n"

                else:
                    # L2/L3/L4 标准路径
                    from src.agents.writer import WriterInput

                    yield f"event: progress\ndata: {json.dumps({'step': 2, 'total': 4, 'message': '构建场景...'})}\n\n"

                    writer_input = WriterInput(
                        scene_id=context.get("scene_id", "CH01-SC01"),
                        chapter_num=context.get("chapter_num", 1),
                        pov_character=context.get("pov_character", "主角"),
                        objective=user_message[:100],
                        conflict=context.get("conflict", "内心挣扎"),
                        outcome=context.get("outcome", "+"),
                        plot_beat=user_message,
                        emotional_arc=context.get("emotional_arc", "平静→紧张"),
                        sensory_guidance={
                            "location": context.get("location", "未知地点"),
                            "time": context.get("time", "某个时刻"),
                            "atmosphere": context.get("atmosphere", "神秘")
                        },
                        word_target=context.get("word_target", 2000)
                    )

                    yield f"event: progress\ndata: {json.dumps({'step': 3, 'total': 4, 'message': '创作中...'})}\n\n"

                    try:
                        result = await writer.write(writer_input, allow_llm_fallback=allow_llm_fallback)
                        content = result.content

                        # 自适应分块流式输出 (按句子边界，最大 500 字符)
                        chunks = adaptive_chunk_content(content, max_chunk_size=500, min_chunk_size=80)
                        for i, chunk in enumerate(chunks):
                            yield f"event: content\ndata: {json.dumps({'chunk': chunk, 'index': i})}\n\n"
                            # 仅在块之间添加最小延迟
                            if i < len(chunks) - 1:
                                await asyncio.sleep(0.005)

                        # 5. 评估 (可选)
                        yield f"event: progress\ndata: {json.dumps({'step': 4, 'total': 4, 'message': '质量评估...'})}\n\n"

                        try:
                            critic_engine = get_critic_engine()
                            eval_result = await critic_engine.evaluate(
                                content=content,
                                scene_card=None,
                                dimensions=None
                            )
                            yield f"event: evaluation\ndata: {json.dumps({'score': eval_result.get('total_score', 0), 'feedback': eval_result.get('actionable_feedback', '')})}\n\n"
                        except Exception as e:
                            if not allow_llm_fallback:
                                raise RuntimeError("Critic evaluation failed with fallback disabled") from e
                            logger.warning(f"Critic evaluation failed: {e}")
                            stream_diagnostics["fallback_reason"] = "critic_unavailable"
                            stream_diagnostics["failure_reason"] = str(e)
                            yield f"event: evaluation\ndata: {json.dumps({'score': 75, 'feedback': '自动评估暂不可用'})}\n\n"

                    except Exception as e:
                        if not allow_llm_fallback:
                            raise RuntimeError("Writer execution failed with fallback disabled") from e
                        logger.warning(f"Writer failed: {e}")
                        stream_diagnostics["fallback_reason"] = "writer_unavailable_l234"
                        stream_diagnostics["failure_reason"] = str(e)
                        yield f"event: content\ndata: {json.dumps({'chunk': f'[写作服务暂时不可用: {str(e)[:50]}]'})}\n\n"

                # 6. 完成事件
                decision = "soft_go" if stream_diagnostics["fallback_reason"] else "go"
                terminal_state = "recovered" if stream_diagnostics["fallback_reason"] else "done"
                done_payload = _with_terminal_contract({
                    "status": "completed",
                    "terminal": terminal_state,
                    "decision": decision,
                    "skills_used": all_skills[:5],
                    "diagnostics": stream_diagnostics,
                    "workflow_level": to_workflow_label(level),
                    "workflow_level_slug": to_workflow_slug(level),
                })
                yield f"event: done\ndata: {json.dumps(done_payload)}\n\n"

            except Exception as e:
                logger.error(f"Stream error: {e}")
                stream_diagnostics["failure_reason"] = str(e)
                stream_diagnostics["error_type"] = e.__class__.__name__
                terminal_state = "interrupted" if isinstance(e, (asyncio.CancelledError, TimeoutError)) else "error"
                error_payload = _with_terminal_contract({
                    "error": str(e),
                    "terminal": terminal_state,
                    "decision": "no_go",
                    "diagnostics": stream_diagnostics,
                })
                yield f"event: error\ndata: {json.dumps(error_payload)}\n\n"

        return StreamingResponse(
            generate_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
                "Content-Encoding": "identity",  # SSE 不支持 gzip 压缩
            }
        )

    except Exception as e:
        logger.error(f"Chat stream endpoint error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)


# ============ 健康检查端点 ============

async def health_check(request):
    """健康检查"""
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


async def list_mcp_services(request):
    """列出 MCP 服务配置与运行状态"""
    services = request.query_params.get("services")
    runtime_services: Optional[Dict[str, str]] = None
    if services:
        runtime_services = {k: v for k, v in [item.split(":", 1) for item in services.split(",") if ":" in item]}

    payload = [
        _serialize_service_config(config, runtime_services)
        for config in _MCP_SERVICE_CONFIGS.values()
    ]
    return JSONResponse({"services": payload})


async def create_mcp_service(request):
    """新增 MCP 服务配置（不挂载运行时路由）"""
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


async def set_mcp_service_enabled(request):
    """启用/禁用 MCP 服务"""
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


async def list_models(request):
    """列出模型配置（支持按 provider 过滤）"""
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


# ============ REST 兼容端点（供 Desktop 前端调用） ============

async def memory_search_endpoint(request: Request):
    body = await request.json()
    result = await memory_search(
        query=body.get("query", ""),
        layer=body.get("layer"),
        dimensions=body.get("dimensions"),
        entity_id=body.get("entity_id"),
        at_time=body.get("at_time"),
        limit=body.get("limit", 10),
    )
    return JSONResponse(result)


async def memory_add_endpoint(request: Request):
    body = await request.json()
    result = await memory_add(
        content=body.get("content", ""),
        layer=body.get("layer", "session"),
        dimension=body.get("dimension"),
        entity_id=body.get("entity_id"),
        valid_from=body.get("valid_from"),
        valid_until=body.get("valid_until"),
        importance=body.get("importance", 0.5),
        tags=body.get("tags") or [],
    )
    return JSONResponse(result)


async def memory_upload_endpoint(request: Request):
    body = await request.json()

    file_name = body.get("file_name")
    file_content_base64 = body.get("file_content_base64")
    session_id = body.get("session_id")
    chunk_size = body.get("chunk_size", 1000)
    chunk_overlap = body.get("chunk_overlap", 200)

    if not isinstance(file_name, str) or not file_name.strip():
        return JSONResponse({"error": "file_name is required"}, status_code=400)
    if not isinstance(file_content_base64, str) or not file_content_base64.strip():
        return JSONResponse({"error": "file_content_base64 is required"}, status_code=400)
    if not isinstance(session_id, str) or not session_id.strip():
        return JSONResponse({"error": "session_id is required"}, status_code=400)

    try:
        if isinstance(file_content_base64, str) and "," in file_content_base64:
            file_content_base64 = file_content_base64.split(",", 1)[1]
        file_bytes = base64.b64decode(file_content_base64, validate=True)
    except Exception:
        return JSONResponse({"error": "invalid file_content_base64"}, status_code=400)

    try:
        text = DocumentLoader.load_file(io.BytesIO(file_bytes), file_name)
    except Exception as exc:
        return JSONResponse({"error": f"failed to parse file: {exc}"}, status_code=400)

    if not text.strip():
        return JSONResponse({"error": "file contains no readable text"}, status_code=400)

    chunk_size = int(chunk_size)
    chunk_overlap = int(chunk_overlap)
    if chunk_size <= 0:
        chunk_size = 1000
    if chunk_overlap < 0:
        chunk_overlap = 0
    if chunk_overlap >= chunk_size:
        chunk_overlap = max(chunk_size // 5, 0)

    try:
        try:
            from langchain_text_splitters import RecursiveCharacterTextSplitter
        except ImportError:
            from langchain.text_splitter import RecursiveCharacterTextSplitter

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
        )
        chunks = splitter.split_text(text)
    except Exception as exc:
        return JSONResponse({"error": f"failed to split file text: {exc}"}, status_code=500)

    if not chunks:
        return JSONResponse({"error": "file contains no indexable chunks"}, status_code=400)

    safe_filename = "".join([c for c in file_name if c.isalnum() or c in (" ", ".", "_")]).replace(" ", "_")
    if not safe_filename:
        safe_filename = "uploaded_file"

    tags = ["uploaded_material", f"filename:{safe_filename}", f"session:{session_id}"]
    memory_ids: List[str] = []

    for index, chunk in enumerate(chunks):
        chunk_content = chunk.strip()
        if not chunk_content:
            continue
        chunk_id = f"{session_id}_{safe_filename}_part_{index}"
        result = await memory_add(
            content=chunk_content,
            layer="session",
            dimension="context",
            entity_id=session_id,
            importance=0.6,
            tags=[*tags, f"chunk:{index}", f"chunk_id:{chunk_id}"],
        )
        memory_id = result.get("id") if isinstance(result, dict) else None
        if isinstance(memory_id, str):
            memory_ids.append(memory_id)

    if not memory_ids:
        return JSONResponse({"error": "failed to inject any file chunks"}, status_code=500)

    return JSONResponse({
        "status": "created",
        "file_name": file_name,
        "session_id": session_id,
        "chunks": len(memory_ids),
        "memory_ids": memory_ids,
    })


async def memory_temporal_endpoint(request: Request):
    body = await request.json()
    result = await memory_get_temporal(
        entity_id=body.get("entity_id", ""),
        at_time=body.get("at_time"),
    )
    return JSONResponse(result)


async def graph_query_endpoint(request: Request):
    body = await request.json()
    result = await graph_query(cypher=body.get("cypher", ""))
    return JSONResponse(result)


async def graph_character_endpoint(request: Request):
    body = await request.json()
    result = await graph_get_character(
        name=body.get("name", ""),
        include_relations=body.get("include_relations", True),
        include_timeline=body.get("include_timeline", False),
    )
    return JSONResponse(result)


async def graph_foreshadows_endpoint(request: Request):
    body = await request.json()
    result = await graph_get_foreshadows(
        status=body.get("status", "pending"),
        chapter=body.get("chapter"),
    )
    return JSONResponse(result)


async def critic_evaluate_endpoint(request: Request):
    body = await request.json()
    result = await evaluate_content(
        content=body.get("content", ""),
        scene_card=body.get("scene_card"),
        dimensions=body.get("dimensions"),
    )
    return JSONResponse(result)


async def critic_suggestions_endpoint(request: Request):
    body = await request.json()
    result = await get_improvement_suggestions(
        content=body.get("content", ""),
        issues=body.get("issues"),
        max_suggestions=body.get("max_suggestions", 5),
    )
    return JSONResponse(result)


async def novel_quality_check_endpoint(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}

    if not isinstance(body, dict):
        body = {}

    content = body.get("content", "")
    if not isinstance(content, str) or not content.strip():
        return JSONResponse({"error": "content is required"}, status_code=400)
    normalized_content = content.strip()
    retrieval_metadata = body.get("retrieval_metadata")
    context_budget = body.get("context_budget")
    self_learning = body.get("self_learning")

    quality_kwargs: Dict[str, Any] = {}
    if "quality_level" in body:
        quality_kwargs["quality_level"] = str(body.get("quality_level", "high"))
    if "quality_mode" in body:
        quality_kwargs["quality_mode"] = str(body.get("quality_mode", "auto"))
    if "critical_gate_always_on" in body:
        quality_kwargs["critical_gate_always_on"] = bool(body.get("critical_gate_always_on", True))
    if "degrade_reason" in body:
        quality_kwargs["degrade_reason"] = str(body.get("degrade_reason", ""))

    try:
        try:
            result = evaluate_novel_quality(normalized_content, **quality_kwargs)
        except TypeError as exc:
            if quality_kwargs and "unexpected keyword argument" in str(exc):
                result = evaluate_novel_quality(normalized_content)
            else:
                raise
        if inspect.isawaitable(result):
            result = await result
    except Exception:
        logger.exception("novel_quality_check_endpoint evaluator failed")
        result = _quality_default_payload()

    result = _merge_quality_sidecar(
        result,
        retrieval_metadata,
        context_budget,
        self_learning,
    )

    try:
        normalized_result = _normalize_quality_payload(result)
    except Exception:
        logger.exception("novel_quality_check_endpoint normalization failed")
        normalized_result = _quality_default_payload()
    return JSONResponse(normalized_result)


async def writing_helper_process_endpoint(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}

    if not isinstance(body, dict):
        body = {}

    content = body.get("content", "")
    if not isinstance(content, str) or not content.strip():
        return JSONResponse({"error": "content is required"}, status_code=400)

    guard_enabled_override = body.get("detection_evasion_guard_enabled")
    if not isinstance(guard_enabled_override, bool):
        guard_enabled_override = None

    guard_response = _guard_detection_evasion_payload(body, enabled_override=guard_enabled_override)
    if guard_response is not None:
        return guard_response

    # Backward-compatible alias: mode takes precedence over action when both are present.
    mode = body.get("mode", body.get("action", "polish"))
    max_sentences = body.get("max_sentences", 3)
    max_items = body.get("max_items", 6)
    instruction = body.get("instruction", "")

    try:
        result = process_writing_helper(
            content=content,
            mode=mode,
            max_sentences=int(max_sentences),
            max_items=int(max_items),
            instruction=instruction if isinstance(instruction, str) else "",
        )
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=400)

    return JSONResponse(result)


async def workflow_route_endpoint(request: Request):
    body = await request.json()
    result = await workflow_route(task=body.get("task", ""))
    return JSONResponse(result)


async def workflow_plan_endpoint(request: Request):
    body = await request.json()
    kwargs = {
        "task": body.get("task", ""),
        "level": body.get("level"),
        "recommendations": body.get("recommendations"),
    }
    if "genre" in body:
        kwargs["genre"] = body.get("genre")
    result = await workflow_plan(**kwargs)
    return JSONResponse(result)


async def workflow_execute_endpoint(request: Request):
    body = await request.json()
    result = await workflow_execute(
        plan_id=body.get("plan_id", ""),
        step_id=body.get("step_id"),
        recommendations=body.get("recommendations"),
        confirm_token=body.get("confirm_token"),
    )
    return JSONResponse(result)


async def workflow_lifecycle_endpoint(request: Request):
    body = await request.json()
    result = await workflow_lifecycle(
        plan_id=body.get("plan_id", ""),
        action=body.get("action", "status"),
    )
    return JSONResponse(result)


async def workflow_quick_rollback_endpoint(request: Request):
    body = await request.json()
    result = await workflow_quick_rollback(
        plan_id=body.get("plan_id", ""),
        checkpoint_id=body.get("checkpoint_id", ""),
        reason=body.get("reason", ""),
    )
    return JSONResponse(result)


async def ui_bridge_workflow_route_endpoint(request: Request):
    if not _resolve_ui_bridge_enabled():
        return _ui_bridge_disabled_response()
    return await workflow_route_endpoint(request)


async def ui_bridge_workflow_plan_endpoint(request: Request):
    if not _resolve_ui_bridge_enabled():
        return _ui_bridge_disabled_response()
    return await workflow_plan_endpoint(request)


async def ui_bridge_workflow_execute_endpoint(request: Request):
    if not _resolve_ui_bridge_enabled():
        return _ui_bridge_disabled_response()
    return await workflow_execute_endpoint(request)


async def ui_bridge_workflow_lifecycle_endpoint(request: Request):
    if not _resolve_ui_bridge_enabled():
        return _ui_bridge_disabled_response()
    return await workflow_lifecycle_endpoint(request)


async def checkpoint_create_endpoint(request: Request):
    body = await request.json()
    result = await checkpoint_create(
        description=body.get("description", ""),
        auto_commit=body.get("auto_commit", True),
    )
    return JSONResponse(result)


async def checkpoint_restore_endpoint(request: Request):
    body = await request.json()
    result = await checkpoint_restore(
        checkpoint_id=body.get("checkpoint_id", ""),
        confirm_token=body.get("confirm_token"),
    )
    return JSONResponse(result)


async def checkpoint_list_endpoint(request: Request):
    body = await request.json()
    result = await checkpoint_list(limit=body.get("limit", 10))
    return JSONResponse(result)


async def agent_route_endpoint(request: Request):
    body = await request.json()
    result = await agent_route(task=body.get("task", ""))
    return JSONResponse(result)


async def agent_write_endpoint(request: Request):
    body = await request.json()
    quality_goals_payload = body.get("quality_goals") or body.get("qualityGoals")
    write_kwargs = {
        "scene_card": body.get("scene_card") or {},
        "skills": body.get("skills"),
        "word_target": body.get("word_target", 2000),
        "allow_llm_fallback": body.get("allow_llm_fallback", True),
    }
    if quality_goals_payload is not None:
        write_kwargs["quality_goals"] = quality_goals_payload
    result = await agent_write(**write_kwargs)
    return JSONResponse(result)


async def agent_revise_endpoint(request: Request):
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON body"}, status_code=400)

    if not isinstance(body, dict):
        return JSONResponse({"error": "Request body must be an object"}, status_code=400)

    blocked = _guard_detection_evasion_payload(body)
    if blocked is not None:
        return blocked

    feedback_value = body.get("feedback")
    if feedback_value is None:
        feedback_value = {}
    elif not isinstance(feedback_value, dict):
        return JSONResponse({"error": "feedback must be an object"}, status_code=400)

    allow_llm_fallback = bool(body.get("allow_llm_fallback", body.get("allowLlmFallback", True)))

    revise_kwargs = {
        "draft": body.get("draft", ""),
        "feedback": feedback_value,
        "allow_llm_fallback": allow_llm_fallback,
    }
    quality_goals_payload = body.get("quality_goals") or body.get("qualityGoals")
    if quality_goals_payload is not None:
        revise_kwargs["quality_goals"] = quality_goals_payload

    try:
        result = await agent_revise(**revise_kwargs)
        return JSONResponse(result)
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=400)
    except RuntimeError as exc:
        message = str(exc)
        status_code = 503 if "LLM" in message else 500
        return JSONResponse({"error": message}, status_code=status_code)
    except Exception as exc:
        logger.error(f"Agent revise endpoint error: {exc}")
        return JSONResponse({"error": str(exc), "status": "error", "endpoint": "/agent/revise"}, status_code=500)


async def agent_context_endpoint(request: Request):
    body = await request.json()
    result = await agent_get_context(
        scene_info=body.get("scene_info") or {},
        context_types=body.get("context_types"),
    )
    return JSONResponse(result)


async def skills_list_endpoint(request: Request):
    category = request.query_params.get("category")
    result = await skills_list(category=category)
    return JSONResponse(result)


async def skills_load_endpoint(request: Request):
    body = await request.json()
    result = await skills_load(skill_id=body.get("skill_id", ""))
    return JSONResponse(result)


async def skills_match_endpoint(request: Request):
    body = await request.json()
    result = await skills_match(
        task_type=body.get("task_type"),
        keywords=body.get("keywords"),
        issue=body.get("issue"),
    )
    return JSONResponse(result)


async def skills_chain_endpoint(request: Request):
    body = await request.json()
    result = await skills_get_chain(task_type=body.get("task_type", ""))
    return JSONResponse(result)


# ============ 创建 Gateway ============

def create_gateway() -> Starlette:
    """创建 MCP Gateway 应用"""

    # 设置路径
    for mcp in [memory_mcp, graph_mcp, search_mcp, workflow_mcp, critic_mcp, agent_mcp, skills_mcp]:
        mcp.settings.streamable_http_path = "/"

    @contextlib.asynccontextmanager
    async def lifespan(app: Starlette):
        """管理所有 MCP 服务的生命周期 (优化: 并行启动)"""
        logger.info(f"🚀 Starting Niko-Studio MCP Gateway v{__version__}...")

        async with contextlib.AsyncExitStack() as stack:
            # Start all MCP sessions in parallel using asyncio.gather
            mcp_services = [
                memory_mcp, graph_mcp, search_mcp,
                workflow_mcp, critic_mcp, agent_mcp, skills_mcp
            ]

            async def start_mcp(mcp):
                await stack.enter_async_context(mcp.session_manager.run())

            # Parallel MCP session startup
            await asyncio.gather(*[start_mcp(mcp) for mcp in mcp_services])

            logger.info("✅ All MCP services started successfully")

            # Pre-warm critical engines (await completion)
            await prewarm_engines()

            logger.info("📊 Available endpoints:")
            logger.info("   - http://localhost:8000/memory   (5 tools)")
            logger.info("   - http://localhost:8000/graph    (6 tools)")
            logger.info("   - http://localhost:8000/search   (3 tools)")
            logger.info("   - http://localhost:8000/workflow (6 tools)")
            logger.info("   - http://localhost:8000/critic   (3 tools)")
            logger.info("   - http://localhost:8000/agent    (4 tools)")
            logger.info("   - http://localhost:8000/skills   (4 tools)")
            logger.info("   - http://localhost:8000/health")
            logger.info("   - http://localhost:8000/tools")
            logger.info("")
            logger.info("🤖 Agents: Commander, Architect, Writer, Critic, Worldbuilding, Character, Plot")
            logger.info("📚 Skills: 40 writing skills loaded")

            yield

        logger.info("👋 Niko-Studio MCP Gateway stopped")

    # 创建应用
    gateway = Starlette(
        routes=[
            # 辅助端点
            Route("/health", health_check, methods=["GET"]),
            Route("/metrics", metrics_endpoint, methods=["GET"]),
            Route("/tools", list_tools, methods=["GET"]),
            Route("/mcp/services", list_mcp_services, methods=["GET"]),
            Route("/mcp/services", create_mcp_service, methods=["POST"]),
            Route("/mcp/services/{service_id}", update_mcp_service, methods=["PUT"]),
            Route("/mcp/services/{service_id}/enabled", set_mcp_service_enabled, methods=["POST"]),
            Route("/mcp/services/{service_id}/health", probe_mcp_service_health, methods=["POST"]),
            Route("/models", list_models, methods=["GET"]),
            Route("/memory/search", memory_search_endpoint, methods=["POST"]),
            Route("/memory/add", memory_add_endpoint, methods=["POST"]),
            Route("/memory/upload", memory_upload_endpoint, methods=["POST"]),
            Route("/memory/temporal", memory_temporal_endpoint, methods=["POST"]),
            Route("/graph/query", graph_query_endpoint, methods=["POST"]),
            Route("/graph/character", graph_character_endpoint, methods=["POST"]),
            Route("/graph/foreshadows", graph_foreshadows_endpoint, methods=["POST"]),
            Route("/critic/evaluate", critic_evaluate_endpoint, methods=["POST"]),
            Route("/critic/suggestions", critic_suggestions_endpoint, methods=["POST"]),
            Route("/api/novel/quality-check", novel_quality_check_endpoint, methods=["POST"]),
            Route("/writing-helper/process", writing_helper_process_endpoint, methods=["POST"]),
            Route("/workflow/route", workflow_route_endpoint, methods=["POST"]),
            Route("/workflow/plan", workflow_plan_endpoint, methods=["POST"]),
            Route("/workflow/execute", workflow_execute_endpoint, methods=["POST"]),
            Route("/workflow/lifecycle", workflow_lifecycle_endpoint, methods=["POST"]),
            Route("/ui/workflow/route", ui_bridge_workflow_route_endpoint, methods=["POST"]),
            Route("/ui/workflow/plan", ui_bridge_workflow_plan_endpoint, methods=["POST"]),
            Route("/ui/workflow/execute", ui_bridge_workflow_execute_endpoint, methods=["POST"]),
            Route("/ui/workflow/lifecycle", ui_bridge_workflow_lifecycle_endpoint, methods=["POST"]),
            Route("/workflow/quick-rollback", workflow_quick_rollback_endpoint, methods=["POST"]),
            Route("/workflow/checkpoint/create", checkpoint_create_endpoint, methods=["POST"]),
            Route("/workflow/checkpoint/restore", checkpoint_restore_endpoint, methods=["POST"]),
            Route("/workflow/checkpoint/list", checkpoint_list_endpoint, methods=["POST"]),
            Route("/agent/route", agent_route_endpoint, methods=["POST"]),
            Route("/agent/write", agent_write_endpoint, methods=["POST"]),
            Route("/agent/revise", agent_revise_endpoint, methods=["POST"]),
            Route("/agent/context", agent_context_endpoint, methods=["POST"]),
            Route("/skills/list", skills_list_endpoint, methods=["GET"]),
            Route("/skills/load", skills_load_endpoint, methods=["POST"]),
            Route("/skills/match", skills_match_endpoint, methods=["POST"]),
            Route("/skills/chain", skills_chain_endpoint, methods=["POST"]),
            Route("/chat", chat_endpoint, methods=["POST"]),
            Route("/chat/stream", chat_stream_endpoint, methods=["POST"]),
            # MCP 服务挂载 (7个服务)
            Mount("/memory", memory_mcp.streamable_http_app()),
            Mount("/graph", graph_mcp.streamable_http_app()),
            Mount("/search", search_mcp.streamable_http_app()),
            Mount("/workflow", workflow_mcp.streamable_http_app()),
            Mount("/critic", critic_mcp.streamable_http_app()),
            Mount("/agent", agent_mcp.streamable_http_app()),
            Mount("/skills", skills_mcp.streamable_http_app()),
        ],
        lifespan=lifespan,
    )
    gateway.add_middleware(GatewayMetricsMiddleware)

    # 添加 CORS 支持
    gateway = CORSMiddleware(
        gateway,
        allow_origins=_resolve_cors_origins(),
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["Mcp-Session-Id"],  # 重要: Session 管理必需
    )

    return gateway


# 创建默认应用实例
app = create_gateway()


if __name__ == "__main__":
    import uvicorn

    host, port = _resolve_gateway_host_port()
    reload_enabled = _resolve_reload_enabled()

    uvicorn.run(
        "src.mcp.gateway:app",
        host=host,
        port=port,
        reload=reload_enabled,
        log_level="info"
    )
