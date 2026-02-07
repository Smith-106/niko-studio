"""
工作流层级类型定义 (WorkflowLevel Types)

定义 L1-L5 工作流层级的枚举、配置和路由规则。
"""

from enum import Enum
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any, Callable


class WorkflowLevel(Enum):
    """
    工作流层级枚举

    L1 Rapid:      无状态、无工件、直接输出
    L2 Lite:       内存计划、轻量持久化
    L3 Standard:   完整会话、验证步骤
    L4 Brainstorm: 多角色并行分析
    L5 Coordinator: 智能链推荐、状态持久化
    """
    L1_RAPID = 1
    L2_LITE = 2
    L3_STANDARD = 3
    L4_BRAINSTORM = 4
    L5_COORDINATOR = 5
    L5_BRAINSTORM = 5  # backward-compatible alias

    @property
    def name_zh(self) -> str:
        """中文名称"""
        names = {
            1: "快速模式",
            2: "轻量模式",
            3: "标准模式",
            4: "头脑风暴",
            5: "协调者模式",
        }
        return names.get(self.value, "未知")

    @property
    def label(self) -> str:
        """对外统一标识 (L1-L5)"""
        return f"L{self.value}"

    @property
    def slug(self) -> str:
        """内部语义标识 (rapid/lite/standard/brainstorm/coordinator)"""
        mapping = {
            1: "rapid",
            2: "lite",
            3: "standard",
            4: "brainstorm",
            5: "coordinator",
        }
        return mapping.get(self.value, "standard")

    @property
    def description(self) -> str:
        """层级描述"""
        descriptions = {
            1: "无状态、无工件、直接输出",
            2: "内存计划、轻量持久化",
            3: "完整会话、验证步骤",
            4: "多角色并行分析",
            5: "智能链推荐、状态持久化",
        }
        return descriptions.get(self.value, "")

    @classmethod
    def from_string(cls, name: str) -> "WorkflowLevel":
        """从字符串解析层级"""
        mapping = {
            "rapid": cls.L1_RAPID,
            "lite": cls.L2_LITE,
            "standard": cls.L3_STANDARD,
            "brainstorm": cls.L4_BRAINSTORM,
            "storm": cls.L4_BRAINSTORM,
            "coordinator": cls.L5_COORDINATOR,
            "l1": cls.L1_RAPID,
            "l2": cls.L2_LITE,
            "l3": cls.L3_STANDARD,
            "l4": cls.L4_BRAINSTORM,
            "l5": cls.L5_COORDINATOR,
        }
        if not name:
            return cls.L3_STANDARD
        return mapping.get(str(name).lower(), cls.L3_STANDARD)

    @classmethod
    def from_label(cls, label: str) -> "WorkflowLevel":
        """从对外标识或数字解析层级"""
        if label is None:
            return cls.L3_STANDARD
        normalized = str(label).strip().lower()
        if normalized.startswith("l") and normalized[1:].isdigit():
            normalized = normalized[1:]
        if normalized.isdigit():
            value = int(normalized)
            if 1 <= value <= 5:
                return cls(value)
        return cls.from_string(normalized)


@dataclass
class LevelConfig:
    """
    层级配置

    定义每个层级的行为参数。
    """
    level: WorkflowLevel

    # Agent 配置
    required_agents: List[str] = field(default_factory=list)
    optional_agents: List[str] = field(default_factory=list)

    # 执行配置
    max_revisions: int = 3
    pass_score: int = 80
    timeout_seconds: int = 300

    # 持久化配置
    persist_state: bool = False
    persist_artifacts: bool = False
    checkpoint_enabled: bool = False

    # 并行配置
    parallel_execution: bool = False
    max_parallel_tasks: int = 1

    # 人工介入
    human_review_threshold: int = 70
    auto_approve: bool = False

    # 调试
    verbose: bool = True
    save_intermediate: bool = False


