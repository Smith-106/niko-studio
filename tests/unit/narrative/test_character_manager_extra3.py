# -*- coding: utf-8 -*-
"""CharacterManager tests - CRUD, five-dimension modeling, dialogue, state tracking, relationships, growth, validation."""

import pytest
from unittest.mock import MagicMock, AsyncMock

from src.narrative.character_manager import (
    CharacterManager,
    Character,
    Personality,
    PersonalityType,
    Background,
    Motivation,
    MotivationType,
    GrowthArc,
    GrowthStage,
    EmotionalState,
    RelationshipType,
    DynamicEmotion,
    Competence,
    Eccentricity,
    EnvironmentContrast,
    DualPersonality,
    Persona,
    DialogueStyle,
    Relationship,
    KeyEvent,
    FiveDimensionScore,
    DepthLevel,
)


@pytest.fixture()
def mgr():
    return CharacterManager()


@pytest.fixture()
def char(mgr):
    return mgr.create_character("Alice", role="protagonist")


class TestDataclasses:
    def test_dynamic_emotion_evolve(self):
        de = DynamicEmotion(static_emotion="calm", dynamic_emotion="happy", intensity=60)
        de.evolve("s1", "angry")
        assert de.dynamic_emotion == "angry"
        assert len(de.evolution) == 1
        assert de.evolution[0] == ("s1", "happy")

    def test_dynamic_emotion_trajectory(self):
        de = DynamicEmotion(static_emotion="calm", dynamic_emotion="happy")
        de.evolve("s1", "sad")
        de.evolve("s2", "angry")
        traj = de.get_trajectory()
        assert traj == ["calm", "happy", "sad", "angry"]

    def test_dynamic_emotion_to_dict(self):
        de = DynamicEmotion(static_emotion="calm", dynamic_emotion="happy", intensity=70)
        d = de.to_dict()
        assert d["static_emotion"] == "calm"
        assert d["intensity"] == 70

    def test_competence_add_demonstration(self):
        c = Competence(primary_skill="sword")
        c.add_demonstration("s1", "fought dragon", "won")
        assert len(c.demonstrations) == 1
        assert c.demonstrations[0]["action"] == "fought dragon"

    def test_competence_to_dict(self):
        c = Competence(primary_skill="magic", skill_level=90, specializations=["fire"])
        d = c.to_dict()
        assert d["primary_skill"] == "magic"
        assert d["skill_level"] == 90

    def test_eccentricity_add_quirk(self):
        e = Eccentricity()
        e.add_quirk("talks to self")
        e.add_quirk("collects bones", "obsessions")
        e.add_quirk("walks backwards", "habits")
        assert len(e.quirks) == 1
        assert len(e.obsessions) == 1
        assert len(e.unusual_habits) == 1

    def test_eccentricity_to_dict(self):
        e = Eccentricity(quirks=["q1"], eccentricity_level=80)
        d = e.to_dict()
        assert d["eccentricity_level"] == 80

    def test_environment_contrast_to_dict(self):
        ec = EnvironmentContrast(comfort_zone="city", current_environment="forest", contrast_level="high")
        d = ec.to_dict()
        assert d["comfort_zone"] == "city"
        assert d["contrast_level"] == "high"

    def test_dual_personality_conflict_potential(self):
        p1 = Persona(name="Warrior", traits=["brave"], trigger_conditions=[], behavior_patterns=[])
        p2 = Persona(name="Artist", traits=["gentle"], trigger_conditions=[], behavior_patterns=[])
        dp = DualPersonality(primary_persona=p1, shadow_persona=p2, internal_conflict="war vs art")
        text = dp.get_conflict_potential()
        assert "Warrior" in text
        assert "Artist" in text

    def test_dual_personality_to_dict(self):
        p1 = Persona(name="A", traits=["t1"], trigger_conditions=["c1"], behavior_patterns=["b1"])
        p2 = Persona(name="B", traits=["t2"], trigger_conditions=["c2"], behavior_patterns=["b2"])
        dp = DualPersonality(primary_persona=p1, shadow_persona=p2, internal_conflict="conflict")
        d = dp.to_dict()
        assert d["primary_persona"]["name"] == "A"
        assert d["shadow_persona"]["name"] == "B"

    def test_dialogue_style_to_dict(self):
        ds = DialogueStyle(vocabulary_level="sophisticated", formality="formal", dialogue_samples=["a", "b"])
        d = ds.to_dict()
        assert d["vocabulary_level"] == "sophisticated"
        assert d["sample_count"] == 2

    def test_personality_to_dict(self):
        p = Personality(
            type=PersonalityType.ANALYST, core_traits=["smart"],
            strengths=["logic"], weaknesses=["cold"], quirks=["q"],
            speech_patterns=["sp"], values=["truth"], openness=80,
        )
        d = p.to_dict()
        assert d["type"] == "analyst"
        assert d["big_five"]["openness"] == 80

    def test_background_to_dict(self):
        ke = KeyEvent(age=10, description="lost home", impact="trauma", emotional_residue="fear")
        bg = Background(
            birth_place="city", family_structure="single", social_class="middle",
            education="college", occupation="writer", trauma=[ke],
        )
        d = bg.to_dict()
        assert d["birth_place"] == "city"
        assert len(d["trauma"]) == 1
        assert d["trauma"][0]["emotional_residue"] == "fear"

    def test_motivation_to_dict(self):
        m = Motivation(
            type=MotivationType.ESTEEM, surface_goal="fame", deep_need="respect",
            inner_fear="rejection", want="power", need="love", lie="I'm fine alone",
            ghost="childhood neglect",
        )
        d = m.to_dict()
        assert d["type"] == "esteem"
        assert d["ghost"] == "childhood neglect"


