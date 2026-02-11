"""
Worldbuilding Agent Tests

Tests for WorldbuildingAgent: data models, atmosphere determination,
context generation, and consistency validation.
"""

import pytest
from unittest.mock import MagicMock, AsyncMock
from src.agents.worldbuilding import (
    WorldbuildingAgent,
    WorldSetting,
    WorldContext,
)


class TestDataModels:
    """Tests for WorldSetting and WorldContext"""

    def test_world_setting_required_fields(self):
        ws = WorldSetting(
            category="geography",
            name="Dark Forest",
            description="A dangerous forest",
        )
        assert ws.category == "geography"
        assert ws.rules == []
        assert ws.related_locations == []

    def test_world_setting_all_fields(self):
        ws = WorldSetting(
            category="magic",
            name="Rune System",
            description="Ancient rune magic",
            rules=["Cannot use in daylight"],
            related_locations=["Tower"],
            related_characters=["Wizard"],
        )
        assert len(ws.rules) == 1
        assert "Tower" in ws.related_locations

    def test_world_context_defaults(self):
        ctx = WorldContext()
        assert ctx.settings == []
        assert ctx.active_rules == []
        assert ctx.atmosphere == ""
        assert ctx.time_period == ""


class TestDetermineAtmosphere:
    """Tests for _determine_atmosphere()"""

    def test_dark_location(self):
        agent = WorldbuildingAgent()
        result = agent._determine_atmosphere(
            {"description": "A dark and dangerous place"},
            ""
        )
        assert "压抑" in result

    def test_bright_location(self):
        agent = WorldbuildingAgent()
        result = agent._determine_atmosphere(
            {"description": "A bright and warm city"},
            ""
        )
        assert "活跃" in result

    def test_ancient_location(self):
        agent = WorldbuildingAgent()
        result = agent._determine_atmosphere(
            {"description": "An ancient temple ruins"},
            ""
        )
        assert "神秘" in result

    def test_night_time(self):
        agent = WorldbuildingAgent()
        result = agent._determine_atmosphere({}, "deep night")
        assert "紧张" in result

    def test_dawn_time(self):
        agent = WorldbuildingAgent()
        result = agent._determine_atmosphere({}, "dawn breaks")
        assert "希望" in result

    def test_chinese_keywords(self):
        agent = WorldbuildingAgent()
        result = agent._determine_atmosphere(
            {"description": "阴暗潮湿的地下城"},
            "深夜"
        )
        assert "压抑" in result
        assert "紧张" in result

    def test_no_hints_returns_neutral(self):
        agent = WorldbuildingAgent()
        result = agent._determine_atmosphere({}, "")
        assert result == "中性"

    def test_empty_location_details(self):
        agent = WorldbuildingAgent()
        result = agent._determine_atmosphere({}, "清晨")
        assert "希望" in result

    def test_multiple_atmosphere_hints(self):
        agent = WorldbuildingAgent()
        result = agent._determine_atmosphere(
            {"description": "An ancient dark cave"},
            "夜"
        )
        hints = result.split("、")
        assert len(hints) >= 2


class TestGetContext:
    """Tests for get_context()"""

    @pytest.mark.asyncio
    async def test_no_engines_returns_basic_context(self):
        agent = WorldbuildingAgent(
            memory_engine=None,
            graph_engine=None,
        )
        ctx = await agent.get_context({"location": "Forest", "time": "dawn"})
        assert isinstance(ctx, WorldContext)
        assert ctx.time_period == "dawn"
        assert "希望" in ctx.atmosphere

    @pytest.mark.asyncio
    async def test_with_graph_engine(self):
        graph = MagicMock()
        graph.query = MagicMock(return_value=[{
            "l": {"description": "A dark forest", "rules": ["no magic"]},
            "nearby": ["Village"],
            "inhabitants": ["Elf"],
        }])
        agent = WorldbuildingAgent(graph_engine=graph)
        ctx = await agent.get_context({"location": "Dark Forest", "time": ""})
        assert len(ctx.settings) == 1
        assert ctx.settings[0].name == "Dark Forest"
        assert "A dark forest" in ctx.settings[0].description

    @pytest.mark.asyncio
    async def test_graph_query_failure_graceful(self):
        graph = MagicMock()
        graph.query = MagicMock(side_effect=RuntimeError("db error"))
        agent = WorldbuildingAgent(graph_engine=graph)
        ctx = await agent.get_context({"location": "Forest"})
        assert len(ctx.settings) == 0

    @pytest.mark.asyncio
    async def test_with_memory_engine(self):
        memory = MagicMock()
        memory.search = AsyncMock(return_value=[
            {"content": "No teleportation allowed"},
        ])
        agent = WorldbuildingAgent(memory_engine=memory)
        ctx = await agent.get_context({"location": "Arena", "time": "noon"})
        assert "No teleportation allowed" in ctx.active_rules


class TestValidateConsistency:
    """Tests for validate_consistency()"""

    @pytest.mark.asyncio
    async def test_empty_rules_valid(self):
        agent = WorldbuildingAgent()
        ctx = WorldContext()
        result = await agent.validate_consistency("some content", ctx)
        assert result["is_valid"] is True
        assert result["issues"] == []

    @pytest.mark.asyncio
    async def test_with_rules_no_violation(self):
        agent = WorldbuildingAgent()
        ctx = WorldContext(active_rules=["Magic is forbidden in daylight"])
        result = await agent.validate_consistency("The warrior drew his sword", ctx)
        assert result["is_valid"] is True
        assert result["checked_rules"] == 1
