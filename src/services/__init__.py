"""
Services 模块

提供核心服务实现：
- MemoryService: 向量记忆服务
- KnowledgeLayer: 知识层服务
- IndexingService: 索引服务
- DistillService: 蒸馏服务（兼容，已弃用）
- DocumentLoader: 文档加载服务
- FileSyncService: 文件同步服务
- BackupManager: 备份服务
- TokenService: Token 估算服务
- ObsidianService: Obsidian 集成服务
"""

from src.services.memory_service import (
    MemoryService,
    get_memory_service,
    reset_memory_service,
    Message,
    AddOptions,
    SearchOptions,
    SearchResult,
    Memory,
)

from src.services.knowledge_layer import AgentKnowledgeLayer
from src.services.indexing_service import IndexingService
from src.services.distill_service import DistillService
from src.services.document_loader import DocumentLoader

# File sync 依赖 watchdog，保持可选导出，避免导入阶段硬失败
try:
    from src.services.file_sync import (
        FileChangeEvent,
        FileWatcher,
        AutoSyncHandler,
        SyncResult,
        FileSyncService,
    )
except Exception:  # pragma: no cover
    FileChangeEvent = None
    FileWatcher = None
    AutoSyncHandler = None
    SyncResult = None
    FileSyncService = None

from src.services.backup_manager import (
    BackupManager,
    get_backup_manager,
    reset_backup_manager,
    BackupInfo,
    BackupProgress,
)

from src.services.token_service import (
    TokenService,
    get_token_service,
    reset_token_service,
    TokenUsage,
    BudgetStatus,
    MODEL_PRICING,
)

from src.services.obsidian_service import (
    ObsidianService,
    get_obsidian_service,
    reset_obsidian_service,
    VaultInfo,
    NoteInfo,
)

__all__ = [
    # MemoryService
    "MemoryService",
    "get_memory_service",
    "reset_memory_service",
    "Message",
    "AddOptions",
    "SearchOptions",
    "SearchResult",
    "Memory",
    # Knowledge / Index / Distill / Loader
    "AgentKnowledgeLayer",
    "IndexingService",
    "DistillService",
    "DocumentLoader",
    # File sync
    "FileChangeEvent",
    "FileWatcher",
    "AutoSyncHandler",
    "SyncResult",
    "FileSyncService",
    # BackupManager
    "BackupManager",
    "get_backup_manager",
    "reset_backup_manager",
    "BackupInfo",
    "BackupProgress",
    # TokenService
    "TokenService",
    "get_token_service",
    "reset_token_service",
    "TokenUsage",
    "BudgetStatus",
    "MODEL_PRICING",
    # ObsidianService
    "ObsidianService",
    "get_obsidian_service",
    "reset_obsidian_service",
    "VaultInfo",
    "NoteInfo",
]
