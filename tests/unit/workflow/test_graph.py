# -*- coding: utf-8 -*-
"""
Graph Module Tests

Tests for DistillationTemplate, DistillationState, DistillationNode,
should_distill, route_after_distillation, create_distillation_node,
distillation_node function.
"""

import pytest
from unittest.mock import MagicMock, patch
from src.workflow.graph import (
    DistillationTemplate,
    DistillationState,
    DistillationNode,
    should_distill,
    route_after_distillation,
    create_distillation_node,
    distillation_node,
)


# ============================================================
# DistillationTemplate
# ============================================================

class TestDistillationTemplate:

    def test_values(self):
        assert DistillationTemplate.ENTITY_EXTRACTION.value == "entity_extraction"
        assert DistillationTemplate.RELATION_EXTRACTION.value == "relation_extraction"
        assert DistillationTemplate.EVENT_EXTRACTION.value == "event_extraction"
        assert DistillationTemplate.SUMMARY.value == "summary"
        assert DistillationTemplate.CHARACTER_ARC.value == "character_arc"
        assert DistillationTemplate.PLOT_STRUCTURE.value == "plot_structure"
        assert DistillationTemplate.FULL.value == "full"

    def test_from_string_entity(self):
        assert DistillationTemplate.from_string("entity") == DistillationTemplate.ENTITY_EXTRACTION
        assert DistillationTemplate.from_string("entities") == DistillationTemplate.ENTITY_EXTRACTION

    def test_from_string_relation(self):
        assert DistillationTemplate.from_string("relation") == DistillationTemplate.RELATION_EXTRACTION
        assert DistillationTemplate.from_string("relations") == DistillationTemplate.RELATION_EXTRACTION

    def test_from_string_event(self):
        assert DistillationTemplate.from_string("event") == DistillationTemplate.EVENT_EXTRACTION
        assert DistillationTemplate.from_string("events") == DistillationTemplate.EVENT_EXTRACTION

    def test_from_string_summary(self):
        assert DistillationTemplate.from_string("summary") == DistillationTemplate.SUMMARY

    def test_from_string_character(self):
        assert DistillationTemplate.from_string("character") == DistillationTemplate.CHARACTER_ARC
        assert DistillationTemplate.from_string("character_arc") == DistillationTemplate.CHARACTER_ARC

    def test_from_string_plot(self):
        assert DistillationTemplate.from_string("plot") == DistillationTemplate.PLOT_STRUCTURE
        assert DistillationTemplate.from_string("plot_structure") == DistillationTemplate.PLOT_STRUCTURE

    def test_from_string_full(self):
        assert DistillationTemplate.from_string("full") == DistillationTemplate.FULL
        assert DistillationTemplate.from_string("all") == DistillationTemplate.FULL

    def test_from_string_case_insensitive(self):
        assert DistillationTemplate.from_string("ENTITY") == DistillationTemplate.ENTITY_EXTRACTION
        assert DistillationTemplate.from_string("Summary") == DistillationTemplate.SUMMARY

    def test_from_string_unknown_defaults_full(self):
        assert DistillationTemplate.from_string("unknown") == DistillationTemplate.FULL
        assert DistillationTemplate.from_string("") == DistillationTemplate.FULL


# ============================================================
# DistillationState
# ============================================================

