"""
Plot Agent Tests

Tests for PlotAgent: data models, tension analysis,
foreshadow tracking, timeline validation, and context retrieval.
"""

import pytest
from unittest.mock import MagicMock, AsyncMock
from src.agents.plot import (
    PlotAgent,
    PlotContext,
    Foreshadow,
    ForeshadowStatus,
    TimelineEvent,
)


class TestDataModels:
    """Tests for Plot data models"""

    def test_foreshadow_defaults(self):
        f = Foreshadow(foreshadow_id="FS-001", description="A mysterious letter")
        assert f.status == ForeshadowStatus.PLANTED
        assert f.importance == "medium"
        assert f.related_characters == []
        assert f.hints == []

    def test_foreshadow_all_fields(self):
        f = Foreshadow(
            foreshadow_id="FS-002",
            description="Hidden treasure map",
            planted_at="CH01-SC01",
            harvested_at="CH05-SC03",
            status=ForeshadowStatus.HARVESTED,
            importance="high",
            related_characters=["Alice"],
            hints=["CH02-SC01", "CH03-SC02"],
        )
        assert f.status == ForeshadowStatus.HARVESTED
        assert len(f.hints) == 2

    def test_timeline_event_defaults(self):
        e = TimelineEvent(event_id="EVT-001", description="Battle begins")
        assert e.scene_id == ""
        assert e.characters_involved == []
        assert e.is_key_event is False

    def test_plot_context_defaults(self):
        ctx = PlotContext()
        assert ctx.tension_level == 5
        assert ctx.tension_trend == "rising"
        assert ctx.active_foreshadows == []
        assert ctx.foreshadows_to_plant == []

    def test_foreshadow_status_enum(self):
        assert ForeshadowStatus.PLANTED.value == "planted"
        assert ForeshadowStatus.HINTED.value == "hinted"
        assert ForeshadowStatus.HARVESTED.value == "harvested"
        assert ForeshadowStatus.ABANDONED.value == "abandoned"


class TestAnalyzeTension:
    """Tests for _analyze_tension()"""

    def test_establishment(self):
        agent = PlotAgent()
        level, trend = agent._analyze_tension("Establishment", [])
        assert level == 3
        assert trend == "rising"

    def test_climax(self):
        agent = PlotAgent()
        level, trend = agent._analyze_tension("Climax", [])
        assert level == 10
        assert trend == "peak"

    def test_resolution(self):
        agent = PlotAgent()
        level, trend = agent._analyze_tension("Resolution", [])
        assert level == 2
        assert trend == "falling"

    def test_door1(self):
        agent = PlotAgent()
        level, trend = agent._analyze_tension("Door1", [])
        assert level == 6
        assert trend == "rising"

    def test_door2(self):
        agent = PlotAgent()
        level, trend = agent._analyze_tension("Door2", [])
        assert level == 8
        assert trend == "rising"

    def test_midpoint(self):
        agent = PlotAgent()
        level, trend = agent._analyze_tension("Midpoint", [])
        assert level == 7
        assert trend == "peak"

    def test_unknown_structural_function(self):
        agent = PlotAgent()
        level, trend = agent._analyze_tension("Unknown", [])
        assert level == 5
        assert trend == "rising"

    def test_key_events_increase_tension(self):
        agent = PlotAgent()
        events = [
            TimelineEvent(event_id="e1", description="battle", is_key_event=True),
            TimelineEvent(event_id="e2", description="betrayal", is_key_event=True),
        ]
        level, trend = agent._analyze_tension("Rising", events)
        assert level == 7  # 5 base + 2 key events

    def test_key_events_capped_at_plus_2(self):
        agent = PlotAgent()
        events = [
            TimelineEvent(event_id=f"e{i}", description=f"event{i}", is_key_event=True)
            for i in range(5)
        ]
        level, _ = agent._analyze_tension("Rising", events)
        assert level == 7  # 5 + 2 (capped)

    def test_tension_max_10(self):
        agent = PlotAgent()
        events = [
            TimelineEvent(event_id="e1", description="big", is_key_event=True),
            TimelineEvent(event_id="e2", description="bigger", is_key_event=True),
        ]
        level, _ = agent._analyze_tension("Climax", events)
        assert level == 10  # capped at 10

    def test_non_key_events_no_effect(self):
        agent = PlotAgent()
        events = [
            TimelineEvent(event_id="e1", description="minor", is_key_event=False),
        ]
        level, _ = agent._analyze_tension("Rising", events)
        assert level == 5  # base only


