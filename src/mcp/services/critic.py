"""
MCP Critic Service

Critic service FastMCP module with 3 tools for content evaluation.
"""

import logging
from typing import Optional

from mcp.server.fastmcp import FastMCP

from src.workflow.state import NOVEL_PASS_SCORE, NOVEL_HUMAN_REVIEW_SCORE

logger = logging.getLogger("niko-gateway")

critic_mcp = FastMCP("NikoCritic", stateless_http=True)


def _get_engine():
    """Get critic engine (lazy import to avoid circular dependencies)."""
    # Import from gateway to allow test monkeypatching via gateway_module
    from src.mcp.gateway import get_critic_engine
    return get_critic_engine()


@critic_mcp.tool()
async def evaluate_content(
    content: str,
    scene_card: dict = None,
    dimensions: list = None,
    quality_goals: Optional[dict] = None,
) -> dict:
    """
    多维度评估内容 (整合 Critic Agent)

    Args:
        content: 待评估内容
        scene_card: 场景卡片 (兼容参数，当前未使用)
        dimensions: 评估维度 (默认全部)
            - lock: LOCK系统 (L/O/C/K)
            - style: 风格质量 (感官/狄更斯/对话/人设/节奏)
            - logic: 逻辑体验 (剧情/读者/设定)

    Returns:
        {
            "decision": "APPROVED/REVISE/REWRITE/HUMAN_REVIEW",
            "total_score": 85.0,
            "lock_score": 32.0,
            "style_score": 30.0,
            "logic_score": 23.0,
            "actionable_feedback": "...",
            "suggestions": [...]
        }
    """
    engine = _get_engine()

    # 当前容器中的 CriticEngine.evaluate 签名为 evaluate(content, dimensions=None)
    # 兼容支持 quality_goals 的实现，保持向后兼容
    if quality_goals is not None:
        try:
            raw = await engine.evaluate(content, dimensions, quality_goals=quality_goals)
        except TypeError as exc:
            if "unexpected keyword argument" in str(exc):
                raw = await engine.evaluate(content, dimensions)
            else:
                raise
    else:
        raw = await engine.evaluate(content, dimensions)

    # 兼容两种结果结构：
    # 1) legacy: total_score/lock_score/style_score/logic_score/actionable_feedback
    # 2) narrative engine: overall_score/dimensions/issues/recommended_skills
    if isinstance(raw, dict) and "total_score" in raw and "actionable_feedback" in raw:
        return raw

    dim_result = raw.get("dimensions", {}) if isinstance(raw, dict) else {}

    def _dim_score(name: str) -> float:
        value = dim_result.get(name, {}).get("score", 0)
        try:
            return float(value)
        except (TypeError, ValueError):
            return 0.0

    # 将 0-10 维度分映射到前端现有 0-100 结构
    lock_score = _dim_score("dream") * 4
    style_score = _dim_score("voice") * 3.5
    logic_score = ((_dim_score("suspense") + _dim_score("character") + _dim_score("premise")) / 3 if dim_result else 0) * 2.5

    overall_score = raw.get("overall_score", 0) if isinstance(raw, dict) else 0
    total_score = float(overall_score) * 10

    issue_list = raw.get("issues", []) if isinstance(raw, dict) else []
    feedback = "；".join(issue_list[:3]) if issue_list else "评估完成"

    suggestions = raw.get("recommended_skills", []) if isinstance(raw, dict) else []

    decision = (
        "APPROVED"
        if total_score >= NOVEL_PASS_SCORE
        else "REVISE"
        if total_score >= NOVEL_HUMAN_REVIEW_SCORE
        else "REWRITE"
    )

    return {
        "decision": decision,
        "total_score": round(total_score, 1),
        "lock_score": round(lock_score, 1),
        "style_score": round(style_score, 1),
        "logic_score": round(logic_score, 1),
        "actionable_feedback": feedback,
        "suggestions": suggestions,
    }


@critic_mcp.tool()
async def get_improvement_suggestions(
    content: str,
    issues: list = None,
    max_suggestions: int = 5
) -> list:
    """
    获取改进建议

    Args:
        content: 待改进内容
        issues: 已识别的问题
        max_suggestions: 最大建议数

    Returns:
        [{"issue": "...", "suggestion": "...", "skill": "...", "priority": "high"}]
    """
    engine = _get_engine()
    return await engine.suggest_improvements(content, issues, max_suggestions)


@critic_mcp.tool()
async def compare_versions(
    version_a: str,
    version_b: str
) -> dict:
    """
    比较两个版本的质量差异

    Args:
        version_a: 版本A内容
        version_b: 版本B内容

    Returns:
        对比分析结果
    """
    engine = _get_engine()
    return await engine.compare(version_a, version_b)


__all__ = ["critic_mcp"]
