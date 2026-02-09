# -*- coding: utf-8 -*-
"""
Writing Hooks - 写作钩子系统

提供写作操作的生命周期钩子，支持预处理、后处理和错误处理。
可用于内容过滤、格式转换、质量检查等场景。
"""

import logging
import asyncio
from dataclasses import dataclass, field
from enum import Enum, IntEnum
from typing import List, Dict, Any, Optional, Callable, Awaitable, Union, Protocol, runtime_checkable

logger = logging.getLogger("niko-hooks")


class HookType(Enum):
    """钩子类型"""
    PRE_WRITE = "pre_write"      # 写入前
    POST_WRITE = "post_write"    # 写入后
    ON_ERROR = "on_error"        # 错误时
    PRE_EVALUATE = "pre_evaluate"  # 评估前
    POST_EVALUATE = "post_evaluate"  # 评估后


class HookPriority(IntEnum):
    """钩子优先级（数值越小优先级越高）"""
    CRITICAL = 0
    HIGH = 10
    NORMAL = 50
    LOW = 100


@dataclass
class HookResult:
    """钩子执行结果"""
    success: bool
    modified_content: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    error: Optional[Exception] = None
    should_continue: bool = True  # 是否继续执行后续钩子

    @classmethod
    def ok(cls, content: Optional[str] = None, **metadata) -> "HookResult":
        return cls(success=True, modified_content=content, metadata=metadata)

    @classmethod
    def fail(cls, error: Exception, should_continue: bool = False) -> "HookResult":
        return cls(success=False, error=error, should_continue=should_continue)

    @classmethod
    def skip(cls) -> "HookResult":
        return cls(success=True, should_continue=True)


@dataclass
class HookContext:
    """钩子执行上下文"""
    content: str
    skill_id: Optional[str] = None
    agent_id: Optional[str] = None
    session_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    error: Optional[Exception] = None

    def with_content(self, new_content: str) -> "HookContext":
        """创建包含新内容的上下文副本"""
        return HookContext(
            content=new_content,
            skill_id=self.skill_id,
            agent_id=self.agent_id,
            session_id=self.session_id,
            metadata=self.metadata.copy(),
            error=self.error
        )


# 钩子函数类型
SyncHookFunc = Callable[[HookContext], HookResult]
AsyncHookFunc = Callable[[HookContext], Awaitable[HookResult]]
HookFunc = Union[SyncHookFunc, AsyncHookFunc]


@runtime_checkable
class IHook(Protocol):
    """钩子接口协议"""

    @property
    def name(self) -> str:
        """钩子名称"""
        ...

    @property
    def hook_type(self) -> HookType:
        """钩子类型"""
        ...

    @property
    def priority(self) -> HookPriority:
        """优先级"""
        ...

    async def execute(self, context: HookContext) -> HookResult:
        """执行钩子"""
        ...


@dataclass
class Hook:
    """钩子实现"""
    name: str
    hook_type: HookType
    func: HookFunc
    priority: HookPriority = HookPriority.NORMAL
    enabled: bool = True

    async def execute(self, context: HookContext) -> HookResult:
        """执行钩子函数"""
        if not self.enabled:
            return HookResult.skip()

        try:
            if asyncio.iscoroutinefunction(self.func):
                return await self.func(context)
            else:
                return self.func(context)
        except Exception as e:
            logger.error(f"Hook {self.name} failed: {e}")
            return HookResult.fail(e, should_continue=True)


class HookRegistry:
    """
    钩子注册中心

    管理所有钩子的注册、注销和执行顺序。

    使用示例:
        registry = HookRegistry()

        @registry.register(HookType.PRE_WRITE)
        async def validate_content(ctx: HookContext) -> HookResult:
            if len(ctx.content) < 10:
                return HookResult.fail(ValueError("Content too short"))
            return HookResult.ok()

        # 执行所有预写入钩子
        result = await registry.execute(HookType.PRE_WRITE, context)
    """

    def __init__(self):
        self._hooks: Dict[HookType, List[Hook]] = {t: [] for t in HookType}

    def register(
        self,
        hook_type: HookType,
        priority: HookPriority = HookPriority.NORMAL,
        name: Optional[str] = None
    ) -> Callable[[HookFunc], HookFunc]:
        """
        注册钩子装饰器

        Args:
            hook_type: 钩子类型
            priority: 优先级
            name: 钩子名称（默认使用函数名）
        """
        def decorator(func: HookFunc) -> HookFunc:
            hook_name = name or func.__name__
            hook = Hook(
                name=hook_name,
                hook_type=hook_type,
                func=func,
                priority=priority
            )
            self.add_hook(hook)
            return func
        return decorator

    def add_hook(self, hook: Hook) -> None:
        """添加钩子"""
        self._hooks[hook.hook_type].append(hook)
        # 按优先级排序
        self._hooks[hook.hook_type].sort(key=lambda h: h.priority)
        logger.debug(f"Registered hook: {hook.name} ({hook.hook_type.value})")

    def remove_hook(self, hook_type: HookType, name: str) -> bool:
        """移除钩子"""
        hooks = self._hooks[hook_type]
        for i, hook in enumerate(hooks):
            if hook.name == name:
                hooks.pop(i)
                logger.debug(f"Removed hook: {name}")
                return True
        return False

    def enable_hook(self, hook_type: HookType, name: str, enabled: bool = True) -> bool:
        """启用/禁用钩子"""
        for hook in self._hooks[hook_type]:
            if hook.name == name:
                hook.enabled = enabled
                return True
        return False

    async def execute(
        self,
        hook_type: HookType,
        context: HookContext
    ) -> HookResult:
        """
        执行指定类型的所有钩子

        Args:
            hook_type: 钩子类型
            context: 执行上下文

        Returns:
            聚合的执行结果
        """
        hooks = self._hooks[hook_type]
        current_context = context
        all_metadata: Dict[str, Any] = {}

        for hook in hooks:
            if not hook.enabled:
                continue

            result = await hook.execute(current_context)
            all_metadata.update(result.metadata)

            if not result.success:
                return HookResult(
                    success=False,
                    error=result.error,
                    metadata=all_metadata,
                    modified_content=current_context.content
                )

            if result.modified_content is not None:
                current_context = current_context.with_content(result.modified_content)

            if not result.should_continue:
                break

        return HookResult.ok(current_context.content, **all_metadata)

    def list_hooks(self, hook_type: Optional[HookType] = None) -> List[str]:
        """列出钩子名称"""
        if hook_type:
            return [h.name for h in self._hooks[hook_type]]
        return [h.name for hooks in self._hooks.values() for h in hooks]

    def clear(self, hook_type: Optional[HookType] = None) -> None:
        """清除钩子"""
        if hook_type:
            self._hooks[hook_type].clear()
        else:
            for t in HookType:
                self._hooks[t].clear()


