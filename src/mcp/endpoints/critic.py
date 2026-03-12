"""
Critic REST Endpoints

Critic-related HTTP endpoints for content evaluation.
"""

import logging

from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger("niko-gateway")


async def critic_evaluate_endpoint(request: Request):
    """Critic evaluate REST endpoint."""
    from src.mcp.gateway import evaluate_content

    body = await request.json()
    quality_goals = body.get("quality_goals")
    if quality_goals is None:
        quality_goals = body.get("qualityGoals")
    result = await evaluate_content(
        content=body.get("content", ""),
        scene_card=body.get("scene_card"),
        dimensions=body.get("dimensions"),
        quality_goals=quality_goals,
    )
    return JSONResponse(result)


async def critic_suggestions_endpoint(request: Request):
    """Critic suggestions REST endpoint."""
    from src.mcp.gateway import get_improvement_suggestions

    body = await request.json()
    result = await get_improvement_suggestions(
        content=body.get("content", ""),
        issues=body.get("issues"),
        max_suggestions=body.get("max_suggestions", 5),
    )
    return JSONResponse(result)


__all__ = [
    "critic_evaluate_endpoint",
    "critic_suggestions_endpoint",
]
