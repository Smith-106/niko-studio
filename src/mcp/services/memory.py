"""
MCP Memory Service

Memory service FastMCP module with 5 tools for memory operations.
"""

import logging
from mcp.server.fastmcp import FastMCP

logger = logging.getLogger("niko-gateway")

memory_mcp = FastMCP("NikoMemory", stateless_http=True)


def _get_engine():
    """Get memory engine (lazy import to allow test monkeypatching via gateway)."""
    from src.mcp.gateway import get_memory_engine
    return get_memory_engine()


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
    engine = _get_engine()
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
    engine = _get_engine()
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
    engine = _get_engine()
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
    engine = _get_engine()
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
    engine = _get_engine()
    return await engine.resolve_conflict(memory_id_a, memory_id_b, resolution)


__all__ = ["memory_mcp"]
