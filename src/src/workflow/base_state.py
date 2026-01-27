"""
跨领域工作流基础状态定义 (Base State Schema)

定义所有领域工作流共享的抽象基类，确保架构可扩展性。
支持小说创作、代码开发、知识管理等多种工作流。
"""

from typing import TypedDict, List, Optional, Dict, Any, Literal
from datetime import datetime
from abc import ABC


class BaseState(TypedDict, total=False):
    """
    所有工作流状态的抽象基类
    
    设计原则:
    - 包含所有领域通用的元数据和控制字段
    - 子类可添加领域专用字段
    - 保持字段命名一致性
    """
    
    # ========================================
    # 会话元数据 (Universal)
    # ========================================
    session_id: str                         # 会话唯一标识
    created_at: str                         # 创建时间 (ISO8601)
    updated_at: str                         # 最后更新时间
    domain: Literal["novel", "code", "knowledge", "custom"]  # 工作流领域
    
    # ========================================
    # 输入/输出 (Universal)
    # ========================================
    user_request: str                       # 用户原始请求
    final_output: str                       # 最终输出内容
    
    # ========================================
    # 工作流控制 (Universal)
    # ========================================
    current_step: str                       # 当前执行步骤
    workflow_level: Literal["L1", "L2", "L3", "L4", "L5"]  # CCW 工作流层级
    revision_count: int                     # 修改次数
    max_revisions: int                      # 最大修改次数限制
    
    # ========================================
    # 决策与质量 (Universal)
    # ========================================
    decision: Literal["APPROVED", "REVISE", "HUMAN_REVIEW", "REWRITE", "FAILED"]
    decision_reason: str                    # 决策理由
    quality_score: float                    # 质量评分 (0-100)
    
    # ========================================
    # 错误处理 (Universal)
    # ========================================
    errors: List[str]                       # 错误信息列表
    warnings: List[str]                     # 警告信息列表
    requires_human_intervention: bool       # 是否需要人工介入
    
    # ========================================
    # 历史记录 (Universal)
    # ========================================
    revision_history: List[Dict[str, Any]]  # 修改历史
    state_snapshots: List[Dict[str, Any]]   # 状态快照
    
    # ========================================
    # 上下文引用 (OpenKL 兼容)
    # ========================================
    citations: List[str]                    # 引用 ID 列表
    derived_from: List[str]                 # 派生来源


class WorkflowConfig(TypedDict, total=False):
    """
    工作流配置基类
    
    所有领域工作流的配置都继承此基类
    """
    
    # 质量阈值
    pass_score: float                       # 通过分数阈值 (默认80)
    min_quality_score: float                # 最低质量要求
    
    # 循环控制
    max_revisions: int                      # 最大修改次数 (默认3)
    timeout_seconds: int                    # 超时时间 (默认600)
    
    # 人工介入
    human_review_score: float               # 触发人工审阅的分数 (默认70)
    auto_approve_timeout: int               # 自动通过超时时间(秒)
    
    # 调试与日志
    verbose: bool                           # 是否输出详细日志
    save_intermediate: bool                 # 是否保存中间产物
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"]


# 默认配置
DEFAULT_BASE_CONFIG: WorkflowConfig = {
    "pass_score": 80.0,
    "min_quality_score": 60.0,
    "max_revisions": 3,
    "timeout_seconds": 600,
    "human_review_score": 70.0,
    "auto_approve_timeout": 300,
    "verbose": True,
    "save_intermediate": True,
    "log_level": "INFO"
}


def create_base_state(
    user_request: str,
    domain: str = "custom",
    workflow_level: str = "L3"
) -> BaseState:
    """
    创建基础状态实例
    
    Args:
        user_request: 用户请求
        domain: 工作流领域
        workflow_level: CCW 工作流层级
    
    Returns:
        初始化的 BaseState 实例
    """
    import uuid
    
    return BaseState(
        # 元数据
        session_id=str(uuid.uuid4()),
        created_at=datetime.now().isoformat(),
        updated_at=datetime.now().isoformat(),
        domain=domain,
        
        # 输入/输出
        user_request=user_request,
        final_output="",
        
        # 工作流控制
        current_step="init",
        workflow_level=workflow_level,
        revision_count=0,
        max_revisions=3,
        
        # 决策
        decision="APPROVED",
        decision_reason="",
        quality_score=0.0,
        
        # 错误处理
        errors=[],
        warnings=[],
        requires_human_intervention=False,
        
        # 历史
        revision_history=[],
        state_snapshots=[],
        
        # 引用
        citations=[],
        derived_from=[]
    )
