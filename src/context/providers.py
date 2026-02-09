# -*- coding: utf-8 -*-
"""
Context Providers - 上下文提供者

实现动态上下文注入系统，从多个来源聚合上下文信息。
支持记忆系统、技能系统、项目配置等上下文源。
"""

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import IntEnum
from pathlib import Path
from typing import List, Dict, Any, Optional, Protocol, runtime_checkable
import json

logger = logging.getLogger("niko-context")


class ContextPriority(IntEnum):
    """上下文优先级（数值越小优先级越高）"""
    CRITICAL = 0      # 必须包含
    HIGH = 10         # 高优先级
    NORMAL = 50       # 正常优先级
    LOW = 100         # 低优先级
    OPTIONAL = 200    # 可选


@dataclass
class ContextItem:
    """上下文项"""
    key: str
    value: Any
    source: str  # 来源标识
    priority: ContextPriority = ContextPriority.NORMAL
    metadata: Dict[str, Any] = field(default_factory=dict)
    token_estimate: int = 0  # 预估令牌数

    def to_prompt_segment(self) -> str:
        """转换为 prompt 片段"""
        if isinstance(self.value, dict):
            content = json.dumps(self.value, ensure_ascii=False, indent=2)
        elif isinstance(self.value, list):
            content = "\n".join(str(v) for v in self.value)
        else:
            content = str(self.value)

        return f"[{self.key}]\n{content}\n[/{self.key}]"


@runtime_checkable
class IContextProvider(Protocol):
    """上下文提供者协议"""

    @property
    def name(self) -> str:
        """提供者名称"""
        ...

    @property
    def priority(self) -> ContextPriority:
        """默认优先级"""
        ...

    async def get_context(
        self,
        query: Optional[str] = None,
        **kwargs
    ) -> List[ContextItem]:
        """
        获取上下文项

        Args:
            query: 查询字符串（用于相关性筛选）
            **kwargs: 额外参数

        Returns:
            上下文项列表
        """
        ...


class BaseContextProvider(ABC):
    """上下文提供者基类"""

    def __init__(self, name: str, priority: ContextPriority = ContextPriority.NORMAL):
        self._name = name
        self._priority = priority

    @property
    def name(self) -> str:
        return self._name

    @property
    def priority(self) -> ContextPriority:
        return self._priority

    @abstractmethod
    async def get_context(
        self,
        query: Optional[str] = None,
        **kwargs
    ) -> List[ContextItem]:
        """获取上下文项"""
        pass

    def _estimate_tokens(self, text: str) -> int:
        """估算令牌数（简化实现）"""
        # 粗略估计：英文约 4 字符/token，中文约 1.5 字符/token
        chinese_chars = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
        other_chars = len(text) - chinese_chars
        return int(chinese_chars / 1.5 + other_chars / 4)


class MemoryContextProvider(BaseContextProvider):
    """
    记忆上下文提供者

    从 UnifiedMemoryEngine 获取相关记忆作为上下文。

    使用示例:
        provider = MemoryContextProvider(memory_engine)
        items = await provider.get_context(query="角色背景")
    """

    def __init__(
        self,
        memory_engine: Optional[Any] = None,
        max_items: int = 10,
        relevance_threshold: float = 0.5
    ):
        super().__init__("memory", ContextPriority.HIGH)
        self._memory_engine = memory_engine
        self._max_items = max_items
        self._relevance_threshold = relevance_threshold

    async def get_context(
        self,
        query: Optional[str] = None,
        session_id: Optional[str] = None,
        memory_types: Optional[List[str]] = None,
        **kwargs
    ) -> List[ContextItem]:
        """
        获取记忆上下文

        Args:
            query: 搜索查询
            session_id: 会话 ID
            memory_types: 记忆类型过滤
        """
        if self._memory_engine is None:
            logger.warning("Memory engine not configured")
            return []

        items: List[ContextItem] = []

        try:
            # 尝试调用记忆引擎的搜索方法
            if hasattr(self._memory_engine, 'search'):
                results = await self._memory_engine.search(
                    query=query or "",
                    limit=self._max_items,
                    session_id=session_id
                )

                for result in results:
                    if hasattr(result, 'score') and result.score < self._relevance_threshold:
                        continue

                    content = getattr(result, 'content', str(result))
                    items.append(ContextItem(
                        key=f"memory_{len(items)}",
                        value=content,
                        source=self.name,
                        priority=self.priority,
                        metadata={
                            "score": getattr(result, 'score', 1.0),
                            "type": getattr(result, 'memory_type', 'unknown')
                        },
                        token_estimate=self._estimate_tokens(content)
                    ))

            # 获取会话上下文
            if session_id and hasattr(self._memory_engine, 'get_session_context'):
                session_ctx = await self._memory_engine.get_session_context(session_id)
                if session_ctx:
                    items.append(ContextItem(
                        key="session_context",
                        value=session_ctx,
                        source=self.name,
                        priority=ContextPriority.CRITICAL,
                        token_estimate=self._estimate_tokens(str(session_ctx))
                    ))

        except Exception as e:
            logger.error(f"Failed to get memory context: {e}")

        return items


