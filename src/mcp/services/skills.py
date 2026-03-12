"""
MCP Skills Service

Skills service FastMCP module with 4 tools for skill operations.
"""

import logging
from mcp.server.fastmcp import FastMCP

logger = logging.getLogger("niko-gateway")

skills_mcp = FastMCP("NikoSkills", stateless_http=True)


@skills_mcp.tool()
async def skills_list(category: str = None) -> list:
    """
    列出所有技能包

    Args:
        category: 类别过滤 (character/structure/suspense/description/evaluation)

    Returns:
        技能列表
    """
    from src.agents.skill_router import SkillRouter

    router = SkillRouter()
    all_skills = router.list_all_skills()

    result = []
    for skill_id, info in all_skills.items():
        if category and info.get("category", "") != category:
            continue
        skill_entry = {
            "id": skill_id,
            "name": info.get("name", skill_id),
            "description": info.get("description", ""),
            "keywords": info.get("keywords", [])
        }
        result.append(skill_entry)

    return result


@skills_mcp.tool()
async def skills_match(
    task_type: str = None,
    keywords: list = None,
    issue: str = None
) -> list:
    """
    匹配技能包

    Args:
        task_type: 任务类型 (character_creation/dialogue/climax_writing 等)
        keywords: 关键词列表
        issue: 问题描述

    Returns:
        匹配的技能列表，按相关度排序
    """
    from src.agents.skill_router import SkillRouter, TaskType

    router = SkillRouter()

    if task_type:
        try:
            tt = TaskType(task_type)
            recommendations = router.route_by_task_type(tt)
        except ValueError:
            recommendations = []
    elif keywords:
        recommendations = router.route_by_keywords(keywords)
    elif issue:
        recommendations = router.route_by_issue(issue)
    else:
        recommendations = []

    return [
        {
            "skill_id": r.skill_id,
            "skill_name": r.skill_name,
            "relevance": r.relevance,
            "reason": r.reason,
            "priority": r.priority
        }
        for r in recommendations
    ]


@skills_mcp.tool()
async def skills_load(skill_id: str) -> dict:
    """
    加载技能包内容

    Args:
        skill_id: 技能ID

    Returns:
        技能包完整内容
    """
    from src.skills.skill_loader import SkillLoader

    loader = SkillLoader()
    skill = loader.load_skill(skill_id)

    if skill:
        return {
            "id": skill_id,
            "content": skill.get("content", ""),
            "metadata": skill.get("metadata", {})
        }

    return {"error": f"Skill '{skill_id}' not found"}


@skills_mcp.tool()
async def skills_get_chain(task_type: str) -> list:
    """
    获取技能链 (按执行顺序)

    Args:
        task_type: 任务类型

    Returns:
        按执行顺序排列的技能链
    """
    from src.agents.skill_router import SkillRouter, TaskType

    router = SkillRouter()

    try:
        tt = TaskType(task_type)
        chain = router.get_skill_chain(tt)
        return [
            {
                "skill_id": r.skill_id,
                "skill_name": r.skill_name,
                "step": r.priority,
                "reason": r.reason
            }
            for r in chain
        ]
    except ValueError:
        return []


__all__ = ["skills_mcp"]