class TestCharacterManagerCRUD:
    def test_create_character(self, mgr):
        c = mgr.create_character("Bob")
        assert c.name == "Bob"
        assert c.id in mgr.characters

    def test_get_character(self, mgr, char):
        found = mgr.get_character(char.id)
        assert found is char

    def test_get_character_not_found(self, mgr):
        assert mgr.get_character("nonexistent") is None

    def test_get_by_name(self, mgr, char):
        found = mgr.get_by_name("Alice")
        assert found is char

    def test_get_by_name_not_found(self, mgr):
        assert mgr.get_by_name("Nobody") is None

    def test_update_character(self, mgr, char):
        result = mgr.update_character(char.id, {"role": "villain"})
        assert result is True
        assert char.role == "villain"

    def test_update_character_not_found(self, mgr):
        assert mgr.update_character("bad_id", {"role": "x"}) is False

    def test_delete_character(self, mgr, char):
        result = mgr.delete_character(char.id)
        assert result is True
        assert char.id not in mgr.characters

    def test_delete_character_not_found(self, mgr):
        assert mgr.delete_character("bad_id") is False

    def test_list_characters(self, mgr):
        mgr.create_character("A", role="protagonist")
        mgr.create_character("B", role="supporting")
        mgr.create_character("C", role="protagonist")
        all_chars = mgr.list_characters()
        assert len(all_chars) == 3
        protas = mgr.list_characters(role="protagonist")
        assert len(protas) == 2

    def test_update_character_with_graph_manager_sync_branch(self):
        gm = MagicMock()
        gm.get_entity.return_value = None
        mgr = CharacterManager(graph_manager=gm)
        c = mgr.create_character("SyncUser")
        gm.create_entity.reset_mock()

        result = mgr.update_character(c.id, {"role": "villain"})

        assert result is True
        gm.get_entity.assert_called()


