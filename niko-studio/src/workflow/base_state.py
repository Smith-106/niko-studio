"""
跨領域工作流基礎狀態 (Base State)

定義所有領域工作流共享的基礎狀態字段。
各領域適配器 (Novel/Code/Knowledge) 繼承此類並添加專用字段。

設計原則:
- 通用字段下沉到基類
- 領域專用字段在適配器中定義
- 保持向後兼容
"""

from typing import TypedDict, List, Optional, Literal
from datetime import datetime
from abc import ABC


# ============================================================
# 基礎類型定義
# ============================================================

class DecisionType:
    """決策類型常量"""
    APPROVED = "APPROVED"
    REVISE = "REVISE"
    HUMAN_REVIEW = "HUMAN_REVIEW"
    REWRITE = "REWRITE"
    FAILED = "FAILED"


class DomainType:
    """領域類型常量"""
    NOVEL = "novel"
    CODE = "code"
    KNOWLEDGE = "knowledge"
    CUSTOM = "custom"


# ============================================================
# 基礎狀態類
# ============================================================

class BaseState(TypedDict, total=False):
    """
    所有工作流狀態的基類
    
    通用字段，適用於任何領域工作流:
    - 會話管理
    - 循環控制
    - 決策狀態
    - 錯誤處理
    """
    
    # ========================================
    # 會話元數據 (Session Metadata)
    # ========================================
    session_id: str                         # 會話唯一標識
    created_at: str                         # 創建時間 (ISO8601)
    updated_at: str                         # 最後更新時間
    domain: str                             # 領域類型: novel | code | knowledge | custom
    workflow_level: int                     # 工作流層級: 1-5 (L1-L5)
    
    # ========================================
    # 輸入 (Input)
    # ========================================
    user_request: str                       # 用戶原始請求
    context: str                            # 上下文信息
    
    # ========================================
    # 循環控制 (Loop Control)
    # ========================================
    current_step: str                       # 當前步驟名稱
    revision_count: int                     # 當前修改次數
    max_revisions: int                      # 最大修改次數限制
    iteration_count: int                    # 總迭代次數
    
    # ========================================
    # 決策狀態 (Decision State)
    # ========================================
    decision: str                           # 當前決策: APPROVED | REVISE | HUMAN_REVIEW
    decision_reason: str                    # 決策原因
    score: float                            # 質量評分 (0-100)
    
    # ========================================
    # 輸出 (Output)
    # ========================================
    draft_content: str                      # 當前草稿/中間產物
    final_output: str                       # 最終輸出
    
    # ========================================
    # 錯誤處理 (Error Handling)
    # ========================================
    errors: List[str]                       # 錯誤信息列表
    warnings: List[str]                     # 警告信息列表
    requires_human_intervention: bool       # 是否需要人工介入
    
    # ========================================
    # 擴展元數據 (Extension Metadata)
    # ========================================
    metadata: dict                          # 自定義元數據
    tags: List[str]                         # 標籤


# ============================================================
# 工作流配置基類
# ============================================================

class BaseWorkflowConfig(TypedDict, total=False):
    """工作流配置基類"""
    
    # 質量閾值
    pass_score: int                         # 通過分數閾值 (默認 80)
    human_review_score: int                 # 觸發人工審閱的分數 (默認 70)
    
    # 循環控制
    max_revisions: int                      # 最大修改次數 (默認 3)
    auto_approve_timeout: int               # 自動通過超時時間 (秒)
    
    # 調試選項
    verbose: bool                           # 是否輸出詳細日誌
    save_intermediate: bool                 # 是否保存中間產物
    
    # 領域配置
    domain: str                             # 領域類型
    domain_config: dict                     # 領域專用配置


# ============================================================
# 默認配置
# ============================================================

DEFAULT_BASE_CONFIG: BaseWorkflowConfig = {
    "pass_score": 80,
    "human_review_score": 70,
    "max_revisions": 3,
    "auto_approve_timeout": 300,
    "verbose": True,
    "save_intermediate": True,
    "domain": DomainType.CUSTOM,
    "domain_config": {},
}


# ============================================================
# 輔助函數
# ============================================================

def create_base_state(
    user_request: str,
    domain: str = DomainType.CUSTOM,
    workflow_level: int = 3,
    **kwargs
) -> BaseState:
    """創建基礎狀態"""
    import uuid
    
    now = datetime.now().isoformat()
    
    return BaseState(
        # 元數據
        session_id=str(uuid.uuid4()),
        created_at=now,
        updated_at=now,
        domain=domain,
        workflow_level=workflow_level,
        
        # 輸入
        user_request=user_request,
        context="",
        
        # 循環控制
        current_step="init",
        revision_count=0,
        max_revisions=3,
        iteration_count=0,
        
        # 決策
        decision="",
        decision_reason="",
        score=0.0,
        
        # 輸出
        draft_content="",
        final_output="",
        
        # 錯誤
        errors=[],
        warnings=[],
        requires_human_intervention=False,
        
        # 擴展
        metadata={},
        tags=[],
        
        # 允許額外字段
        **kwargs
    )