class SkillContextProvider(BaseContextProvider):
    """
    技能上下文提供者

    从 SkillLoader 获取技能包内容作为上下文。

    使用示例:
        provider = SkillContextProvider(skill_loader)
        items = await provider.get_context(skill_ids=["fictional-dream"])
    """

    def __init__(
        self,
        skill_loader: Optional[Any] = None,
        max_skill_length: int = 4000
    ):
        super().__init__("skill", ContextPriority.NORMAL)
        self._skill_loader = skill_loader
        self._max_skill_length = max_skill_length

    async def get_context(
        self,
        query: Optional[str] = None,
        skill_ids: Optional[List[str]] = None,
        include_summary: bool = True,
        **kwargs
    ) -> List[ContextItem]:
        """
        获取技能上下文

        Args:
            query: 用于匹配技能的查询
            skill_ids: 指定的技能 ID 列表
            include_summary: 是否包含技能摘要
        """
        if self._skill_loader is None:
            logger.warning("Skill loader not configured")
            return []

        items: List[ContextItem] = []

        try:
            # 加载指定技能
            if skill_ids:
                for skill_id in skill_ids:
                    try:
                        content = self._skill_loader.load(skill_id)
                        # 截断过长内容
                        if len(content) > self._max_skill_length:
                            content = content[:self._max_skill_length] + "\n... (内容截断)"

                        items.append(ContextItem(
                            key=f"skill_{skill_id}",
                            value=content,
                            source=self.name,
                            priority=self.priority,
                            metadata={"skill_id": skill_id},
                            token_estimate=self._estimate_tokens(content)
                        ))
                    except FileNotFoundError:
                        logger.warning(f"Skill not found: {skill_id}")

            # 从查询解析 @skill 引用
            if query and hasattr(self._skill_loader, 'extract_refs'):
                refs = self._skill_loader.extract_refs(query)
                for skill_id in refs:
                    if skill_ids and skill_id in skill_ids:
                        continue  # 已加载
                    try:
                        content = self._skill_loader.load(skill_id)
                        if len(content) > self._max_skill_length:
                            content = content[:self._max_skill_length] + "\n... (内容截断)"

                        items.append(ContextItem(
                            key=f"skill_{skill_id}",
                            value=content,
                            source=self.name,
                            priority=self.priority,
                            metadata={"skill_id": skill_id, "from_ref": True},
                            token_estimate=self._estimate_tokens(content)
                        ))
                    except FileNotFoundError:
                        pass

            # 包含技能摘要
            if include_summary and hasattr(self._skill_loader, 'get_summary'):
                summary = self._skill_loader.get_summary()
                items.append(ContextItem(
                    key="available_skills",
                    value=summary,
                    source=self.name,
                    priority=ContextPriority.LOW,
                    token_estimate=self._estimate_tokens(summary)
                ))

        except Exception as e:
            logger.error(f"Failed to get skill context: {e}")

        return items


class ProjectContextProvider(BaseContextProvider):
    """
    项目上下文提供者

    从 .niko/ 目录读取项目配置和上下文。

    使用示例:
        provider = ProjectContextProvider(project_root="/path/to/project")
        items = await provider.get_context()
    """

    def __init__(
        self,
        project_root: Optional[str] = None
    ):
        super().__init__("project", ContextPriority.HIGH)
        self._project_root = Path(project_root) if project_root else Path.cwd()
        self._niko_dir = self._project_root / ".niko"

    async def get_context(
        self,
        query: Optional[str] = None,
        include_characters: bool = True,
        include_world: bool = True,
        include_outline: bool = True,
        **kwargs
    ) -> List[ContextItem]:
        """
        获取项目上下文

        Args:
            query: 查询字符串（用于相关性筛选）
            include_characters: 包含角色信息
            include_world: 包含世界观信息
            include_outline: 包含大纲信息
        """
        items: List[ContextItem] = []

        if not self._niko_dir.exists():
            logger.debug(f"No .niko directory found at {self._niko_dir}")
            return items

        try:
            # 读取项目配置
            config_file = self._niko_dir / "config.json"
            if config_file.exists():
                config = json.loads(config_file.read_text(encoding="utf-8"))
                items.append(ContextItem(
                    key="project_config",
                    value=config,
                    source=self.name,
                    priority=ContextPriority.HIGH,
                    token_estimate=self._estimate_tokens(str(config))
                ))

            # 读取角色信息
            if include_characters:
                chars_dir = self._niko_dir / "characters"
                if chars_dir.exists():
                    characters = []
                    for char_file in chars_dir.glob("*.json"):
                        try:
                            char_data = json.loads(char_file.read_text(encoding="utf-8"))
                            characters.append(char_data)
                        except json.JSONDecodeError:
                            pass

                    if characters:
                        items.append(ContextItem(
                            key="characters",
                            value=characters,
                            source=self.name,
                            priority=ContextPriority.NORMAL,
                            metadata={"count": len(characters)},
                            token_estimate=self._estimate_tokens(str(characters))
                        ))

            # 读取世界观
            if include_world:
                world_file = self._niko_dir / "world.json"
                if world_file.exists():
                    world = json.loads(world_file.read_text(encoding="utf-8"))
                    items.append(ContextItem(
                        key="world",
                        value=world,
                        source=self.name,
                        priority=ContextPriority.NORMAL,
                        token_estimate=self._estimate_tokens(str(world))
                    ))

            # 读取大纲
            if include_outline:
                outline_file = self._niko_dir / "outline.json"
                if outline_file.exists():
                    outline = json.loads(outline_file.read_text(encoding="utf-8"))
                    items.append(ContextItem(
                        key="outline",
                        value=outline,
                        source=self.name,
                        priority=ContextPriority.HIGH,
                        token_estimate=self._estimate_tokens(str(outline))
                    ))

        except Exception as e:
            logger.error(f"Failed to get project context: {e}")

        return items


