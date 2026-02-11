# -*- coding: utf-8 -*-
"""CharacterManager data classes tests - enums, five dimensions, DialogueStyle, Personality, Background, Motivation, Relationship."""

import pytest
from src.narrative.character_manager import (
    PersonalityType,
    MotivationType,
    RelationshipType,
    GrowthStage,
    EmotionalState,
    DepthLevel,
    DynamicEmotion,
    Competence,
    Eccentricity,
    EnvironmentContrast,
    Persona,
    DualPersonality,
    DialogueStyle,
    Personality,
    KeyEvent,
    Background,
    Motivation,
    Relationship,
)


class TestEnums:
    def test_personality_type(self):
        assert PersonalityType.ANALYST.value == "analyst"
        assert PersonalityType.DIPLOMAT.value == "diplomat"
        assert PersonalityType.SENTINEL.value == "sentinel"
        assert PersonalityType.EXPLORER.value == "explorer"

    def test_motivation_type(self):
        assert MotivationType.SURVIVAL.value == "survival"
        assert MotivationType.SELF_ACTUALIZATION.value == "self_actualization"

    def test_relationship_type(self):
        assert RelationshipType.FAMILY.value == "family"
        assert RelationshipType.ENEMY.value == "enemy"
        assert len(RelationshipType) == 9

    def test_growth_stage(self):
        assert GrowthStage.ORDINARY_WORLD.value == "ordinary_world"
        assert GrowthStage.RETURN_WITH_ELIXIR.value == "elixir"
        assert len(GrowthStage) == 12

    def test_emotional_state(self):
        assert EmotionalState.JOY.value == "joy"
        assert EmotionalState.NEUTRAL.value == "neutral"

    def test_depth_level(self):
        assert DepthLevel.FLAT.value == "flat"
        assert DepthLevel.UNFORGETTABLE.value == "unforgettable"


class TestDynamicEmotion:
    def test_evolve(self):
        de = DynamicEmotion(static_emotion="忧郁", dynamic_emotion="平静")
        de.evolve("scene1", "愤怒")
        assert de.dynamic_emotion == "愤怒"
        assert len(de.evolution) == 1
        assert de.evolution[0] == ("scene1", "平静")

    def test_get_trajectory(self):
        de = DynamicEmotion(static_emotion="忧郁", dynamic_emotion="平静")
        de.evolve("s1", "愤怒")
        de.evolve("s2", "释然")
        traj = de.get_trajectory()
        assert traj == ["忧郁", "平静", "愤怒", "释然"]

    def test_to_dict(self):
        de = DynamicEmotion(static_emotion="忧郁", dynamic_emotion="平静", intensity=80)
        d = de.to_dict()
        assert d["static_emotion"] == "忧郁"
        assert d["intensity"] == 80
        assert d["evolution"] == []


class TestCompetence:
    def test_add_demonstration(self):
        c = Competence(primary_skill="编程")
        c.add_demonstration("s1", "写代码", "成功")
        assert len(c.demonstrations) == 1
        assert c.demonstrations[0]["scene_id"] == "s1"

    def test_to_dict(self):
        c = Competence(primary_skill="剑术", skill_level=90, specializations=["太极剑"])
        d = c.to_dict()
        assert d["primary_skill"] == "剑术"
        assert d["skill_level"] == 90
        assert "太极剑" in d["specializations"]


class TestEccentricity:
    def test_add_quirk_default(self):
        e = Eccentricity()
        e.add_quirk("总是倒着走路")
        assert "总是倒着走路" in e.quirks

    def test_add_quirk_obsessions(self):
        e = Eccentricity()
        e.add_quirk("收集石头", category="obsessions")
        assert "收集石头" in e.obsessions

    def test_add_quirk_habits(self):
        e = Eccentricity()
        e.add_quirk("每天数星星", category="habits")
        assert "每天数星星" in e.unusual_habits

    def test_to_dict(self):
        e = Eccentricity(quirks=["q1"], eccentricity_level=80)
        d = e.to_dict()
        assert d["eccentricity_level"] == 80
        assert "q1" in d["quirks"]


class TestEnvironmentContrast:
    def test_to_dict(self):
        ec = EnvironmentContrast(
            comfort_zone="图书馆",
            current_environment="战场",
            contrast_level="extreme",
            contrast_score=90,
        )
        d = ec.to_dict()
        assert d["comfort_zone"] == "图书馆"
        assert d["contrast_level"] == "extreme"
        assert d["contrast_score"] == 90


