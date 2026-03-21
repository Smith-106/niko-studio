"""
MCP Endpoint Modules

This package contains HTTP endpoint handlers for the MCP Gateway.
"""

from src.mcp.endpoints.health import (
    health_check,
    metrics_endpoint,
    list_tools,
    list_models,
)
from src.mcp.endpoints.mcp_admin import (
    list_mcp_services,
    create_mcp_service,
    update_mcp_service,
    delete_mcp_service,
    set_mcp_service_enabled,
    probe_mcp_service_health,
)
from src.mcp.endpoints.memory import (
    memory_search_endpoint,
    memory_add_endpoint,
    memory_upload_endpoint,
    memory_temporal_endpoint,
)
from src.mcp.endpoints.graph import (
    graph_query_endpoint,
    graph_character_endpoint,
    graph_foreshadows_endpoint,
)
from src.mcp.endpoints.critic import (
    critic_evaluate_endpoint,
    critic_suggestions_endpoint,
)
from src.mcp.endpoints.writing import (
    novel_quality_check_endpoint,
    writing_helper_process_endpoint,
)
from src.mcp.endpoints.workflow import (
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
)
from src.mcp.endpoints.agent import (
    agent_route_endpoint,
    agent_write_endpoint,
    agent_revise_endpoint,
    agent_context_endpoint,
)
from src.mcp.endpoints.skills import (
    skills_list_endpoint,
    skills_load_endpoint,
    skills_match_endpoint,
    skills_chain_endpoint,
)
from src.mcp.endpoints.chat import (
    chat_endpoint,
    chat_stream_endpoint,
)
from src.mcp.endpoints.config import (
    get_config,
    update_config,
    get_secrets,
    update_secrets,
    reload_config,
)

__all__ = [
    # Health endpoints
    "health_check",
    "metrics_endpoint",
    "list_tools",
    "list_models",
    # MCP admin endpoints
    "list_mcp_services",
    "create_mcp_service",
    "update_mcp_service",
    "delete_mcp_service",
    "set_mcp_service_enabled",
    "probe_mcp_service_health",
    # Memory endpoints
    "memory_search_endpoint",
    "memory_add_endpoint",
    "memory_upload_endpoint",
    "memory_temporal_endpoint",
    # Graph endpoints
    "graph_query_endpoint",
    "graph_character_endpoint",
    "graph_foreshadows_endpoint",
    # Critic endpoints
    "critic_evaluate_endpoint",
    "critic_suggestions_endpoint",
    # Writing endpoints
    "novel_quality_check_endpoint",
    "writing_helper_process_endpoint",
    # Workflow endpoints
    "workflow_route_endpoint",
    "workflow_plan_endpoint",
    "workflow_execute_endpoint",
    "workflow_lifecycle_endpoint",
    "workflow_quick_rollback_endpoint",
    "ui_bridge_workflow_route_endpoint",
    "ui_bridge_workflow_plan_endpoint",
    "ui_bridge_workflow_execute_endpoint",
    "ui_bridge_workflow_lifecycle_endpoint",
    "checkpoint_create_endpoint",
    "checkpoint_restore_endpoint",
    "checkpoint_list_endpoint",
    # Agent endpoints
    "agent_route_endpoint",
    "agent_write_endpoint",
    "agent_revise_endpoint",
    "agent_context_endpoint",
    # Skills endpoints
    "skills_list_endpoint",
    "skills_load_endpoint",
    "skills_match_endpoint",
    "skills_chain_endpoint",
    # Chat endpoints
    "chat_endpoint",
    "chat_stream_endpoint",
    # Config endpoints
    "get_config",
    "update_config",
    "get_secrets",
    "update_secrets",
    "reload_config",
]
