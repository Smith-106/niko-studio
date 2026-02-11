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
    WritingState,
    WorkflowConfig,
    DEFAULT_CONFIG,
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
        )
        assert result["entities_count"] == 5


# ============================================================
# DEFAULT_CONFIG Tests
# ============================================================

class TestDefaultConfig:

    def test_pass_score(self):
        assert DEFAULT_CONFIG["pass_score"] == 80

    def test_min_c_score(self):
        assert DEFAULT_CONFIG["min_c_score"] == 7

    def test_max_revisions(self):
        assert DEFAULT_CONFIG["max_revisions"] == 3

    def test_human_review_score(self):
        assert DEFAULT_CONFIG["human_review_score"] == 70

    def test_verbose(self):
        assert DEFAULT_CONFIG["verbose"] is True


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
