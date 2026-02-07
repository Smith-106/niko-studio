"""
會話模塊

提供會話管理和斷點續傳功能。
"""

from .session_manager import (
    SessionManager,
    SessionInfo,
    SessionStatus,
    ContentType,
    PATH_ROUTES,
)

from .resume_strategy import (
    # 枚举
    ResumeMode,
    ContextFormat,
    # 数据类
    ConversationTurn,
    SessionContext,
    ResumeDecision,
    CheckpointState,
    # 抽象基类
    ResumeStrategy,
    # 具体策略
    NativeResumeStrategy,
    PromptConcatStrategy,
    HybridStrategy,
    # 策略解析器
    ResumeStrategyResolver,
    # 便捷函数
    determine_resume_strategy,
    build_context_prefix,
    create_strategy,
)

__all__ = [
    # Session Manager
    "SessionManager",
    "SessionInfo",
    "SessionStatus",
    "ContentType",
    "PATH_ROUTES",
    # Resume Strategy - 枚举
    "ResumeMode",
    "ContextFormat",
    # Resume Strategy - 数据类
    "ConversationTurn",
    "SessionContext",
    "ResumeDecision",
    "CheckpointState",
    # Resume Strategy - 抽象基类
    "ResumeStrategy",
    # Resume Strategy - 具体策略
    "NativeResumeStrategy",
    "PromptConcatStrategy",
    "HybridStrategy",
    # Resume Strategy - 策略解析器
    "ResumeStrategyResolver",
    # Resume Strategy - 便捷函数
    "determine_resume_strategy",
    "build_context_prefix",
    "create_strategy",
]
