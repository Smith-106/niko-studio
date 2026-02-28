"""
State Tests

Tests for LOCKScores, SceneCard, CritiqueResult, DistillationResult,
WritingState, WorkflowConfig, DEFAULT_CONFIG, and create_initial_state.
"""

import pytest
from src.workflow.state import (
    LOCKScores,
    SceneCard,
    CritiqueResult,
    DistillationResult,
    RetrievalMetadata,
    WritingState,
    WorkflowConfig,
    DEFAULT_CONFIG,
    NOVEL_PASS_SCORE,
    NOVEL_HUMAN_REVIEW_SCORE,
    NOVEL_MIN_C_SCORE,
    create_initial_state,
)


# ============================================================
# TypedDict Structure Tests
# ============================================================

class TestLOCKScores:

    def test_create(self):
        scores = LOCKScores(L=8, O=7, C=9, K=8, total=82.0)
        assert scores["L"] == 8
        assert scores["total"] == 82.0


class TestSceneCard:

    def test_minimal(self):
        card = SceneCard(scene_id="s1", chapter_num=1, scene_num=1)
        assert card["scene_id"] == "s1"

    def test_full(self):
        card = SceneCard(
            scene_id="s1",
            chapter_num=1,
            scene_num=1,
            pov_character="Alice",
            objective="Escape",
            conflict="Guards",
            outcome="Success",
        )
        assert card["pov_character"] == "Alice"


class TestCritiqueResult:

    def test_create(self):
        result = CritiqueResult(
            decision="APPROVED",
            total_score=85.0,
            actionable_feedback="Good work",
        )
        assert result["decision"] == "APPROVED"
        assert result["total_score"] == 85.0


class TestDistillationResultTyped:

    def test_create(self):
        result = DistillationResult(
            entities_count=5,
            relations_count=3,
            template="summary",
            canonical_schema_version="narrative_entity.v1",
            canonical_trace={
                "session_id": "session-1",
                "run_id": "run-1",
                "revision_id": "distill-1-s1",
            },
            canonical_entities=[
                {
                    "entity_id": "char-1",
                    "entity_type": "Character",
                    "scope": "character",
                    "name": "Alice",
                }
            ],
            canonical_relations=[
                {
                    "relation_id": "char-1-KNOWS-char-2",
                    "source_entity_id": "char-1",
                    "target_entity_id": "char-2",
                    "relation_type": "KNOWS",
                }
            ],
            canonical_conflicts=[
                {
                    "conflict_id": "CTD-0001",
                    "conflict_type": "causality",
                    "severity": "critical",
                    "description": "Self-referential relation without allowed identity semantics",
                    "critical_condition": "self_referential_non_identity_relation",
                }
            ],
        )
        assert result["entities_count"] == 5
        assert result["canonical_schema_version"] == "narrative_entity.v1"
        assert result["canonical_trace"]["session_id"] == "session-1"
        assert result["canonical_trace"]["run_id"] == "run-1"
        assert result["canonical_relations"][0]["relation_type"] == "KNOWS"


class TestRetrievalMetadata:

    def test_memory_observability_fields_optional(self):
        metadata = RetrievalMetadata(c_effective=0.8, s_final=0.7, r_memory=0.6)
        assert metadata["c_effective"] == 0.8
        assert metadata["s_final"] == 0.7
        assert metadata["r_memory"] == 0.6

    def test_extended_retrieval_metadata_fields(self):
        metadata = RetrievalMetadata(
            retrieval_profile="standard_balanced",
            budget_tokens=1200,
            cache_hit=True,
        )
        assert metadata["retrieval_profile"] == "standard_balanced"
        assert metadata["budget_tokens"] == 1200
        assert metadata["cache_hit"] is True


# ============================================================
# DEFAULT_CONFIG Tests
# ============================================================

class TestDefaultConfig:

    def test_pass_score(self):
        assert DEFAULT_CONFIG["pass_score"] == NOVEL_PASS_SCORE

    def test_min_c_score(self):
        assert DEFAULT_CONFIG["min_c_score"] == NOVEL_MIN_C_SCORE

    def test_max_revisions(self):
        assert DEFAULT_CONFIG["max_revisions"] == 3

    def test_human_review_score(self):
        assert DEFAULT_CONFIG["human_review_score"] == NOVEL_HUMAN_REVIEW_SCORE

    def test_context_governance_defaults(self):
        assert DEFAULT_CONFIG["enable_context_governance"] is False
        assert DEFAULT_CONFIG["min_retrieval_hit_rate"] == 0.70
        assert DEFAULT_CONFIG["min_context_budget_utilization"] == 0.60
        assert DEFAULT_CONFIG["retrieval_profile"] == "standard_balanced"

    def test_self_learning_defaults(self):
        assert DEFAULT_CONFIG["enable_self_learning_loop"] is False
        assert DEFAULT_CONFIG["self_learning_max_rules"] == 20
        assert DEFAULT_CONFIG["self_learning_curate_every_n_revisions"] == 2


# ============================================================
# create_initial_state Tests
# ============================================================

class TestCreateInitialState:

    def test_minimal(self):
        state = create_initial_state("A mystery story")
        assert state["user_idea"] == "A mystery story"
        assert state["genre"] == "悬疑"
        assert state["target_chapters"] == 30
        assert state["target_wordcount"] == 600000

    def test_custom_params(self):
        state = create_initial_state(
            "A sci-fi story",
            genre="科幻",
            target_chapters=10,
            target_wordcount=200000,
        )
        assert state["genre"] == "科幻"
        assert state["target_chapters"] == 10
        assert state["target_wordcount"] == 200000

    def test_session_id_generated(self):
        state = create_initial_state("test")
        assert len(state["session_id"]) > 0

    def test_unique_sessions(self):
        s1 = create_initial_state("test")
        s2 = create_initial_state("test")
        assert s1["session_id"] != s2["session_id"]

    def test_initial_chapter(self):
        state = create_initial_state("test")
        assert state["current_chapter"] == 1
        assert state["current_scene_index"] == 0

    def test_initial_empty_values(self):
        state = create_initial_state("test")
        assert state["story_blueprint"] == {}
        assert state["scene_cards"] == []
        assert state["character_profiles"] == []
        assert state["draft_content"] == ""
        assert state["draft_version"] == 0
        assert state["revision_count"] == 0
        assert state["revision_history"] == []
        assert state["distillation_result"] == {}
        assert state["distillation_state"] == {}
        assert state["retrieval_metadata"] == {}
        assert state["context_budget"] == {}
        assert state["context_governance"] == {}
        assert state["self_learning"] == {
            "reflector": {},
            "curator": {},
            "playbook": {"rules": []},
        }
        assert state["errors"] == []

    def test_initial_flags(self):
        state = create_initial_state("test")
        assert state["requires_human_intervention"] is False
        assert state["final_score"] == 0.0

    def test_metadata(self):
        state = create_initial_state("test", metadata={"project": "novel-1"})
        assert state["metadata"] == {"project": "novel-1"}

    def test_metadata_default(self):
        state = create_initial_state("test")
        assert state["metadata"] == {}

    def test_created_at(self):
        state = create_initial_state("test")
        assert state["created_at"] is not None
        assert "T" in state["created_at"]  # ISO8601 format