class TestFiveDimensionModeling:
    def test_set_dynamic_emotion(self, mgr, char):
        result = mgr.set_dynamic_emotion(char.id, "calm", "angry", 70)
        assert result is True
        assert char.dynamic_emotion.static_emotion == "calm"
        assert char.dynamic_emotion.intensity == 70

    def test_set_dynamic_emotion_not_found(self, mgr):
        assert mgr.set_dynamic_emotion("bad", "a", "b") is False

    def test_evolve_emotion(self, mgr, char):
        mgr.set_dynamic_emotion(char.id, "calm", "happy")
        result = mgr.evolve_emotion(char.id, "s1", "sad")
        assert result is True
        assert char.dynamic_emotion.dynamic_emotion == "sad"

    def test_evolve_emotion_no_dynamic(self, mgr, char):
        assert mgr.evolve_emotion(char.id, "s1", "sad") is False

    def test_set_competence(self, mgr, char):
        result = mgr.set_competence(char.id, "swordsmanship", 85, ["dual-wield"], ["magic"])
        assert result is True
        assert char.competence.primary_skill == "swordsmanship"

    def test_set_competence_not_found(self, mgr):
        assert mgr.set_competence("bad", "skill") is False

    def test_add_competence_demonstration(self, mgr, char):
        mgr.set_competence(char.id, "archery")
        result = mgr.add_competence_demonstration(char.id, "s1", "shot arrow", "bullseye")
        assert result is True
        assert len(char.competence.demonstrations) == 1

    def test_add_competence_demonstration_no_competence(self, mgr, char):
        assert mgr.add_competence_demonstration(char.id, "s1", "a", "b") is False

    def test_set_eccentricity(self, mgr, char):
        result = mgr.set_eccentricity(char.id, quirks=["talks to self"], eccentricity_level=75)
        assert result is True
        assert char.eccentricity.eccentricity_level == 75

    def test_set_eccentricity_not_found(self, mgr):
        assert mgr.set_eccentricity("bad") is False

    def test_set_environment_contrast(self, mgr, char):
        result = mgr.set_environment_contrast(char.id, "library", "battlefield", "high")
        assert result is True
        assert char.environment_contrast.contrast_score == 70  # high -> 70

    def test_set_environment_contrast_not_found(self, mgr):
        assert mgr.set_environment_contrast("bad", "a", "b") is False

    def test_set_dual_personality(self, mgr, char):
        result = mgr.set_dual_personality(
            char.id,
            primary_name="Warrior", primary_traits=["brave"], primary_patterns=["charge"],
            shadow_name="Poet", shadow_traits=["gentle"], shadow_patterns=["write"],
            internal_conflict="war vs peace", duality_score=70,
        )
        assert result is True
        assert char.dual_personality.duality_score == 70

    def test_set_dual_personality_not_found(self, mgr):
        assert mgr.set_dual_personality("bad", "a", [], [], "b", [], [], "c") is False

    def test_get_depth_assessment(self, mgr, char):
        result = mgr.get_depth_assessment(char.id)
        assert "suggestions" in result
        assert result["character"] == "Alice"

    def test_get_depth_assessment_not_found(self, mgr):
        result = mgr.get_depth_assessment("bad")
        assert "error" in result


class TestCharacterFiveDimensionScore:
    def test_score_with_all_dimensions(self, mgr, char):
        mgr.set_dynamic_emotion(char.id, "calm", "angry", 80)
        char.dynamic_emotion.evolve("s1", "sad")
        mgr.set_competence(char.id, "sword", 90)
        mgr.add_competence_demonstration(char.id, "s1", "fight", "win")
        mgr.set_eccentricity(char.id, quirks=["q1", "q2"], obsessions=["o1"], eccentricity_level=60)
        mgr.set_environment_contrast(char.id, "city", "wild", "extreme")
        mgr.set_dual_personality(
            char.id, "A", ["t"], ["p"], "B", ["t"], ["p"], "conflict",
            conflict_scenarios=["cs1", "cs2"],
        )
        score = char.get_five_dimension_score()
        assert score.overall_score > 0
        assert score.dynamic_score > 0
        assert score.competence_score > 0


