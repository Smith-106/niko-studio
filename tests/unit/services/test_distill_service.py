# -*- coding: utf-8 -*-
"""
DistillService Tests

Tests for DistillService: init, get_distillation_prompt,
distill_chapter, apply_to_graph.
"""

import warnings
import pytest
from unittest.mock import MagicMock

with warnings.catch_warnings():
    warnings.simplefilter("ignore", DeprecationWarning)
    from src.services.distill_service import DistillService


# ============================================================
# DistillService init
# ============================================================

class TestDistillServiceInit:

    def test_default(self):
        svc = DistillService()
        assert svc.llm_client is None

    def test_with_client(self):
        mock = MagicMock()
        svc = DistillService(llm_client=mock)
        assert svc.llm_client is mock


# ============================================================
# get_distillation_prompt
# ============================================================

class TestGetDistillationPrompt:

    def test_extract_facts(self):
        svc = DistillService()
        prompt = svc.get_distillation_prompt("extract-facts", "some content")
        assert "Extract factual" in prompt
        assert "some content" in prompt

    def test_extract_relationships(self):
        svc = DistillService()
        prompt = svc.get_distillation_prompt("extract-relationships", "content")
        assert "connections" in prompt or "relationships" in prompt

    def test_unknown_type(self):
        svc = DistillService()
        prompt = svc.get_distillation_prompt("unknown-type", "content")
        assert "Analyze" in prompt
        assert "content" in prompt

    def test_long_content_truncated(self):
        svc = DistillService()
        long_content = "A" * 5000
        prompt = svc.get_distillation_prompt("extract-facts", long_content)
        assert "truncated" in prompt


# ============================================================
# distill_chapter
# ============================================================

class TestDistillChapter:

    def test_returns_entities_and_relations(self):
        svc = DistillService()
        result = svc.distill_chapter("Some chapter content")
        assert "entities" in result
        assert "relations" in result
        assert len(result["entities"]) > 0
        assert len(result["relations"]) > 0

    def test_entity_structure(self):
        svc = DistillService()
        result = svc.distill_chapter("content")
        entity = result["entities"][0]
        assert "id" in entity
        assert "name" in entity
        assert "type" in entity

    def test_relation_structure(self):
        svc = DistillService()
        result = svc.distill_chapter("content")
        rel = result["relations"][0]
        assert "source" in rel
        assert "target" in rel
        assert "type" in rel


# ============================================================
# apply_to_graph
# ============================================================

class TestApplyToGraph:

    def test_applies_entities_and_relations(self):
        svc = DistillService()
        mock_kl = MagicMock()

        data = {
            "entities": [
                {"id": "e1", "name": "Alice", "type": "Character", "description": "Protagonist"},
                {"id": "e2", "name": "Wonderland", "type": "Location", "description": "Place"},
            ],
            "relations": [
                {"source": "e1", "target": "e2", "type": "LOCATED_IN", "props": {}},
            ]
        }

        svc.apply_to_graph(mock_kl, data)

        assert mock_kl.add_entity.call_count == 2
        assert mock_kl.add_relation.call_count == 1

    def test_empty_data(self):
        svc = DistillService()
        mock_kl = MagicMock()
        svc.apply_to_graph(mock_kl, {"entities": [], "relations": []})
        mock_kl.add_entity.assert_not_called()
        mock_kl.add_relation.assert_not_called()

    def test_missing_keys(self):
        svc = DistillService()
        mock_kl = MagicMock()
        svc.apply_to_graph(mock_kl, {})
        mock_kl.add_entity.assert_not_called()