class TestTrackForeshadow:
    """Tests for track_foreshadow()"""

    @pytest.mark.asyncio
    async def test_no_graph_engine(self, monkeypatch):
        agent = PlotAgent()
        # Use monkeypatch to override the property safely
        monkeypatch.setattr(type(agent), "graph_engine", property(lambda self: None))
        result = await agent.track_foreshadow("FS-001", "plant", "CH01-SC01")
        assert result["success"] is False
        assert "No graph engine" in result["error"]

    @pytest.mark.asyncio
    async def test_plant_action(self, monkeypatch):
        graph = MagicMock()
        graph.query = MagicMock(return_value=None)
        agent = PlotAgent()
        monkeypatch.setattr(type(agent), "graph_engine", property(lambda self: graph))
        result = await agent.track_foreshadow("FS-001", "plant", "CH01-SC01")
        assert result["success"] is True
        assert result["new_status"] == "planted"
        graph.query.assert_called_once()

    @pytest.mark.asyncio
    async def test_harvest_action(self, monkeypatch):
        graph = MagicMock()
        graph.query = MagicMock(return_value=None)
        agent = PlotAgent()
        monkeypatch.setattr(type(agent), "graph_engine", property(lambda self: graph))
        result = await agent.track_foreshadow("FS-001", "harvest", "CH05-SC03")
        assert result["success"] is True
        assert result["new_status"] == "harvested"

    @pytest.mark.asyncio
    async def test_hint_action(self, monkeypatch):
        graph = MagicMock()
        graph.query = MagicMock(return_value=None)
        agent = PlotAgent()
        monkeypatch.setattr(type(agent), "graph_engine", property(lambda self: graph))
        result = await agent.track_foreshadow("FS-001", "hint", "CH03-SC01")
        assert result["success"] is True
        assert result["new_status"] == "hinted"

    @pytest.mark.asyncio
    async def test_abandon_action(self, monkeypatch):
        graph = MagicMock()
        graph.query = MagicMock(return_value=None)
        agent = PlotAgent()
        monkeypatch.setattr(type(agent), "graph_engine", property(lambda self: graph))
        result = await agent.track_foreshadow("FS-001", "abandon", "CH04-SC01")
        assert result["success"] is True
        assert result["new_status"] == "abandoned"

    @pytest.mark.asyncio
    async def test_graph_query_failure(self, monkeypatch):
        graph = MagicMock()
        graph.query = MagicMock(side_effect=RuntimeError("db error"))
        agent = PlotAgent()
        monkeypatch.setattr(type(agent), "graph_engine", property(lambda self: graph))
        result = await agent.track_foreshadow("FS-001", "plant", "CH01-SC01")
        assert result["success"] is False
        assert "db error" in result["error"]


class TestValidateTimeline:
    """Tests for validate_timeline()"""

    @pytest.mark.asyncio
    async def test_no_issues(self):
        agent = PlotAgent()
        ctx = PlotContext(
            upcoming_events=["dragon attack"],
            foreshadows_to_harvest=["mysterious clue"],
        )
        content = "The mysterious clue was finally revealed. Warriors prepared for battle."
        result = await agent.validate_timeline(content, ctx)
        assert result["is_valid"] is True

    @pytest.mark.asyncio
    async def test_references_future_event(self):
        agent = PlotAgent()
        ctx = PlotContext(upcoming_events=["dragon attack"])
        content = "The aftermath of the dragon attack was devastating"
        result = await agent.validate_timeline(content, ctx)
        assert result["is_valid"] is False
        assert len(result["issues"]) > 0

    @pytest.mark.asyncio
    async def test_missing_foreshadow_harvest(self):
        agent = PlotAgent()
        ctx = PlotContext(foreshadows_to_harvest=["mysterious letter"])
        content = "They walked through the forest in silence"
        result = await agent.validate_timeline(content, ctx)
        assert len(result["suggestions"]) > 0
        assert "mysterious letter" in result["suggestions"][0]

    @pytest.mark.asyncio
    async def test_empty_context(self):
        agent = PlotAgent()
        ctx = PlotContext()
        result = await agent.validate_timeline("any content", ctx)
        assert result["is_valid"] is True
        assert result["issues"] == []
        assert result["suggestions"] == []


class TestGetContext:
    """Tests for get_context()"""

    @pytest.mark.asyncio
    async def test_no_engines_returns_basic(self, monkeypatch):
        agent = PlotAgent()
        monkeypatch.setattr(type(agent), "memory_engine", property(lambda self: None))
        monkeypatch.setattr(type(agent), "graph_engine", property(lambda self: None))
        ctx = await agent.get_context({
            "scene_id": "CH03-SC01",
            "structural_function": "Rising",
        })
        assert isinstance(ctx, PlotContext)
        assert ctx.current_position == "CH03-SC01"
        assert ctx.structural_function == "Rising"
        assert ctx.tension_level == 5
        assert ctx.tension_trend == "rising"

    @pytest.mark.asyncio
    async def test_foreshadow_passthrough(self, monkeypatch):
        agent = PlotAgent()
        monkeypatch.setattr(type(agent), "memory_engine", property(lambda self: None))
        monkeypatch.setattr(type(agent), "graph_engine", property(lambda self: None))
        ctx = await agent.get_context({
            "scene_id": "CH01-SC01",
            "foreshadows_to_plant": ["clue A"],
            "foreshadows_to_harvest": ["old clue B"],
        })
        assert ctx.foreshadows_to_plant == ["clue A"]
        assert ctx.foreshadows_to_harvest == ["old clue B"]

    @pytest.mark.asyncio
    async def test_default_scene_info(self, monkeypatch):
        agent = PlotAgent()
        monkeypatch.setattr(type(agent), "memory_engine", property(lambda self: None))
        monkeypatch.setattr(type(agent), "graph_engine", property(lambda self: None))
        ctx = await agent.get_context({})
        assert ctx.current_position == "CH01-SC01"
        assert ctx.structural_function == "Rising"
