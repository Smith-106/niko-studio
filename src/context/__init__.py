# -*- coding: utf-8 -*-
"""
Context Module - 上下文提供者系统

提供动态上下文注入，支持记忆、技能、项目等多种上下文源。
"""

from .providers import (
    IContextProvider,
    ContextPriority,
    ContextItem,
    ContextAggregator,
    MemoryContextProvider,
    SkillContextProvider,
    ProjectContextProvider,
    get_default_aggregator,
)

__all__ = [
    "IContextProvider",
    "ContextPriority",
    "ContextItem",
    "ContextAggregator",
    "MemoryContextProvider",
    "SkillContextProvider",
    "ProjectContextProvider",
    "get_default_aggregator",
]
