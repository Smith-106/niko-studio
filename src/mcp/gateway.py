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
import inspect
import io
import base64
import os
from typing import Optional, List, Dict, Any

from src import __version__
from src.config import get_config_value
from src.knowledge.services.config import load_config as load_services_config
from src.workflow.state import (
    NOVEL_PASS_SCORE,
    NOVEL_HUMAN_REVIEW_SCORE,
)
from src.cli.commands.genre_profile import genre_to_generation_recommendation
from src.services.document_loader import DocumentLoader
from src.services.writing_helper import process_writing_helper
from src.workflow.novel_quality import evaluate_novel_quality

# Import from extracted modules
from src.mcp.config import (
    _is_production_env,
    _resolve_reload_enabled,
    _resolve_gateway_host_port,
    _resolve_search_route_mode,
    _resolve_search_elastic_timeout_ms,
    _resolve_redis_rate_limit,
    _resolve_langflow_flow_name,
    _resolve_governance_hook_enabled,
    _resolve_redis_cache_ttl_seconds,
    _resolve_search_cache_key,
    _resolve_ui_bridge_enabled,
    _parse_origins,
    _resolve_cors_origins,
    _ui_bridge_disabled_response,
)
from src.mcp.config import _is_llm_available as _config_is_llm_available
from src.mcp.metrics import (
    _METRICS,
    _record_request_metrics,
    _get_metrics_snapshot,
    _utc_now_iso,
    GatewayMetricsMiddleware,
)
from src.mcp.service_config import (
    McpServiceConfig,
    _MCP_SERVICE_CONFIGS,
    _MCP_SERVICE_HEALTH_CACHE,
    _RUNTIME_SERVER_ORDER,
    _serialize_service_config,
    _normalize_service_config_payload,
    _update_service_config,
    _set_service_enabled,
    _refresh_service_health_cache,
    _service_runtime_status,
)
from src.mcp.runtime import (
    _RUNTIME_SESSION_ID,
    _RUNTIME_LAST_PROBE_AT,
    _RUNTIME_RECONNECT_ATTEMPTS,
    _RUNTIME_LAST_ERROR,
    _INTEGRATION_ADAPTERS,
    _to_runtime_connection_state,
    _to_runtime_reconnect_state,
    _to_server_runtime_state,
    _build_runtime_servers,
    _service_is_ready,
    _get_observability_snapshot,
)
from src.mcp.contract import (
    _with_contract,
    _with_terminal_contract,
    _contains_detection_evasion_intent,
    _resolve_detection_evasion_guard_enabled,
    _guard_detection_evasion_payload,
    _quality_default_payload,
    _normalize_quality_payload,
    _merge_quality_sidecar,
)
from src.mcp.engine import (
    get_memory_engine,
    get_graph_engine,
    get_search_engine,
    get_workflow_engine,
    get_critic_engine,
    prewarm_engines as _engine_prewarm_engines,
)

# Import MCP services
from src.mcp.services import (
    memory_mcp,
    graph_mcp,
    search_mcp,
    workflow_mcp,
    critic_mcp,
    agent_mcp,
    skills_mcp,
    # Tool functions for test compatibility
    memory_add,
    memory_search,
    memory_get_temporal,
    memory_get_conflicts,
    memory_resolve_conflict,
    graph_query,
    graph_get_character,
    graph_get_relationships,
    graph_get_foreshadows,
    graph_add_entity,
    graph_add_relation,
    search_hybrid,
    search_iterative,
    search_context,
    workflow_route,
    workflow_plan,
    workflow_execute,
    workflow_quick_rollback,
    workflow_lifecycle,
    checkpoint_create,
    checkpoint_restore,
    checkpoint_list,
    evaluate_content,
    get_improvement_suggestions,
    compare_versions,
    agent_route,
    agent_write,
    agent_revise,
    agent_get_context,
    get_commander_agent,
    get_writer_agent,
    skills_list,
    skills_match,
    skills_load,
    skills_get_chain,
)

