"""
领域适配器包

提供不同领域（小说、代码、知识管理等）的工作流适配器。
每个适配器扩展 BaseState 并实现领域特定的逻辑。
"""

from .base_adapter import BaseAdapter
from .novel_adapter import NovelAdapter, WritingState
from .code_adapter import CodeAdapter, CodingState

__all__ = [
    "BaseAdapter",
    "NovelAdapter",
    "WritingState",
    "CodeAdapter",
    "CodingState",
]