class TestDistillationState:

    def test_defaults(self):
        ds = DistillationState()
        assert ds.sources == []
        assert ds.template == DistillationTemplate.FULL
        assert ds.result == {}
        assert ds.scene_id == ""
        assert ds.chapter_num == 0
        assert ds.is_completed is False
        assert ds.error is None

    def test_custom(self):
        ds = DistillationState(
            sources=["text1"],
            template=DistillationTemplate.SUMMARY,
            scene_id="s1",
            chapter_num=3,
        )
        assert ds.sources == ["text1"]
        assert ds.template == DistillationTemplate.SUMMARY
        assert ds.scene_id == "s1"
        assert ds.chapter_num == 3

    def test_to_dict(self):
        ds = DistillationState(
            sources=["src"],
            template=DistillationTemplate.ENTITY_EXTRACTION,
            result={"entities": [{"name": "Alice"}]},
            scene_id="scene_1",
            chapter_num=2,
            is_completed=True,
        )
        d = ds.to_dict()
        assert d["sources"] == ["src"]
        assert d["template"] == "entity_extraction"
        assert d["is_completed"] is True
        assert d["scene_id"] == "scene_1"
        assert d["error"] is None

    def test_from_dict(self):
        data = {
            "sources": ["text"],
            "template": "summary",
            "result": {"summary": "test"},
            "scene_id": "s2",
            "chapter_num": 5,
            "is_completed": True,
            "error": None,
        }
        ds = DistillationState.from_dict(data)
        assert ds.sources == ["text"]
        assert ds.template == DistillationTemplate.SUMMARY
        assert ds.scene_id == "s2"
        assert ds.chapter_num == 5
        assert ds.is_completed is True

    def test_from_dict_defaults(self):
        ds = DistillationState.from_dict({})
        assert ds.sources == []
        assert ds.template == DistillationTemplate.FULL
        assert ds.scene_id == ""

    def test_roundtrip(self):
        original = DistillationState(
            sources=["a", "b"],
            template=DistillationTemplate.CHARACTER_ARC,
            result={"character_arcs": []},
            scene_id="sc",
            chapter_num=1,
            is_completed=False,
            error="some error",
        )
        restored = DistillationState.from_dict(original.to_dict())
        assert restored.sources == original.sources
        assert restored.template == original.template
        assert restored.scene_id == original.scene_id
        assert restored.error == original.error


# ============================================================
# DistillationNode
# ============================================================

class TestDistillationNode:

    def test_init_defaults(self):
        node = DistillationNode()
        assert node.template == DistillationTemplate.FULL
        assert node._knowledge_layer is None
        assert node._distill_service is None

    def test_init_custom(self):
        kl = MagicMock()
        ds = MagicMock()
        node = DistillationNode(
            template=DistillationTemplate.SUMMARY,
            knowledge_layer=kl,
            distill_service=ds,
        )
        assert node.template == DistillationTemplate.SUMMARY
        assert node._knowledge_layer is kl

    def test_process_empty_draft(self):
        node = DistillationNode()
        state = {"draft_content": ""}
        result = node.process(state)
        assert result is state  # unchanged

    def test_process_no_draft_key(self):
        node = DistillationNode()
        state = {}
        result = node.process(state)
        assert result is state

    def test_process_with_mock_services(self):
        kl = MagicMock()
        ds = MagicMock()
        ds.distill_chapter.return_value = {
            "entities": [{"name": "Alice"}],
            "relations": [
                {"source": "char-1", "target": "char-1", "type": "KNOWS"}
            ],
            "events": [{"event": "meeting"}],
        }
        ds.apply_to_graph = MagicMock()

        node = DistillationNode(
            template=DistillationTemplate.FULL,
            knowledge_layer=kl,
            distill_service=ds,
        )

        state = {
            "draft_content": "Alice met Bob in the park.",
            "current_scene": {"scene_id": "s1"},
            "current_chapter": 2,
        }

        result = node.process(state)
        assert result["distillation_result"]["entities_count"] == 1
        assert result["distillation_result"]["relations_count"] == 1
        assert result["distillation_result"]["events_count"] == 1
        assert result["distillation_result"]["template"] == "full"
        assert result["distillation_result"]["canonical_schema_version"] == "narrative_entity.v1"
        assert len(result["distillation_result"]["canonical_entities"]) == 1
        assert len(result["distillation_result"]["canonical_relations"]) == 1
        assert result["distillation_result"]["canonical_relations"][0]["relation_type"] == "KNOWS"
        assert "canonical_conflicts" in result["distillation_result"]
        assert len(result["distillation_result"]["canonical_conflicts"]) == 1
        assert result["distillation_result"]["canonical_conflicts"][0]["conflict_id"] == "CTD-0001"
        assert result["distillation_result"]["canonical_conflicts"][0]["severity"] == "critical"
        assert result["distillation_result"]["canonical_conflicts"][0]["critical_condition"] == "self_referential_non_identity_relation"
        assert "canonical_trace" in result["distillation_result"]
        assert "run_id" in result["distillation_result"]["canonical_trace"]
        assert "session_id" in result["distillation_result"]["canonical_trace"]
        assert result["distillation_result"]["canonical_trace"]["session_id"] == ""
        assert result["distillation_state"]["is_completed"] is True
        ds.apply_to_graph.assert_called_once()

    def test_process_entity_extraction(self):
        ds = MagicMock()
        ds.distill_chapter.return_value = {"entities": [{"name": "Bob"}]}
        ds.apply_to_graph = MagicMock()
        kl = MagicMock()

        node = DistillationNode(
            template=DistillationTemplate.ENTITY_EXTRACTION,
            knowledge_layer=kl,
            distill_service=ds,
        )
        state = {"draft_content": "Bob walked.", "current_scene": {}, "current_chapter": 1}
        result = node.process(state)
        assert len(result["distillation_result"]["entities"]) == 1

    def test_process_error_handling(self):
        ds = MagicMock()
        ds.distill_chapter.side_effect = RuntimeError("LLM error")
        kl = MagicMock()

        node = DistillationNode(
            template=DistillationTemplate.FULL,
            knowledge_layer=kl,
            distill_service=ds,
        )
        state = {"draft_content": "test content", "errors": []}
        result = node.process(state)
        assert any("Distillation warning" in e for e in result["errors"])
        assert result["distillation_state"]["error"] is not None

    def test_callable(self):
        ds = MagicMock()
        ds.distill_chapter.return_value = {"entities": [], "relations": [], "events": []}
        ds.apply_to_graph = MagicMock()
        kl = MagicMock()
        node = DistillationNode(knowledge_layer=kl, distill_service=ds)
        state = {"draft_content": "text"}
        result = node(state)
        assert "distillation_result" in result


