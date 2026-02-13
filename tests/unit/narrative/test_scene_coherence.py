# -*- coding: utf-8 -*-
"""
Scene Coherence Detector Tests

Comprehensive tests for ContradictionType, Severity, TimeUnit enums,
TimeMarker, LocationMarker, StateSnapshot, Contradiction, Scene,
CoherenceReport dataclasses, and SceneCoherenceDetector pure logic methods.
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from src.narrative.scene_coherence import (
    ContradictionType,
    Severity,
    TimeUnit,
    TimeMarker,
    LocationMarker,
    StateSnapshot,
    Contradiction,
    Scene,
    CoherenceReport,
    SceneCoherenceDetector,
)


# ============================================================
# Enums
# ============================================================

class TestContradictionType:

    def test_values(self):
        assert ContradictionType.TIMELINE.value == "timeline"
        assert ContradictionType.LOCATION.value == "location"
        assert ContradictionType.CHARACTER_STATE.value == "char_state"
        assert ContradictionType.OBJECT_STATE.value == "obj_state"
        assert ContradictionType.ENVIRONMENT.value == "environment"
        assert ContradictionType.CAUSALITY.value == "causality"
        assert ContradictionType.KNOWLEDGE.value == "knowledge"
        assert ContradictionType.PHYSICS.value == "physics"

    def test_count(self):
        assert len(ContradictionType) == 8


class TestSeverity:

    def test_values(self):
        assert Severity.CRITICAL.value == "critical"
        assert Severity.MAJOR.value == "major"
        assert Severity.MINOR.value == "minor"
        assert Severity.INFO.value == "info"

    def test_count(self):
        assert len(Severity) == 4


class TestTimeUnit:

    def test_values(self):
        assert TimeUnit.SECOND.value == "second"
        assert TimeUnit.HOUR.value == "hour"
        assert TimeUnit.DAY.value == "day"
        assert TimeUnit.YEAR.value == "year"

    def test_count(self):
        assert len(TimeUnit) == 7


# ============================================================
# Dataclasses
# ============================================================

class TestTimeMarker:

    def test_defaults(self):
        tm = TimeMarker(scene_id="s1")
        assert tm.timestamp is None
        assert tm.relative_time is None
        assert tm.time_of_day is None
        assert tm.duration is None
        assert tm.order == 0

    def test_to_dict(self):
        ts = datetime(2025, 1, 1, 10, 0)
        tm = TimeMarker(scene_id="s1", timestamp=ts, time_of_day="morning", order=1)
        d = tm.to_dict()
        assert d["scene_id"] == "s1"
        assert d["timestamp"] == ts.isoformat()
        assert d["time_of_day"] == "morning"
        assert d["order"] == 1

    def test_to_dict_none_timestamp(self):
        tm = TimeMarker(scene_id="s1")
        d = tm.to_dict()
        assert d["timestamp"] is None
        assert d["duration"] is None


class TestLocationMarker:

    def test_defaults(self):
        lm = LocationMarker(scene_id="s1", location_name="北京")
        assert lm.location_type == ""
        assert lm.parent_location == ""
        assert lm.coordinates is None

    def test_to_dict(self):
        lm = LocationMarker(scene_id="s1", location_name="办公室",
                            location_type="indoor", parent_location="大厦")
        d = lm.to_dict()
        assert d["location_name"] == "办公室"
        assert d["location_type"] == "indoor"


class TestStateSnapshot:

    def test_basic(self):
        ss = StateSnapshot(
            scene_id="s1", entity_id="char_01",
            entity_type="character", entity_name="李明",
            properties={"status": "alive", "location": "北京"}
        )
        assert ss.entity_name == "李明"
        assert ss.properties["status"] == "alive"

    def test_to_dict(self):
        ss = StateSnapshot(
            scene_id="s1", entity_id="obj_01",
            entity_type="object", entity_name="宝剑",
            properties={"owner": "李明"}
        )
        d = ss.to_dict()
        assert d["entity_type"] == "object"
        assert d["properties"]["owner"] == "李明"


class TestContradiction:

    def test_basic(self):
        c = Contradiction(
            id="CTD-0001",
            type=ContradictionType.TIMELINE,
            severity=Severity.MAJOR,
            description="时间倒流",
            scene_a="s1", scene_b="s2",
        )
        assert c.entity_involved == ""
        assert c.suggestion == ""

    def test_to_dict(self):
        c = Contradiction(
            id="CTD-0001",
            type=ContradictionType.LOCATION,
            severity=Severity.CRITICAL,
            description="地点传送",
            scene_a="s1", scene_b="s2",
            suggestion="增加过渡场景",
        )
        d = c.to_dict()
        assert d["type"] == "location"
        assert d["severity"] == "critical"
        assert d["suggestion"] == "增加过渡场景"


class TestScene:

    def test_defaults(self):
        s = Scene(id="s1", title="开篇", content="故事开始", order=0)
        assert s.characters == []
        assert s.objects == []
        assert s.events == []
        assert s.chapter == ""

    def test_to_dict(self):
        s = Scene(id="s1", title="开篇", content="故事开始", order=0,
                  characters=["李明"], objects=["宝剑"])
        d = s.to_dict()
        assert d["id"] == "s1"
        assert d["characters"] == ["李明"]
        assert d["time_marker"] is None


class TestCoherenceReport:

    def test_basic(self):
        r = CoherenceReport(
            total_scenes=5,
            total_contradictions=2,
            critical_count=1,
            major_count=1,
            minor_count=0,
            info_count=0,
            contradictions=[],
            timeline_issues=[],
            location_issues=[],
            state_issues=[],
            coherence_score=85.0,
            summary="测试摘要",
        )
        assert r.total_scenes == 5
        assert r.coherence_score == 85.0

    def test_to_dict(self):
        r = CoherenceReport(
            total_scenes=3,
            total_contradictions=0,
            critical_count=0,
            major_count=0,
            minor_count=0,
            info_count=0,
            contradictions=[],
            timeline_issues=[],
            location_issues=[],
            state_issues=[],
            coherence_score=100.0,
            summary="完美",
        )
        d = r.to_dict()
        assert d["by_severity"]["critical"] == 0
        assert d["coherence_score"] == 100.0
        assert "generated_at" in d


# ============================================================
# SceneCoherenceDetector - Init & Scene Management
# ============================================================

class TestSceneCoherenceDetectorInit:

    def test_init_no_llm(self):
        d = SceneCoherenceDetector()
        assert d.llm is None
        assert d.scenes == {}
        assert d.contradictions == []

    def test_add_scene(self):
        d = SceneCoherenceDetector()
        s = Scene(id="s1", title="T", content="C", order=0)
        d.add_scene(s)
        assert "s1" in d.scenes
        assert d.scenes["s1"].title == "T"

    def test_create_scene_basic(self):
        d = SceneCoherenceDetector()
        s = d.create_scene("s1", "开场", "内容", 0)
        assert s.id == "s1"
        assert d.get_scene("s1") is s

    def test_create_scene_with_time_info(self):
        d = SceneCoherenceDetector()
        s = d.create_scene(
            "s1", "早晨", "内容", 0,
            time_info={"relative_time": "一小时后", "time_of_day": "morning"}
        )
        assert s.time_marker is not None
        assert s.time_marker.time_of_day == "morning"
        assert s.time_marker.relative_time == "一小时后"

    def test_create_scene_with_location_info(self):
        d = SceneCoherenceDetector()
        s = d.create_scene(
            "s1", "到达", "内容", 0,
            location_info={"name": "北京", "type": "outdoor", "parent": "中国"}
        )
        assert s.location_marker is not None
        assert s.location_marker.location_name == "北京"
        assert s.location_marker.location_type == "outdoor"

    def test_create_scene_with_characters_objects(self):
        d = SceneCoherenceDetector()
        s = d.create_scene("s1", "T", "C", 0,
                           characters=["李明", "王芳"],
                           objects=["宝剑"])
        assert s.characters == ["李明", "王芳"]
        assert s.objects == ["宝剑"]

    def test_get_scene_not_found(self):
        d = SceneCoherenceDetector()
        assert d.get_scene("nonexistent") is None

    def test_get_ordered_scenes(self):
        d = SceneCoherenceDetector()
        d.create_scene("s3", "T3", "C3", 3)
        d.create_scene("s1", "T1", "C1", 1)
        d.create_scene("s2", "T2", "C2", 2)
        ordered = d.get_ordered_scenes()
        assert [s.id for s in ordered] == ["s1", "s2", "s3"]


# ============================================================
# State Tracking
# ============================================================

class TestStateTracking:

    def test_record_state(self):
        d = SceneCoherenceDetector()
        d.create_scene("s1", "T", "C", 0)
        ss = d.record_state("s1", "c1", "character", "李明",
                            {"status": "alive"})
        assert ss.entity_name == "李明"
        assert d.get_entity_states("c1") == [ss]

    def test_record_state_appends_to_scene(self):
        d = SceneCoherenceDetector()
        d.create_scene("s1", "T", "C", 0)
        d.record_state("s1", "c1", "character", "李明", {"status": "alive"})
        scene = d.get_scene("s1")
        assert len(scene.state_snapshots) == 1

    def test_record_state_no_scene(self):
        d = SceneCoherenceDetector()
        ss = d.record_state("nonexistent", "c1", "character", "李明", {})
        assert ss.entity_id == "c1"
        # No error, just doesn't append to scene

    def test_get_entity_states_empty(self):
        d = SceneCoherenceDetector()
        assert d.get_entity_states("nonexistent") == []

    def test_multiple_states_same_entity(self):
        d = SceneCoherenceDetector()
        d.create_scene("s1", "T1", "C1", 0)
        d.create_scene("s2", "T2", "C2", 1)
        d.record_state("s1", "c1", "character", "李明", {"status": "alive"})
        d.record_state("s2", "c1", "character", "李明", {"status": "injured"})
        states = d.get_entity_states("c1")
        assert len(states) == 2


# ============================================================
# Location Graph
# ============================================================

class TestLocationGraph:

    def test_set_travel_time_bidirectional(self):
        d = SceneCoherenceDetector()
        d.set_travel_time("北京", "上海", timedelta(hours=5))
        assert d.get_travel_time("北京", "上海") == timedelta(hours=5)
        assert d.get_travel_time("上海", "北京") == timedelta(hours=5)

    def test_set_travel_time_unidirectional(self):
        d = SceneCoherenceDetector()
        d.set_travel_time("A", "B", timedelta(hours=1), bidirectional=False)
        assert d.get_travel_time("A", "B") == timedelta(hours=1)
        assert d.get_travel_time("B", "A") is None

    def test_get_travel_time_not_set(self):
        d = SceneCoherenceDetector()
        assert d.get_travel_time("X", "Y") is None


# ============================================================
# Time Helpers
# ============================================================

class TestTimeHelpers:

    def test_is_valid_time_progression_forward(self):
        d = SceneCoherenceDetector()
        assert d._is_valid_time_progression("morning", "afternoon") is True
        assert d._is_valid_time_progression("afternoon", "evening") is True
        assert d._is_valid_time_progression("evening", "night") is True

    def test_is_valid_time_progression_same(self):
        d = SceneCoherenceDetector()
        assert d._is_valid_time_progression("morning", "morning") is True

    def test_is_valid_time_progression_backward(self):
        d = SceneCoherenceDetector()
        assert d._is_valid_time_progression("evening", "morning") is False
        assert d._is_valid_time_progression("night", "afternoon") is False

    def test_is_valid_time_progression_night_to_morning(self):
        d = SceneCoherenceDetector()
        assert d._is_valid_time_progression("night", "morning") is True

    def test_is_valid_time_progression_unknown(self):
        d = SceneCoherenceDetector()
        assert d._is_valid_time_progression("unknown", "morning") is True

    def test_normalize_time_of_day(self):
        d = SceneCoherenceDetector()
        assert d._normalize_time_of_day("早上") == "morning"
        assert d._normalize_time_of_day("下午") == "afternoon"
        assert d._normalize_time_of_day("傍晚") == "evening"
        assert d._normalize_time_of_day("深夜") == "night"

    def test_normalize_time_of_day_english(self):
        d = SceneCoherenceDetector()
        assert d._normalize_time_of_day("morning") == "morning"
        assert d._normalize_time_of_day("night") == "night"

    def test_normalize_time_of_day_unknown(self):
        d = SceneCoherenceDetector()
        assert d._normalize_time_of_day("随机") is None

    def test_extract_time_expressions(self):
        d = SceneCoherenceDetector()
        times = d._extract_time_expressions("下午3点他出发了")
        assert any("3点" in t for t in times)

    def test_extract_time_expressions_none(self):
        d = SceneCoherenceDetector()
        times = d._extract_time_expressions("没有时间信息")
        assert times == []

    def test_parse_hour_from_expressions(self):
        d = SceneCoherenceDetector()
        assert d._parse_hour_from_expressions(["3点"]) == 3
        assert d._parse_hour_from_expressions(["15:30"]) == 15

    def test_parse_hour_pm(self):
        d = SceneCoherenceDetector()
        assert d._parse_hour_from_expressions(["下午3点"]) == 15

    def test_parse_hour_none(self):
        d = SceneCoherenceDetector()
        assert d._parse_hour_from_expressions(["没有时间"]) is None

    def test_extract_time_period(self):
        d = SceneCoherenceDetector()
        assert d._extract_time_period("早上他出门了") == "morning"
        assert d._extract_time_period("夜晚降临") == "night"
        assert d._extract_time_period("下午开会") == "afternoon"

    def test_extract_time_period_none(self):
        d = SceneCoherenceDetector()
        assert d._extract_time_period("他走了") is None

    def test_has_day_change_indicator(self):
        d = SceneCoherenceDetector()
        assert d._has_day_change_indicator("晚上", "第二天早上") is True
        assert d._has_day_change_indicator("", "次日清晨") is True

    def test_has_day_change_indicator_none(self):
        d = SceneCoherenceDetector()
        assert d._has_day_change_indicator("晚上", "早上") is False


# ============================================================
# Coherence Score & Summary
# ============================================================

class TestCoherenceScoreAndSummary:

    def test_score_no_scenes(self):
        d = SceneCoherenceDetector()
        assert d._calculate_coherence_score(0, 0, 0, 0) == 100.0

    def test_score_no_issues(self):
        d = SceneCoherenceDetector()
        d.create_scene("s1", "T", "C", 0)
        assert d._calculate_coherence_score(0, 0, 0, 0) == 100.0

    def test_score_with_critical(self):
        d = SceneCoherenceDetector()
        d.create_scene("s1", "T", "C", 0)
        d.create_scene("s2", "T", "C", 1)
        score = d._calculate_coherence_score(1, 0, 0, 0)
        assert score < 100.0

    def test_score_floor_at_zero(self):
        d = SceneCoherenceDetector()
        d.create_scene("s1", "T", "C", 0)
        score = d._calculate_coherence_score(10, 10, 10, 10)
        assert score == 0.0

    def test_summary_no_issues(self):
        d = SceneCoherenceDetector()
        summary = d._generate_summary([], 100.0)
        assert "未检测到矛盾" in summary

    def test_summary_critical(self):
        d = SceneCoherenceDetector()
        c = Contradiction(id="1", type=ContradictionType.TIMELINE,
                          severity=Severity.CRITICAL, description="",
                          scene_a="s1", scene_b="s2")
        summary = d._generate_summary([c], 50.0)
        assert "严重矛盾" in summary

    def test_summary_major(self):
        d = SceneCoherenceDetector()
        c = Contradiction(id="1", type=ContradictionType.TIMELINE,
                          severity=Severity.MAJOR, description="",
                          scene_a="s1", scene_b="s2")
        summary = d._generate_summary([c], 80.0)
        assert "主要矛盾" in summary

    def test_summary_minor_only(self):
        d = SceneCoherenceDetector()
        c = Contradiction(id="1", type=ContradictionType.TIMELINE,
                          severity=Severity.MINOR, description="",
                          scene_a="s1", scene_b="s2")
        summary = d._generate_summary([c], 95.0)
        assert "轻微问题" in summary


# ============================================================
# Timeline Contradiction Detection
# ============================================================

class TestTimelineDetection:

    def test_no_scenes(self):
        d = SceneCoherenceDetector()
        issues = d._detect_timeline_contradictions()
        assert issues == []

    def test_valid_progression(self):
        d = SceneCoherenceDetector()
        d.create_scene("s1", "早晨", "早上出门", 0,
                        time_info={"time_of_day": "morning"})
        d.create_scene("s2", "下午", "下午开会", 1,
                        time_info={"time_of_day": "afternoon"})
        issues = d._detect_timeline_contradictions()
        assert len(issues) == 0

    def test_invalid_progression(self):
        d = SceneCoherenceDetector()
        d.create_scene("s1", "晚上", "夜晚", 0,
                        time_info={"time_of_day": "night"})
        d.create_scene("s2", "下午", "下午", 1,
                        time_info={"time_of_day": "afternoon"})
        issues = d._detect_timeline_contradictions()
        assert len(issues) >= 1
        assert issues[0].type == ContradictionType.TIMELINE

    def test_content_time_contradiction(self):
        d = SceneCoherenceDetector()
        d.create_scene("s1", "T1", "下午3点他出发了", 0)
        d.create_scene("s2", "T2", "2点他到达了", 1)
        issues = d._detect_timeline_contradictions()
        # Time flows backward: 3点 -> 2点
        assert any(c.type == ContradictionType.TIMELINE for c in issues)


# ============================================================
# Location Contradiction Detection
# ============================================================

class TestLocationDetection:

    def test_no_issues_same_location(self):
        d = SceneCoherenceDetector()
        d.create_scene("s1", "T1", "C1", 0,
                        location_info={"name": "北京"})
        d.create_scene("s2", "T2", "C2", 1,
                        location_info={"name": "北京"})
        issues = d._detect_location_contradictions()
        assert len(issues) == 0

    def test_teleportation_detected(self):
        d = SceneCoherenceDetector()
        d.set_travel_time("北京", "上海", timedelta(hours=5))
        d.create_scene("s1", "T1", "C1", 0,
                        time_info={"time_of_day": "morning"},
                        location_info={"name": "北京"})
        d.create_scene("s2", "T2", "C2", 1,
                        time_info={"time_of_day": "morning"},
                        location_info={"name": "上海"})
        # Set duration shorter than travel time
        d.scenes["s1"].time_marker.duration = timedelta(hours=1)
        issues = d._detect_location_contradictions()
        assert len(issues) == 1
        assert issues[0].severity == Severity.CRITICAL

    def test_no_travel_time_defined(self):
        d = SceneCoherenceDetector()
        d.create_scene("s1", "T1", "C1", 0,
                        location_info={"name": "A"})
        d.create_scene("s2", "T2", "C2", 1,
                        location_info={"name": "B"})
        # No travel time registered, no issue reported
        issues = d._detect_location_contradictions()
        assert len(issues) == 0


# ============================================================
# State Contradiction Detection
# ============================================================

class TestStateDetection:

    def test_character_death_resurrection(self):
        d = SceneCoherenceDetector()
        d.create_scene("s1", "T1", "C1", 0)
        d.create_scene("s2", "T2", "C2", 1)
        d.record_state("s1", "c1", "character", "李明", {"status": "dead"})
        d.record_state("s2", "c1", "character", "李明", {"status": "alive"})
        issues = d._detect_state_contradictions()
        assert len(issues) == 1
        assert issues[0].severity == Severity.CRITICAL
        assert issues[0].type == ContradictionType.CHARACTER_STATE

    def test_object_destroyed_reappears(self):
        d = SceneCoherenceDetector()
        d.create_scene("s1", "T1", "C1", 0)
        d.create_scene("s2", "T2", "C2", 1)
        d.record_state("s1", "o1", "object", "宝剑", {"destroyed": True})
        d.record_state("s2", "o1", "object", "宝剑", {"exists": True})
        issues = d._detect_state_contradictions()
        assert len(issues) == 1
        assert issues[0].type == ContradictionType.OBJECT_STATE

    def test_no_contradiction_normal_transition(self):
        d = SceneCoherenceDetector()
        d.create_scene("s1", "T1", "C1", 0)
        d.create_scene("s2", "T2", "C2", 1)
        d.record_state("s1", "c1", "character", "李明", {"status": "alive"})
        d.record_state("s2", "c1", "character", "李明", {"status": "injured"})
        issues = d._detect_state_contradictions()
        assert len(issues) == 0

    def test_single_snapshot_no_issues(self):
        d = SceneCoherenceDetector()
        d.create_scene("s1", "T1", "C1", 0)
        d.record_state("s1", "c1", "character", "李明", {"status": "alive"})
        issues = d._detect_state_contradictions()
        assert len(issues) == 0

    def test_object_ownership_change_without_transfer_in_state_detection(self):
        d = SceneCoherenceDetector()
        d.create_scene("s1", "T1", "C1", 0)
        d.create_scene("s2", "T2", "C2", 1)
        d.create_scene("s3", "T3", "C3", 2)
        d.record_state("s1", "o1", "object", "宝剑", {"owner": "李明"})
        d.record_state("s3", "o1", "object", "宝剑", {"owner": "王芳"})

        issues = d._detect_state_contradictions()

        assert len(issues) == 1
        assert issues[0].type == ContradictionType.OBJECT_STATE
        assert "所有权" in issues[0].description

    def test_object_ownership_change_with_transfer_in_state_detection(self):
        d = SceneCoherenceDetector()
        d.create_scene("s1", "T1", "C1", 0)
        d.create_scene("s2", "T2", "C2", 1)
        d.scenes["s2"].events = ["李明将宝剑交给了王芳"]
        d.create_scene("s3", "T3", "C3", 2)
        d.record_state("s1", "o1", "object", "宝剑", {"owner": "李明"})
        d.record_state("s3", "o1", "object", "宝剑", {"owner": "王芳"})

        issues = d._detect_state_contradictions()

        assert len(issues) == 0


# ============================================================
# Causality Detection
# ============================================================

class TestCausalityDetection:

    def test_no_scenes(self):
        d = SceneCoherenceDetector()
        issues = d._detect_causality_contradictions()
        assert issues == []

    def test_single_scene(self):
        d = SceneCoherenceDetector()
        d.create_scene("s1", "T", "C", 0)
        issues = d._detect_causality_contradictions()
        assert issues == []

    def test_death_then_action(self):
        d = SceneCoherenceDetector()
        d.create_scene("s1", "T1", "李明死亡了", 0)
        d.create_scene("s2", "T2", "李明说道你好", 1)
        issues = d._detect_causality_contradictions()
        # Should detect: 李明 died in s1 but speaks in s2
        assert len(issues) >= 1

    def test_event_order_contradiction(self):
        d = SceneCoherenceDetector()
        # Within same scene: death before birth
        d.create_scene("s1", "T", "他死亡了然后出生了", 0,
                        characters=["他"])
        d.scenes["s1"].events = []
        issues = d._detect_event_order_contradictions(d.get_ordered_scenes())
        # "死亡" appears before "出生" in text
        assert len(issues) >= 1

    def test_extract_causal_relations(self):
        d = SceneCoherenceDetector()
        cause_kw = [r"因为"]
        effect_kw = [r"所以"]
        text = "因为下雨了路面湿滑，所以他摔倒了不幸受伤"
        relations = d._extract_causal_relations(text, cause_kw, effect_kw)
        assert len(relations) >= 1


# ============================================================
# Entity/Context Helpers
# ============================================================

class TestEntityHelpers:

    def test_get_entity_context(self):
        d = SceneCoherenceDetector()
        content = "很久以前李明在北京生活，他每天早起锻炼"
        ctx = d._get_entity_context(content, "李明", window=10)
        assert "李明" in ctx

    def test_get_entity_context_not_found(self):
        d = SceneCoherenceDetector()
        ctx = d._get_entity_context("没有这个人", "王芳")
        assert ctx == ""

    def test_get_context_around(self):
        d = SceneCoherenceDetector()
        content = "0123456789ABCDEFGHIJ"
        ctx = d._get_context_around(content, 10, window=5)
        assert len(ctx) <= 10


# ============================================================
# detect_all Integration
# ============================================================

class TestDetectAll:

    def test_empty_detector(self):
        d = SceneCoherenceDetector()
        report = d.detect_all()
        assert report.total_scenes == 0
        assert report.total_contradictions == 0
        assert report.coherence_score == 100.0

    def test_clean_scenes(self):
        d = SceneCoherenceDetector()
        d.create_scene("s1", "开始", "早上出门", 0,
                        time_info={"time_of_day": "morning"},
                        location_info={"name": "家"})
        d.create_scene("s2", "中午", "下午到达", 1,
                        time_info={"time_of_day": "afternoon"},
                        location_info={"name": "家"})
        report = d.detect_all()
        assert report.total_scenes == 2
        assert report.total_contradictions == 0

    def test_with_contradictions(self):
        d = SceneCoherenceDetector()
        d.create_scene("s1", "T1", "C1", 0)
        d.create_scene("s2", "T2", "C2", 1)
        d.record_state("s1", "c1", "character", "李明", {"status": "dead"})
        d.record_state("s2", "c1", "character", "李明", {"status": "alive"})
        report = d.detect_all()
        assert report.total_contradictions >= 1
        assert report.coherence_score < 100.0

    def test_report_to_dict(self):
        d = SceneCoherenceDetector()
        d.create_scene("s1", "T", "C", 0)
        report = d.detect_all()
        d_dict = report.to_dict()
        assert "total_scenes" in d_dict
        assert "by_severity" in d_dict
        assert "coherence_score" in d_dict


# ============================================================
# Cross-Scene Validation
# ============================================================

class TestCrossSceneValidation:

    def test_validate_character_presence_no_states(self):
        d = SceneCoherenceDetector()
        issues = d.validate_character_presence("nonexistent")
        assert issues == []

    def test_validate_object_tracking_no_states(self):
        d = SceneCoherenceDetector()
        issues = d.validate_object_tracking("nonexistent")
        assert issues == []

    def test_validate_object_ownership_change_without_transfer(self):
        d = SceneCoherenceDetector()
        # Create 4 scenes with gap
        d.create_scene("s1", "T1", "C1", 0)
        d.create_scene("s2", "T2", "C2", 1)
        d.create_scene("s3", "T3", "C3", 2)
        d.create_scene("s4", "T4", "C4", 3)
        d.record_state("s1", "o1", "object", "宝剑", {"owner": "李明"})
        d.record_state("s4", "o1", "object", "宝剑", {"owner": "王芳"})
        issues = d.validate_object_tracking("o1")
        assert len(issues) == 1
        assert "所有权" in issues[0].description

    def test_validate_object_ownership_with_transfer_event(self):
        d = SceneCoherenceDetector()
        d.create_scene("s1", "T1", "C1", 0)
        d.create_scene("s2", "T2", "C2", 1)
        d.scenes["s2"].events = ["李明将宝剑交给了王芳"]  # Transfer event
        d.create_scene("s3", "T3", "C3", 2)
        d.record_state("s1", "o1", "object", "宝剑", {"owner": "李明"})
        d.record_state("s3", "o1", "object", "宝剑", {"owner": "王芳"})
        issues = d.validate_object_tracking("o1")
        # "交给" keyword found in intermediate event
        assert len(issues) == 0


# ============================================================
# Deep Analysis (LLM mock)
# ============================================================

class TestDeepAnalysis:

    def test_mock_deep_analysis_no_llm(self):
        d = SceneCoherenceDetector()
        result = asyncio.get_event_loop().run_until_complete(
            d.deep_analysis()
        )
        assert "contradictions_found" in result
        assert "suggestions" in result

    def test_mock_deep_analysis_with_scene_ids(self):
        d = SceneCoherenceDetector()
        d.create_scene("s1", "T", "C", 0)
        result = asyncio.get_event_loop().run_until_complete(
            d.deep_analysis(["s1"])
        )
        # Still returns mock since no LLM
        assert "contradictions_found" in result


# ============================================================
# Export
# ============================================================

class TestExport:

    def test_export_empty(self):
        d = SceneCoherenceDetector()
        data = d.export_data()
        assert data["scenes"] == {}
        assert data["state_registry"] == {}
        assert data["contradictions"] == []
        assert "exported_at" in data

    def test_export_with_data(self):
        d = SceneCoherenceDetector()
        d.create_scene("s1", "T", "C", 0)
        d.record_state("s1", "c1", "character", "李明", {"status": "alive"})
        d.set_travel_time("A", "B", timedelta(hours=1))
        data = d.export_data()
        assert "s1" in data["scenes"]
        assert "c1" in data["state_registry"]
        assert "A" in data["location_graph"]
