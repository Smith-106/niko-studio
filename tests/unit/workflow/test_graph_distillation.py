# -*- coding: utf-8 -*-
"""
Graph Distillation Tests

Tests for DistillationTemplate, DistillationState, DistillationNode,
distillation_node function, should_distill, route_after_distillation,
add_distillation_node, create_distillation_node.
"""

import pytest
from unittest.mock import MagicMock, patch

from src.workflow.graph import (
    DistillationTemplate,
    DistillationState,
    DistillationNode,
    distillation_node,
    should_distill,
    route_after_distillation,
    create_distillation_node,
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

    def test_from_string(self):
        assert DistillationTemplate.from_string("entity") == DistillationTemplate.ENTITY_EXTRACTION
        assert DistillationTemplate.from_string("entities") == DistillationTemplate.ENTITY_EXTRACTION
        assert DistillationTemplate.from_string("relation") == DistillationTemplate.RELATION_EXTRACTION
        assert DistillationTemplate.from_string("event") == DistillationTemplate.EVENT_EXTRACTION
        assert DistillationTemplate.from_string("summary") == DistillationTemplate.SUMMARY
        assert DistillationTemplate.from_string("character") == DistillationTemplate.CHARACTER_ARC
        assert DistillationTemplate.from_string("character_arc") == DistillationTemplate.CHARACTER_ARC
        assert DistillationTemplate.from_string("plot") == DistillationTemplate.PLOT_STRUCTURE
        assert DistillationTemplate.from_string("full") == DistillationTemplate.FULL
        assert DistillationTemplate.from_string("all") == DistillationTemplate.FULL

    def test_from_string_unknown(self):
        assert DistillationTemplate.from_string("unknown") == DistillationTemplate.FULL

    def test_from_string_case_insensitive(self):
        assert DistillationTemplate.from_string("ENTITY") == DistillationTemplate.ENTITY_EXTRACTION
        assert DistillationTemplate.from_string("Full") == DistillationTemplate.FULL


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
        assert ds.is_completed is False
        assert ds.error is None

    def test_to_dict(self):
        ds = DistillationState(
            sources=["text"],
            template=DistillationTemplate.SUMMARY,
            scene_id="SC01",
            chapter_num=1,
        )
        d = ds.to_dict()
        assert d["template"] == "summary"
        assert d["scene_id"] == "SC01"
        assert d["sources"] == ["text"]

    def test_from_dict(self):
        data = {
            "sources": ["content"],
            "template": "entity",
            "result": {"entities": []},
            "scene_id": "SC02",
            "chapter_num": 2,
            "is_completed": True,
            "error": None,
        }
        ds = DistillationState.from_dict(data)
        assert ds.template == DistillationTemplate.ENTITY_EXTRACTION
        assert ds.scene_id == "SC02"
        assert ds.is_completed is True

    def test_from_dict_defaults(self):
        ds = DistillationState.from_dict({})
        assert ds.sources == []
        assert ds.template == DistillationTemplate.FULL

    def test_roundtrip(self):
        ds = DistillationState(
            sources=["text"],
            template=DistillationTemplate.CHARACTER_ARC,
            result={"character_arcs": []},
            scene_id="SC03",
            chapter_num=3,
            is_completed=True,
        )
        d = ds.to_dict()
        ds2 = DistillationState.from_dict(d)
        assert ds2.template == DistillationTemplate.CHARACTER_ARC
        assert ds2.scene_id == "SC03"


# ============================================================
# DistillationNode
# ============================================================

class TestDistillationNode:

    def test_init(self):
        node = DistillationNode()
        assert node.template == DistillationTemplate.FULL

    def test_init_with_template(self):
        node = DistillationNode(template=DistillationTemplate.SUMMARY)
        assert node.template == DistillationTemplate.SUMMARY

    def test_process_empty_draft(self):
        node = DistillationNode()
        state = {"draft_content": ""}
        result = node.process(state)
        assert result is state  # returns unchanged

    def test_process_no_draft(self):
        node = DistillationNode()
        state = {}
        result = node.process(state)
        assert result is state

    def test_process_with_mock_service(self):
        mock_kl = MagicMock()
        mock_ds = MagicMock()
        mock_ds.distill_chapter.return_value = {
            "entities": [{"id": "e1", "name": "Alice", "type": "Character"}],
            "relations": [{"source": "e1", "target": "e1", "type": "KNOWS"}],
            "events": [],
        }
        mock_ds.apply_to_graph = MagicMock()

        node = DistillationNode(
            template=DistillationTemplate.FULL,
            knowledge_layer=mock_kl,
            distill_service=mock_ds,
        )
        state = {"draft_content": "Alice went to Wonderland"}
        result = node.process(state)

        assert "distillation_result" in result
        assert result["distillation_result"]["entities_count"] == 1
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
        assert "revision_id" in result["distillation_result"]["canonical_trace"]
        assert "session_id" in result["distillation_result"]["canonical_trace"]
        assert result["distillation_result"]["canonical_trace"]["session_id"] == ""

    def test_process_error_handling(self):
        mock_ds = MagicMock()
        mock_ds.distill_chapter.side_effect = RuntimeError("fail")

        node = DistillationNode(distill_service=mock_ds)
        # Need a mock knowledge_layer too since it's accessed
        node._knowledge_layer = MagicMock()
        state = {"draft_content": "content", "errors": []}
        result = node.process(state)

        assert "errors" in result
        assert any("Distillation" in e for e in result["errors"])

    def test_callable(self):
        node = DistillationNode()
        state = {}
        result = node(state)
        assert result is state

    def test_execute_entity_template(self):
        mock_ds = MagicMock()
        mock_ds.distill_chapter.return_value = {
            "entities": [{"id": "e1"}],
            "relations": [],
            "events": [],
        }
        node = DistillationNode(template=DistillationTemplate.ENTITY_EXTRACTION)
        node._distill_service = mock_ds
        result = node._execute_distillation("text", DistillationTemplate.ENTITY_EXTRACTION)
        assert "entities" in result

    def test_execute_relation_template(self):
        mock_ds = MagicMock()
        mock_ds.distill_chapter.return_value = {
            "relations": [{"source": "a", "target": "b"}],
        }
        node = DistillationNode(template=DistillationTemplate.RELATION_EXTRACTION)
        node._distill_service = mock_ds
        result = node._execute_distillation("text", DistillationTemplate.RELATION_EXTRACTION)
        assert "relations" in result

    def test_execute_event_template(self):
        mock_ds = MagicMock()
        mock_ds.distill_chapter.return_value = {"events": [{"name": "e"}]}
        node = DistillationNode(template=DistillationTemplate.EVENT_EXTRACTION)
        node._distill_service = mock_ds
        result = node._execute_distillation("text", DistillationTemplate.EVENT_EXTRACTION)
        assert "events" in result

    def test_execute_summary_template(self):
        mock_ds = MagicMock()
        mock_ds.distill_chapter.return_value = {"summary": "A summary"}
        node = DistillationNode(template=DistillationTemplate.SUMMARY)
        node._distill_service = mock_ds
        result = node._execute_distillation("text", DistillationTemplate.SUMMARY)
        assert "summary" in result

    def test_execute_character_arc_template(self):
        mock_ds = MagicMock()
        mock_ds.distill_chapter.return_value = {
            "character_arcs": [],
            "entities": [{"type": "Character"}, {"type": "Location"}],
        }
        node = DistillationNode(template=DistillationTemplate.CHARACTER_ARC)
        node._distill_service = mock_ds
        result = node._execute_distillation("text", DistillationTemplate.CHARACTER_ARC)
        assert "character_arcs" in result
        # Only character entities
        assert len(result["entities"]) == 1

    def test_execute_plot_structure_template(self):
        mock_ds = MagicMock()
        mock_ds.distill_chapter.return_value = {
            "plot_points": [{"name": "p"}],
            "events": [{"name": "e"}],
        }
        node = DistillationNode(template=DistillationTemplate.PLOT_STRUCTURE)
        node._distill_service = mock_ds
        result = node._execute_distillation("text", DistillationTemplate.PLOT_STRUCTURE)
        assert "plot_points" in result
        assert "events" in result


# ============================================================
# should_distill
# ============================================================

class TestShouldDistill:

    def test_should_distill_true(self):
        state = {"draft_content": "content"}
        assert should_distill(state) is True

    def test_should_distill_no_draft(self):
        state = {}
        assert should_distill(state) is False

    def test_should_distill_already_distilled(self):
        state = {"draft_content": "content", "distillation_result": {}}
        assert should_distill(state) is False

    def test_should_distill_disabled(self):
        state = {"draft_content": "content", "config": {"enable_distillation": False}}
        assert should_distill(state) is False


# ============================================================
# route_after_distillation
# ============================================================

class TestRouteAfterDistillation:

    def test_default_to_critic(self):
        state = {}
        assert route_after_distillation(state) == "critic"

    def test_with_error(self):
        state = {"distillation_state": {"error": "some error"}}
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
        node = create_distillation_node(template="summary")
        assert node.template == DistillationTemplate.SUMMARY

    def test_with_knowledge_layer(self):
        mock_kl = MagicMock()
        node = create_distillation_node(knowledge_layer=mock_kl)
        assert node._knowledge_layer is mock_kl


# ============================================================
# distillation_node function
# ============================================================

class TestDistillationNodeFunction:

    def test_function(self):
        state = {}
        result = distillation_node(state)
        assert result is state  # no draft_content, returns unchanged
