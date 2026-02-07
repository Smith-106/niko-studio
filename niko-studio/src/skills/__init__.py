"""
Niko-Studio Skills 模块

技能包是静态知识文件，不需要 MCP 服务。
直接读取 Markdown 文件，注入到 Prompt 中。

使用方式:
    from src.skills import load_skill, get_skill_summary, resolve_skill_refs
    
    # 加载技能内容
    content = load_skill("fictional-dream")
    
    # 获取技能摘要供 LLM 选择
    summary = get_skill_summary()
    
    # 解析 @skill:name 引用
    resolved = resolve_skill_refs("使用 @skill:fictional-dream 写...")
"""

from .skill_loader import (
    SkillLoader,
    Skill,
    SkillMeta,
    get_loader,
    load_skill,
    list_skills,
    get_skill_summary,
    resolve_skill_refs,
)

__all__ = [
    "SkillLoader",
    "Skill", 
    "SkillMeta",
    "get_loader",
    "load_skill",
    "list_skills",
    "get_skill_summary",
    "resolve_skill_refs",
]