class TestDualPersonality:
    def test_get_conflict_potential(self):
        dp = DualPersonality(
            primary_persona=Persona(name="战士", traits=["勇敢"], trigger_conditions=["战斗"], behavior_patterns=["冲锋"]),
            shadow_persona=Persona(name="诗人", traits=["敏感"], trigger_conditions=["音乐"], behavior_patterns=["写诗"]),
            internal_conflict="暴力与温柔的冲突",
        )
        result = dp.get_conflict_potential()
        assert "战士" in result
        assert "诗人" in result

    def test_to_dict(self):
        dp = DualPersonality(
            primary_persona=Persona(name="A", traits=["t1"], trigger_conditions=["c1"], behavior_patterns=["b1"]),
            shadow_persona=Persona(name="B", traits=["t2"], trigger_conditions=["c2"], behavior_patterns=["b2"]),
            internal_conflict="conflict",
            duality_score=75,
        )
        d = dp.to_dict()
        assert d["primary_persona"]["name"] == "A"
        assert d["shadow_persona"]["name"] == "B"
        assert d["duality_score"] == 75


class TestDialogueStyle:
    def test_defaults(self):
        ds = DialogueStyle()
        assert ds.vocabulary_level == "medium"
        assert ds.formality == "neutral"
        assert ds.dialogue_samples == []

    def test_to_dict(self):
        ds = DialogueStyle(
            vocabulary_level="sophisticated",
            favorite_words=["indeed"],
            dialogue_samples=["sample1", "sample2"],
        )
        d = ds.to_dict()
        assert d["vocabulary_level"] == "sophisticated"
        assert "indeed" in d["favorite_words"]
        assert d["sample_count"] == 2


class TestPersonality:
    def test_to_dict(self):
        p = Personality(
            type=PersonalityType.ANALYST,
            core_traits=["聪明", "冷静"],
            strengths=["逻辑"],
            weaknesses=["社交"],
            quirks=["摸下巴"],
            speech_patterns=["嗯..."],
            values=["真理"],
            openness=80,
        )
        d = p.to_dict()
        assert d["type"] == "analyst"
        assert d["big_five"]["openness"] == 80
        assert "聪明" in d["core_traits"]


class TestBackground:
    def test_to_dict(self):
        bg = Background(
            birth_place="北京",
            family_structure="核心家庭",
            social_class="中产",
            education="大学",
            occupation="教师",
            childhood_events=[KeyEvent(age=5, description="搬家", impact="适应力", emotional_residue="不安")],
            secrets=["秘密1"],
        )
        d = bg.to_dict()
        assert d["birth_place"] == "北京"
        assert len(d["childhood_events"]) == 1
        assert d["childhood_events"][0]["age"] == 5
        assert "秘密1" in d["secrets"]

    def test_to_dict_with_trauma(self):
        bg = Background(
            birth_place="上海", family_structure="单亲", social_class="底层",
            education="初中", occupation="工人",
            trauma=[KeyEvent(age=10, description="失去亲人", impact="封闭", emotional_residue="悲伤")],
        )
        d = bg.to_dict()
        assert len(d["trauma"]) == 1
        assert d["trauma"][0]["emotional_residue"] == "悲伤"


class TestMotivation:
    def test_to_dict(self):
        m = Motivation(
            type=MotivationType.ESTEEM,
            surface_goal="成名",
            deep_need="被认可",
            inner_fear="被遗忘",
            want="名声",
            need="爱",
            lie="名声等于价值",
            ghost="童年被忽视",
            stakes=["失去一切"],
        )
        d = m.to_dict()
        assert d["type"] == "esteem"
        assert d["surface_goal"] == "成名"
        assert d["ghost"] == "童年被忽视"
        assert "失去一切" in d["stakes"]


class TestRelationship:
    def test_defaults(self):
        r = Relationship(target_id="c2", target_name="李四", type=RelationshipType.FRIENDSHIP)
        assert r.trust_level == 50
        assert r.power_balance == 50
        assert r.tension_points == []

    def test_to_dict(self):
        r = Relationship(
            target_id="c2", target_name="李四",
            type=RelationshipType.RIVALRY,
            trust_level=20, conflict_potential=90,
        )
        d = r.to_dict()
        assert d["type"] == "rivalry"
        assert d["trust_level"] == 20
        assert d["conflict_potential"] == 90
