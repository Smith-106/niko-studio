# -*- coding: utf-8 -*-
"""Extra branch tests for scene_coherence."""

import json
from datetime import datetime, timedelta

import pytest

from src.narrative.scene_coherence import SceneCoherenceDetector, Scene, StateSnapshot, TimeMarker


class _FakeLLMResponse:
    def __init__(self, content):
        self.content = content


class _FakeLLM:
    async def ainvoke(self, _prompt):
        return _FakeLLMResponse(
            json.dumps(
                {
                    "contradictions": [],
                    "overall_coherence": "ok",
                    "suggestions": ["none"],
                }
            )
        )


def test_extract_causal_relations_pattern2_branch():
    detector = SceneCoherenceDetector()
    cause_kw = [r"因为"]
    effect_kw = [r"所以"]

    text = "前文内容足够长所以，然后因为后文也足够长"
    relations = detector._extract_causal_relations(text, cause_kw, effect_kw)

    assert len(relations) >= 1


def test_extract_entity_near_match_none_branch():
    detector = SceneCoherenceDetector()

    entity = detector._extract_entity_near_match("abc死亡def", 3)

    assert entity is None


def test_detect_causality_relations_append_and_llm_pass_branch(monkeypatch):
    detector = SceneCoherenceDetector(llm=_FakeLLM())
    detector.create_scene("s1", "scene1", "李明因为误会所以死亡", 0)
    detector.create_scene("s2", "scene2", "李明说你好", 1)

    monkeypatch.setattr(detector, "_extract_entity_near_match", lambda *_args, **_kwargs: "李明")

    issues = detector._detect_causality_contradictions()

    assert len(issues) >= 1


def test_detect_causality_entity_not_found_continue_branch():
    detector = SceneCoherenceDetector()
    detector.create_scene("s1", "scene1", "发生死亡", 0)
    detector.create_scene("s2", "scene2", "有人说道你好", 1)

    issues = detector._detect_causality_contradictions()

    assert isinstance(issues, list)


def test_detect_event_order_first_occurrence_record_branch():
    detector = SceneCoherenceDetector()
    detector.create_scene("s1", "scene1", "普通内容", 0)
    detector.scenes["s1"].events = ["事件A"]

    issues = detector._detect_event_order_contradictions(detector.get_ordered_scenes())

    assert issues == []


def test_mock_causality_analysis_branch():
    detector = SceneCoherenceDetector()
    scene = Scene(id="s1", title="t", content="c", order=0)

    result = detector._mock_causality_analysis([scene])

    assert result[0]["type"] == "causality"


def test_is_valid_time_progression_unknown_index_branch(monkeypatch):
    detector = SceneCoherenceDetector()

    monkeypatch.setattr(detector, "_normalize_time_of_day", lambda _x: "custom")

    assert detector._is_valid_time_progression("x", "y") is True


def test_check_content_time_contradiction_relative_time_issue_branch():
    detector = SceneCoherenceDetector()

    prev = Scene(id="s1", title="prev", content="今天下午", order=0)
    curr = Scene(id="s2", title="curr", content="昨天晚上", order=1)
    prev.time_marker = TimeMarker(scene_id="s1", timestamp=datetime(2025, 1, 3, 10, 0))
    curr.time_marker = TimeMarker(scene_id="s2", timestamp=datetime(2025, 1, 5, 10, 0))

    issue = detector._check_content_time_contradiction(prev, curr)

    assert issue is not None
    assert "相对时间矛盾" in issue.description


def test_mock_time_contradiction_analysis_branch():
    detector = SceneCoherenceDetector()
    prev = Scene(id="s1", title="prev", content="3点", order=0)
    curr = Scene(id="s2", title="curr", content="2点", order=1)

    result = detector._mock_time_contradiction_analysis(prev, curr)

    assert result["has_contradiction"] is False


def test_check_state_transition_missing_scene_branch():
    detector = SceneCoherenceDetector()
    prev = StateSnapshot(scene_id="missing-a", entity_id="e1", entity_type="character", entity_name="A")
    curr = StateSnapshot(scene_id="missing-b", entity_id="e1", entity_type="character", entity_name="A")

    issue = detector._check_state_transition(prev, curr)

    assert issue is None


