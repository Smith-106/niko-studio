"""
Workflow REST Endpoints

Workflow-related HTTP endpoints for Desktop frontend.
"""

import logging

from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger("niko-gateway")


async def workflow_route_endpoint(request: Request):
    """Workflow route REST endpoint."""
    from src.mcp.gateway import workflow_route

    body = await request.json()
    result = await workflow_route(task=body.get("task", ""))
    return JSONResponse(result)


async def workflow_plan_endpoint(request: Request):
    """Workflow plan REST endpoint."""
    from src.mcp.gateway import workflow_plan

    body = await request.json()
    kwargs = {
        "task": body.get("task", ""),
        "level": body.get("level"),
        "recommendations": body.get("recommendations"),
    }
    if "genre" in body:
        kwargs["genre"] = body.get("genre")
    result = await workflow_plan(**kwargs)
    return JSONResponse(result)


async def workflow_execute_endpoint(request: Request):
    """Workflow execute REST endpoint."""
    from src.mcp.gateway import workflow_execute

    body = await request.json()
    result = await workflow_execute(
        plan_id=body.get("plan_id", ""),
        step_id=body.get("step_id"),
        recommendations=body.get("recommendations"),
        confirm_token=body.get("confirm_token"),
    )
    return JSONResponse(result)


async def workflow_lifecycle_endpoint(request: Request):
    """Workflow lifecycle REST endpoint."""
    from src.mcp.gateway import workflow_lifecycle

    body = await request.json()
    result = await workflow_lifecycle(
        plan_id=body.get("plan_id", ""),
        action=body.get("action", "status"),
    )
    return JSONResponse(result)


async def workflow_quick_rollback_endpoint(request: Request):
    """Workflow quick rollback REST endpoint."""
    from src.mcp.gateway import workflow_quick_rollback

    body = await request.json()
    result = await workflow_quick_rollback(
        plan_id=body.get("plan_id", ""),
        checkpoint_id=body.get("checkpoint_id", ""),
        reason=body.get("reason", ""),
    )
    return JSONResponse(result)


# UI Bridge endpoints (wrap workflow endpoints with enabled check)

async def ui_bridge_workflow_route_endpoint(request: Request):
    """UI Bridge workflow route endpoint."""
    from src.mcp.gateway import _resolve_ui_bridge_enabled, _ui_bridge_disabled_response
    if not _resolve_ui_bridge_enabled():
        return _ui_bridge_disabled_response()
    return await workflow_route_endpoint(request)


async def ui_bridge_workflow_plan_endpoint(request: Request):
    """UI Bridge workflow plan endpoint."""
    from src.mcp.gateway import _resolve_ui_bridge_enabled, _ui_bridge_disabled_response
    if not _resolve_ui_bridge_enabled():
        return _ui_bridge_disabled_response()
    return await workflow_plan_endpoint(request)


async def ui_bridge_workflow_execute_endpoint(request: Request):
    """UI Bridge workflow execute endpoint."""
    from src.mcp.gateway import _resolve_ui_bridge_enabled, _ui_bridge_disabled_response
    if not _resolve_ui_bridge_enabled():
        return _ui_bridge_disabled_response()
    return await workflow_execute_endpoint(request)


async def ui_bridge_workflow_lifecycle_endpoint(request: Request):
    """UI Bridge workflow lifecycle endpoint."""
    from src.mcp.gateway import _resolve_ui_bridge_enabled, _ui_bridge_disabled_response
    if not _resolve_ui_bridge_enabled():
        return _ui_bridge_disabled_response()
    return await workflow_lifecycle_endpoint(request)


async def checkpoint_create_endpoint(request: Request):
    """Checkpoint create REST endpoint."""
    from src.mcp.gateway import checkpoint_create

    body = await request.json()
    result = await checkpoint_create(
        description=body.get("description", ""),
        auto_commit=body.get("auto_commit", True),
    )
    return JSONResponse(result)


async def checkpoint_restore_endpoint(request: Request):
    """Checkpoint restore REST endpoint."""
    from src.mcp.gateway import checkpoint_restore

    body = await request.json()
    result = await checkpoint_restore(
        checkpoint_id=body.get("checkpoint_id", ""),
        confirm_token=body.get("confirm_token"),
    )
    return JSONResponse(result)


async def checkpoint_list_endpoint(request: Request):
    """Checkpoint list REST endpoint."""
    from src.mcp.gateway import checkpoint_list

    body = await request.json()
    result = await checkpoint_list(limit=body.get("limit", 10))
    return JSONResponse(result)


__all__ = [
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
]