class TestCoverageBranches:
    def test_relationship_to_dict_and_depth_level_branches(self):
        rel = Relationship(target_id="b", target_name="B", type=RelationshipType.FRIENDSHIP)
        rel_dict = rel.to_dict()
        assert rel_dict["target_id"] == "b"

        unforgettable = FiveDimensionScore(dynamic_score=100, competence_score=100, eccentricity_score=100, contrast_score=100, duality_score=100)
        deep = FiveDimensionScore(dynamic_score=70, competence_score=70, eccentricity_score=70, contrast_score=70, duality_score=70)
        moderate = FiveDimensionScore(dynamic_score=50, competence_score=50, eccentricity_score=50, contrast_score=50, duality_score=50)

        assert unforgettable.depth_level == DepthLevel.UNFORGETTABLE
        assert deep.depth_level == DepthLevel.DEEP
        assert moderate.depth_level == DepthLevel.MODERATE

    def test_character_to_dict_includes_all_optional_dimension_fields(self, mgr, char):
        mgr.set_dynamic_emotion(char.id, "calm", "angry", 70)
        mgr.set_competence(char.id, "magic", 88)
        mgr.set_eccentricity(char.id, quirks=["q1"], eccentricity_level=66)
        mgr.set_environment_contrast(char.id, "city", "forest", "high")
        mgr.set_dual_personality(
            char.id,
            primary_name="Warrior", primary_traits=["brave"], primary_patterns=["charge"],
            shadow_name="Poet", shadow_traits=["gentle"], shadow_patterns=["write"],
            internal_conflict="war vs peace",
        )
        mgr.set_dialogue_style(char.id, formality="formal")

        d = char.to_dict()
        for key in [
            "dynamic_emotion",
            "competence",
            "eccentricity",
            "environment_contrast",
            "dual_personality",
            "dialogue_style",
        ]:
            assert key in d

    def test_update_relationship_char_not_found_and_export_all(self, mgr):
        assert mgr.update_relationship("missing", "target", trust_change=1) is False
        exported = mgr.export_all()
        assert "characters" in exported
        assert "relationship_network" in exported
        assert "exported_at" in exported

    def test_sync_methods_return_early_without_graph_manager(self, mgr):
        c = mgr.create_character("NoGraph")
        mgr._sync_to_graph(c)
        mgr._sync_relationship_to_graph(c.id, c.id, RelationshipType.ALLY, 50)


class TestDialogue:
    def test_set_dialogue_style(self, mgr, char):
        result = mgr.set_dialogue_style(
            char.id, formality="formal", verbal_tics=["您好"],
        )
        assert result is True
        assert char.dialogue_style.formality == "formal"

    def test_set_dialogue_style_not_found(self, mgr):
        assert mgr.set_dialogue_style("bad") is False

    def test_add_dialogue_sample(self, mgr, char):
        mgr.set_dialogue_style(char.id)
        result = mgr.add_dialogue_sample(char.id, "s1", "Hello world")
        assert result is True
        assert len(char.dialogue_history) == 1

    def test_add_dialogue_sample_not_found(self, mgr):
        assert mgr.add_dialogue_sample("bad", "s1", "text") is False

    def test_check_dialogue_consistency_no_style(self, mgr, char):
        result = mgr.check_dialogue_consistency(char.id, "test dialogue")
        assert result.get("consistent") is True

    def test_check_dialogue_consistency_formal(self, mgr, char):
        mgr.set_dialogue_style(char.id, formality="formal", verbal_tics=["您好"])
        result = mgr.check_dialogue_consistency(char.id, "嘿哟咋整呐")
        assert "issues" in result

    def test_check_dialogue_consistency_casual_avoided_and_reserved_emotion(self, mgr, char):
        mgr.set_dialogue_style(
            char.id,
            formality="casual",
            verbal_tics=[],
            emotional_expression="reserved",
        )
        char.dialogue_style.avoided_words = ["禁词"]

        result = mgr.check_dialogue_consistency(char.id, "您请问禁词?!...~!")

        assert any("过于正式" in issue for issue in result["issues"])
        assert any("避免的词汇" in issue for issue in result["issues"])
        assert any("过于强烈" in issue for issue in result["issues"])

    def test_check_dialogue_consistency_expressive_but_too_reserved(self, mgr, char):
        mgr.set_dialogue_style(
            char.id,
            formality="formal",
            verbal_tics=[],
            emotional_expression="expressive",
        )

        result = mgr.check_dialogue_consistency(char.id, "嗯哦是的好的")
        assert any("过于内敛" in issue for issue in result["issues"])

    def test_check_dialogue_consistency_not_found(self, mgr):
        result = mgr.check_dialogue_consistency("bad", "text")
        assert "error" in result

    def test_analyze_dialogue_pattern(self, mgr, char):
        mgr.add_dialogue_sample(char.id, "s1", "你好世界，这是一段测试对话。")
        mgr.add_dialogue_sample(char.id, "s2", "再见世界，这是另一段对话！")
        result = mgr.analyze_dialogue_pattern(char.id)
        assert result["sample_count"] == 2

    def test_analyze_dialogue_pattern_no_history(self, mgr, char):
        result = mgr.analyze_dialogue_pattern(char.id)
        assert "warning" in result

    def test_analyze_dialogue_pattern_not_found(self, mgr):
        result = mgr.analyze_dialogue_pattern("bad")
        assert "error" in result


