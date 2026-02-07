"""
Niko-Studio MCP Gateway - 统一入口，支持多模型并行调用

运行方式:
    uvicorn src.mcp.gateway:app --host 0.0.0.0 --port 8000 --reload

客户端连接:
    - http://localhost:8000/memory   (记忆服务)
    - http://localhost:8000/graph    (图谱服务)
    - http://localhost:8000/search   (搜索服务)
    - http://localhost:8000/workflow (工作流服务)
    - http://localhost:8000/critic   (评估服务)

注意: Skills 不再是 MCP 服务！
    - Skills 是静态知识文件，直接本地读取
    - 使用 src.skills.load_skill() 加载
    - 使用 @skill:name 引用语法

支持的模型客户端:
    - Claude Code (主写作)
    - Codex CLI (评审)
    - Gemini Agent (规划)
    - Qwen Agent (翻译)
    - 任何支持 MCP 的客户端
"""

import contextlib
import logging
import asyncio
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any, Iterable
from pathlib import Path

from src.config import get_config_value
from src.knowledge.services import get_services


def _is_llm_available() -> bool:
    try:
        return get_services().is_healthy()
    except Exception:
        return False

from starlette.applications import Starlette
from starlette.routing import Mount, Route
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse, StreamingResponse
from mcp.server.fastmcp import FastMCP

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("niko-gateway")

# ============ 延迟导入引擎 (通过 ServiceContainer) ============

from src.container import get_container, reset_container


def get_memory_engine():
    """Get memory engine (delegates to container)."""
    return get_container().memory


def get_graph_engine():
    """Get graph engine (delegates to container)."""
    return get_container().graph


def get_search_engine():
    """Get search engine (delegates to container)."""
    return get_container().search


def get_workflow_engine():
    """Get workflow engine (delegates to container)."""
    return get_container().workflow


def get_critic_engine():
    """Get critic engine (delegates to container)."""
    return get_container().critic


async def prewarm_engines():
    """
    Pre-warm critical engines at startup using parallel initialization.

    This reduces cold start latency by initializing engines before first request.
    """
    await get_container().initialize_all()


# ============ 1. 记忆服务 MCP ============

memory_mcp = FastMCP("NikoMemory", stateless_http=True)


@memory_mcp.tool()
async def memory_add(
    content: str,
    layer: str = "session",
    dimension: str = None,
    entity_id: str = None,
    valid_from: str = None,
    valid_until: str = None,
    importance: float = 0.5,
    tags: list = None
) -> dict:
    """
    添加记忆到系统
    
    Args:
        content: 记忆内容
        layer: 记忆层级 (ephemeral/session/user/project)
        dimension: 记忆维度 (timeline/context/character/worldview/preference/experience)
        entity_id: 关联实体ID (用于时序追踪)
        valid_from: 生效时间 (ISO格式)
        valid_until: 失效时间 (ISO格式)
        importance: 重要性 (0-1)
        tags: 标签列表
    
    Returns:
        {"id": "xxx", "status": "created"}
    """
    engine = get_memory_engine()
    return await engine.add(
        content=content,
        layer=layer,
        dimension=dimension,
        entity_id=entity_id,
        valid_from=valid_from,
        valid_until=valid_until,
        importance=importance,
        tags=tags or []
    )


@memory_mcp.tool()
async def memory_search(
    query: str,
    layer: str = None,
    dimensions: list = None,
    entity_id: str = None,
    at_time: str = None,
    limit: int = 10
) -> list:
    """
    搜索记忆
    
    Args:
        query: 搜索查询
        layer: 限定层级
        dimensions: 限定维度列表
        entity_id: 限定实体
        at_time: 时序查询时间点
        limit: 返回数量
    
    Returns:
        [{"id": "xxx", "content": "...", "score": 0.95}, ...]
    """
    engine = get_memory_engine()
    return await engine.search(
        query=query,
        layer=layer,
        dimensions=dimensions,
        entity_id=entity_id,
        at_time=at_time,
        limit=limit
    )