# Import HTTP endpoints
from src.mcp.endpoints import (
    # Health endpoints
    health_check,
    metrics_endpoint,
    list_tools,
    list_models,
    # MCP admin endpoints
    list_mcp_services,
    create_mcp_service,
    update_mcp_service,
    delete_mcp_service,
    set_mcp_service_enabled,
    probe_mcp_service_health,
    # Memory endpoints
    memory_search_endpoint,
    memory_add_endpoint,
    memory_upload_endpoint,
    memory_temporal_endpoint,
    # Graph endpoints
    graph_query_endpoint,
    graph_character_endpoint,
    graph_foreshadows_endpoint,
    # Critic endpoints
    critic_evaluate_endpoint,
    critic_suggestions_endpoint,
    # Writing endpoints
    novel_quality_check_endpoint,
    writing_helper_process_endpoint,
    # Workflow endpoints
    workflow_route_endpoint,
    workflow_plan_endpoint,
    workflow_execute_endpoint,
    workflow_lifecycle_endpoint,
    workflow_quick_rollback_endpoint,
    ui_bridge_workflow_route_endpoint,
    ui_bridge_workflow_plan_endpoint,
    ui_bridge_workflow_execute_endpoint,
    ui_bridge_workflow_lifecycle_endpoint,
    checkpoint_create_endpoint,
    checkpoint_restore_endpoint,
    checkpoint_list_endpoint,
    # Agent endpoints
    agent_route_endpoint,
    agent_write_endpoint,
    agent_revise_endpoint,
    agent_context_endpoint,
    # Skills endpoints
    skills_list_endpoint,
    skills_load_endpoint,
    skills_match_endpoint,
    skills_chain_endpoint,
    # Chat endpoints
    chat_endpoint,
    chat_stream_endpoint,
)

from starlette.applications import Starlette
from starlette.routing import Mount, Route
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse, StreamingResponse
from starlette.requests import Request

import re  # For test compatibility
import asyncio  # For test compatibility

def _is_llm_available() -> bool:
    """Wrapper to allow test monkeypatching of get_services."""
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


from src.container import get_container


def _prewarm_engines():
    """Wrapper to allow tests to monkeypatch container initialize_all."""
    return get_container().initialize_all()


async def prewarm_engines():
    """Wrapper to allow tests to monkeypatch container initialize_all."""
    await _prewarm_engines()


def _is_production_env() -> bool:
    """Wrapper to allow test monkeypatching of get_config_value."""
    env = str(os.getenv("NIKO_ENV") or get_config_value("env", "development")).lower()
    return env in {"prod", "production"}


def _resolve_reload_enabled() -> bool:
    """Wrapper to allow test monkeypatching of config."""
    if _is_production_env():
        return False
    raw = os.getenv("NIKO_GATEWAY_RELOAD")
    if raw is not None:
        return str(raw).strip().lower() in {"true", "1", "yes", "on"}
    return bool(get_config_value("gateway.reload", True))


def _resolve_gateway_host_port() -> tuple[str, int]:
    """Wrapper to allow test monkeypatching of config."""
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


def _resolve_ui_bridge_enabled() -> bool:
    """Wrapper to allow test monkeypatching of config."""
    raw = os.getenv("NIKO_UI_BRIDGE_ENABLED")
    if raw is not None:
        return str(raw).strip().lower() in {"true", "1", "yes", "on"}
    return bool(get_config_value("gateway.ui_bridge_enabled", False))


def _parse_origins(raw):
    """Wrapper to allow test monkeypatching of config."""
    if raw is None:
        return []
    if isinstance(raw, str):
        return [item.strip() for item in raw.split(",") if item.strip()]
    if isinstance(raw, (list, tuple, set)):
        cleaned = []
        for item in raw:
            if item is None:
                continue
            cleaned_item = str(item).strip()
            if cleaned_item:
                cleaned.append(cleaned_item)
        return cleaned
    return [str(raw).strip()]


def _resolve_cors_origins() -> list[str]:
    """Wrapper to allow test monkeypatching of config."""
    if _is_production_env():
        raw = os.getenv("NIKO_CORS_PROD_ORIGINS")
        if raw is None:
            raw = get_config_value("gateway.cors_prod_origins", [])
        origins = _parse_origins(raw)
        filtered = [origin for origin in origins if origin != "*" and not origin.startswith("http://localhost")]
        if not filtered:
            raise RuntimeError("Production CORS origins must include at least one non-localhost origin")
        return filtered

    raw = os.getenv("NIKO_CORS_DEV_ORIGINS")
    if raw is None:
        raw = get_config_value("gateway.cors_dev_origins", [])
    origins = _parse_origins(raw)
    return origins or ["*"]