class ContextAggregator:
    """
    上下文聚合器

    从多个提供者收集上下文并进行优先级排序和令牌预算管理。

    使用示例:
        aggregator = ContextAggregator()
        aggregator.add_provider(MemoryContextProvider(memory_engine))
        aggregator.add_provider(SkillContextProvider(skill_loader))
        aggregator.add_provider(ProjectContextProvider())

        # 获取聚合上下文
        items = await aggregator.get_context(
            query="角色背景",
            max_tokens=4000
        )

        # 转换为 prompt
        prompt_context = aggregator.to_prompt(items)
    """

    def __init__(self, max_total_tokens: int = 8000):
        self._providers: List[IContextProvider] = []
        self._max_total_tokens = max_total_tokens

    def add_provider(self, provider: IContextProvider) -> None:
        """添加上下文提供者"""
        self._providers.append(provider)
        # 按优先级排序
        self._providers.sort(key=lambda p: p.priority)
        logger.debug(f"Added context provider: {provider.name}")

    def remove_provider(self, name: str) -> bool:
        """移除提供者"""
        for i, provider in enumerate(self._providers):
            if provider.name == name:
                self._providers.pop(i)
                return True
        return False

    async def get_context(
        self,
        query: Optional[str] = None,
        max_tokens: Optional[int] = None,
        provider_kwargs: Optional[Dict[str, Dict[str, Any]]] = None,
        **kwargs
    ) -> List[ContextItem]:
        """
        获取聚合上下文

        Args:
            query: 查询字符串
            max_tokens: 最大令牌数（None 表示无限制）
            provider_kwargs: 各提供者的额外参数
            **kwargs: 传递给所有提供者的参数

        Returns:
            按优先级排序的上下文项列表
        """
        all_items: List[ContextItem] = []
        provider_kwargs = provider_kwargs or {}

        # 从各提供者收集上下文
        for provider in self._providers:
            try:
                extra_kwargs = provider_kwargs.get(provider.name, {})
                items = await provider.get_context(query=query, **kwargs, **extra_kwargs)
                all_items.extend(items)
            except Exception as e:
                logger.error(f"Provider {provider.name} failed: {e}")

        # 按优先级排序
        all_items.sort(key=lambda x: x.priority)

        # 应用令牌预算
        if max_tokens is not None:
            all_items = self._apply_token_budget(all_items, max_tokens)

        return all_items

    def _apply_token_budget(
        self,
        items: List[ContextItem],
        max_tokens: int
    ) -> List[ContextItem]:
        """应用令牌预算，保留高优先级项目"""
        result: List[ContextItem] = []
        total_tokens = 0

        for item in items:
            if total_tokens + item.token_estimate <= max_tokens:
                result.append(item)
                total_tokens += item.token_estimate
            elif item.priority <= ContextPriority.HIGH:
                # 高优先级项目总是包含
                result.append(item)
                total_tokens += item.token_estimate
                logger.warning(f"Token budget exceeded for critical item: {item.key}")

        return result

    def to_prompt(self, items: List[ContextItem]) -> str:
        """将上下文项转换为 prompt 字符串"""
        if not items:
            return ""

        segments = [item.to_prompt_segment() for item in items]
        return "\n\n".join(segments)

    def list_providers(self) -> List[str]:
        """列出所有提供者名称"""
        return [p.name for p in self._providers]


# ============ 便捷函数 ============

def get_default_aggregator(
    memory_engine: Optional[Any] = None,
    skill_loader: Optional[Any] = None,
    project_root: Optional[str] = None
) -> ContextAggregator:
    """获取预配置的默认上下文聚合器"""
    aggregator = ContextAggregator()

    if memory_engine:
        aggregator.add_provider(MemoryContextProvider(memory_engine))

    if skill_loader:
        aggregator.add_provider(SkillContextProvider(skill_loader))

    aggregator.add_provider(ProjectContextProvider(project_root))

    return aggregator
