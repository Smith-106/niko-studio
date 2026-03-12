"""
MCP Agent Service

Agent service FastMCP module with 4 tools for agent operations.
"""

import logging
from typing import Optional

from mcp.server.fastmcp import FastMCP

from src.workflow.state import NOVEL_PASS_SCORE, NOVEL_HUMAN_REVIEW_SCORE

logger = logging.getLogger("niko-gateway")

agent_mcp = FastMCP("NikoAgent", stateless_http=True)


# These functions are imported by gateway.py and re-exported for test monkeypatching
def get_commander_agent():
    """Get commander agent (delegates to container)."""
    from src.container import get_container
    return get_container().commander


def get_writer_agent():
    """Get writer agent (delegates to container)."""
    from src.container import get_container
    return get_container().writer


@agent_mcp.tool()
async def agent_route(task: str) -> dict:
    """
    使用 Commander Agent 路由任务

    Args:
        task: 任务描述

    Returns:
        {
            "workflow_level": "L3",
            "workflow_level_slug": "standard",
            "scene_type": "dialogue",
            "dispatched_skills": ["dialogue-system", ...],
            "task_assignments": [...]
        }
    """
    from src.workflow.levels.types import WorkflowLevel, to_workflow_label, to_workflow_slug
    # Import from gateway to allow test monkeypatching
    from src.mcp.gateway import get_commander_agent as _get_commander_agent

    agent = _get_commander_agent()
    level = WorkflowLevel.from_label(agent.route(task))
    if not isinstance(level, WorkflowLevel):
        level = WorkflowLevel.from_label(level)
    scene_type = agent.detect_scene_type(task)
    skills = agent.dispatch_skills(scene_type)
    assignments = agent.dispatch_tasks(task, level)

    return {
        "workflow_level": to_workflow_label(level),
        "workflow_level_slug": to_workflow_slug(level),
        "scene_type": scene_type.value,
        "dispatched_skills": skills,
        "task_assignments": [a.model_dump(mode="json") for a in assignments]
    }


@agent_mcp.tool()
async def agent_write(
    scene_card: dict,
    skills: list = None,
    word_target: int = 2000,
    allow_llm_fallback: bool = True,
    quality_goals: Optional[dict] = None,
) -> dict:
    """
    使用 Writer Agent 生成内容

    Args:
        scene_card: 场景卡片
        skills: 注入的技能列表
        word_target: 目标字数
        allow_llm_fallback: 是否允许 LLM 降级

    Returns:
        {
            "content": "...",
            "wordcount": 2000,
            "sensory_types": ["visual", "auditory"],
            "forbidden_words_found": []
        }
    """
    from src.agents.writer import WriterAgent, WriterInput
    # Import from gateway to allow test monkeypatching
    from src.mcp.gateway import get_writer_agent as _get_writer_agent

    agent = _get_writer_agent()

    if skills:
        agent.inject_skills(skills)

    writer_input = WriterInput(
        scene_id=scene_card.get("scene_id", "CH01-SC01"),
        chapter_num=scene_card.get("chapter_num", 1),
        pov_character=scene_card.get("pov_character", ""),
        objective=scene_card.get("objective", ""),
        conflict=scene_card.get("conflict", ""),
        outcome=scene_card.get("outcome", "+"),
        plot_beat=scene_card.get("plot_beat", ""),
        emotional_arc=scene_card.get("emotional_arc", "平静→变化"),
        sensory_guidance=scene_card.get("sensory_guidance", {}),
        word_target=word_target
    )

    result = await agent.write(writer_input, allow_llm_fallback=allow_llm_fallback)

    return {
        "content": result.content,
        "wordcount": result.wordcount,
        "sensory_types": result.sensory_types_used,
        "forbidden_words_found": result.forbidden_words_found,
        "sections_needing_review": result.sections_needing_review
    }


@agent_mcp.tool()
async def agent_revise(
    draft: str,
    feedback: dict,
    allow_llm_fallback: bool = True,
    quality_goals: Optional[dict] = None,
) -> dict:
    """
    使用 Writer Agent 修订内容

    Args:
        draft: 原始草稿
        feedback: Critic 反馈 (issues, suggestions, dimension_scores)
        allow_llm_fallback: 是否允许 LLM 降级

    Returns:
        修订后的内容
    """
    # Import from gateway to allow test monkeypatching
    from src.mcp.gateway import get_writer_agent as _get_writer_agent
    agent = _get_writer_agent()
    revise_kwargs = {
        "allow_llm_fallback": allow_llm_fallback,
    }
    if quality_goals is not None:
        revise_kwargs["quality_goals"] = quality_goals

    result = await agent.revise(
        draft,
        feedback,
        **revise_kwargs,
    )

    return {
        "content": result.content,
        "wordcount": result.wordcount,
        "forbidden_words_found": result.forbidden_words_found
    }


@agent_mcp.tool()
async def agent_get_context(
    scene_info: dict,
    context_types: list = None
) -> dict:
    """
    获取场景上下文 (Worldbuilding + Character + Plot)

    Args:
        scene_info: 场景信息
        context_types: 上下文类型 ["world", "character", "plot"]

    Returns:
        综合上下文信息
    """
    context_types = context_types or ["world", "character", "plot"]
    result = {}

    if "world" in context_types:
        from src.agents.worldbuilding import WorldbuildingAgent
        world_agent = WorldbuildingAgent()
        world_ctx = await world_agent.get_context(scene_info)
        result["world"] = world_ctx.model_dump()

    if "character" in context_types:
        from src.agents.character import CharacterAgent
        char_agent = CharacterAgent()
        char_ctx = await char_agent.get_context(scene_info)
        result["character"] = char_ctx.model_dump()

    if "plot" in context_types:
        from src.agents.plot import PlotAgent
        plot_agent = PlotAgent()
        plot_ctx = await plot_agent.get_context(scene_info)
        result["plot"] = plot_ctx.model_dump()

    return result


__all__ = ["agent_mcp", "get_commander_agent", "get_writer_agent"]
