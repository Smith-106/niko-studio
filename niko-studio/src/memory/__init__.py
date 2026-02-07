# Memory Engine
"""
统一记忆引擎 - 合并四层 + 六维 + 时序

层级 (生命周期):
- ephemeral: 临时记忆 (< 1小时)
- session: 会话记忆 (当前任务)
- user: 用户记忆 (长期偏好)
- project: 项目记忆 (小说级别)

维度 (内容类型):
- timeline: 事件时间线
- context: 故事上下文
- character: 角色身份
- worldview: 世界设定
- preference: 创作偏好
- experience: 写作经验
"""

from .unified_memory import UnifiedMemoryEngine, UnifiedMemory, MemoryLayer, MemoryDimension
from .memory_chunk import (
    MemoryChunk,
    ChunkBuffer,
    ChunkSplitter,
    TextChunker,
    ChunkedMemoryAdapter,
    get_chunk_buffer,
    get_text_chunker,
)
from .session_cluster import (
    SessionCluster,
    ClusterMember,
    ClusterRelation,
    SessionClusterManager,
    MemberRole,
    RelationType,
)
from .memory_manager import (
    MemoryManager,
    MemoryEntry,
    MemoryManagerAdapter,
    get_memory_manager,
    reset_memory_manager,
)
from .citation_manager import (
    CitationManager,
    TransientCitation,
    PersistedCitation,
    get_citation_manager,
    reset_citation_manager,
)
from .distillation_manager import (
    DistillationManager,
    DistillationTemplate,
    DistillationResult,
    DISTILLATION_PROMPTS,
    get_distillation_manager,
    reset_distillation_manager,
)

__all__ = [
    # Unified Memory
    "UnifiedMemoryEngine",
    "UnifiedMemory",
    "MemoryLayer",
    "MemoryDimension",
    # Memory Chunk
    "MemoryChunk",
    "ChunkBuffer",
    "ChunkSplitter",
    "TextChunker",
    "ChunkedMemoryAdapter",
    "get_chunk_buffer",
    "get_text_chunker",
    # Session Cluster
    "SessionCluster",
    "ClusterMember",
    "ClusterRelation",
    "SessionClusterManager",
    "MemberRole",
    "RelationType",
    # Memory Manager (OpenKL)
    "MemoryManager",
    "MemoryEntry",
    "MemoryManagerAdapter",
    "get_memory_manager",
    "reset_memory_manager",
    # Citation Manager
    "CitationManager",
    "TransientCitation",
    "PersistedCitation",
    "get_citation_manager",
    "reset_citation_manager",
    # Distillation Manager
    "DistillationManager",
    "DistillationTemplate",
    "DistillationResult",
    "DISTILLATION_PROMPTS",
    "get_distillation_manager",
    "reset_distillation_manager",
]