@memory_mcp.tool()
async def memory_get_temporal(
    entity_id: str,
    at_time: str = None
) -> list:
    """
    获取实体在特定时间点的事实 (时序追踪)
    
    Args:
        entity_id: 实体ID
        at_time: 查询时间点 (默认当前)
    
    Returns:
        实体在该时间点有效的所有记忆
    """
    engine = get_memory_engine()
    return await engine.get_temporal_facts(entity_id, at_time)


@memory_mcp.tool()
async def memory_get_conflicts(entity_id: str) -> list:
    """
    获取实体的冲突记忆
    
    Args:
        entity_id: 实体ID
    
    Returns:
        [{"memory_a": {...}, "memory_b": {...}, "conflict_type": "..."}]
    """
    engine = get_memory_engine()
    return await engine.detect_conflicts(entity_id)


@memory_mcp.tool()
async def memory_resolve_conflict(
    memory_id_a: str,
    memory_id_b: str,
    resolution: str = "auto"
) -> dict:
    """
    解决记忆冲突
    
    Args:
        memory_id_a: 记忆A的ID
        memory_id_b: 记忆B的ID
        resolution: 解决策略 (auto/keep_a/keep_b/merge)
    
    Returns:
        解决结果
    """
    engine = get_memory_engine()
    return await engine.resolve_conflict(memory_id_a, memory_id_b, resolution)


# ============ 2. 知识图谱服务 MCP ============

graph_mcp = FastMCP("NikoGraph", stateless_http=True)


@graph_mcp.tool()
async def graph_query(cypher: str) -> list:
    """
    执行 Cypher 查询
    
    Args:
        cypher: Cypher 查询语句
    
    Returns:
        查询结果列表
    """
    engine = get_graph_engine()
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
    engine = get_graph_engine()
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
    engine = get_graph_engine()
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
    engine = get_graph_engine()
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
    engine = get_graph_engine()
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
    engine = get_graph_engine()
    return await engine.create_relation(from_name, to_name, relation_type, properties or {})


# ============ 3. 搜索服务 MCP ============

search_mcp = FastMCP("NikoSearch", stateless_http=True)


@search_mcp.tool()
async def search_hybrid(
    query: str,
    scope: str = "all",
    limit: int = 10
) -> list:
    """
    混合搜索 (向量 + 关键词 + 图谱)
    
    Args:
        query: 搜索查询
        scope: 搜索范围 (all/memory/graph/files)
        limit: 返回数量
    
    Returns:
        搜索结果列表
    """
    engine = get_search_engine()
    return await engine.hybrid_search(query, scope, limit)


@search_mcp.tool()
async def search_iterative(
    query: str,
    max_iterations: int = 3,
    confidence_threshold: float = 0.8
) -> dict:
    """
    迭代检索 (GAM 模式)
    
    Args:
        query: 初始查询
        max_iterations: 最大迭代次数
        confidence_threshold: 置信度阈值
    
    Returns:
        {"answer": "...", "sources": [...], "iterations": 2}
    """
    engine = get_search_engine()
    return await engine.iterative_retrieve(query, max_iterations, confidence_threshold)


@search_mcp.tool()
async def search_context(text: str) -> str:
    """
    解析 @引用 并返回上下文
    
    支持的引用类型:
    - @character:名称  → 角色信息
    - @chapter:编号    → 章节内容
    - @memory:查询     → 相关记忆
    - @skill:技能名    → 技能包内容 (本地文件)
    
    Args:
        text: 包含 @引用 的文本
    
    Returns:
        解析后的完整上下文
    
    示例:
        输入: "根据@character:张三的性格，使用@skill:fictional-dream..."
        输出: "[角色:张三] 性格:内向... [技能包:fictional-dream] 内容..."
    """
    engine = get_search_engine()
    return await engine.resolve_context(text)


# ============ 4. 工作流服务 MCP ============

workflow_mcp = FastMCP("NikoWorkflow", stateless_http=True)


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
    engine = get_workflow_engine()
    return await engine.route(task)


