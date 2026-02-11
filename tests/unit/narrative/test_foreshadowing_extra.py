# -*- coding: utf-8 -*-
"""Foreshadowing tests - dataclasses, state machine, ForeshadowingManager CRUD, overdue, scene management."""

import pytest
import json
from datetime import datetime, timedelta

from src.narrative.foreshadowing import (
    ForeshadowState,
    ForeshadowHint,
    Foreshadow,
    HarvestReminder,
    ForeshadowingManager,
)


class TestForeshadowState:
    def test_values(self):
        assert ForeshadowState.PLANTED.value == "planted"
        assert ForeshadowState.HINTED.value == "hinted"
        assert ForeshadowState.HARVESTED.value == "harvested"

    def test_from_value(self):
        assert ForeshadowState("planted") == ForeshadowState.PLANTED


class TestForeshadowHint:
    def test_defaults(self):
        h = ForeshadowHint(scene_id="s1", description="a clue")
        assert h.scene_id == "s1"
        assert isinstance(h.timestamp, datetime)


class TestForeshadow:
    def _make(self, **kwargs):
        defaults = dict(
            id="f1", description="desc", state=ForeshadowState.PLANTED,
            planted_at="scene1", planted_time=datetime(2025, 1, 1),
        )
        defaults.update(kwargs)
        return Foreshadow(**defaults)

    def test_defaults(self):
        f = self._make()
        assert f.importance == 5
        assert f.hints == []
        assert f.harvested_at is None
        assert f.tags == []
        assert f.metadata == {}

    def test_to_dict(self):
        f = self._make(importance=8, tags=["mystery"])
        d = f.to_dict()
        assert d["id"] == "f1"
        assert d["state"] == "planted"
        assert d["importance"] == 8
        assert "mystery" in d["tags"]
        assert d["harvested_time"] is None

    def test_to_dict_with_hints(self):
        h = ForeshadowHint(scene_id="s2", description="hint1", timestamp=datetime(2025, 1, 2))
        f = self._make(hints=[h])
        d = f.to_dict()
        assert len(d["hints"]) == 1
        assert d["hints"][0]["scene_id"] == "s2"

    def test_to_dict_harvested(self):
        f = self._make(
            state=ForeshadowState.HARVESTED,
            harvested_at="scene5",
            harvested_time=datetime(2025, 1, 10),
        )
        d = f.to_dict()
        assert d["state"] == "harvested"
        assert d["harvested_at"] == "scene5"
        assert d["harvested_time"] is not None

    def test_from_dict(self):
        d = {
            "id": "f2", "description": "test", "state": "hinted",
            "planted_at": "s1", "planted_time": "2025-01-01T00:00:00",
            "hints": [{"scene_id": "s2", "description": "h", "timestamp": "2025-01-02T00:00:00"}],
            "harvested_at": None, "harvested_time": None,
            "importance": 7, "tags": ["tag1"], "metadata": {"k": "v"},
        }
        f = Foreshadow.from_dict(d)
        assert f.id == "f2"
        assert f.state == ForeshadowState.HINTED
        assert len(f.hints) == 1
        assert f.importance == 7

    def test_from_dict_minimal(self):
        d = {
            "id": "f3", "description": "min", "state": "planted",
            "planted_at": "s1", "planted_time": "2025-01-01T00:00:00",
        }
        f = Foreshadow.from_dict(d)
        assert f.importance == 5
        assert f.tags == []