# 预定义层级配置
LEVEL_CONFIGS: Dict[WorkflowLevel, LevelConfig] = {
    WorkflowLevel.L1_RAPID: LevelConfig(
        level=WorkflowLevel.L1_RAPID,
        required_agents=["writer"],
        optional_agents=[],
        max_revisions=0,
        pass_score=0,
        timeout_seconds=60,
        persist_state=False,
        persist_artifacts=False,
        checkpoint_enabled=False,
        parallel_execution=False,
        max_parallel_tasks=1,
        human_review_threshold=0,
        auto_approve=True,
        verbose=False,
        save_intermediate=False,
    ),
    WorkflowLevel.L2_LITE: LevelConfig(
        level=WorkflowLevel.L2_LITE,
        required_agents=["writer", "critic"],
        optional_agents=["architect"],
        max_revisions=1,
        pass_score=70,
        timeout_seconds=120,
        persist_state=True,
        persist_artifacts=False,
        checkpoint_enabled=False,
        parallel_execution=False,
        max_parallel_tasks=1,
        human_review_threshold=60,
        auto_approve=True,
        verbose=True,
        save_intermediate=False,
    ),
    WorkflowLevel.L3_STANDARD: LevelConfig(
        level=WorkflowLevel.L3_STANDARD,
        required_agents=["architect", "writer", "critic"],
        optional_agents=["researcher"],
        max_revisions=3,
        pass_score=80,
        timeout_seconds=300,
        persist_state=True,
        persist_artifacts=True,
        checkpoint_enabled=True,
        parallel_execution=False,
        max_parallel_tasks=1,
        human_review_threshold=70,
        auto_approve=False,
        verbose=True,
        save_intermediate=True,
    ),
    WorkflowLevel.L4_BRAINSTORM: LevelConfig(
        level=WorkflowLevel.L4_BRAINSTORM,
        required_agents=["architect", "writer", "critic"],
        optional_agents=["researcher", "devil_advocate", "optimist", "realist"],
        max_revisions=5,
        pass_score=85,
        timeout_seconds=600,
        persist_state=True,
        persist_artifacts=True,
        checkpoint_enabled=True,
        parallel_execution=True,
        max_parallel_tasks=4,
        human_review_threshold=75,
        auto_approve=False,
        verbose=True,
        save_intermediate=True,
    ),
    WorkflowLevel.L5_COORDINATOR: LevelConfig(
        level=WorkflowLevel.L5_COORDINATOR,
        required_agents=["coordinator", "architect", "writer", "critic"],
        optional_agents=["researcher", "devil_advocate", "optimist", "realist", "specialist"],
        max_revisions=10,
        pass_score=90,
        timeout_seconds=1800,
        persist_state=True,
        persist_artifacts=True,
        checkpoint_enabled=True,
        parallel_execution=True,
        max_parallel_tasks=8,
        human_review_threshold=80,
        auto_approve=False,
        verbose=True,
        save_intermediate=True,
    ),
}


@dataclass
class RoutingRule:
    """
    路由规则

    定义任务如何被路由到特定层级。
    """
    name: str
    description: str
    target_level: WorkflowLevel

    # 匹配条件
    keywords: List[str] = field(default_factory=list)
    min_complexity: int = 0
    max_complexity: int = 100
    requires_persistence: bool = False
    requires_collaboration: bool = False

    # 优先级 (越高越优先)
    priority: int = 0

    def matches(self, task_context: Dict[str, Any]) -> bool:
        """检查任务是否匹配此规则"""
        # 关键词匹配
        task_text = task_context.get("text", "").lower()
        if self.keywords:
            if not any(kw.lower() in task_text for kw in self.keywords):
                return False

        # 复杂度匹配
        complexity = task_context.get("complexity", 50)
        if not (self.min_complexity <= complexity <= self.max_complexity):
            return False

        # 持久化需求
        if self.requires_persistence and not task_context.get("persist", False):
            return False

        # 协作需求
        if self.requires_collaboration and not task_context.get("collaborate", False):
            return False

        return True


# 预定义路由规则
ROUTING_RULES: List[RoutingRule] = [
    # L1 快速任务
    RoutingRule(
        name="typo_fix",
        description="错字修正",
        target_level=WorkflowLevel.L1_RAPID,
        keywords=["错字", "typo", "拼写", "修正", "纠错"],
        max_complexity=20,
        priority=100,
    ),
    RoutingRule(
        name="format_adjust",
        description="格式调整",
        target_level=WorkflowLevel.L1_RAPID,
        keywords=["格式", "排版", "缩进", "对齐"],
        max_complexity=30,
        priority=90,
    ),
    RoutingRule(
        name="quick_polish",
        description="快速润色",
        target_level=WorkflowLevel.L1_RAPID,
        keywords=["润色", "polish", "简单修改"],
        max_complexity=25,
        priority=85,
    ),

    # L2 轻量任务
    RoutingRule(
        name="single_scene",
        description="单场景写作",
        target_level=WorkflowLevel.L2_LITE,
        keywords=["场景", "片段", "短文"],
        min_complexity=20,
        max_complexity=50,
        priority=70,
    ),
    RoutingRule(
        name="dialogue_write",
        description="对话写作",
        target_level=WorkflowLevel.L2_LITE,
        keywords=["对话", "对白", "台词"],
        min_complexity=25,
        max_complexity=55,
        priority=65,
    ),

    # L3 标准任务
    RoutingRule(
        name="chapter_write",
        description="章节写作",
        target_level=WorkflowLevel.L3_STANDARD,
        keywords=["章节", "chapter", "完整"],
        min_complexity=40,
        max_complexity=75,
        requires_persistence=True,
        priority=50,
    ),
    RoutingRule(
        name="character_develop",
        description="角色发展",
        target_level=WorkflowLevel.L3_STANDARD,
        keywords=["角色", "人物", "塑造", "发展"],
        min_complexity=45,
        max_complexity=80,
        priority=45,
    ),

    # L4 头脑风暴
    RoutingRule(
        name="plot_brainstorm",
        description="剧情头脑风暴",
        target_level=WorkflowLevel.L4_BRAINSTORM,
        keywords=["头脑风暴", "brainstorm", "创意", "多角度"],
        min_complexity=60,
        requires_collaboration=True,
        priority=40,
    ),
    RoutingRule(
        name="conflict_design",
        description="冲突设计",
        target_level=WorkflowLevel.L4_BRAINSTORM,
        keywords=["冲突", "矛盾", "对立", "张力"],
        min_complexity=55,
        requires_collaboration=True,
        priority=35,
    ),

    # L5 协调者
    RoutingRule(
        name="full_novel",
        description="完整小说创作",
        target_level=WorkflowLevel.L5_COORDINATOR,
        keywords=["小说", "novel", "长篇", "完整"],
        min_complexity=80,
        requires_persistence=True,
        requires_collaboration=True,
        priority=20,
    ),
    RoutingRule(
        name="complex_revision",
        description="复杂修订",
        target_level=WorkflowLevel.L5_COORDINATOR,
        keywords=["大修", "重构", "全面修改"],
        min_complexity=75,
        requires_persistence=True,
        priority=25,
    ),
]


