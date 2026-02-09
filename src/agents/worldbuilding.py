# -*- coding: utf-8 -*-
"""
Worldbuilding Agent - 世界观管理

负责世界观设定的查询、验证和一致性检查。
从 Memory + Graph 存储中获取世界观上下文。
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from .base import BaseAgent


class WorldSetting(BaseModel):
    """世界观设定"""
    category: str = Field(..., description="类别: geography/culture/magic/technology/history")
    name: str = Field(..., description="设定名称")
    description: str = Field(..., description="详细描述")
    rules: List[str] = Field(default_factory=list, description="相关规则")
    related_locations: List[str] = Field(default_factory=list)
    related_characters: List[str] = Field(default_factory=list)


class WorldContext(BaseModel):
    """世界观上下文"""
    settings: List[WorldSetting] = Field(default_factory=list)
    active_rules: List[str] = Field(default_factory=list, description="当前场景适用的规则")
    location_details: Dict[str, Any] = Field(default_factory=dict)
    time_period: str = Field(default="", description="时间背景")
    atmosphere: str = Field(default="", description="整体氛围")


class WorldbuildingAgent(BaseAgent):
    """
    世界观 Agent

    职责：
    1. 查询世界观设定
    2. 验证场景与世界观一致性
    3. 提供场景所需的环境细节
    """

    def __init__(self, llm=None, memory_engine=None, graph_engine=None, name: str = "Worldbuilding", config: Optional[Dict[str, Any]] = None):
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

    async def get_context(self, scene_info: Dict[str, Any]) -> WorldContext:
        """
        获取场景所需的世界观上下文

        Args:
            scene_info: 场景信息，包含 location, time, characters 等

        Returns:
            WorldContext: 世界观上下文
        """
        location = scene_info.get("location", "")
        time_period = scene_info.get("time", "")

        settings = []
        active_rules = []
        location_details = {}

        # 从 Graph 查询地点信息
        if self.graph_engine and location:
            try:
                result = await self._query_location(location)
                if result:
                    location_details = result
                    settings.append(WorldSetting(
                        category="geography",
                        name=location,
                        description=result.get("description", ""),
                        rules=result.get("rules", []),
                        related_locations=result.get("nearby", []),
                        related_characters=result.get("inhabitants", [])
                    ))
            except Exception as e:
                self.log_activity(f"Location query failed: {e}", level="WARNING")

        # 从 Memory 查询相关规则
        if self.memory_engine:
            try:
                rules = await self._query_rules(location, time_period)
                active_rules.extend(rules)
            except Exception as e:
                self.log_activity(f"Rules query failed: {e}", level="WARNING")

        # 确定氛围
        atmosphere = self._determine_atmosphere(location_details, time_period)

        context = WorldContext(
            settings=settings,
            active_rules=active_rules,
            location_details=location_details,
            time_period=time_period,
            atmosphere=atmosphere
        )

        self.log_activity(f"Generated world context for {location}: {len(settings)} settings, {len(active_rules)} rules")
        return context

    async def _query_location(self, location: str) -> Dict[str, Any]:
        """查询地点详情"""
        if not self.graph_engine:
            return {}

        query = f"""
        MATCH (l:Location {{name: '{location}'}})
        OPTIONAL MATCH (l)-[:NEAR]->(nearby:Location)
        OPTIONAL MATCH (c:Character)-[:LIVES_IN]->(l)
        RETURN l, collect(DISTINCT nearby.name) as nearby, collect(DISTINCT c.name) as inhabitants
        """

        try:
            result = self.graph_engine.query(query)
            if result and len(result) > 0:
                node = result[0]
                return {
                    "name": location,
                    "description": node.get("l", {}).get("description", ""),
                    "rules": node.get("l", {}).get("rules", []),
                    "nearby": node.get("nearby", []),
                    "inhabitants": node.get("inhabitants", [])
                }
        except Exception:
            pass

        return {}

    async def _query_rules(self, location: str, time_period: str) -> List[str]:
        """查询适用规则"""
        if not self.memory_engine:
            return []

        rules = []

        # 查询位置相关规则
        if location:
            try:
                location_rules = await self.memory_engine.search(
                    query=f"world rules {location}",
                    limit=5
                )
                for r in location_rules:
                    if isinstance(r, dict) and "content" in r:
                        rules.append(r["content"])
            except Exception:
                pass

        # 查询时间相关规则
        if time_period:
            try:
                time_rules = await self.memory_engine.search(
                    query=f"world rules {time_period}",
                    limit=3
                )
                for r in time_rules:
                    if isinstance(r, dict) and "content" in r:
                        rules.append(r["content"])
            except Exception:
                pass

        return rules

    def _determine_atmosphere(self, location_details: Dict[str, Any], time_period: str) -> str:
        """根据地点和时间确定氛围"""
        atmosphere_hints = []

        if location_details:
            desc = location_details.get("description", "").lower()
            if any(word in desc for word in ["dark", "黑暗", "阴暗", "危险"]):
                atmosphere_hints.append("压抑")
            if any(word in desc for word in ["bright", "明亮", "温暖", "繁华"]):
                atmosphere_hints.append("活跃")
            if any(word in desc for word in ["ancient", "古老", "废墟", "历史"]):
                atmosphere_hints.append("神秘")

        if time_period:
            if any(word in time_period.lower() for word in ["night", "夜", "深夜"]):
                atmosphere_hints.append("紧张")
            if any(word in time_period.lower() for word in ["dawn", "黎明", "清晨"]):
                atmosphere_hints.append("希望")

        return "、".join(atmosphere_hints) if atmosphere_hints else "中性"

    async def validate_consistency(self, content: str, context: WorldContext) -> Dict[str, Any]:
        """
        验证内容与世界观的一致性

        Args:
            content: 待验证的内容
            context: 世界观上下文

        Returns:
            验证结果，包含 is_valid, issues, suggestions
        """
        issues = []
        suggestions = []

        # 检查规则违反
        for rule in context.active_rules:
            # 简单关键词检查（实际应用中可用 LLM 进行语义检查）
            rule_keywords = rule.split()[:3]  # 取规则前几个词作为关键词
            for keyword in rule_keywords:
                if len(keyword) > 2 and keyword in content:
                    # 可能相关，标记为需要检查
                    pass

        is_valid = len(issues) == 0

        return {
            "is_valid": is_valid,
            "issues": issues,
            "suggestions": suggestions,
            "checked_rules": len(context.active_rules)
        }

    def run(self, input_data: Any) -> Any:
        """同步运行接口"""
        import asyncio
        return asyncio.run(self.get_context(input_data))
