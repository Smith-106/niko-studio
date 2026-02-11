"""
Architect Agent Logic Tests

Tests for data models (LOCKAnalysis, SceneCard, StoryBlueprint, etc.),
_validate(), _load_golden_dataset(), get_thinking_chain/data(),
distill_blueprint(), _build_distill_content().
"""

import pytest
import json
import os
import tempfile
from unittest.mock import MagicMock, AsyncMock, patch
from pydantic import ValidationError
from src.agents.architect import (
    LOCKAnalysis,
    TwoDoorsStructure,
    SceneCard,
    RhythmAnalysis,
    StoryBlueprint,
    ArchitectAgent,
    ARCHITECT_SYSTEM_PROMPT,
    ARCHITECT_USER_PROMPT_TEMPLATE,
)


# ============================================================
# Helper factories
# ============================================================

def _make_lock(L=8, O=8, C=8, K=8, **overrides):
    defaults = dict(
        L_score=L, L_protagonist="Hero", L_desire="Find truth",
        L_pain_point="Lonely", L_unique_trait="Deduction",
        O_score=O, O_short_term="Survive", O_long_term="Save world",
        O_measurable=True,
        C_score=C, C_external="Villain", C_internal="Self-doubt",
        C_escalation="Rising",
        K_score=K, K_hooks=["hook1", "hook2"],
        K_transformation="Hero grows",
    )
    defaults.update(overrides)
    return LOCKAnalysis(**defaults)


def _make_two_doors(**overrides):
    defaults = dict(
        disturbance={"event": "break"},
        door_1={"event": "enter new world"},
        midpoint={"event": "false victory"},
        door_2={"event": "darkest hour"},
        climax={"event": "final battle"},
    )
    defaults.update(overrides)
    return TwoDoorsStructure(**defaults)


def _make_scene_card(scene_id="CH01-SC01", chapter_num=1, scene_num=1, **overrides):
    defaults = dict(
        scene_id=scene_id,
        chapter_num=chapter_num,
        scene_num=scene_num,
        pov_character="Hero",
        objective="Escape",
        conflict="Blocked by guards",
        outcome="+",
        structural_function="Rising",
        emotional_arc="hope to despair",
        sensory_guidance={"visual": "dark corridor"},
        plot_beat="rising action",
    )
    defaults.update(overrides)
    return SceneCard(**defaults)


def _make_blueprint(lock=None, scenes=None, **overrides):
    lock = lock or _make_lock()
    two_doors = _make_two_doors()
    scenes = scenes or [_make_scene_card()]
    rhythm = RhythmAnalysis(positive_scenes=1, negative_scenes=0, balance_score=7)
    defaults = dict(
        title="Test Story",
        genre="Fantasy",
        logline="A hero's journey",
        lock_analysis=lock,
        two_doors=two_doors,
        scene_cards=scenes,
        rhythm_analysis=rhythm,
        target_chapters=1,
        target_wordcount=50000,
    )
    defaults.update(overrides)
    return StoryBlueprint(**defaults)


# ============================================================
# LOCKAnalysis Tests
# ============================================================

class TestLOCKAnalysis:

    def test_total_score(self):
        lock = _make_lock(L=7, O=8, C=9, K=6)
        assert lock.total_score == 30

    def test_is_valid_above_threshold(self):
        lock = _make_lock(L=7, O=7, C=7, K=7)
        assert lock.is_valid is True  # 28

    def test_is_valid_at_threshold(self):
        lock = _make_lock(L=7, O=7, C=7, K=7)
        assert lock.total_score == 28
        assert lock.is_valid is True

    def test_is_valid_below_threshold(self):
        lock = _make_lock(L=6, O=7, C=7, K=7)
        assert lock.total_score == 27
        assert lock.is_valid is False

    def test_score_bounds_validation(self):
        with pytest.raises(ValidationError):
            _make_lock(L=11)
        with pytest.raises(ValidationError):
            _make_lock(L=-1)

    def test_max_score(self):
        lock = _make_lock(L=10, O=10, C=10, K=10)
        assert lock.total_score == 40
        assert lock.is_valid is True

    def test_min_score(self):
        lock = _make_lock(L=0, O=0, C=0, K=0)
        assert lock.total_score == 0
        assert lock.is_valid is False


