"""
MCP Gateway Engine Accessors

Engine accessor functions that delegate to the service container.
"""

from src.container import get_container


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


__all__ = [
    "get_memory_engine",
    "get_graph_engine",
    "get_search_engine",
    "get_workflow_engine",
    "get_critic_engine",
    "prewarm_engines",
]
