# -*- coding: utf-8 -*-
"""
Hooks Module - 钩子系统

提供写作流程中的预处理、后处理和错误处理钩子。
"""

from .writing_hooks import (
    HookType,
    HookPriority,
    HookResult,
    HookContext,
    IHook,
    HookRegistry,
    WritingHooks,
    get_default_writing_hooks,
)

__all__ = [
    "HookType",
    "HookPriority",
    "HookResult",
    "HookContext",
    "IHook",
    "HookRegistry",
    "WritingHooks",
    "get_default_writing_hooks",
]
