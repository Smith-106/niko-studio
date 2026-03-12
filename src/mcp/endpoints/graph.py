"""
Graph REST Endpoints

Graph-related HTTP endpoints for Desktop frontend.
"""

import logging

from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger("niko-gateway")


async def graph_query_endpoint(request: Request):
    """Graph Cypher query REST endpoint."""
    from src.mcp.gateway import graph_query

    body = await request.json()
    result = await graph_query(cypher=body.get("cypher", ""))
    return JSONResponse(result)


async def graph_character_endpoint(request: Request):
    """Graph character query REST endpoint."""
    from src.mcp.gateway import graph_get_character

    body = await request.json()
    result = await graph_get_character(
        name=body.get("name", ""),
        include_relations=body.get("include_relations", True),
        include_timeline=body.get("include_timeline", False),
    )
    return JSONResponse(result)


async def graph_foreshadows_endpoint(request: Request):
    """Graph foreshadows query REST endpoint."""
    from src.mcp.gateway import graph_get_foreshadows

    body = await request.json()
    result = await graph_get_foreshadows(
        status=body.get("status", "pending"),
        chapter=body.get("chapter"),
    )
    return JSONResponse(result)


__all__ = [
    "graph_query_endpoint",
    "graph_character_endpoint",
    "graph_foreshadows_endpoint",
]