class TestStateTracking:
    def test_record_state(self, mgr, char):
        state = mgr.record_state(char.id, "s1", location="forest", emotional_state=EmotionalState.FEAR)
        assert state is not None
        assert state.location == "forest"

    def test_record_state_not_found(self, mgr):
        assert mgr.record_state("bad", "s1") is None

    def test_get_character_timeline(self, mgr, char):
        mgr.record_state(char.id, "s1", location="city")
        mgr.record_state(char.id, "s2", location="forest")
        timeline = mgr.get_character_timeline(char.id)
        assert len(timeline) == 2

    def test_get_character_timeline_not_found(self, mgr):
        assert mgr.get_character_timeline("bad") == []

    def test_compare_states(self, mgr, char):
        mgr.record_state(char.id, "s1", location="city", emotional_state=EmotionalState.JOY)
        mgr.record_state(char.id, "s2", location="forest", emotional_state=EmotionalState.FEAR)
        result = mgr.compare_states(char.id, "s1", "s2")
        assert result["changes"]["location"]["from"] == "city"
        assert result["changes"]["location"]["to"] == "forest"

    def test_compare_states_not_found(self, mgr):
        result = mgr.compare_states("bad", "s1", "s2")
        assert "error" in result

    def test_compare_states_missing_scene(self, mgr, char):
        mgr.record_state(char.id, "s1", location="city")
        result = mgr.compare_states(char.id, "s1", "s_missing")
        assert "error" in result

    def test_character_get_current_state(self, mgr, char):
        assert char.get_current_state() is None
        mgr.record_state(char.id, "s1", location="city")
        assert char.get_current_state().location == "city"

    def test_character_get_state_at_scene(self, mgr, char):
        mgr.record_state(char.id, "s1", location="city")
        mgr.record_state(char.id, "s2", location="forest")
        state = char.get_state_at_scene("s1")
        assert state.location == "city"
        assert char.get_state_at_scene("s_none") is None


class TestRelationshipManagement:
    def test_add_relationship(self, mgr):
        a = mgr.create_character("A")
        b = mgr.create_character("B")
        result = mgr.add_relationship(a.id, b.id, RelationshipType.FRIENDSHIP, trust_level=80)
        assert result is True
        rel = a.relationships.get_relationship(b.id)
        assert rel.trust_level == 80

    def test_add_relationship_not_found(self, mgr, char):
        assert mgr.add_relationship(char.id, "bad_id", RelationshipType.ALLY) is False

    def test_update_relationship(self, mgr):
        a = mgr.create_character("A")
        b = mgr.create_character("B")
        mgr.add_relationship(a.id, b.id, RelationshipType.FRIENDSHIP, trust_level=50)
        result = mgr.update_relationship(a.id, b.id, trust_change=20, new_status="close")
        assert result is True
        rel = a.relationships.get_relationship(b.id)
        assert rel.trust_level == 70
        assert rel.current_status == "close"

    def test_update_relationship_not_found(self, mgr, char):
        assert mgr.update_relationship(char.id, "bad", trust_change=10) is False

    def test_get_relationship_network(self, mgr):
        a = mgr.create_character("A")
        b = mgr.create_character("B")
        mgr.add_relationship(a.id, b.id, RelationshipType.ENEMY)
        network = mgr.get_relationship_network()
        assert len(network["nodes"]) == 2
        assert len(network["edges"]) == 1

    def test_find_related_characters_no_graph(self, mgr):
        a = mgr.create_character("A")
        b = mgr.create_character("B")
        mgr.add_relationship(a.id, b.id, RelationshipType.ALLY)
        related = mgr.find_related_characters(a.id)
        assert len(related) == 1
        assert related[0].name == "B"

    def test_find_related_characters_not_found(self, mgr):
        assert mgr.find_related_characters("bad") == []