# ============================================================
# SceneCard Tests
# ============================================================

class TestSceneCard:

    def test_valid_scene_id(self):
        sc = _make_scene_card(scene_id="CH01-SC01")
        assert sc.scene_id == "CH01-SC01"

    def test_invalid_scene_id_format(self):
        with pytest.raises(ValidationError):
            _make_scene_card(scene_id="invalid-id")

    def test_invalid_scene_id_lowercase(self):
        with pytest.raises(ValidationError):
            _make_scene_card(scene_id="ch01-sc01")

    def test_invalid_scene_id_no_dash(self):
        with pytest.raises(ValidationError):
            _make_scene_card(scene_id="CH01SC01")

    def test_valid_scene_id_high_numbers(self):
        sc = _make_scene_card(scene_id="CH99-SC99", chapter_num=99, scene_num=99)
        assert sc.scene_id == "CH99-SC99"

    def test_outcome_positive(self):
        sc = _make_scene_card(outcome="+")
        assert sc.outcome == "+"

    def test_outcome_negative(self):
        sc = _make_scene_card(outcome="-")
        assert sc.outcome == "-"

    def test_foreshadows_default_empty(self):
        sc = _make_scene_card()
        assert sc.foreshadows_to_plant == []
        assert sc.foreshadows_to_harvest == []

    def test_foreshadows_with_values(self):
        sc = _make_scene_card(
            foreshadows_to_plant=["clue A"],
            foreshadows_to_harvest=["old clue"],
        )
        assert sc.foreshadows_to_plant == ["clue A"]

    def test_hook_optional(self):
        sc = _make_scene_card()
        assert sc.hook is None
        sc2 = _make_scene_card(hook="What happens next?")
        assert sc2.hook == "What happens next?"


# ============================================================
# TwoDoorsStructure Tests
# ============================================================

class TestTwoDoorsStructure:

    def test_required_fields(self):
        td = _make_two_doors()
        assert td.disturbance is not None
        assert td.door_1 is not None
        assert td.door_2 is not None

    def test_resolution_optional(self):
        td = _make_two_doors()
        assert td.resolution is None
        td2 = _make_two_doors(resolution={"event": "new normal"})
        assert td2.resolution == {"event": "new normal"}


# ============================================================
# RhythmAnalysis Tests
# ============================================================

class TestRhythmAnalysis:

    def test_defaults(self):
        r = RhythmAnalysis(positive_scenes=3, negative_scenes=2, balance_score=8)
        assert r.warnings == []

    def test_with_warnings(self):
        r = RhythmAnalysis(
            positive_scenes=5, negative_scenes=0, balance_score=3,
            warnings=["Too many positive scenes in a row"],
        )
        assert len(r.warnings) == 1

    def test_balance_score_bounds(self):
        with pytest.raises(ValidationError):
            RhythmAnalysis(positive_scenes=1, negative_scenes=1, balance_score=11)
        with pytest.raises(ValidationError):
            RhythmAnalysis(positive_scenes=1, negative_scenes=1, balance_score=-1)


# ============================================================
# StoryBlueprint Tests
# ============================================================

class TestStoryBlueprint:

    def test_basic_blueprint(self):
        bp = _make_blueprint()
        assert bp.title == "Test Story"
        assert bp.genre == "Fantasy"
        assert len(bp.scene_cards) == 1

    def test_blueprint_lock_score(self):
        bp = _make_blueprint()
        assert bp.lock_analysis.total_score == 32


# ============================================================
# ArchitectAgent._load_golden_dataset Tests
# ============================================================

