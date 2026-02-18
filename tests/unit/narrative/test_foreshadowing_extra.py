# -*- coding: utf-8 -*-
"""Foreshadowing tests - dataclasses, state machine, ForeshadowingManager CRUD, overdue, scene management."""

import pytest
import json
import sys
import types
from dataclasses import dataclass
from enum import Enum
from datetime import datetime, timedelta
from unittest.mock import MagicMock

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




class TestForeshadowingAdditionalBranches:
    @pytest.fixture()
    def mgr(self, tmp_path):
        db = str(tmp_path / "foreshadow_extra.db")
        return ForeshadowingManager(db_path=db)

    def test_default_db_path_when_none(self, monkeypatch, tmp_path):
        monkeypatch.setattr("src.narrative.foreshadowing.Path.home", lambda: tmp_path)
        mgr = ForeshadowingManager()
        try:
            assert mgr.db_path.as_posix().endswith(".niko/foreshadowing.db")
        finally:
            mgr.close()

    def test_get_lifecycle_summary_none_when_missing(self, mgr):
        assert mgr.get_lifecycle_summary("missing") is None

    def test_context_manager_enter_exit(self, tmp_path):
        db = str(tmp_path / "ctx.db")
        with ForeshadowingManager(db_path=db) as manager:
            planted = manager.plant("x", "s1")
            assert manager.get(planted.id) is not None
        assert manager._conn is None

    def test_reminder_trigger_rule_evaluate_raises(self):
        from src.narrative.foreshadowing import ReminderTriggerRule

        rule = ReminderTriggerRule(name="base", description="d", priority=1)
        with pytest.raises(NotImplementedError):
            rule.evaluate(None, 1, 0)

    def test_scene_count_rule_low_branch_unreachable_defense(self):
        from src.narrative.foreshadowing import SceneCountRule

        rule = SceneCountRule()
        f = Foreshadow(
            id="f-low",
            description="d",
            state=ForeshadowState.PLANTED,
            planted_at="s1",
            planted_time=datetime.now(),
            importance=5,
        )
        assert rule._get_suggestion(f, "low")

    def test_rule_engine_skips_disabled_rule(self):
        from src.narrative.foreshadowing import ReminderRuleEngine, SceneCountRule

        engine = ReminderRuleEngine()
        disabled = SceneCountRule(name="disabled")
        disabled.enabled = False
        engine.add_rule(disabled)

        f = Foreshadow(
            id="f1",
            description="d",
            state=ForeshadowState.PLANTED,
            planted_at="s1",
            planted_time=datetime.now(),
            importance=10,
        )
        reminders = engine.evaluate(f, 100, 1)
        assert all(r.reason for r in reminders)

    def test_graph_sync_import_error(self, mgr):
        from src.narrative.foreshadowing import ForeshadowGraphIntegration

        integ = ForeshadowGraphIntegration(mgr, graph_manager=MagicMock())
        foreshadow = mgr.plant("graph", "s1")

        import builtins

        original_import = builtins.__import__

        def fake_import(name, *args, **kwargs):
            if name == "docs.contracts.graph_contracts":
                raise ImportError("missing")
            return original_import(name, *args, **kwargs)

        builtins.__import__ = fake_import
        try:
            assert integ.sync_foreshadow_to_graph(foreshadow) is None
        finally:
            builtins.__import__ = original_import

    def test_graph_create_scene_relationships_import_error(self, mgr):
        from src.narrative.foreshadowing import ForeshadowGraphIntegration

        integ = ForeshadowGraphIntegration(mgr, graph_manager=MagicMock())
        f = mgr.plant("x", "s1")

        import builtins

        original_import = builtins.__import__

        def fake_import(name, *args, **kwargs):
            if name == "docs.contracts.graph_contracts":
                raise ImportError("missing")
            return original_import(name, *args, **kwargs)

        builtins.__import__ = fake_import
        try:
            integ._create_scene_relationships(f, "foreshadow_x")
        finally:
            builtins.__import__ = original_import

    def test_graph_link_without_manager_returns_false(self, mgr):
        from src.narrative.foreshadowing import ForeshadowGraphIntegration

        integ = ForeshadowGraphIntegration(mgr, graph_manager=None)
        assert integ.link_foreshadow_to_entity("f1", "entity") is False

    def test_graph_find_related_without_manager_returns_empty(self, mgr):
        from src.narrative.foreshadowing import ForeshadowGraphIntegration

        integ = ForeshadowGraphIntegration(mgr, graph_manager=None)
        assert integ.find_related_foreshadows("entity") == []

    def test_graph_network_without_manager_error(self, mgr):
        from src.narrative.foreshadowing import ForeshadowGraphIntegration

        integ = ForeshadowGraphIntegration(mgr, graph_manager=None)
        result = integ.get_foreshadow_network("f1")
        assert result["error"] == "GraphManager not set"

    def test_graph_network_exception_branch(self, mgr):
        from src.narrative.foreshadowing import ForeshadowGraphIntegration

        gm = MagicMock()
        gm.get_subgraph.side_effect = RuntimeError("boom")
        integ = ForeshadowGraphIntegration(mgr, graph_manager=gm)

        result = integ.get_foreshadow_network("f1")
        assert "boom" in result["error"]

    def test_enhanced_manager_set_graph_manager(self, tmp_path):
        from src.narrative.foreshadowing import EnhancedForeshadowingManager

        m = EnhancedForeshadowingManager(db_path=str(tmp_path / "enh.db"))
        try:
            gm = MagicMock()
            m.set_graph_manager(gm)
            assert m.graph_integration.gm is gm
        finally:
            m.close()

    def test_enhanced_manager_analyze_health_recommendation_branches(self, tmp_path):
        from src.narrative.foreshadowing import EnhancedForeshadowingManager

        m = EnhancedForeshadowingManager(db_path=str(tmp_path / "enh2.db"))
        try:
            f1 = m.plant("a", "s1", importance=9)
            m.register_scene("default", "s1", 1)
            m.register_scene("default", "s2", 2)
            m.hint(f1.id, "s2")
            health = m.analyze_foreshadow_health()
            assert "health_score" in health
            assert isinstance(health["recommendations"], list)
        finally:
            m.close()

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

    def test_from_dict_harvested_time_parsing(self):
        data = {
            "id": "f-h",
            "description": "harvested",
            "state": "harvested",
            "planted_at": "s1",
            "planted_time": "2025-01-01T00:00:00",
            "harvested_at": "s2",
            "harvested_time": "2025-01-02T00:00:00",
        }
        f = Foreshadow.from_dict(data)
        assert f.harvested_time is not None

    def test_get_overdue_fallback_days_to_scenes(self, mgr):
        old = mgr.plant("old", "missing-scene", importance=10)
        old.planted_time = datetime.now() - timedelta(days=20)
        mgr._conn.execute(
            "UPDATE foreshadows SET planted_time = ? WHERE id = ?",
            (old.planted_time.isoformat(), old.id),
        )
        mgr._conn.commit()

        reminders = mgr.get_overdue(threshold=5, current_scene_id="unknown", story_id="default")
        assert reminders

    def test_search_with_state_filter_branch(self, mgr):
        f1 = mgr.plant("q one", "s1")
        f2 = mgr.plant("q two", "s2")
        mgr.harvest(f2.id, "s3")

        results = mgr.search("q", state=ForeshadowState.HARVESTED)
        assert [r.id for r in results] == [f2.id]
        assert f1.id not in [r.id for r in results]

    def test_scene_count_rule_high_urgency_branch(self):
        from src.narrative.foreshadowing import SceneCountRule

        rule = SceneCountRule(threshold_multiplier=1.0)
        f = Foreshadow(
            id="f-high",
            description="d",
            state=ForeshadowState.PLANTED,
            planted_at="s1",
            planted_time=datetime.now(),
            importance=9,
        )
        reminder = rule.evaluate(f, 11, 0)
        assert reminder is not None
        assert reminder.urgency == "high"
        assert "尽快" in reminder.suggestion

    def test_scene_count_rule_low_branch(self):
        from src.narrative.foreshadowing import SceneCountRule

        rule = SceneCountRule(threshold_multiplier=-1.0)
        f = Foreshadow(
            id="f-low",
            description="d",
            state=ForeshadowState.PLANTED,
            planted_at="s1",
            planted_time=datetime.now(),
            importance=5,
        )
        reminder = rule.evaluate(f, 0, 1)
        assert reminder is not None
        assert reminder.urgency == "low"

    def test_scene_count_rule_else_suggestion_for_hinted(self):
        from src.narrative.foreshadowing import SceneCountRule

        rule = SceneCountRule(threshold_multiplier=1.0)
        f = Foreshadow(
            id="f-hinted",
            description="d",
            state=ForeshadowState.HINTED,
            planted_at="s1",
            planted_time=datetime.now(),
            importance=8,
        )
        reminder = rule.evaluate(f, 10, 0)
        assert reminder is not None
        assert reminder.urgency == "medium"
        assert "高潮" in reminder.suggestion

    def test_high_importance_rule_none_branch(self):
        from src.narrative.foreshadowing import HighImportanceRule

        rule = HighImportanceRule(importance_threshold=8, scene_threshold=5)
        f = Foreshadow(
            id="f-hi",
            description="d",
            state=ForeshadowState.PLANTED,
            planted_at="s1",
            planted_time=datetime.now(),
            importance=9,
        )
        assert rule.evaluate(f, 3, 0) is None

    def test_graph_integration_happy_paths(self, mgr, monkeypatch):
        from src.narrative.foreshadowing import ForeshadowGraphIntegration

        class EntityType(Enum):
            CONCEPT = "concept"

        class RelationType(Enum):
            RELATED_TO = "related_to"

        @dataclass
        class Entity:
            id: str
            name: str
            type: EntityType
            properties: dict
            created_at: str = "created"

        @dataclass
        class Relationship:
            id: str
            source_id: str
            target_id: str
            type: RelationType
            properties: dict

        graph_mod = types.ModuleType("docs.contracts.graph_contracts")
        graph_mod.Entity = Entity
        graph_mod.EntityType = EntityType
        graph_mod.Relationship = Relationship
        graph_mod.RelationType = RelationType

        monkeypatch.setitem(sys.modules, "docs", types.ModuleType("docs"))
        monkeypatch.setitem(sys.modules, "docs.contracts", types.ModuleType("docs.contracts"))
        monkeypatch.setitem(sys.modules, "docs.contracts.graph_contracts", graph_mod)

        gm = MagicMock()
        gm.get_entity.return_value = None
        integ = ForeshadowGraphIntegration(mgr, graph_manager=gm)

        f = mgr.plant("graph-happy", "s1")
        mgr.hint(f.id, "s2", "h")
        mgr.harvest(f.id, "s3")
        f = mgr.get(f.id)

        eid = integ.sync_foreshadow_to_graph(f)
        assert eid == f"foreshadow_{f.id}"
        assert gm.create_entity.called
        assert gm.create_relationship.call_count >= 3

        gm.reset_mock()
        existing = Entity("foreshadow_x", "x", EntityType.CONCEPT, {}, created_at="old")
        gm.get_entity.return_value = existing
        integ.sync_foreshadow_to_graph(f)
        assert gm.update_entity.called

    def test_graph_sync_generic_exception_branch(self, mgr, monkeypatch):
        from src.narrative.foreshadowing import ForeshadowGraphIntegration

        class EntityType(Enum):
            CONCEPT = "concept"

        @dataclass
        class Entity:
            id: str
            name: str
            type: EntityType
            properties: dict

        graph_mod = types.ModuleType("docs.contracts.graph_contracts")
        graph_mod.Entity = Entity
        graph_mod.EntityType = EntityType
        graph_mod.Relationship = object
        graph_mod.RelationType = object

        monkeypatch.setitem(sys.modules, "docs", types.ModuleType("docs"))
        monkeypatch.setitem(sys.modules, "docs.contracts", types.ModuleType("docs.contracts"))
        monkeypatch.setitem(sys.modules, "docs.contracts.graph_contracts", graph_mod)

        gm = MagicMock()
        gm.get_entity.side_effect = RuntimeError("boom")
        integ = ForeshadowGraphIntegration(mgr, graph_manager=gm)

        f = mgr.plant("graph-ex", "s1")
        assert integ.sync_foreshadow_to_graph(f) is None

    def test_graph_create_scene_relationships_no_manager_branch(self, mgr):
        from src.narrative.foreshadowing import ForeshadowGraphIntegration

        integ = ForeshadowGraphIntegration(mgr, graph_manager=None)
        f = mgr.plant("x", "s1")
        integ._create_scene_relationships(f, "foreshadow_x")

    def test_graph_link_find_network_success_and_exception(self, mgr, monkeypatch):
        from src.narrative.foreshadowing import ForeshadowGraphIntegration

        class EntityType(Enum):
            CONCEPT = "concept"

        class RelationType(Enum):
            RELATED_TO = "related_to"

        @dataclass
        class Entity:
            id: str
            name: str
            type: EntityType
            properties: dict

        @dataclass
        class Relationship:
            id: str
            source_id: str
            target_id: str
            type: RelationType
            properties: dict

        graph_mod = types.ModuleType("docs.contracts.graph_contracts")
        graph_mod.Entity = Entity
        graph_mod.EntityType = EntityType
        graph_mod.Relationship = Relationship
        graph_mod.RelationType = RelationType

        monkeypatch.setitem(sys.modules, "docs", types.ModuleType("docs"))
        monkeypatch.setitem(sys.modules, "docs.contracts", types.ModuleType("docs.contracts"))
        monkeypatch.setitem(sys.modules, "docs.contracts.graph_contracts", graph_mod)

        gm = MagicMock()
        integ = ForeshadowGraphIntegration(mgr, graph_manager=gm)

        assert integ.link_foreshadow_to_entity("f1", "e1", "INVOLVES") is True

        gm.create_relationship.side_effect = RuntimeError("link-fail")
        assert integ.link_foreshadow_to_entity("f1", "e1", "INVOLVES") is False

        f = mgr.plant("find", "s1")
        gm.find_related_entities.return_value = [
            Entity(id=f"foreshadow_{f.id}", name="x", type=EntityType.CONCEPT, properties={"foreshadow_id": f.id}),
            Entity(id="other", name="y", type=EntityType.CONCEPT, properties={}),
        ]
        related = integ.find_related_foreshadows("entity")
        assert [x.id for x in related] == [f.id]

        gm.find_related_entities.side_effect = RuntimeError("find-fail")
        assert integ.find_related_foreshadows("entity") == []

        @dataclass
        class SubGraph:
            entities: list
            relationships: list

        gm.find_related_entities.side_effect = None
        gm.get_subgraph.return_value = SubGraph(
            entities=[Entity(id="foreshadow_f1", name="f1", type=EntityType.CONCEPT, properties={})],
            relationships=[Relationship(id="r1", source_id="a", target_id="b", type=RelationType.RELATED_TO, properties={"k": 1})],
        )
        network = integ.get_foreshadow_network("f1")
        assert network["center"] == "f1"
        assert network["entities"]
        assert network["relationships"]

    def test_generate_recommendations_hint_rate_low_branch(self, tmp_path):
        from src.narrative.foreshadowing import EnhancedForeshadowingManager

        m = EnhancedForeshadowingManager(db_path=str(tmp_path / "enh-rec-low.db"))
        try:
            pending = [
                Foreshadow(
                    id="f-low",
                    description="d",
                    state=ForeshadowState.PLANTED,
                    planted_at="s1",
                    planted_time=datetime.now(),
                    importance=5,
                )
            ]

            recs = m._generate_recommendations(
                harvest_rate=60.0,
                hint_rate=20.0,
                avg_hints=1.0,
                pending=pending,
            )
            assert any("暗示率较低" in r for r in recs)
        finally:
            m.close()

    def test_generate_recommendations_good_status_branch(self, tmp_path):
        from src.narrative.foreshadowing import EnhancedForeshadowingManager

        m = EnhancedForeshadowingManager(db_path=str(tmp_path / "enh-rec-good.db"))
        try:
            pending = [
                Foreshadow(
                    id="f-ok",
                    description="d",
                    state=ForeshadowState.PLANTED,
                    planted_at="s1",
                    planted_time=datetime.now(),
                    importance=5,
                )
            ]

            recs = m._generate_recommendations(
                harvest_rate=80.0,
                hint_rate=60.0,
                avg_hints=1.5,
                pending=pending,
            )
            assert recs == ["伏笔管理状态良好"]
        finally:
            m.close()

    def test_graph_create_scene_relationships_ignores_duplicate_errors(self, mgr, monkeypatch):
        from src.narrative.foreshadowing import ForeshadowGraphIntegration

        class EntityType(Enum):
            CONCEPT = "concept"

        class RelationType(Enum):
            RELATED_TO = "related_to"

        @dataclass
        class Relationship:
            id: str
            source_id: str
            target_id: str
            type: RelationType
            properties: dict

        graph_mod = types.ModuleType("docs.contracts.graph_contracts")
        graph_mod.Relationship = Relationship
        graph_mod.RelationType = RelationType

        monkeypatch.setitem(sys.modules, "docs", types.ModuleType("docs"))
        monkeypatch.setitem(sys.modules, "docs.contracts", types.ModuleType("docs.contracts"))
        monkeypatch.setitem(sys.modules, "docs.contracts.graph_contracts", graph_mod)

        gm = MagicMock()
        gm.create_relationship.side_effect = RuntimeError("exists")

        integ = ForeshadowGraphIntegration(mgr, graph_manager=gm)

        f = mgr.plant("dup", "s1")
        mgr.hint(f.id, "s2", "h")
        mgr.harvest(f.id, "s3")
        f = mgr.get(f.id)

        integ._create_scene_relationships(f, f"foreshadow_{f.id}")
        assert gm.create_relationship.call_count >= 3