class TestGrowthArcManagement:
    def test_advance_growth(self, mgr, char):
        result = mgr.advance_growth(char.id, GrowthStage.ORDEAL, "big battle")
        assert result is True
        assert char.growth.current_stage == GrowthStage.ORDEAL
        assert char.growth.progress > 0
        assert "big battle" in char.growth.turning_points

    def test_advance_growth_not_found(self, mgr):
        assert mgr.advance_growth("bad", GrowthStage.ORDEAL) is False


class TestValidation:
    def test_validate_consistency_basic(self, mgr, char):
        result = mgr.validate_consistency(char.id)
        assert "valid" in result
        assert "warnings" in result

    def test_validate_consistency_not_found(self, mgr):
        result = mgr.validate_consistency("bad")
        assert result["valid"] is False

    def test_validate_consistency_all_key_branches(self, mgr, char):
        char.personality.extraversion = 20
        char.motivation.type = MotivationType.SURVIVAL
        char.motivation.surface_goal = "追求自我实现"
        char.background.social_class = "贫困家庭"
        char.background.education = "精英教育"
        char.growth.progress = 0.9
        char.growth.current_stage = GrowthStage.ORDINARY_WORLD

        for idx in range(6):
            friend = mgr.create_character(f"F{idx}")
            mgr.add_relationship(char.id, friend.id, RelationshipType.FRIENDSHIP)

        mgr.record_state(char.id, "scene-injured", location="街道", physical_condition="injured")
        mgr.record_state(char.id, "scene-normal", location="街道", physical_condition="normal")

        result = mgr.validate_consistency(char.id)

        assert result["valid"] is False
        assert any("生存动机与自我实现目标不一致" in issue for issue in result["issues"])
        assert any("成长进度与当前阶段不一致" in issue for issue in result["issues"])
        assert any("内向角色有过多友谊关系" in warning for warning in result["warnings"])
        assert any("社会阶层与教育背景可能不一致" in warning for warning in result["warnings"])
        assert any("受伤状态突然恢复" in warning for warning in result["warnings"])

    def test_validate_all(self, mgr):
        mgr.create_character("A")
        mgr.create_character("B")
        result = mgr.validate_all()
        assert result["total_characters"] == 2
        assert "average_score" in result

    def test_validate_all_empty(self, mgr):
        result = mgr.validate_all()
        assert result["total_characters"] == 0


class TestCharacterToDict:
    def test_to_dict(self, mgr, char):
        d = char.to_dict()
        assert d["name"] == "Alice"
        assert d["role"] == "protagonist"
        assert "five_dimension_score" in d

    def test_generate_id(self, mgr, char):
        cid = char.generate_id()
        assert len(cid) == 12