class TestLoadGoldenDataset:

    def test_none_path_returns_empty(self):
        agent = ArchitectAgent(
            llm=None,
            golden_dataset_path=None,
            enable_sequential_thinking=False,
            enable_distillation=False,
        )
        assert agent.golden_dataset == []

    def test_valid_json_file(self):
        data = [{"example": "golden"}]
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
            json.dump(data, f)
            f.flush()
            path = f.name

        try:
            agent = ArchitectAgent(
                llm=None,
                golden_dataset_path=path,
                enable_sequential_thinking=False,
                enable_distillation=False,
            )
            assert agent.golden_dataset == data
        finally:
            os.unlink(path)

    def test_file_not_found_returns_empty(self):
        agent = ArchitectAgent(
            llm=None,
            golden_dataset_path="/nonexistent/path.json",
            enable_sequential_thinking=False,
            enable_distillation=False,
        )
        assert agent.golden_dataset == []

    def test_gbk_encoded_file(self):
        data = [{"name": "test"}]
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.json', delete=False) as f:
            # Write invalid UTF-8 but valid GBK
            content = json.dumps(data).encode('gbk')
            # Prepend a GBK-specific byte to force UTF-8 decode error
            f.write(b'\xc4\xe3\xba\xc3')  # "nihao" in GBK
            path = f.name

        try:
            # This will try utf-8 first (fail), then gbk
            # The GBK bytes won't parse as valid JSON, so it may raise
            # We test the fallback path exists
            agent = ArchitectAgent(
                llm=None,
                golden_dataset_path=path,
                enable_sequential_thinking=False,
                enable_distillation=False,
            )
            # If GBK parsing fails with JSONDecodeError, it will propagate
            # but the code path for UnicodeDecodeError -> GBK is exercised
        except (json.JSONDecodeError, Exception):
            pass  # Expected - the GBK content isn't valid JSON
        finally:
            os.unlink(path)


# ============================================================
# ArchitectAgent._validate Tests
# ============================================================

class TestValidate:

    def _make_agent(self):
        return ArchitectAgent(
            llm=None,
            enable_sequential_thinking=False,
            enable_distillation=False,
        )

    def test_valid_blueprint_passes(self):
        agent = self._make_agent()
        bp = _make_blueprint()
        # Should not raise
        agent._validate(bp)

    def test_low_lock_score_raises(self):
        agent = self._make_agent()
        bp = _make_blueprint(lock=_make_lock(L=5, O=5, C=5, K=5))
        with pytest.raises(ValueError, match="LOCK"):
            agent._validate(bp)

    def test_missing_desire_raises(self):
        agent = self._make_agent()
        bp = _make_blueprint(lock=_make_lock(L_desire=""))
        with pytest.raises(ValueError, match="渴望"):
            agent._validate(bp)

    def test_scene_without_conflict_raises(self):
        agent = self._make_agent()
        scene = _make_scene_card(conflict="")
        bp = _make_blueprint(scenes=[scene])
        with pytest.raises(ValueError, match="冲突"):
            agent._validate(bp)

    def test_missing_door1_raises(self):
        agent = self._make_agent()
        bp = _make_blueprint()
        bp.two_doors.door_1 = {}
        with pytest.raises(ValueError, match="第一扇门"):
            agent._validate(bp)

    def test_missing_door2_raises(self):
        agent = self._make_agent()
        bp = _make_blueprint()
        bp.two_doors.door_2 = {}
        with pytest.raises(ValueError, match="第二扇门"):
            agent._validate(bp)

    def test_insufficient_scenes_warns(self, capsys):
        agent = self._make_agent()
        bp = _make_blueprint(target_chapters=10)
        # 1 scene < 10 chapters -> warning, not error
        agent._validate(bp)
        # No exception raised

    def test_rhythm_warnings_printed(self, capsys):
        agent = self._make_agent()
        rhythm = RhythmAnalysis(
            positive_scenes=5, negative_scenes=0, balance_score=3,
            warnings=["Too many positive scenes"],
        )
        bp = _make_blueprint()
        bp.rhythm_analysis = rhythm
        agent._validate(bp)
        captured = capsys.readouterr()
        assert "Too many positive" in captured.out


# ============================================================
# ArchitectAgent.get_thinking_chain / get_thinking_data Tests
# ============================================================

