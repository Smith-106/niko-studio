"""
MCP Service Modules

This package contains individual MCP service modules that expose tools
for different functional areas of the Niko-Studio system.
"""

from src.mcp.services.memory import (
    memory_mcp,
    memory_add,
    memory_search,
    memory_get_temporal,
    memory_get_conflicts,
    memory_resolve_conflict,
)
from src.mcp.services.graph import (
    graph_mcp,
    graph_query,
    graph_get_character,
    graph_get_relationships,
    graph_get_foreshadows,
    graph_add_entity,
    graph_add_relation,
)
from src.mcp.services.search import (
    search_mcp,
    search_hybrid,
    search_iterative,
    search_context,
)
from src.mcp.services.workflow import (
    workflow_mcp,
    workflow_route,
    workflow_plan,
    workflow_execute,
    workflow_quick_rollback,
    workflow_lifecycle,
    checkpoint_create,
    checkpoint_restore,
    checkpoint_list,
)
from src.mcp.services.critic import (
    critic_mcp,
    evaluate_content,
    get_improvement_suggestions,
    compare_versions,
)
from src.mcp.services.agent import (
    agent_mcp,
    agent_route,
    agent_write,
    agent_revise,
    agent_get_context,
    get_commander_agent,
    get_writer_agent,
)
from src.mcp.services.skills import (
    skills_mcp,
    skills_list,
    skills_match,
    skills_load,
    skills_get_chain,
)

__all__ = [
    "memory_mcp",
    "graph_mcp",
    "search_mcp",
    "workflow_mcp",
    "critic_mcp",
    "agent_mcp",
    "skills_mcp",
    # Tool functions for test compatibility
    "memory_add",
    "memory_search",
    "memory_get_temporal",
    "memory_get_conflicts",
    "memory_resolve_conflict",
    "graph_query",
    "graph_get_character",
    "graph_get_relationships",
    "graph_get_foreshadows",
    "graph_add_entity",
    "graph_add_relation",
    "search_hybrid",
    "search_iterative",
    "search_context",
    "workflow_route",
    "workflow_plan",
    "workflow_execute",
    "workflow_quick_rollback",
    "workflow_lifecycle",
    "checkpoint_create",
    "checkpoint_restore",
    "checkpoint_list",
    "evaluate_content",
    "get_improvement_suggestions",
    "compare_versions",
    "agent_route",
    "agent_write",
    "agent_revise",
    "agent_get_context",
    "get_commander_agent",
    "get_writer_agent",
    "skills_list",
    "skills_match",
    "skills_load",
    "skills_get_chain",
]
