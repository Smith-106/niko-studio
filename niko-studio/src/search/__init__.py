# Search Engine
"""
搜索引擎 - 混合检索 + 迭代检索

特性:
- 混合搜索 (向量 + 关键词 + 图谱)
- 迭代检索 (GAM 模式)
- @引用上下文解析
- HNSW 向量索引 (384维嵌入)
"""

from .iterative_retriever import IterativeRetriever
from .vector_search import (
    VectorIndex,
    VectorSearch,
    SearchResult,
    HNSWConfig,
    hybrid_search,
    create_vector_index,
    search_memory_vectors,
    search_chunk_vectors,
    get_vector_stats,
)
from .smart_search import SmartSearch

__all__ = [
    # Retriever
    "IterativeRetriever",
    # Vector Search
    "VectorIndex",
    "VectorSearch",
    "SearchResult",
    "HNSWConfig",
    "hybrid_search",
    "create_vector_index",
    "search_memory_vectors",
    "search_chunk_vectors",
    "get_vector_stats",
    # Smart Search
    "SmartSearch",
]
