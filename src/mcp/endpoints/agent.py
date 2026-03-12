"""
Agent REST Endpoints

Agent-related HTTP endpoints for Desktop frontend.
"""

import logging

from starlette.requests import Request
from starlette.responses import JSONResponse

from src.mcp.contract import _guard_detection_evasion_payload

logger = logging.getLogger("niko-gateway")


async def agent_route_endpoint(request: Request):
    """Agent route REST endpoint."""
    from src.mcp.gateway import agent_route

    body = await request.json()
    result = await agent_route(task=body.get("task", ""))
    return JSONResponse(result)


async def agent_write_endpoint(request: Request):
    """Agent write REST endpoint."""
    from src.mcp.gateway import agent_write

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
    """Agent revise REST endpoint."""
    from src.mcp.gateway import agent_revise, _guard_detection_evasion_payload

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
    """Agent context REST endpoint."""
    from src.mcp.gateway import agent_get_context

    body = await request.json()
    result = await agent_get_context(
        scene_info=body.get("scene_info") or {},
        context_types=body.get("context_types"),
    )
    return JSONResponse(result)


__all__ = [
    "agent_route_endpoint",
    "agent_write_endpoint",
    "agent_revise_endpoint",
    "agent_context_endpoint",
]