class TestGraphManagerIntegration:
    def test_create_with_graph_manager(self):
        gm = MagicMock()
        gm.get_entity.return_value = None
        mgr = CharacterManager(graph_manager=gm)
        mgr.create_character("Test")
        gm.create_entity.assert_called_once()

    def test_delete_with_graph_manager(self):
        gm = MagicMock()
        gm.get_entity.return_value = None
        mgr = CharacterManager(graph_manager=gm)
        c = mgr.create_character("Test")
        mgr.delete_character(c.id)
        gm.delete_entity.assert_called_once()

    def test_get_character_subgraph_no_graph(self, mgr, char):
        assert mgr.get_character_subgraph(char.id) is None

    def test_add_relationship_with_graph_manager_sync_branch(self):
        gm = MagicMock()
        mgr = CharacterManager(graph_manager=gm)
        a = mgr.create_character("A")
        b = mgr.create_character("B")
        gm.create_relationship.reset_mock()

        result = mgr.add_relationship(a.id, b.id, RelationshipType.FRIENDSHIP, trust_level=80)

        assert result is True
        gm.create_relationship.assert_called_once()

    def test_sync_to_graph_updates_existing_entity(self):
        gm = MagicMock()
        gm.get_entity.return_value = MagicMock()
        mgr = CharacterManager(graph_manager=gm)
        char = mgr.create_character("GraphUser")
        gm.update_entity.reset_mock()
        mgr._sync_to_graph(char)
        gm.update_entity.assert_called_once()

    def test_sync_to_graph_swallow_exception(self):
        gm = MagicMock()
        gm.get_entity.side_effect = RuntimeError("boom")
        mgr = CharacterManager(graph_manager=gm)
        char = mgr.create_character("GraphCrash")
        mgr._sync_to_graph(char)

    def test_sync_relationship_to_graph_creates_relationship(self):
        gm = MagicMock()
        mgr = CharacterManager(graph_manager=gm)
        a = mgr.create_character("A")
        b = mgr.create_character("B")
        mgr._sync_relationship_to_graph(a.id, b.id, RelationshipType.FRIENDSHIP, 80)
        gm.create_relationship.assert_called_once()

    def test_sync_relationship_to_graph_swallow_exception(self):
        gm = MagicMock()
        gm.create_relationship.side_effect = RuntimeError("boom")
        mgr = CharacterManager(graph_manager=gm)
        a = mgr.create_character("A")
        b = mgr.create_character("B")
        mgr._sync_relationship_to_graph(a.id, b.id, RelationshipType.FRIENDSHIP, 80)

    def test_get_character_subgraph_with_graph_manager(self):
        gm = MagicMock()
        ent_type = type("EntType", (), {"value": "character"})
        rel_type = type("RelType", (), {"value": "related_to"})
        entity = type("E", (), {"id": "c1", "name": "Alice", "type": ent_type})
        relation = type("R", (), {"source_id": "c1", "target_id": "c2", "type": rel_type})
        gm.get_subgraph.return_value = type("SubGraph", (), {"entities": [entity], "relationships": [relation]})

        mgr = CharacterManager(graph_manager=gm)
        result = mgr.get_character_subgraph("c1")

        assert result["center"] == "c1"
        assert result["entities"][0]["name"] == "Alice"
        assert result["relationships"][0]["target"] == "c2"

    def test_get_character_subgraph_graph_error(self):
        gm = MagicMock()
        gm.get_subgraph.side_effect = RuntimeError("boom")
        mgr = CharacterManager(graph_manager=gm)
        assert mgr.get_character_subgraph("c1") is None

    def test_find_related_characters_with_graph_manager(self):
        gm = MagicMock()
        e = type("E", (), {"id": "b-id"})
        gm.find_related_entities.return_value = [e]

        mgr = CharacterManager(graph_manager=gm)
        a = mgr.create_character("A")
        b = mgr.create_character("B")
        b.id = "b-id"
        mgr.characters[b.id] = b

        related = mgr.find_related_characters(a.id)
        assert len(related) == 1
        assert related[0].name == "B"

    def test_find_related_characters_graph_error(self):
        gm = MagicMock()
        gm.find_related_entities.side_effect = RuntimeError("boom")
        mgr = CharacterManager(graph_manager=gm)
        assert mgr.find_related_characters("any") == []