# ============================================================
# should_distill
# ============================================================

class TestShouldDistill:

    def test_true_with_draft(self):
        state = {"draft_content": "some content", "config": {}}
        assert should_distill(state) is True

    def test_false_no_draft(self):
        state = {"draft_content": "", "config": {}}
        assert should_distill(state) is False

    def test_false_already_distilled(self):
        state = {
            "draft_content": "content",
            "distillation_result": {"entities": []},
            "config": {},
        }
        assert should_distill(state) is False

    def test_false_disabled(self):
        state = {
            "draft_content": "content",
            "config": {"enable_distillation": False},
        }
        assert should_distill(state) is False

    def test_true_enabled_explicitly(self):
        state = {
            "draft_content": "content",
            "config": {"enable_distillation": True},
        }
        assert should_distill(state) is True


# ============================================================
# route_after_distillation
# ============================================================

class TestRouteAfterDistillation:

    def test_default_route(self):
        state = {}
        assert route_after_distillation(state) == "critic"

    def test_with_error_still_critic(self):
        state = {"distillation_state": {"error": "some error"}}
        assert route_after_distillation(state) == "critic"

    def test_with_completed_state(self):
        state = {"distillation_state": {"is_completed": True}}
        assert route_after_distillation(state) == "critic"


# ============================================================
# create_distillation_node
# ============================================================

class TestCreateDistillationNode:

    def test_default(self):
        node = create_distillation_node()
        assert isinstance(node, DistillationNode)
        assert node.template == DistillationTemplate.FULL

    def test_with_template(self):
        node = create_distillation_node(template="entity")
        assert node.template == DistillationTemplate.ENTITY_EXTRACTION

    def test_with_knowledge_layer(self):
        kl = MagicMock()
        node = create_distillation_node(knowledge_layer=kl)
        assert node._knowledge_layer is kl


# ============================================================
# distillation_node function
# ============================================================

class TestDistillationNodeFunction:

    def test_creates_full_node(self):
        state = {"draft_content": ""}
        result = distillation_node(state)
        assert result is state  # No draft, returns unchanged
