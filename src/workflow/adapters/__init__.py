"""
工作流適配器模塊

提供各領域 (小說/代碼/知識) 的工作流適配器。
"""

from .novel_adapter import NovelAdapter, WritingState
from .code_adapter import CodeAdapter, CodingState

__all__ = [
    "NovelAdapter",
    "WritingState",
    "CodeAdapter", 
    "CodingState",
]