class TestForeshadowingManager:
    @pytest.fixture()
    def mgr(self, tmp_path):
        db = str(tmp_path / "foreshadow.db")
        return ForeshadowingManager(db_path=db)

    def test_plant(self, mgr):
        f = mgr.plant("a secret door", "scene1", importance=8, tags=["mystery"])
        assert f.state == ForeshadowState.PLANTED
        assert f.description == "a secret door"
        assert f.importance == 8
        assert "mystery" in f.tags

    def test_plant_clamps_importance(self, mgr):
        f = mgr.plant("over", "s1", importance=99)
        assert f.importance == 10
        f2 = mgr.plant("under", "s1", importance=-5)
        assert f2.importance == 1

    def test_get(self, mgr):
        f = mgr.plant("test", "s1")
        got = mgr.get(f.id)
        assert got is not None
        assert got.id == f.id

    def test_get_nonexistent(self, mgr):
        assert mgr.get("nonexistent") is None

    def test_hint(self, mgr):
        f = mgr.plant("foreshadow", "s1")
        updated = mgr.hint(f.id, "s2", "a subtle clue")
        assert updated.state == ForeshadowState.HINTED
        assert len(updated.hints) == 1
        assert updated.hints[0].scene_id == "s2"

    def test_hint_nonexistent(self, mgr):
        assert mgr.hint("nonexistent", "s1") is None

    def test_hint_harvested_returns_none(self, mgr):
        f = mgr.plant("test", "s1")
        mgr.harvest(f.id, "s2")
        result = mgr.hint(f.id, "s3")
        assert result is None

    def test_harvest(self, mgr):
        f = mgr.plant("to harvest", "s1")
        harvested = mgr.harvest(f.id, "s5")
        assert harvested.state == ForeshadowState.HARVESTED
        assert harvested.harvested_at == "s5"
        assert harvested.harvested_time is not None

    def test_harvest_nonexistent(self, mgr):
        assert mgr.harvest("nonexistent", "s1") is None

    def test_harvest_already_harvested(self, mgr):
        f = mgr.plant("test", "s1")
        mgr.harvest(f.id, "s2")
        result = mgr.harvest(f.id, "s3")
        assert result.state == ForeshadowState.HARVESTED
        assert result.harvested_at == "s2"  # unchanged

    def test_get_all(self, mgr):
        mgr.plant("a", "s1")
        mgr.plant("b", "s2")
        all_f = mgr.get_all()
        assert len(all_f) == 2

    def test_get_all_by_state(self, mgr):
        f1 = mgr.plant("a", "s1")
        mgr.plant("b", "s2")
        mgr.harvest(f1.id, "s3")
        planted = mgr.get_all(state=ForeshadowState.PLANTED)
        assert len(planted) == 1
        harvested = mgr.get_all(state=ForeshadowState.HARVESTED)
        assert len(harvested) == 1

    def test_get_pending(self, mgr):
        f1 = mgr.plant("a", "s1")
        f2 = mgr.plant("b", "s2")
        mgr.hint(f1.id, "s3")
        mgr.harvest(f2.id, "s4")
        pending = mgr.get_pending()
        assert len(pending) == 1
        assert pending[0].id == f1.id

    def test_register_scene(self, mgr):
        mgr.register_scene("story1", "s1", 1)
        mgr.register_scene("story1", "s2", 2)
        seq = mgr._get_scene_sequence("story1", "s1")
        assert seq == 1

    def test_get_scene_sequence_none(self, mgr):
        assert mgr._get_scene_sequence("story1", None) is None
        assert mgr._get_scene_sequence("story1", "nonexistent") is None

    def test_calculate_urgency(self, mgr):
        assert mgr._calculate_urgency(20, 10) == "critical"
        assert mgr._calculate_urgency(15, 10) == "high"
        assert mgr._calculate_urgency(10, 10) == "medium"
        assert mgr._calculate_urgency(5, 10) == "low"
        assert mgr._calculate_urgency(10, 0) == "medium"  # ratio defaults to 1.0

    def test_get_overdue_reason(self, mgr):
        f = Foreshadow(
            id="f1", description="d", state=ForeshadowState.PLANTED,
            planted_at="s1", planted_time=datetime.now(), hints=[],
        )
        reason = mgr._get_overdue_reason(30, 10, f)
        assert "严重超期" in reason

        reason2 = mgr._get_overdue_reason(12, 10, f)
        assert "未曾暗示" in reason2

        f_with_hints = Foreshadow(
            id="f2", description="d", state=ForeshadowState.HINTED,
            planted_at="s1", planted_time=datetime.now(),
            hints=[ForeshadowHint(scene_id="s2", description="h")],
        )
        reason3 = mgr._get_overdue_reason(12, 10, f_with_hints)
        assert "等待过长" in reason3

    def test_get_harvest_suggestion(self, mgr):
        f = Foreshadow(
            id="f1", description="d", state=ForeshadowState.PLANTED,
            planted_at="s1", planted_time=datetime.now(),
        )
        assert "立即回收" in mgr._get_harvest_suggestion(f, "critical")
        assert "尽快" in mgr._get_harvest_suggestion(f, "high")
        assert "暗示" in mgr._get_harvest_suggestion(f, "medium")

        f2 = Foreshadow(
            id="f2", description="d", state=ForeshadowState.HINTED,
            planted_at="s1", planted_time=datetime.now(),
        )
        assert "高潮" in mgr._get_harvest_suggestion(f2, "medium")

    def test_full_lifecycle(self, mgr):
        """Test complete PLANTED -> HINTED -> HARVESTED lifecycle."""
        f = mgr.plant("the ring", "ch1", importance=9)
        assert f.state == ForeshadowState.PLANTED

        f = mgr.hint(f.id, "ch3", "glint of gold")
        assert f.state == ForeshadowState.HINTED
        assert len(f.hints) == 1

        f = mgr.hint(f.id, "ch5", "ring grows warm")
        assert len(f.hints) == 2

        f = mgr.harvest(f.id, "ch8")
        assert f.state == ForeshadowState.HARVESTED
        assert f.harvested_at == "ch8"