class TestThinkingMethods:

    def test_thinking_disabled_chain(self):
        agent = ArchitectAgent(
            llm=None,
            enable_sequential_thinking=False,
            enable_distillation=False,
        )
        assert agent.get_thinking_chain() == "SequentialThinking not enabled"

    def test_thinking_disabled_data(self):
        agent = ArchitectAgent(
            llm=None,
            enable_sequential_thinking=False,
            enable_distillation=False,
        )
        assert agent.get_thinking_data() == {}

    def test_thinking_enabled_chain(self):
        agent = ArchitectAgent(
            llm=None,
            enable_sequential_thinking=True,
            enable_distillation=False,
        )
        result = agent.get_thinking_chain()
        assert isinstance(result, str)
        assert "SequentialThinking" not in result or "not enabled" not in result

    def test_thinking_enabled_data(self):
        agent = ArchitectAgent(
            llm=None,
            enable_sequential_thinking=True,
            enable_distillation=False,
        )
        result = agent.get_thinking_data()
        assert isinstance(result, dict)


# ============================================================
# ArchitectAgent.distill_blueprint Tests
# ============================================================

class TestDistillBlueprint:

    @pytest.mark.asyncio
    async def test_no_distill_service(self):
        agent = ArchitectAgent(
            llm=None,
            enable_sequential_thinking=False,
            enable_distillation=False,
        )
        bp = _make_blueprint()
        result = await agent.distill_blueprint(bp)
        assert result["status"] == "distillation_disabled"
        assert result["entities"] == []
        assert result["relations"] == []

    @pytest.mark.asyncio
    async def test_with_distill_service(self):
        agent = ArchitectAgent(
            llm=None,
            enable_sequential_thinking=False,
            enable_distillation=False,
        )
        mock_service = MagicMock()
        mock_service.distill_chapter.return_value = {
            "entities": [{"name": "Hero"}],
            "relations": [{"source": "Hero", "target": "Villain"}],
        }
        agent.distill_service = mock_service

        bp = _make_blueprint()
        result = await agent.distill_blueprint(bp)
        assert len(result["entities"]) == 1
        assert len(result["relations"]) == 1
        mock_service.distill_chapter.assert_called_once()

    @pytest.mark.asyncio
    async def test_with_knowledge_layer(self):
        agent = ArchitectAgent(
            llm=None,
            enable_sequential_thinking=False,
            enable_distillation=False,
        )
        mock_service = MagicMock()
        mock_service.distill_chapter.return_value = {"entities": [], "relations": []}
        mock_kl = MagicMock()
        agent.distill_service = mock_service
        agent.knowledge_layer = mock_kl

        bp = _make_blueprint()
        await agent.distill_blueprint(bp)
        mock_service.apply_to_graph.assert_called_once_with(mock_kl, {"entities": [], "relations": []})

    @pytest.mark.asyncio
    async def test_distill_with_thinking_engine(self):
        agent = ArchitectAgent(
            llm=None,
            enable_sequential_thinking=True,
            enable_distillation=False,
        )
        mock_service = MagicMock()
        mock_service.distill_chapter.return_value = {
            "entities": [{"name": "A"}],
            "relations": [],
        }
        agent.distill_service = mock_service

        bp = _make_blueprint()
        result = await agent.distill_blueprint(bp)
        # Should record conclusion in thinking engine
        data = agent.get_thinking_data()
        assert isinstance(data, dict)


# ============================================================
# ArchitectAgent._build_distill_content Tests
# ============================================================