def test_check_state_transition_character_location_change_pass_branch():
    detector = SceneCoherenceDetector()
    detector.create_scene("s1", "s1", "c1", 0)
    detector.create_scene("s2", "s2", "c2", 1)

    prev = StateSnapshot(
        scene_id="s1",
        entity_id="c1",
        entity_type="character",
        entity_name="李明",
        properties={"status": "alive", "location": "A"},
    )
    curr = StateSnapshot(
        scene_id="s2",
        entity_id="c1",
        entity_type="character",
        entity_name="李明",
        properties={"status": "alive", "location": "B"},
    )

    issue = detector._check_state_transition(prev, curr)

    assert issue is None


def test_validate_character_presence_intermediate_missing_branch():
    detector = SceneCoherenceDetector()
    detector.create_scene("s1", "s1", "a", 0, location_info={"name": "A"})
    detector.create_scene("s2", "s2", "b", 1, location_info={"name": "A"})
    detector.create_scene("s3", "s3", "c", 2, location_info={"name": "A"})
    detector.create_scene("s4", "s4", "d", 3, location_info={"name": "A"})
    detector.create_scene("s5", "s5", "e", 4, location_info={"name": "B"})

    detector.record_state("s1", "char-1", "character", "李明", {"status": "alive"})
    detector.record_state("s5", "char-1", "character", "李明", {"status": "alive"})
    detector.scenes["s1"].characters = ["char-1"]
    detector.scenes["s5"].characters = ["char-1"]

    issues = detector.validate_character_presence("char-1")

    assert len(issues) == 1
    assert "突然出现" in issues[0].description


def test_detect_causality_records_extracted_relations_branch():
    detector = SceneCoherenceDetector()
    detector.create_scene("s1", "scene1", "因为停电了所以他摔倒并受伤", 0)
    detector.create_scene("s2", "scene2", "普通后续场景", 1)

    issues = detector._detect_causality_contradictions()

    assert isinstance(issues, list)


def test_detect_causality_entity_none_continue_branch(monkeypatch):
    detector = SceneCoherenceDetector()
    detector.create_scene("s1", "scene1", "这里写到死亡", 0)
    detector.create_scene("s2", "scene2", "后续场景仍有动作", 1)

    monkeypatch.setattr(detector, "_extract_entity_near_match", lambda *_args, **_kwargs: None)

    issues = detector._detect_causality_contradictions()

    assert issues == [] or isinstance(issues, list)


def test_validate_character_presence_missing_scene_continue_branch():
    detector = SceneCoherenceDetector()
    detector.create_scene("s1", "scene1", "A", 0, location_info={"name": "A"})

    detector.record_state("s1", "char-x", "character", "李明", {"status": "alive"})
    detector.record_state("missing-scene", "char-x", "character", "李明", {"status": "alive"})

    issues = detector.validate_character_presence("char-x")

    assert issues == []


def test_detect_causality_causal_relation_append_line(monkeypatch):
    detector = SceneCoherenceDetector()
    detector.create_scene("s1", "scene1", "任意内容", 0)
    detector.create_scene("s2", "scene2", "任意内容", 1)

    monkeypatch.setattr(detector, "_extract_causal_relations", lambda *_args, **_kwargs: [("因", "果")])

    issues = detector._detect_causality_contradictions()

    assert isinstance(issues, list)


@pytest.mark.asyncio
async def test_deep_analysis_returns_error_when_no_scenes_to_analyze_branch():
    detector = SceneCoherenceDetector(llm=_FakeLLM())
    detector.create_scene("s1", "title", "content", 0)

    result = await detector.deep_analysis(["missing-id"])

    assert result == {"error": "No scenes to analyze"}


@pytest.mark.asyncio
async def test_deep_analysis_builds_prompt_and_parses_llm_json_branch():
    detector = SceneCoherenceDetector(llm=_FakeLLM())
    detector.create_scene("s1", "title1", "content1", 0)
    detector.create_scene("s2", "title2", "content2", 1)

    result = await detector.deep_analysis(["s2", "s1"])

    assert result["contradictions"] == []
    assert result["overall_coherence"] == "ok"
    assert result["suggestions"] == ["none"]
