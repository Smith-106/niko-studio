"""
工作流層級模塊

提供 L1-L5 工作流層級實現。
"""

from .base_level import BaseLevel, LevelRegistry
from .level1_rapid import Level1Rapid
from .level2_lite import Level2Lite
from .level3_standard import Level3Standard
from .level4_brainstorm import (
    Level4Brainstorm,
    BrainstormRole,
    RoleAnalysis,
    BrainstormSynthesis,
    GuidanceSpecification,
)
from .level5_coordinator import (
    Level5Coordinator,
    CommandChain,
    ExecutionUnit,
    RequirementAnalysis,
    CoordinatorState,
    Command,
    CommandType,
    ExecutionStatus,
)
from .types import (
    WorkflowLevel,
    LevelConfig,
    WorkflowConfig,
    LevelRouter,
    RoutingRule,
    LEVEL_CONFIGS,
    ROUTING_RULES,
    get_level_config,
    route_task,
    to_workflow_label,
    to_workflow_slug,
)

__all__ = [
    # 基类
    "BaseLevel",
    "LevelRegistry",
    # 层级实现
    "Level1Rapid",
    "Level2Lite",
    "Level3Standard",
    "Level4Brainstorm",
    "Level5Coordinator",
    # L4 相关类型
    "BrainstormRole",
    "RoleAnalysis",
    "BrainstormSynthesis",
    "GuidanceSpecification",
    # L5 相关类型
    "CommandChain",
    "ExecutionUnit",
    "RequirementAnalysis",
    "CoordinatorState",
    "Command",
    "CommandType",
    "ExecutionStatus",
    # 类型定义
    "WorkflowLevel",
    "LevelConfig",
    "WorkflowConfig",
    "LevelRouter",
    "RoutingRule",
    # 预定义配置
    "LEVEL_CONFIGS",
    "ROUTING_RULES",
    # 便捷函数
    "get_level_config",
    "route_task",
    "to_workflow_label",
    "to_workflow_slug",
]