class LevelRouter:
    """
    层级路由器

    根据任务上下文自动选择合适的工作流层级。
    """

    def __init__(self, rules: List[RoutingRule] = None):
        self.rules = rules or ROUTING_RULES
        # 按优先级排序
        self.rules.sort(key=lambda r: r.priority, reverse=True)

    def route(self, task_context: Dict[str, Any]) -> WorkflowLevel:
        """
        路由任务到合适的层级

        Args:
            task_context: 任务上下文
                - text: 任务描述文本
                - complexity: 复杂度评分 (0-100)
                - persist: 是否需要持久化
                - collaborate: 是否需要协作

        Returns:
            推荐的工作流层级
        """
        for rule in self.rules:
            if rule.matches(task_context):
                return rule.target_level

        # 默认返回标准模式
        return WorkflowLevel.L3_STANDARD

    def get_config(self, level: WorkflowLevel) -> LevelConfig:
        """获取层级配置"""
        return LEVEL_CONFIGS.get(level, LEVEL_CONFIGS[WorkflowLevel.L3_STANDARD])

    def estimate_complexity(self, text: str) -> int:
        """
        估算任务复杂度

        基于文本长度、关键词等因素评估。
        """
        complexity = 50  # 基准复杂度

        # 文本长度影响
        text_len = len(text)
        if text_len < 50:
            complexity -= 20
        elif text_len > 500:
            complexity += 20
        elif text_len > 200:
            complexity += 10

        # 复杂关键词
        complex_keywords = ["完整", "详细", "深入", "全面", "系统", "多角度"]
        for kw in complex_keywords:
            if kw in text:
                complexity += 5

        # 简单关键词
        simple_keywords = ["简单", "快速", "直接", "仅", "只"]
        for kw in simple_keywords:
            if kw in text:
                complexity -= 5

        return max(0, min(100, complexity))


def get_level_config(level: WorkflowLevel | str | int) -> LevelConfig:
    """获取层级配置的便捷函数"""
    if not isinstance(level, WorkflowLevel):
        level = WorkflowLevel.from_label(level)
    return LEVEL_CONFIGS.get(level, LEVEL_CONFIGS[WorkflowLevel.L3_STANDARD])


def route_task(task_text: str, **kwargs) -> WorkflowLevel:
    """路由任务的便捷函数"""
    router = LevelRouter()
    complexity = router.estimate_complexity(task_text)

    context = {
        "text": task_text,
        "complexity": complexity,
        **kwargs
    }

    return router.route(context)


def to_workflow_label(level: WorkflowLevel | str | int) -> str:
    """将层级转换为对外统一标识"""
    if not isinstance(level, WorkflowLevel):
        level = WorkflowLevel.from_label(level)
    return level.label


def to_workflow_slug(level: WorkflowLevel | str | int) -> str:
    """将层级转换为内部语义标识"""
    if not isinstance(level, WorkflowLevel):
        level = WorkflowLevel.from_label(level)
    return level.slug


# 为兼容性提供别名
WorkflowConfig = LevelConfig


__all__ = [
    # 核心枚举
    "WorkflowLevel",
    # 配置类
    "LevelConfig",
    "WorkflowConfig",  # 别名
    # 路由
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
