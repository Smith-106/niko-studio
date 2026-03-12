"""
MCP Workflow Service

Workflow service FastMCP module with 9 tools for workflow operations.
"""

import logging
from typing import Optional

from mcp.server.fastmcp import FastMCP

logger = logging.getLogger("niko-gateway")

workflow_mcp = FastMCP("NikoWorkflow", stateless_http=True)


def _get_engine():
    """Get workflow engine (lazy import to allow test monkeypatching via gateway)."""
    from src.mcp.gateway import get_workflow_engine
    return get_workflow_engine()


def _get_integration_adapters():
    """Get integration adapters (lazy import to allow test monkeypatching via gateway)."""
    from src.mcp.gateway import _INTEGRATION_ADAPTERS
    return _INTEGRATION_ADAPTERS


def _resolve_governance_hook_enabled() -> bool:
    """Check if DBHub governance hook is enabled."""
    from src.mcp.config import _resolve_governance_hook_enabled
    return _resolve_governance_hook_enabled()


def _resolve_langflow_flow_name() -> str:
    """Resolve Langflow flow name for orchestration hooks."""
    from src.mcp.config import _resolve_langflow_flow_name
    return _resolve_langflow_flow_name()


def _merge_recommendations_with_genre(recommendations, genre):
    """Merge recommendations with genre-specific recommendation."""
    from src.cli.commands.genre_profile import genre_to_generation_recommendation
    merged = []
    if isinstance(recommendations, list):
        merged = list(recommendations)

    genre_recommendation = genre_to_generation_recommendation(str(genre or "none"))
    if genre_recommendation is None:
        return merged if merged else recommendations

    merged.append(genre_recommendation)
    return merged


@workflow_mcp.tool()
async def workflow_route(task: str) -> dict:
    """
    路由任务到合适的工作流级别 (L1-L5)

    Args:
        task: 任务描述

    Returns:
        {"level": "L3", "reason": "...", "suggested_workflow": "..."}

    级别说明:
        L1: 简单问答
        L2: 段落生成
        L3: 章节创作
        L4: 多章连续
        L5: 全书规划
    """
    engine = _get_engine()
    return await engine.route(task)


@workflow_mcp.tool()
async def workflow_plan(
    task: str,
    level: str = None,
    recommendations: list = None,
    genre: Optional[str] = None,
) -> dict:
    """
    生成执行计划 (Plan 模式)

    Args:
        task: 任务描述
        level: 指定级别 (可选)

    Returns:
        {"plan_id": "...", "steps": [...], "dependencies": [...]}
    """
    merged_recommendations = _merge_recommendations_with_genre(recommendations, genre)

    if _resolve_governance_hook_enabled():
        try:
            adapters = _get_integration_adapters()
            await adapters.governance.on_schema_workflow(
                event="workflow_plan_requested",
                payload={
                    "task": task,
                    "level": level,
                    "recommendations_count": len(merged_recommendations or []),
                },
            )
        except Exception as exc:
            logger.warning("dbhub governance hook failed, continue local-first: %s", exc)

    engine = _get_engine()
    return await engine.plan(task, level, recommendations=merged_recommendations)


@workflow_mcp.tool()
async def workflow_execute(
    plan_id: str,
    step_id: str = None,
    recommendations: list = None,
    confirm_token: str = None,
) -> dict:
    """
    执行计划 (Act 模式)

    Args:
        plan_id: 计划ID
        step_id: 指定步骤ID (可选,默认执行下一步)

    Returns:
        执行结果
    """
    engine = _get_engine()
    return await engine.execute(
        plan_id,
        step_id,
        recommendations=recommendations,
        confirm_token=confirm_token,
    )


@workflow_mcp.tool()
async def workflow_quick_rollback(
    plan_id: str,
    checkpoint_id: str,
    reason: str = "",
) -> dict:
    """执行快速撤销，恢复到指定 checkpoint。"""
    engine = _get_engine()
    return await engine.quick_rollback(plan_id=plan_id, checkpoint_id=checkpoint_id, reason=reason)


@workflow_mcp.tool()
async def workflow_lifecycle(
    plan_id: str,
    action: str = "status"
) -> dict:
    """
    loop-runner 生命周期控制。

    支持动作:
      - start
      - pause
      - resume
      - stop
      - status
    """
    engine = _get_engine()
    return await engine.lifecycle(plan_id, action)


@workflow_mcp.tool()
async def checkpoint_create(
    description: str = "",
    auto_commit: bool = True
) -> dict:
    """
    创建检查点 (Git-based)

    Args:
        description: 检查点描述
        auto_commit: 是否自动提交

    Returns:
        {"checkpoint_id": "...", "commit_hash": "..."}
    """
    engine = _get_engine()
    return await engine.create_checkpoint(description, auto_commit)


@workflow_mcp.tool()
async def checkpoint_restore(checkpoint_id: str, confirm_token: str = None) -> dict:
    """
    恢复到检查点

    Args:
        checkpoint_id: 检查点ID

    Returns:
        恢复结果
    """
    engine = _get_engine()
    return await engine.restore_checkpoint(checkpoint_id, confirm_token=confirm_token)


@workflow_mcp.tool()
async def checkpoint_list(limit: int = 10) -> list:
    """
    列出最近的检查点

    Args:
        limit: 返回数量

    Returns:
        检查点列表
    """
    engine = _get_engine()
    return await engine.list_checkpoints(limit)


__all__ = ["workflow_mcp"]
