# -*- coding: utf-8 -*-
"""CharacterManager tests - CRUD, five-dimension modeling, dialogue, state tracking, relationships, growth, validation."""

import pytest
from unittest.mock import MagicMock

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