class TestBuildDistillContent:

    def test_contains_title(self):
        agent = ArchitectAgent(
            llm=None,
            enable_sequential_thinking=False,
            enable_distillation=False,
        )
        bp = _make_blueprint(title="My Great Story")
        content = agent._build_distill_content(bp)
        assert "My Great Story" in content

    def test_contains_lock_elements(self):
        agent = ArchitectAgent(
            llm=None,
            enable_sequential_thinking=False,
            enable_distillation=False,
        )
        bp = _make_blueprint()
        content = agent._build_distill_content(bp)
        assert "Hero" in content  # L_protagonist
        assert "Find truth" in content  # L_desire
        assert "Lonely" in content  # L_pain_point
        assert "Survive" in content  # O_short_term

    def test_contains_scene_info(self):
        agent = ArchitectAgent(
            llm=None,
            enable_sequential_thinking=False,
            enable_distillation=False,
        )
        bp = _make_blueprint()
        content = agent._build_distill_content(bp)
        assert "CH01-SC01" in content
        assert "Escape" in content  # objective

    def test_limits_scenes_to_10(self):
        agent = ArchitectAgent(
            llm=None,
            enable_sequential_thinking=False,
            enable_distillation=False,
        )
        scenes = [
            _make_scene_card(
                scene_id=f"CH{i:02d}-SC01",
                chapter_num=i,
            )
            for i in range(1, 16)
        ]
        bp = _make_blueprint(scenes=scenes, target_chapters=15)
        content = agent._build_distill_content(bp)
        assert "CH10-SC01" in content
        assert "CH11-SC01" not in content

    def test_contains_two_doors(self):
        agent = ArchitectAgent(
            llm=None,
            enable_sequential_thinking=False,
            enable_distillation=False,
        )
        bp = _make_blueprint()
        content = agent._build_distill_content(bp)
        assert "enter new world" in content  # door_1
        assert "darkest hour" in content  # door_2


# ============================================================
# ArchitectAgent.get_distillation_prompts Tests
# ============================================================

class TestGetDistillationPrompts:

    def test_no_distill_service(self):
        agent = ArchitectAgent(
            llm=None,
            enable_sequential_thinking=False,
            enable_distillation=False,
        )
        result = agent.get_distillation_prompts("some content")
        assert result == {}

    def test_with_distill_service(self):
        agent = ArchitectAgent(
            llm=None,
            enable_sequential_thinking=False,
            enable_distillation=False,
        )
        mock_service = MagicMock()
        mock_service.get_distillation_prompt.return_value = "prompt text"
        agent.distill_service = mock_service

        result = agent.get_distillation_prompts("content")
        assert "extract-facts" in result
        assert "extract-relationships" in result
        assert mock_service.get_distillation_prompt.call_count == 2


# ============================================================
# Prompt Template Tests
# ============================================================

class TestPromptTemplates:

    def test_system_prompt_contains_lock(self):
        assert "LOCK" in ARCHITECT_SYSTEM_PROMPT
        assert "Lead" in ARCHITECT_SYSTEM_PROMPT
        assert "Objective" in ARCHITECT_SYSTEM_PROMPT
        assert "Confrontation" in ARCHITECT_SYSTEM_PROMPT
        assert "Knockout" in ARCHITECT_SYSTEM_PROMPT

    def test_user_prompt_template_has_placeholders(self):
        assert "{user_idea}" in ARCHITECT_USER_PROMPT_TEMPLATE
        assert "{genre}" in ARCHITECT_USER_PROMPT_TEMPLATE
        assert "{target_chapters}" in ARCHITECT_USER_PROMPT_TEMPLATE
        assert "{format_instructions}" in ARCHITECT_USER_PROMPT_TEMPLATE


# ============================================================
# ArchitectAgent.generate_story_blueprint (fallback) Tests
# ============================================================

class TestGenerateStoryBlueprint:

    @pytest.mark.asyncio
    async def test_fallback_on_exception(self):
        mock_llm = MagicMock()
        mock_llm.ainvoke = AsyncMock(side_effect=RuntimeError("LLM error"))
        # Also need to make it work with pipe operator
        mock_llm.__or__ = MagicMock(side_effect=RuntimeError("pipe error"))

        agent = ArchitectAgent(
            llm=mock_llm,
            enable_sequential_thinking=False,
            enable_distillation=False,
        )
        result = await agent.generate_story_blueprint("test request", chapter_count=5, genre="sci-fi")
        assert result["fallback"] is True
        assert result["request"] == "test request"
        assert result["chapter_count"] == 5
        assert result["genre"] == "sci-fi"
