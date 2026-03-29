"""
LLM/Embedding 服务层 Protocol 定义

DEPRECATED: This module is deprecated. Use src.protocols instead.
All protocols have been moved to src.protocols for better modularity.

Migration:
    # Old:
    from knowledge.services.protocols import LLMService, EmbeddingService
    
    # New:
    from protocols import LLMService, EmbeddingService

This module imports from src.protocols for backward compatibility.
"""

import warnings
from typing import runtime_checkable

# Emit deprecation warning on import
warnings.warn(
    "knowledge.services.protocols is deprecated. Use src.protocols instead.",
    DeprecationWarning,
    stacklevel=2
)

# Import from shared protocols module for backward compatibility
from protocols import (
    LLMService,
    LLMProvider,
    EmbeddingService,
    EmbeddingProvider,
    EmbeddingCache,
)

# Re-export runtime_checkable for backward compatibility with tests
from typing import Protocol, Any

__all__ = [
    "LLMService",
    "LLMProvider",
    "EmbeddingService",
    "EmbeddingProvider",
    "EmbeddingCache",
    "SearchInterface",
    "runtime_checkable",  # Re-exported for backward compatibility
    "Protocol",  # Re-exported for backward compatibility
    "Any",  # Re-exported for backward compatibility
]


# ============================================================
# Search Interface Protocol
# ============================================================

@runtime_checkable
class SearchInterface(Protocol):
    """Search 抽象接口

    定义搜索服务的核心能力，包括搜索、索引和删除操作。
    用于解耦 memory 层与 search 实现层的直接依赖。
    """

    def search(
        self,
        query: str,
        top_k: int = 5,
        type_filter: str | None = None,
        min_score: float = 0.0,
    ) -> list[dict[str, Any]]:
        """执行搜索

        Args:
            query: 搜索查询字符串
            top_k: 返回结果数量上限
            type_filter: 按类型过滤 (如 'memory', 'chunk')
            min_score: 最低相似度阈值

        Returns:
            搜索结果列表，每个结果为字典格式
        """
        ...

    def index(
        self,
        id: str,
        content: str,
        metadata: dict[str, Any] | None = None,
        type: str = "chunk",
    ) -> None:
        """索引文档

        Args:
            id: 文档唯一标识符
            content: 文档内容
            metadata: 元数据字典
            type: 文档类型 (如 'memory', 'chunk')
        """
        ...

    def delete(self, id: str) -> bool:
        """删除文档

        Args:
            id: 文档唯一标识符

        Returns:
            删除成功返回 True，文档不存在返回 False
        """
        ...