class TestLLMAssistedMethods:
    @pytest.mark.asyncio
    async def test_analyze_character_without_llm_uses_mock(self, mgr, char):
        result = await mgr.analyze_character(char.id, "some content")
        assert result["character"] == "Alice"
        assert "consistency_score" in result

    @pytest.mark.asyncio
    async def test_analyze_character_with_llm(self, char):
        llm = MagicMock()
        llm.ainvoke = AsyncMock(return_value=MagicMock(content='{"ok": true, "score": 88}'))
        mgr = CharacterManager(llm=llm)
        mgr.characters[char.id] = char

        result = await mgr.analyze_character(char.id, "content")

        assert result["ok"] is True
        assert result["score"] == 88
        llm.ainvoke.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_analyze_character_not_found(self, mgr):
        result = await mgr.analyze_character("bad", "content")
        assert result["error"] == "Character not found"

    @pytest.mark.asyncio
    async def test_suggest_development_without_llm(self, mgr, char):
        result = await mgr.suggest_development(char.id)
        assert result["character"] == "Alice"
        assert "suggested_events" in result

    @pytest.mark.asyncio
    async def test_suggest_development_not_found(self, mgr):
        result = await mgr.suggest_development("bad")
        assert result["error"] == "Character not found"

    @pytest.mark.asyncio
    async def test_suggest_development_with_llm(self, char):
        llm = MagicMock()
        llm.ainvoke = AsyncMock(return_value=MagicMock(content='{"next": "ordeal"}'))
        mgr = CharacterManager(llm=llm)
        mgr.characters[char.id] = char

        result = await mgr.suggest_development(char.id)

        assert result["next"] == "ordeal"

    @pytest.mark.asyncio
    async def test_analyze_five_dimensions_with_llm(self, char):
        llm = MagicMock()
        llm.ainvoke = AsyncMock(return_value=MagicMock(content='{"overall": 91}'))
        mgr = CharacterManager(llm=llm)
        mgr.characters[char.id] = char

        result = await mgr.analyze_five_dimensions(char.id, "content")

        assert result["overall"] == 91

    @pytest.mark.asyncio
    async def test_analyze_five_dimensions_without_llm(self, mgr, char):
        result = await mgr.analyze_five_dimensions(char.id, "content")
        assert result["character"] == "Alice"
        assert result["overall"] >= 0

    @pytest.mark.asyncio
    async def test_analyze_five_dimensions_not_found(self, mgr):
        result = await mgr.analyze_five_dimensions("bad", "content")
        assert result["error"] == "Character not found"


class TestImportAndDeserialize:
    def test_import_character_missing_required_fields(self, mgr):
        assert mgr.import_character({"name": "OnlyName"}) is None
        assert mgr.import_character({"id": "only-id"}) is None

    def test_import_character_invalid_timestamp_returns_none(self, mgr):
        data = {
            "id": "c-bad-time",
            "name": "BadTime",
            "created_at": "not-a-datetime",
        }
        assert mgr.import_character(data) is None

    def test_import_character_success_with_updated_at_branch(self):
        mgr = CharacterManager(graph_manager=MagicMock())
        mgr._sync_to_graph = MagicMock()

        data = {
            "id": "c-1",
            "name": "Importer",
            "role": "supporting",
            "personality": {"type": "invalid", "big_five": {"openness": 70}},
            "background": {
                "birth_place": "city",
                "trauma": [{"age": 10, "description": "x", "impact": "y", "emotional_residue": "z"}],
            },
            "motivation": {"type": "invalid", "surface_goal": "goal"},
            "relationships": {
                "connections": [
                    {
                        "target_id": "c-2",
                        "target_name": "Other",
                        "type": "invalid",
                    }
                ]
            },
            "growth": {"current_stage": "invalid", "progress": 0.4},
            "dynamic_emotion": {"static_emotion": "calm", "dynamic_emotion": "sad", "intensity": 65},
            "competence": {"primary_skill": "magic", "skill_level": 88},
            "eccentricity": {"quirks": ["q"]},
            "environment_contrast": {"comfort_zone": "city", "current_environment": "forest", "contrast_level": "high"},
            "dual_personality": {
                "primary_persona": {"name": "P1", "traits": ["a"], "trigger_conditions": [], "behavior_patterns": []},
                "shadow_persona": {"name": "P2", "traits": ["b"], "trigger_conditions": [], "behavior_patterns": []},
                "internal_conflict": "x",
            },
            "dialogue_style": {"formality": "formal", "vocabulary_level": "high"},
            "created_at": "2026-01-01T00:00:00",
            "updated_at": "2026-01-02T00:00:00",
        }

        imported = mgr.import_character(data)

        assert imported is not None
        assert imported.name == "Importer"
        assert imported.personality.type == PersonalityType.ANALYST
        assert imported.motivation.type == MotivationType.SELF_ACTUALIZATION
        assert imported.growth.current_stage == GrowthStage.ORDINARY_WORLD
        assert imported.relationships.connections[0].type == RelationshipType.ACQUAINTANCE
        assert imported.dynamic_emotion.intensity == 65
        assert imported.updated_at.isoformat().startswith("2026-01-02")
        mgr._sync_to_graph.assert_called_once_with(imported)
