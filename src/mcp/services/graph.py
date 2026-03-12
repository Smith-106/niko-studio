"""
MCP Graph Service

Graph service FastMCP module with 6 tools for knowledge graph operations.
"""

import logging
from mcp.server.fastmcp import FastMCP

logger = logging.getLogger("niko-gateway")

graph_mcp = FastMCP("NikoGraph", stateless_http=True)


def _get_engine():
    """Get graph engine (lazy import to allow test monkeypatching via gateway)."""
    from src.mcp.gateway import get_graph_engine
    return get_graph_engine()


@graph_mcp.tool()
async def graph_query(cypher: str) -> list:
    """
    执行 Cypher 查询

    Args:
        cypher: Cypher 查询语句

    Returns:
        查询结果列表
    """
    engine = _get_engine()
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
    engine = _get_engine()
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
    engine = _get_engine()
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
    engine = _get_engine()
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
    engine = _get_engine()
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
    engine = _get_engine()
    return await engine.create_relation(from_name, to_name, relation_type, properties or {})


__all__ = ["graph_mcp"]
