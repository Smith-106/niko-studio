"""
Skills REST Endpoints

Skills-related HTTP endpoints for Desktop frontend.
"""

import logging

from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger("niko-gateway")


async def skills_list_endpoint(request: Request):
    """Skills list REST endpoint."""
    from src.mcp.gateway import skills_list

    category = request.query_params.get("category")
    result = await skills_list(category=category)
    return JSONResponse(result)


async def skills_load_endpoint(request: Request):
    """Skills load REST endpoint."""
    from src.mcp.gateway import skills_load

    body = await request.json()
    result = await skills_load(skill_id=body.get("skill_id", ""))
    return JSONResponse(result)


async def skills_match_endpoint(request: Request):
    """Skills match REST endpoint."""
    from src.mcp.gateway import skills_match

    body = await request.json()
    result = await skills_match(
        task_type=body.get("task_type"),
        keywords=body.get("keywords"),
        issue=body.get("issue"),
    )
    return JSONResponse(result)


async def skills_chain_endpoint(request: Request):
    """Skills chain REST endpoint."""
    from src.mcp.gateway import skills_get_chain

    body = await request.json()
    result = await skills_get_chain(task_type=body.get("task_type", ""))
    return JSONResponse(result)


__all__ = [
    "skills_list_endpoint",
    "skills_load_endpoint",
    "skills_match_endpoint",
    "skills_chain_endpoint",
]