class WritingHooks:
    """
    写作钩子管理器

    提供写作流程的标准钩子接口。

    使用示例:
        hooks = WritingHooks()

        # 预写入处理
        result = await hooks.pre_write(content, skill_id="novel-chapter")
        if result.success:
            # 使用处理后的内容
            processed = result.modified_content or content

        # 后写入处理
        await hooks.post_write(output, skill_id="novel-chapter")
    """

    def __init__(self, registry: Optional[HookRegistry] = None):
        self.registry = registry or HookRegistry()

    async def pre_write(
        self,
        content: str,
        skill_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        **metadata
    ) -> HookResult:
        """
        执行预写入钩子

        Args:
            content: 输入内容
            skill_id: 技能标识符
            agent_id: Agent 标识符
            **metadata: 额外元数据
        """
        context = HookContext(
            content=content,
            skill_id=skill_id,
            agent_id=agent_id,
            metadata=metadata
        )
        return await self.registry.execute(HookType.PRE_WRITE, context)

    async def post_write(
        self,
        content: str,
        skill_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        **metadata
    ) -> HookResult:
        """
        执行后写入钩子

        Args:
            content: 输出内容
            skill_id: 技能标识符
            agent_id: Agent 标识符
            **metadata: 额外元数据
        """
        context = HookContext(
            content=content,
            skill_id=skill_id,
            agent_id=agent_id,
            metadata=metadata
        )
        return await self.registry.execute(HookType.POST_WRITE, context)

    async def on_error(
        self,
        error: Exception,
        content: str = "",
        skill_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        **metadata
    ) -> HookResult:
        """
        执行错误处理钩子

        Args:
            error: 异常对象
            content: 相关内容
            skill_id: 技能标识符
            agent_id: Agent 标识符
            **metadata: 额外元数据
        """
        context = HookContext(
            content=content,
            skill_id=skill_id,
            agent_id=agent_id,
            metadata=metadata,
            error=error
        )
        return await self.registry.execute(HookType.ON_ERROR, context)

    async def pre_evaluate(
        self,
        content: str,
        **metadata
    ) -> HookResult:
        """执行预评估钩子"""
        context = HookContext(content=content, metadata=metadata)
        return await self.registry.execute(HookType.PRE_EVALUATE, context)

    async def post_evaluate(
        self,
        content: str,
        scores: Optional[Dict[str, float]] = None,
        **metadata
    ) -> HookResult:
        """执行后评估钩子"""
        if scores:
            metadata["scores"] = scores
        context = HookContext(content=content, metadata=metadata)
        return await self.registry.execute(HookType.POST_EVALUATE, context)


# ============ 预置钩子 ============

def _create_content_length_hook() -> Hook:
    """创建内容长度检查钩子"""
    def check_length(ctx: HookContext) -> HookResult:
        if len(ctx.content) < 10:
            return HookResult.fail(ValueError("Content too short (min 10 chars)"))
        if len(ctx.content) > 100000:
            return HookResult.fail(ValueError("Content too long (max 100000 chars)"))
        return HookResult.ok()

    return Hook(
        name="content_length_check",
        hook_type=HookType.PRE_WRITE,
        func=check_length,
        priority=HookPriority.HIGH
    )


def _create_encoding_hook() -> Hook:
    """创建编码检查钩子"""
    def check_encoding(ctx: HookContext) -> HookResult:
        try:
            ctx.content.encode("utf-8")
            return HookResult.ok()
        except UnicodeEncodeError as e:
            return HookResult.fail(e)

    return Hook(
        name="encoding_check",
        hook_type=HookType.PRE_WRITE,
        func=check_encoding,
        priority=HookPriority.CRITICAL
    )


def _create_error_logging_hook() -> Hook:
    """创建错误日志钩子"""
    def log_error(ctx: HookContext) -> HookResult:
        if ctx.error:
            logger.error(
                f"Writing error in skill={ctx.skill_id}, agent={ctx.agent_id}: {ctx.error}"
            )
        return HookResult.ok()

    return Hook(
        name="error_logging",
        hook_type=HookType.ON_ERROR,
        func=log_error,
        priority=HookPriority.CRITICAL
    )


def get_default_writing_hooks() -> WritingHooks:
    """获取预配置的默认写作钩子"""
    registry = HookRegistry()

    # 添加预置钩子
    registry.add_hook(_create_content_length_hook())
    registry.add_hook(_create_encoding_hook())
    registry.add_hook(_create_error_logging_hook())

    return WritingHooks(registry)
