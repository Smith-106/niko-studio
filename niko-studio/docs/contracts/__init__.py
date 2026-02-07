"""
Niko-Studio 接口契约模块

本模块定义了 Memory、Workflow、Graph 三大核心模块的接口契约。
所有实现类必须遵循这些 Protocol 定义。

Usage:
    from docs.contracts import IMemoryService, IWorkflowService, IGraphService
"""

from .memory_contracts import (
    IMemoryService,
    ICitationService,
    IDistillationService,
    Message,
    AddOptions,
    SearchOptions,
    SearchResult,
    TransientCitation,
    PersistedCitation,
    Memory,
)

from .workflow_contracts import (
    IWorkflowService,
    ISessionService,
    Task,
    WorkflowLevel,
    Result,
    Session,
    Content,
)

from .graph_contracts import (
    IGraphService,
    Entity,
    EntityStats,
)

__all__ = [
    # Memory
    "IMemoryService",
    "ICitationService",
    "IDistillationService",
    "Message",
    "AddOptions",
    "SearchOptions",
    "SearchResult",
    "TransientCitation",
    "PersistedCitation",
    "Memory",
    # Workflow
    "IWorkflowService",
    "ISessionService",
    "Task",
    "WorkflowLevel",
    "Result",
    "Session",
    "Content",
    # Graph
    "IGraphService",
    "Entity",
    "EntityStats",
]