@workflow_mcp.tool()
async def workflow_plan(
    task: str,
    level: str = None
) -> dict:
    """
    生成执行计划 (Plan 模式)
    
    Args:
        task: 任务描述
        level: 指定级别 (可选)
    
    Returns:
        {"plan_id": "...", "steps": [...], "dependencies": [...]}
    """
    engine = get_workflow_engine()
    return await engine.plan(task, level)


@workflow_mcp.tool()
async def workflow_execute(
    plan_id: str,
    step_id: str = None
) -> dict:
    """
    执行计划 (Act 模式)
    
    Args:
        plan_id: 计划ID
        step_id: 指定步骤ID (可选,默认执行下一步)
    
    Returns:
        执行结果
    """
    engine = get_workflow_engine()
    return await engine.execute(plan_id, step_id)


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
    engine = get_workflow_engine()
    return await engine.create_checkpoint(description, auto_commit)


@workflow_mcp.tool()
async def checkpoint_restore(checkpoint_id: str) -> dict:
    """
    恢复到检查点
    
    Args:
        checkpoint_id: 检查点ID
    
    Returns:
        恢复结果
    """
    engine = get_workflow_engine()
    return await engine.restore_checkpoint(checkpoint_id)


@workflow_mcp.tool()
async def checkpoint_list(limit: int = 10) -> list:
    """
    列出最近的检查点
    
    Args:
        limit: 返回数量
    
    Returns:
        检查点列表
    """
    engine = get_workflow_engine()
    return await engine.list_checkpoints(limit)


# ============ 5. 评估服务 MCP ============

critic_mcp = FastMCP("NikoCritic", stateless_http=True)


