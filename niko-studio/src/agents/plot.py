# -*- coding: utf-8 -*-
"""
Plot Agent - 剧情管理

负责剧情大纲、时间线和伏笔的追踪与管理。
从 Memory + Graph 存储中获取剧情上下文。
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from enum import Enum
from .base import BaseAgent


class ForeshadowStatus(Enum):
    """伏笔状态"""
    PLANTED = "planted"       # 已埋设
    HINTED = "hinted"         # 已暗示
    HARVESTED = "harvested"   # 已回收
    ABANDONED = "abandoned"   # 已放弃


class Foreshadow(BaseModel):
    """伏笔"""
    foreshadow_id: str = Field(..., description="伏笔ID")
    description: str = Field(..., description="伏笔描述")
    planted_at: str = Field(default="", description="埋设位置 (CH01-SC01)")
    harvested_at: str = Field(default="", description="回收位置")
    status: ForeshadowStatus = Field(default=ForeshadowStatus.PLANTED)
    importance: str = Field(default="medium", description="重要性: high/medium/low")
    related_characters: List[str] = Field(default_factory=list)
    hints: List[str] = Field(default_factory=list, description="中间暗示")


class TimelineEvent(BaseModel):
    """时间线事件"""
    event_id: str = Field(..., description="事件ID")
    description: str = Field(..., description="事件描述")
    scene_id: str = Field(default="", description="发生场景")
    characters_involved: List[str] = Field(default_factory=list)
    consequences: List[str] = Field(default_factory=list, description="后续影响")
    is_key_event: bool = Field(default=False, description="是否关键事件")


class PlotContext(BaseModel):
    """剧情上下文"""
    current_position: str = Field(default="", description="当前剧情位置 (CH01-SC01)")
    structural_function: str = Field(default="", description="结构功能: Setup/Door1/Rising/...")

    # 时间线
    previous_events: List[TimelineEvent] = Field(default_factory=list)
    upcoming_events: List[str] = Field(default_factory=list, description="已规划的后续事件")

    # 伏笔
    active_foreshadows: List[Foreshadow] = Field(default_factory=list, description="待回收的伏笔")
    foreshadows_to_plant: List[str] = Field(default_factory=list, description="本场景需埋设的伏笔")
    foreshadows_to_harvest: List[str] = Field(default_factory=list, description="本场景需回收的伏笔")

    # 张力
    tension_level: int = Field(default=5, ge=1, le=10, description="当前张力水平")
    tension_trend: str = Field(default="rising", description="张力趋势: rising/falling/peak")


class PlotAgent(BaseAgent):
    """
    剧情 Agent

    职责：
    1. 追踪剧情时间线
    2. 管理伏笔系统
    3. 分析张力曲线
    4. 确保剧情一致性
    """

    def __init__(self, llm=None, memory_engine=None, graph_engine=None, name: str = "Plot", config: Optional[Dict[str, Any]] = None):
        super().__init__(name, config)
        self.llm = llm
        self._memory_engine = memory_engine
        self._graph_engine = graph_engine

    @property
    def memory_engine(self):
        """延迟加载 Memory Engine"""
        if self._memory_engine is None:
            try:
                from src.memory.unified_memory import UnifiedMemoryEngine
                self._memory_engine = UnifiedMemoryEngine()
            except Exception as e:
                self.log_activity(f"Failed to load MemoryEngine: {e}", level="WARNING")
        return self._memory_engine

    @property
    def graph_engine(self):
        """延迟加载 Graph Engine"""
        if self._graph_engine is None:
            try:
                from src.graph.graph_engine import GraphEngine
                self._graph_engine = GraphEngine()
            except Exception as e:
                self.log_activity(f"Failed to load GraphEngine: {e}", level="WARNING")
        return self._graph_engine

    async def get_context(self, scene_info: Dict[str, Any]) -> PlotContext:
        """
        获取场景所需的剧情上下文

        Args:
            scene_info: 场景信息

        Returns:
            PlotContext: 剧情上下文
        """
        scene_id = scene_info.get("scene_id", "CH01-SC01")
        structural_function = scene_info.get("structural_function", "Rising")

        # 获取时间线事件
        previous_events = await self._get_previous_events(scene_id)
        upcoming_events = await self._get_upcoming_events(scene_id)

        # 获取伏笔状态
        active_foreshadows = await self._get_active_foreshadows(scene_id)
        foreshadows_to_plant = scene_info.get("foreshadows_to_plant", [])
        foreshadows_to_harvest = scene_info.get("foreshadows_to_harvest", [])

        # 分析张力
        tension_level, tension_trend = self._analyze_tension(
            structural_function, previous_events
        )

        context = PlotContext(
            current_position=scene_id,
            structural_function=structural_function,
            previous_events=previous_events,
            upcoming_events=upcoming_events,
            active_foreshadows=active_foreshadows,
            foreshadows_to_plant=foreshadows_to_plant,
            foreshadows_to_harvest=foreshadows_to_harvest,
            tension_level=tension_level,
            tension_trend=tension_trend
        )

        self.log_activity(f"Generated plot context for {scene_id}: tension={tension_level}, {len(active_foreshadows)} active foreshadows")
        return context

    async def _get_previous_events(self, current_scene_id: str) -> List[TimelineEvent]:
        """获取之前的时间线事件"""
        events = []

        if self.memory_engine:
            try:
                # 解析场景ID获取章节号
                chapter_num = int(current_scene_id[2:4]) if len(current_scene_id) >= 4 else 1

                # 查询之前章节的关键事件
                results = await self.memory_engine.search(
                    query=f"key event chapter before {chapter_num}",
                    limit=10
                )

                for r in results:
                    if isinstance(r, dict):
                        events.append(TimelineEvent(
                            event_id=r.get("id", ""),
                            description=r.get("content", ""),
                            scene_id=r.get("scene_id", ""),
                            characters_involved=r.get("characters", []),
                            is_key_event=r.get("is_key", False)
                        ))
            except Exception as e:
                self.log_activity(f"Event query failed: {e}", level="WARNING")

        return events

    async def _get_upcoming_events(self, current_scene_id: str) -> List[str]:
        """获取已规划的后续事件"""
        upcoming = []

        if self.memory_engine:
            try:
                results = await self.memory_engine.search(
                    query=f"planned event after {current_scene_id}",
                    limit=5
                )

                for r in results:
                    if isinstance(r, dict) and "content" in r:
                        upcoming.append(r["content"])
            except Exception:
                pass

        return upcoming

    async def _get_active_foreshadows(self, current_scene_id: str) -> List[Foreshadow]:
        """获取待回收的伏笔"""
        foreshadows = []

        if self.graph_engine:
            query = """
            MATCH (f:Foreshadow)
            WHERE f.status = 'planted' OR f.status = 'hinted'
            RETURN f
            ORDER BY f.importance DESC
            LIMIT 20
            """

            try:
                results = self.graph_engine.query(query)
                for r in results:
                    f_data = r.get("f", {})
                    foreshadows.append(Foreshadow(
                        foreshadow_id=f_data.get("id", ""),
                        description=f_data.get("description", ""),
                        planted_at=f_data.get("planted_at", ""),
                        status=ForeshadowStatus(f_data.get("status", "planted")),
                        importance=f_data.get("importance", "medium"),
                        related_characters=f_data.get("characters", []),
                        hints=f_data.get("hints", [])
                    ))
            except Exception as e:
                self.log_activity(f"Foreshadow query failed: {e}", level="WARNING")

        return foreshadows

    def _analyze_tension(
        self,
        structural_function: str,
        previous_events: List[TimelineEvent]
    ) -> tuple:
        """分析张力水平和趋势"""
        # 基于结构位置的基准张力
        tension_map = {
            "Establishment": (3, "rising"),
            "Door1": (6, "rising"),
            "Rising": (5, "rising"),
            "Midpoint": (7, "peak"),
            "Falling": (4, "falling"),
            "Door2": (8, "rising"),
            "Climax": (10, "peak"),
            "Resolution": (2, "falling"),
        }

        base_tension, trend = tension_map.get(structural_function, (5, "rising"))

        # 根据之前事件调整
        key_events = sum(1 for e in previous_events if e.is_key_event)
        tension_adjustment = min(key_events, 2)  # 最多 +2

        tension_level = min(10, base_tension + tension_adjustment)

        return tension_level, trend

    async def track_foreshadow(
        self,
        foreshadow_id: str,
        action: str,
        scene_id: str
    ) -> Dict[str, Any]:
        """
        追踪伏笔状态变化

        Args:
            foreshadow_id: 伏笔ID
            action: plant/hint/harvest/abandon
            scene_id: 发生场景

        Returns:
            更新结果
        """
        status_map = {
            "plant": ForeshadowStatus.PLANTED,
            "hint": ForeshadowStatus.HINTED,
            "harvest": ForeshadowStatus.HARVESTED,
            "abandon": ForeshadowStatus.ABANDONED,
        }

        new_status = status_map.get(action, ForeshadowStatus.PLANTED)

        if self.graph_engine:
            try:
                update_query = f"""
                MATCH (f:Foreshadow {{id: '{foreshadow_id}'}})
                SET f.status = '{new_status.value}'
                """
                if action == "harvest":
                    update_query += f", f.harvested_at = '{scene_id}'"
                elif action == "hint":
                    update_query += f", f.hints = f.hints + ['{scene_id}']"

                self.graph_engine.query(update_query)

                self.log_activity(f"Foreshadow {foreshadow_id} -> {new_status.value} at {scene_id}")
                return {"success": True, "new_status": new_status.value}
            except Exception as e:
                return {"success": False, "error": str(e)}

        return {"success": False, "error": "No graph engine"}

    async def validate_timeline(self, content: str, context: PlotContext) -> Dict[str, Any]:
        """
        验证内容与时间线的一致性

        Args:
            content: 待验证内容
            context: 剧情上下文

        Returns:
            验证结果
        """
        issues = []
        suggestions = []

        # 检查是否引用了未发生的事件
        for upcoming in context.upcoming_events:
            if upcoming.lower() in content.lower():
                issues.append(f"内容可能引用了尚未发生的事件: {upcoming[:50]}...")

        # 检查伏笔是否被正确处理
        for fs in context.foreshadows_to_harvest:
            if fs.lower() not in content.lower():
                suggestions.append(f"本场景应回收伏笔: {fs}")

        is_valid = len(issues) == 0

        return {
            "is_valid": is_valid,
            "issues": issues,
            "suggestions": suggestions
        }

    def run(self, input_data: Any) -> Any:
        """同步运行接口"""
        import asyncio
        return asyncio.run(self.get_context(input_data))