# Re-exports for backward compatibility with tests that monkeypatch gateway module
from src.workflow.levels.level5_coordinator import Level5Coordinator
from src.workflow.base_state import create_base_state
from src.config import get_config_value
from src.mcp.config import (
    _is_production_env as _config_is_production_env,
    _resolve_reload_enabled as _config_resolve_reload_enabled,
    _resolve_gateway_host_port as _config_resolve_gateway_host_port,
    _resolve_ui_bridge_enabled as _config_resolve_ui_bridge_enabled,
    _resolve_cors_origins as _config_resolve_cors_origins,
    _parse_origins as _config_parse_origins,
    _resolve_search_route_mode,
    _resolve_search_elastic_timeout_ms,
    _resolve_governance_hook_enabled,
)
from src.mcp.metrics import _METRICS, _record_request_metrics, _get_metrics_snapshot, _utc_now_iso
from src.mcp.contract import (
    _quality_default_payload,
    _normalize_quality_payload,
    _merge_quality_sidecar,
    _guard_detection_evasion_payload,
    _normalize_schema_version,
    _normalize_issue_severity,
    _normalize_issue_item,
    _with_contract,
    _resolve_detection_evasion_guard_enabled,
)

def _normalize_schema_version(payload, contract_payload):
    """Wrapper to allow tests to override ANALYSIS_SCHEMA_VERSION."""
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
from src.mcp.service_config import _normalize_service_config_payload, _update_service_config, _set_service_enabled
from src.mcp.runtime import _INTEGRATION_ADAPTERS
from src.mcp.engine import get_memory_engine, get_graph_engine, get_search_engine, get_workflow_engine, get_critic_engine
from src.mcp.endpoints.chat import adaptive_chunk_content
from src.mcp.endpoints.health import health_check, metrics_endpoint, list_tools, list_models
from src.mcp.endpoints.mcp_admin import (
    list_mcp_services, create_mcp_service, update_mcp_service,
    delete_mcp_service, set_mcp_service_enabled, probe_mcp_service_health,
)
from src.mcp.endpoints.workflow import (
    workflow_route_endpoint, workflow_plan_endpoint, workflow_execute_endpoint,
    workflow_lifecycle_endpoint, workflow_quick_rollback_endpoint,
    ui_bridge_workflow_route_endpoint, ui_bridge_workflow_plan_endpoint,
    ui_bridge_workflow_execute_endpoint, ui_bridge_workflow_lifecycle_endpoint,
    checkpoint_create_endpoint, checkpoint_restore_endpoint, checkpoint_list_endpoint,
)
from src.mcp.endpoints.memory import (
    memory_search_endpoint, memory_add_endpoint, memory_upload_endpoint, memory_temporal_endpoint,
)
from src.mcp.endpoints.graph import graph_query_endpoint, graph_character_endpoint, graph_foreshadows_endpoint
from src.mcp.endpoints.critic import critic_evaluate_endpoint, critic_suggestions_endpoint
from src.mcp.endpoints.writing import novel_quality_check_endpoint, writing_helper_process_endpoint
from src.mcp.endpoints.agent import (
    agent_route_endpoint, agent_write_endpoint, agent_revise_endpoint, agent_context_endpoint,
)
from src.mcp.endpoints.skills import skills_list_endpoint, skills_load_endpoint, skills_match_endpoint, skills_chain_endpoint
from src.mcp.endpoints.chat import chat_endpoint, chat_stream_endpoint
from src.mcp.services import (
    memory_search, memory_add, memory_get_temporal,
    graph_query, graph_get_character, graph_get_foreshadows,
    evaluate_content, get_improvement_suggestions,
    workflow_route, workflow_plan, workflow_execute, workflow_quick_rollback,
    workflow_lifecycle, checkpoint_create, checkpoint_restore, checkpoint_list,
    agent_route, agent_write, agent_revise, agent_get_context,
    skills_list, skills_load, skills_match, skills_get_chain,
    memory_mcp, graph_mcp, search_mcp, workflow_mcp, critic_mcp, agent_mcp, skills_mcp,
    get_commander_agent, get_writer_agent,
)
from src.knowledge.services import get_services
from src.knowledge.services.config import load_config as load_services_config
from src.container import get_container
from src.workflow.novel_quality import evaluate_novel_quality
from src.workflow.levels.types import ANALYSIS_SCHEMA_VERSION, ensure_contract_payload
from src.services.document_loader import DocumentLoader

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("niko-gateway")


def _merge_recommendations_with_genre(
    recommendations: Optional[List[Dict[str, Any]]],
    genre: Optional[str],
) -> Optional[List[Dict[str, Any]]]:
    """Merge recommendations with genre-specific recommendation."""
    merged: List[Dict[str, Any]] = []
    if isinstance(recommendations, list):
        merged = list(recommendations)

    genre_recommendation = genre_to_generation_recommendation(str(genre or "none"))
    if genre_recommendation is None:
        return merged if merged else recommendations

    merged.append(genre_recommendation)
    return merged


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("niko-gateway")


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
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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