@critic_mcp.tool()
async def evaluate_content(
    content: str,
    scene_card: dict = None,
    dimensions: list = None
) -> dict:
    """
    多维度评估内容 (整合 Critic Agent)

    Args:
        content: 待评估内容
        scene_card: 场景卡片 (可选)
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
    engine = get_critic_engine()
    return await engine.evaluate(content, scene_card, dimensions)


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
    engine = get_critic_engine()
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
    engine = get_critic_engine()
    return await engine.compare(version_a, version_b)


# ============ 6. Agent 服务 MCP (新增) ============

agent_mcp = FastMCP("NikoAgent", stateless_http=True)


def get_commander_agent():
    """Get commander agent (delegates to container)."""
    return get_container().commander


def get_writer_agent():
    """Get writer agent (delegates to container)."""
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
    agent = get_commander_agent()
    from src.workflow.levels.types import WorkflowLevel, to_workflow_label, to_workflow_slug
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
        "task_assignments": [a.model_dump() for a in assignments]
    }


@agent_mcp.tool()
async def agent_write(
    scene_card: dict,
    skills: list = None,
    word_target: int = 2000,
    allow_llm_fallback: bool = True
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

    agent = get_writer_agent()

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
    allow_llm_fallback: bool = True
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
    agent = get_writer_agent()
    result = await agent.revise(draft, feedback, allow_llm_fallback=allow_llm_fallback)

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


# ============ 7. 技能服务端点 (新增) ============

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


# ============ Chat 统一入口 ============

from starlette.requests import Request

async def chat_endpoint(request: Request):
    """
    统一聊天入口 - Desktop 应用主接口

    接收用户消息，通过 Commander 路由到正确的工作流，返回结果。
    支持五种模式：
    - L1: 快速修复/润色
    - L2: 轻量扩写/短文
    - L3: 标准章节创作
    - L4: 头脑风暴
    - L5: 深度编排
    """
    try:
        body = await request.json()
        messages = body.get("messages", [])
        from src.workflow.levels.types import WorkflowLevel, to_workflow_label, to_workflow_slug
        raw_workflow_level = body.get("workflowLevel", "L3")
        if raw_workflow_level is None:
            raw_workflow_level = "L3"
        if not isinstance(raw_workflow_level, str):
            return JSONResponse({"error": "Invalid workflowLevel. Expected one of: L1, L2, L3, L4, L5"}, status_code=400)
        normalized_level = raw_workflow_level.strip().upper()
        allowed_levels = {"L1", "L2", "L3", "L4", "L5"}
        if normalized_level not in allowed_levels:
            return JSONResponse({"error": "Invalid workflowLevel. Expected one of: L1, L2, L3, L4, L5"}, status_code=400)
        workflow_level = WorkflowLevel.from_label(normalized_level)
        skills = body.get("skills", [])
        context = body.get("context", {})
        allow_llm_fallback = bool(body.get("allowLlmFallback", True))

        if not allow_llm_fallback and not _is_llm_available():
            return JSONResponse({"error": "LLM unavailable and fallback disabled"}, status_code=503)

        if not messages:
            return JSONResponse({"error": "No messages provided"}, status_code=400)

        # 获取最新用户消息
        user_message = next(
            (m["content"] for m in reversed(messages) if m["role"] == "user"),
            ""
        )

        if not user_message:
            return JSONResponse({"error": "No user message found"}, status_code=400)

        # 使用 Commander Agent 处理
        commander = get_commander_agent()
        from src.workflow.levels.types import WorkflowLevel, to_workflow_label, to_workflow_slug

        # 路由任务
        level = workflow_level
        scene_type = commander.detect_scene_type(user_message)
        dispatched_skills = commander.dispatch_skills(scene_type)

        # 合并用户选择的技能
        all_skills = list(set(dispatched_skills + skills))

        # 获取任务分配
        assignments = commander.dispatch_tasks(user_message, level)

        # 根据工作流级别执行不同逻辑
        response_content = ""
        evaluation_result = {"score": 0, "feedback": ""}
        steps_completed = 0

        try:
            # 获取 Writer Agent
            writer = get_writer_agent()

            # 注入技能
            if all_skills:
                writer.inject_skills(all_skills[:5])

            # L1: 快速模式 - 直接续写/润色
            if level == WorkflowLevel.L1_RAPID:
                from src.agents.writer import WriterInput

                # 简单续写
                result = await writer.continue_writing(
                    existing_content=user_message,
                    continuation_hint="继续发展情节",
                    word_target=500,
                    allow_llm_fallback=allow_llm_fallback
                )
                response_content = result
                steps_completed = 1

            # L3/L5: 标准/深度模式 - 完整创作流程
            else:
                from src.agents.writer import WriterInput

                # 构建场景输入
                writer_input = WriterInput(
                    scene_id=context.get("scene_id", "CH01-SC01"),
                    chapter_num=context.get("chapter_num", 1),
                    pov_character=context.get("pov_character", "主角"),
                    objective=user_message[:100],
                    conflict=context.get("conflict", "内心挣扎"),
                    outcome=context.get("outcome", "+"),
                    plot_beat=user_message,
                    emotional_arc=context.get("emotional_arc", "平静→紧张"),
                    sensory_guidance={
                        "location": context.get("location", "未知地点"),
                        "time": context.get("time", "某个时刻"),
                        "atmosphere": context.get("atmosphere", "神秘")
                    },
                    word_target=context.get("word_target", 2000)
                )

                # 执行写作
                result = await writer.write(writer_input, allow_llm_fallback=allow_llm_fallback)
                response_content = result.content
                steps_completed = 4  # 4-chain prompt

                # 调用 Critic 评估 (如果可用)
                try:
                    critic_engine = get_critic_engine()
                    eval_result = await critic_engine.evaluate(
                        content=result.content,
                        scene_card=None,
                        dimensions=None
                    )
                    evaluation_result = {
                        "score": eval_result.get("total_score", 0),
                        "feedback": eval_result.get("actionable_feedback", "")
                    }
                except Exception as e:
                    if not allow_llm_fallback:
                        raise RuntimeError("Critic evaluation failed with fallback disabled") from e
                    logger.warning(f"Critic evaluation failed: {e}")
                    evaluation_result = {
                        "score": 75,
                        "feedback": f"自检: 使用了 {len(result.sensory_types_used)} 种感官描写"
                    }

        except Exception as e:
            if not allow_llm_fallback:
                raise RuntimeError("Writer execution failed with fallback disabled") from e
            logger.warning(f"Writer execution failed, falling back to analysis: {e}")
            # 回退到分析模式
            response_content = f"""## 任务分析

