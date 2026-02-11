# -*- coding: utf-8 -*-
"""CharacterManager extra tests - Relationships, GrowthArc, CharacterState, FiveDimensionScore, Character."""

import pytest
from datetime import datetime
from src.narrative.character_manager import (
    RelationshipType,
    GrowthStage,
    EmotionalState,
    DepthLevel,
    Relationship,
    Relationships,
    GrowthArc,
    CharacterState,
    FiveDimensionScore,
    Personality,
    PersonalityType,
    Background,
    Motivation,
    MotivationType,
    KeyEvent,
)


class TestRelationships:
    def test_add_and_get(self):
        rs = Relationships()
        r = Relationship(target_id="c2", target_name="Bob", type=RelationshipType.FRIENDSHIP)
        rs.add_relationship(r)
        assert rs.get_relationship("c2") is not None
        assert rs.get_relationship("c2").target_name == "Bob"

    def test_get_nonexistent(self):
        rs = Relationships()
        assert rs.get_relationship("nobody") is None

    def test_get_by_type(self):
        rs = Relationships()
        rs.add_relationship(Relationship(target_id="c1", target_name="A", type=RelationshipType.FAMILY))
        rs.add_relationship(Relationship(target_id="c2", target_name="B", type=RelationshipType.ENEMY))
        rs.add_relationship(Relationship(target_id="c3", target_name="C", type=RelationshipType.FAMILY))
        family = rs.get_by_type(RelationshipType.FAMILY)
        assert len(family) == 2

    def test_to_dict(self):
        rs = Relationships(social_role="leader", group_affiliations=["guild"])
        rs.add_relationship(Relationship(target_id="c1", target_name="A", type=RelationshipType.MENTOR))
        d = rs.to_dict()
        assert d["social_role"] == "leader"
        assert len(d["connections"]) == 1
        assert "guild" in d["group_affiliations"]


class TestGrowthArc:
    def test_to_dict(self):
        ga = GrowthArc(
            arc_type="positive",
            starting_state="naive",
            ending_state="wise",
            catalyst="betrayal",
            turning_points=["discovery", "confrontation"],
            current_stage=GrowthStage.ORDEAL,
            progress=0.6,
            belief_change="from trust to caution",
            skill_growth=["swordsmanship"],
        )
        d = ga.to_dict()
        assert d["arc_type"] == "positive"
        assert d["current_stage"] == "ordeal"
        assert d["progress"] == 0.6
        assert "swordsmanship" in d["skill_growth"]

    def test_defaults(self):
        ga = GrowthArc(
            arc_type="flat", starting_state="s", ending_state="e", catalyst="c"
        )
        assert ga.current_stage == GrowthStage.ORDINARY_WORLD
        assert ga.progress == 0.0
        assert ga.turning_points == []


class TestCharacterState:
    def test_to_dict(self):
        cs = CharacterState(
            scene_id="s1",
            timestamp=datetime(2025, 1, 1),
            location="forest",
            physical_condition="injured",
            emotional_state=EmotionalState.FEAR,
            emotional_intensity=80,
            current_goal="escape",
            concerns=["pursuit"],
            knowledge=["secret path"],
        )
        d = cs.to_dict()
        assert d["scene_id"] == "s1"
        assert d["location"] == "forest"
        assert d["emotional_state"] == "fear"
        assert d["emotional_intensity"] == 80
        assert "pursuit" in d["concerns"]

    def test_defaults(self):
        cs = CharacterState(scene_id="s1", timestamp=datetime.now())
        assert cs.location == ""
        assert cs.physical_condition == "normal"
        assert cs.emotional_state == EmotionalState.NEUTRAL
        assert cs.possessions == []


class TestFiveDimensionScore:
    def test_overall_score(self):
        fds = FiveDimensionScore(
            dynamic_score=80, competence_score=70,
            eccentricity_score=90, contrast_score=85,
            duality_score=75,
        )
        expected = (80*0.15 + 70*0.15 + 90*0.20 + 85*0.20 + 75*0.30)
        assert abs(fds.overall_score - expected) < 0.01

    def test_depth_level_unforgettable(self):
        fds = FiveDimensionScore(
            dynamic_score=90, competence_score=90,
            eccentricity_score=90, contrast_score=90,
            duality_score=90,
        )
        assert fds.depth_level == DepthLevel.UNFORGETTABLE

    def test_depth_level_deep(self):
        fds = FiveDimensionScore(
            dynamic_score=75, competence_score=75,
            eccentricity_score=75, contrast_score=75,
            duality_score=75,
        )
        assert fds.depth_level == DepthLevel.DEEP

    def test_depth_level_moderate(self):
        fds = FiveDimensionScore(
            dynamic_score=55, competence_score=55,
            eccentricity_score=55, contrast_score=55,
            duality_score=55,
        )
        assert fds.depth_level == DepthLevel.MODERATE

    def test_depth_level_flat(self):
        fds = FiveDimensionScore()
        assert fds.depth_level == DepthLevel.FLAT

    def test_to_dict(self):
        fds = FiveDimensionScore(dynamic_score=60, duality_score=80)
        d = fds.to_dict()
        assert "overall" in d
        assert "depth_level" in d
        assert d["dynamic"] == 60
        assert d["duality"] == 80
