"""
workflow 包 - LangGraph 工作流編排

支持多領域工作流:
- 小說創作 (Novel)
- 代碼開發 (Code)
- 自定義領域 (Custom)
"""

# ============================================================
# 向後兼容導出 (舊接口)
# ============================================================

from .state import (
    WritingState,
    WorkflowConfig,
    DEFAULT_CONFIG,
    create_initial_state,
    SceneCard,
    CritiqueResult,
    LOCKScores
)

from .graph import (
    create_writing_graph,
    compile_graph,
    run_writing_session,
    architect_node,
    writer_node,
    critic_node,
    finalize_node,
    should_continue
)

# ============================================================
# 新跨領域架構導出
# ============================================================

from .base_state import (
    BaseState,
    BaseWorkflowConfig,
    DomainType,
    DecisionType,
    create_base_state,
)

from .base_adapter import (
    BaseDomainAdapter,
    BaseEvaluationResult,
    AdapterRegistry,
)

from .graph_factory import (
    WorkflowFactory,
    WorkflowLevel,
    create_workflow,
)

# 適配器 (延遲導入避免循環依賴)
from .adapters import (
    NovelAdapter,
    CodeAdapter,
)

__all__ = [
    # ========================================
    # 向後兼容 (舊接口)
    # ========================================
    # State
    "WritingState",
    "WorkflowConfig",
    "DEFAULT_CONFIG",
    "create_initial_state",
    "SceneCard",
    "CritiqueResult",
    "LOCKScores",
    
    # Graph
    "create_writing_graph",
    "compile_graph",
    "run_writing_session",
    "architect_node",
    "writer_node", 
    "critic_node",
    "finalize_node",
    "should_continue",
    
    # ========================================
    # 跨領域架構 (新接口)
    # ========================================
    # Base Classes
    "BaseState",
    "BaseWorkflowConfig",
    "BaseDomainAdapter",
    "BaseEvaluationResult",
    
    # Factory
    "WorkflowFactory",
    "WorkflowLevel",
    "create_workflow",
    
    # Registry
    "AdapterRegistry",
    "DomainType",
    "DecisionType",
    
    # Adapters
    "NovelAdapter",
    "CodeAdapter",
]