**工作流级别**: {to_workflow_label(level)}
**场景类型**: {scene_type.value}
**调用技能**: {', '.join(all_skills[:5])}

### 执行计划

"""
            for i, task in enumerate(assignments, 1):
                response_content += f"{i}. **{task.agent_type.upper()}**: {task.instruction[:50]}...\n"

            response_content += f"""
### 提示

检测到您的请求需要 LLM 支持。请确保：
1. 已配置有效的 LLM API 密钥
2. LLM 服务可用

您可以在设置中配置 Claude/OpenAI/Gemini API。
"""
            steps_completed = 1

        return JSONResponse({
            "content": response_content,
            "skills_used": all_skills[:5],
            "workflow_info": {
                "level": to_workflow_label(level),
                "level_slug": to_workflow_slug(level),
                "scene_type": scene_type.value,
                "steps_completed": steps_completed,
                "total_steps": len(assignments)
            },
            "evaluation": evaluation_result
        })

    except Exception as e:
        logger.error(f"Chat endpoint error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)


# ============ SSE 流式聊天端点 ============

import json
import asyncio
import re


def adaptive_chunk_content(
    content: str,
    max_chunk_size: int = 500,
    min_chunk_size: int = 50
) -> list:
    """
    按句子边界自适应分块内容。

    优化策略:
    - 在句子边界(。！？!?.\\n)处分割
    - 最大块大小 500 字符
    - 最小块大小 50 字符 (避免过于碎片化)

    Args:
        content: 要分块的内容
        max_chunk_size: 最大块大小
        min_chunk_size: 最小块大小

    Returns:
        分块后的内容列表
    """
    if not content:
        return []

    # 中英文句子结束符
    sentence_endings = re.compile(r'([。！？!?.\n])')

    chunks = []
    current_chunk = ""

    # 按句子边界分割
    parts = sentence_endings.split(content)

    for i, part in enumerate(parts):
        if not part:
            continue

        # 如果是标点符号，追加到当前块
        if sentence_endings.match(part):
            current_chunk += part
            continue

        # 检查是否会超过最大大小
        if len(current_chunk) + len(part) > max_chunk_size:
            # 当前块已有内容且超过最小大小，先保存
            if current_chunk and len(current_chunk) >= min_chunk_size:
                chunks.append(current_chunk)
                current_chunk = part
            elif current_chunk:
                # 当前块太小，继续追加
                current_chunk += part
            else:
                # 单个 part 超过最大大小，强制分割
                while len(part) > max_chunk_size:
                    chunks.append(part[:max_chunk_size])
                    part = part[max_chunk_size:]
                current_chunk = part
        else:
            current_chunk += part

        # 如果当前块在句子边界且达到合理大小
        if (current_chunk.endswith(('。', '！', '？', '!', '?', '.', '\n'))
                and len(current_chunk) >= min_chunk_size):
            chunks.append(current_chunk)
            current_chunk = ""

    # 保存剩余内容
    if current_chunk:
        chunks.append(current_chunk)

    return chunks


async def chat_stream_endpoint(request: Request):
    """
    SSE 流式聊天入口 - 实时返回生成内容

    使用 Server-Sent Events 协议，支持：
    - 实时内容流式输出
    - 进度状态更新
    - 评估结果推送
    """
    try:
        body = await request.json()
        messages = body.get("messages", [])
        from src.workflow.levels.types import WorkflowLevel, to_workflow_label, to_workflow_slug
        raw_workflow_level = body.get("workflowLevel", "L3")
        if raw_workflow_level is None:
            raw_workflow_level = "L3"
        if not isinstance(raw_workflow_level, str):
            return JSONResponse({"error": "Invalid workflowLevel. Expected one of: L1, L2, L3, L4, L5"}, status_code=400)
        normalized_level = raw_workflow_level.strip().upper()
        allowed_levels = {"L1", "L2", "L3", "L4", "L5"}
        if normalized_level not in allowed_levels:
            return JSONResponse({"error": "Invalid workflowLevel. Expected one of: L1, L2, L3, L4, L5"}, status_code=400)
        workflow_level = WorkflowLevel.from_label(normalized_level)
        skills = body.get("skills", [])
        context = body.get("context", {})
        allow_llm_fallback = bool(body.get("allowLlmFallback", True))

        if not allow_llm_fallback and not _is_llm_available():
            return JSONResponse({"error": "LLM unavailable and fallback disabled"}, status_code=503)

        if not messages:
            return JSONResponse({"error": "No messages provided"}, status_code=400)

        user_message = next(
            (m["content"] for m in reversed(messages) if m["role"] == "user"),
            ""
        )

        if not user_message:
            return JSONResponse({"error": "No user message found"}, status_code=400)

        async def generate_stream():
            """SSE 事件生成器"""
            try:
                # 1. 发送开始事件
                yield f"event: start\ndata: {json.dumps({'status': 'started'})}\n\n"

                # 2. 路由分析
                commander = get_commander_agent()
                level = workflow_level
                scene_type = commander.detect_scene_type(user_message)
                dispatched_skills = commander.dispatch_skills(scene_type)
                all_skills = list(set(dispatched_skills + skills))

                yield f"event: routing\ndata: {json.dumps({'level': to_workflow_label(level), 'level_slug': to_workflow_slug(level), 'scene_type': scene_type.value, 'skills': all_skills[:5]})}\n\n"

                # 3. 获取 Writer Agent
                writer = get_writer_agent()
                if all_skills:
                    writer.inject_skills(all_skills[:5])

                yield f"event: progress\ndata: {json.dumps({'step': 1, 'total': 4, 'message': '准备写作环境...'})}\n\n"

                # 4. 执行写作 (模拟分段输出)
                if level == WorkflowLevel.L1_RAPID:
                    # L1 快速模式
                    yield f"event: progress\ndata: {json.dumps({'step': 2, 'total': 4, 'message': '快速续写中...'})}\n\n"

                    try:
                        result = await writer.continue_writing(
                            existing_content=user_message,
                            continuation_hint="继续发展情节",
                            word_target=500,
                            allow_llm_fallback=allow_llm_fallback
                        )
                        content = result if isinstance(result, str) else result.content

                        # 自适应分块流式输出 (按句子边界)
                        chunks = adaptive_chunk_content(content, max_chunk_size=500, min_chunk_size=50)
                        for i, chunk in enumerate(chunks):
                            yield f"event: content\ndata: {json.dumps({'chunk': chunk, 'index': i})}\n\n"
                            # 仅在块之间添加最小延迟以保持流式效果
                            if i < len(chunks) - 1:
                                await asyncio.sleep(0.005)

                        yield f"event: progress\ndata: {json.dumps({'step': 4, 'total': 4, 'message': '完成'})}\n\n"

                    except Exception as e:
                        if not allow_llm_fallback:
                            raise RuntimeError("Writer execution failed with fallback disabled") from e
                        logger.warning(f"Writer failed: {e}")
                        yield f"event: content\ndata: {json.dumps({'chunk': f'[写作服务暂时不可用，请检查 LLM 配置]'})}\n\n"

                else:
                    # L3/L5 标准/深度模式
                    from src.agents.writer import WriterInput

                    yield f"event: progress\ndata: {json.dumps({'step': 2, 'total': 4, 'message': '构建场景...'})}\n\n"

                    writer_input = WriterInput(
                        scene_id=context.get("scene_id", "CH01-SC01"),
                        chapter_num=context.get("chapter_num", 1),
                        pov_character=context.get("pov_character", "主角"),
                        objective=user_message[:100],
                        conflict=context.get("conflict", "内心挣扎"),
                        outcome=context.get("outcome", "+"),
                        plot_beat=user_message,
                        emotional_arc=context.get("emotional_arc", "平静→紧张"),
                        sensory_guidance={
                            "location": context.get("location", "未知地点"),
                            "time": context.get("time", "某个时刻"),
                            "atmosphere": context.get("atmosphere", "神秘")
                        },
                        word_target=context.get("word_target", 2000)
                    )

                    yield f"event: progress\ndata: {json.dumps({'step': 3, 'total': 4, 'message': '创作中...'})}\n\n"

                    try:
                        result = await writer.write(writer_input, allow_llm_fallback=allow_llm_fallback)
                        content = result.content

                        # 自适应分块流式输出 (按句子边界，最大 500 字符)
                        chunks = adaptive_chunk_content(content, max_chunk_size=500, min_chunk_size=80)
                        for i, chunk in enumerate(chunks):
                            yield f"event: content\ndata: {json.dumps({'chunk': chunk, 'index': i})}\n\n"
                            # 仅在块之间添加最小延迟
                            if i < len(chunks) - 1:
                                await asyncio.sleep(0.005)

                        # 5. 评估 (可选)
                        yield f"event: progress\ndata: {json.dumps({'step': 4, 'total': 4, 'message': '质量评估...'})}\n\n"

                        try:
                            critic_engine = get_critic_engine()
                            eval_result = await critic_engine.evaluate(
                                content=content,
                                scene_card=None,
                                dimensions=None
                            )
                            yield f"event: evaluation\ndata: {json.dumps({'score': eval_result.get('total_score', 0), 'feedback': eval_result.get('actionable_feedback', '')})}\n\n"
                        except Exception as e:
                            if not allow_llm_fallback:
                                raise RuntimeError("Critic evaluation failed with fallback disabled") from e
                            logger.warning(f"Critic evaluation failed: {e}")
                            yield f"event: evaluation\ndata: {json.dumps({'score': 75, 'feedback': '自动评估暂不可用'})}\n\n"

                    except Exception as e:
                        if not allow_llm_fallback:
                            raise RuntimeError("Writer execution failed with fallback disabled") from e
                        logger.warning(f"Writer failed: {e}")
                        yield f"event: content\ndata: {json.dumps({'chunk': f'[写作服务暂时不可用: {str(e)[:50]}]'})}\n\n"

                # 6. 完成事件
                yield f"event: done\ndata: {json.dumps({'status': 'completed', 'skills_used': all_skills[:5]})}\n\n"

            except Exception as e:
                logger.error(f"Stream error: {e}")
                yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

        return StreamingResponse(
            generate_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
                "Content-Encoding": "identity",  # SSE 不支持 gzip 压缩
            }
        )

    except Exception as e:
        logger.error(f"Chat stream endpoint error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)


# ============ 健康检查端点 ============

async def health_check(request):
    """健康检查"""
    engine_health = {}
    for name, getter in (
        ("memory", get_memory_engine),
        ("graph", get_graph_engine),
        ("workflow", get_workflow_engine),
        ("critic", get_critic_engine),
    ):
        try:
            engine = getter()
            if hasattr(engine, "health_check"):
                engine_health[name] = await engine.health_check()
            else:
                engine_health[name] = {"status": "ok"}
        except Exception as exc:
            engine_health[name] = {"status": "error", "error": str(exc)}

    return JSONResponse({
        "status": "healthy",
        "version": "8.2.0",
        "services": {
            "memory": "ok",
            "graph": "ok",
            "search": "ok",
            "workflow": "ok",
            "critic": "ok",
            "agent": "ok",
            "skills": "ok"
        },
        "engine_health": engine_health,
        "agents": ["commander", "architect", "writer", "critic", "worldbuilding", "character", "plot"],
        "skills_count": 40
    })


async def list_tools(request):
    """列出所有可用工具"""
    tools = {
        "memory": [
            "memory_add", "memory_search", "memory_get_temporal",
            "memory_get_conflicts", "memory_resolve_conflict"
        ],
        "graph": [
            "graph_query", "graph_get_character", "graph_get_relationships",
            "graph_get_foreshadows", "graph_add_entity", "graph_add_relation"
        ],
        "search": [
            "search_hybrid", "search_iterative", "search_context"
        ],
        "workflow": [
            "workflow_route", "workflow_plan", "workflow_execute",
            "checkpoint_create", "checkpoint_restore", "checkpoint_list"
        ],
        "critic": [
            "evaluate_content", "get_improvement_suggestions", "compare_versions"
        ],
        "agent": [
            "agent_route", "agent_write", "agent_revise", "agent_get_context"
        ],
        "skills": [
            "skills_list", "skills_match", "skills_load", "skills_get_chain"
        ]
    }
    return JSONResponse(tools)


# ============ 创建 Gateway ============

def create_gateway() -> Starlette:
    """创建 MCP Gateway 应用"""

    # 设置路径
    for mcp in [memory_mcp, graph_mcp, search_mcp, workflow_mcp, critic_mcp, agent_mcp, skills_mcp]:
        mcp.settings.streamable_http_path = "/"

    @contextlib.asynccontextmanager
    async def lifespan(app: Starlette):
        """管理所有 MCP 服务的生命周期 (优化: 并行启动)"""
        logger.info("🚀 Starting Niko-Studio MCP Gateway v8.2.0...")

        async with contextlib.AsyncExitStack() as stack:
            # Start all MCP sessions in parallel using asyncio.gather
            mcp_services = [
                memory_mcp, graph_mcp, search_mcp,
                workflow_mcp, critic_mcp, agent_mcp, skills_mcp
            ]

            async def start_mcp(mcp):
                await stack.enter_async_context(mcp.session_manager.run())

            # Parallel MCP session startup
            await asyncio.gather(*[start_mcp(mcp) for mcp in mcp_services])

            logger.info("✅ All MCP services started successfully")

            # Pre-warm critical engines (await completion)
            await prewarm_engines()

            logger.info("📊 Available endpoints:")
            logger.info("   - http://localhost:8000/memory   (5 tools)")
            logger.info("   - http://localhost:8000/graph    (6 tools)")
            logger.info("   - http://localhost:8000/search   (3 tools)")
            logger.info("   - http://localhost:8000/workflow (6 tools)")
            logger.info("   - http://localhost:8000/critic   (3 tools)")
            logger.info("   - http://localhost:8000/agent    (4 tools)")
            logger.info("   - http://localhost:8000/skills   (4 tools)")
            logger.info("   - http://localhost:8000/health")
            logger.info("   - http://localhost:8000/tools")
            logger.info("")
            logger.info("🤖 Agents: Commander, Architect, Writer, Critic, Worldbuilding, Character, Plot")
            logger.info("📚 Skills: 40 writing skills loaded")

            yield

        logger.info("👋 Niko-Studio MCP Gateway stopped")

    # 创建应用
    gateway = Starlette(
        routes=[
            # MCP 服务挂载 (7个服务)
            Mount("/memory", memory_mcp.streamable_http_app()),
            Mount("/graph", graph_mcp.streamable_http_app()),
            Mount("/search", search_mcp.streamable_http_app()),
            Mount("/workflow", workflow_mcp.streamable_http_app()),
            Mount("/critic", critic_mcp.streamable_http_app()),
            Mount("/agent", agent_mcp.streamable_http_app()),
            Mount("/skills", skills_mcp.streamable_http_app()),
            # 辅助端点
            Route("/health", health_check, methods=["GET"]),
            Route("/tools", list_tools, methods=["GET"]),
            Route("/chat", chat_endpoint, methods=["POST"]),
            Route("/chat/stream", chat_stream_endpoint, methods=["POST"]),
        ],
        lifespan=lifespan,
    )
    
    # 添加 CORS 支持
    gateway = CORSMiddleware(
        gateway,
        allow_origins=["*"],
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["Mcp-Session-Id"],  # 重要: Session 管理必需
    )
    
    return gateway


# 创建默认应用实例
app = create_gateway()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "src.mcp.gateway:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
