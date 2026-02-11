"""
Character Depth System Tests

Tests for CharacterTrait, DominantEmotion, Persona, DualPersonality,
CharacterDepthScore, CharacterDepthResult, and CharacterDepthSystem.
"""

import pytest
import asyncio
from src.narrative.character_depth import (
    CharacterTrait,
    DominantEmotion,
    Persona,
    DualPersonality,
    CharacterDepthScore,
    CharacterDepthResult,
    CharacterDepthSystem,
)


# ============================================================
# CharacterTrait Enum
# ============================================================

class TestCharacterTrait:

    def test_values(self):
        assert CharacterTrait.INTERESTING.value == "interesting"
        assert CharacterTrait.KNOWLEDGEABLE.value == "knowledgeable"
        assert CharacterTrait.COMPETENT.value == "competent"
        assert CharacterTrait.ECCENTRIC.value == "eccentric"
        assert CharacterTrait.DUAL_PERSONALITY.value == "dual_personality"

    def test_count(self):
        assert len(CharacterTrait) == 5


# ============================================================
# DominantEmotion
# ============================================================

class TestDominantEmotion:

    def test_basic(self):
        e = DominantEmotion(static_emotion="anger", dynamic_emotion="fear")
        assert e.static_emotion == "anger"
        assert e.dynamic_emotion == "fear"
        assert e.evolution == []

    def test_add_evolution_point(self):
        e = DominantEmotion(static_emotion="anger", dynamic_emotion="anger")
        e.add_evolution_point("sadness")
        assert e.dynamic_emotion == "sadness"
        assert e.evolution == ["sadness"]

    def test_multiple_evolution(self):
        e = DominantEmotion(static_emotion="joy", dynamic_emotion="joy")
        e.add_evolution_point("fear")
        e.add_evolution_point("anger")
        e.add_evolution_point("hope")
        assert e.dynamic_emotion == "hope"
        assert len(e.evolution) == 3


# ============================================================
# Persona & DualPersonality
# ============================================================

class TestPersona:

    def test_basic(self):
        p = Persona(
            name="warrior",
            traits=["brave", "strong"],
            trigger_conditions=["danger"],
            behavior_patterns=["fight"]
        )
        assert p.name == "warrior"
        assert len(p.traits) == 2


class TestDualPersonality:

    def test_basic(self):
        primary = Persona(name="scholar", traits=["calm"], trigger_conditions=[], behavior_patterns=["read"])
        shadow = Persona(name="fighter", traits=["aggressive"], trigger_conditions=["threat"], behavior_patterns=["attack"])
        dp = DualPersonality(
            primary_persona=primary,
            shadow_persona=shadow,
            internal_conflict="peace vs violence"
        )
        assert dp.primary_persona.name == "scholar"
        assert dp.shadow_persona.name == "fighter"
        assert dp.switch_triggers == []

    def test_conflict_potential(self):
        primary = Persona(name="A", traits=[], trigger_conditions=[], behavior_patterns=[])
        shadow = Persona(name="B", traits=[], trigger_conditions=[], behavior_patterns=[])
        dp = DualPersonality(
            primary_persona=primary,
            shadow_persona=shadow,
            internal_conflict="test"
        )
        result = dp.get_conflict_potential()
        assert "A" in result
        assert "B" in result


# ============================================================
# CharacterDepthScore
# ============================================================

class TestCharacterDepthScore:

    def test_basic(self):
        s = CharacterDepthScore(trait=CharacterTrait.INTERESTING, score=8.0)
        assert s.score == 8.0
        assert s.evidence == []
        assert s.issues == []
        assert s.suggestions == []

    def test_with_details(self):
        s = CharacterDepthScore(
            trait=CharacterTrait.ECCENTRIC,
            score=7.5,
            evidence=["e1"],
            issues=["i1"],
            suggestions=["s1"]
        )
        assert len(s.evidence) == 1
        assert len(s.issues) == 1


# ============================================================
# CharacterDepthResult (weighted scoring + depth_level)
# ============================================================

class TestCharacterDepthResult:

    def _make_score(self, trait, score):
        return CharacterDepthScore(trait=trait, score=score)

    def test_unforgettable(self):
        # All 10s: (10*0.20 + 10*0.15 + 10*0.15 + 10*0.20 + 10*0.30) * 10 = 100
        r = CharacterDepthResult(
            character_name="Hero",
            interest_score=self._make_score(CharacterTrait.INTERESTING, 10.0),
            competence_score=self._make_score(CharacterTrait.COMPETENT, 10.0),
            eccentricity_score=self._make_score(CharacterTrait.ECCENTRIC, 10.0),
            environment_contrast_score=self._make_score(CharacterTrait.INTERESTING, 10.0),
            dual_personality_score=self._make_score(CharacterTrait.DUAL_PERSONALITY, 10.0),
        )
        assert r.overall_score == 100.0
        assert r.depth_level == "UNFORGETTABLE"

    def test_deep(self):
        # Score = (7*0.20 + 7*0.15 + 7*0.15 + 7*0.20 + 7*0.30) * 10 = 70
        r = CharacterDepthResult(
            character_name="Hero",
            interest_score=self._make_score(CharacterTrait.INTERESTING, 7.0),
            competence_score=self._make_score(CharacterTrait.COMPETENT, 7.0),
            eccentricity_score=self._make_score(CharacterTrait.ECCENTRIC, 7.0),
            environment_contrast_score=self._make_score(CharacterTrait.INTERESTING, 7.0),
            dual_personality_score=self._make_score(CharacterTrait.DUAL_PERSONALITY, 7.0),
        )
        assert r.overall_score == 70.0
        assert r.depth_level == "DEEP"

    def test_moderate(self):
        # Score = (5*0.20 + 5*0.15 + 5*0.15 + 5*0.20 + 5*0.30) * 10 = 50
        r = CharacterDepthResult(
            character_name="Hero",
            interest_score=self._make_score(CharacterTrait.INTERESTING, 5.0),
            competence_score=self._make_score(CharacterTrait.COMPETENT, 5.0),
            eccentricity_score=self._make_score(CharacterTrait.ECCENTRIC, 5.0),
            environment_contrast_score=self._make_score(CharacterTrait.INTERESTING, 5.0),
            dual_personality_score=self._make_score(CharacterTrait.DUAL_PERSONALITY, 5.0),
        )
        assert r.overall_score == 50.0
        assert r.depth_level == "MODERATE"

    def test_flat(self):
        # Score = (3*0.20 + 3*0.15 + 3*0.15 + 3*0.20 + 3*0.30) * 10 = 30
        r = CharacterDepthResult(
            character_name="Hero",
            interest_score=self._make_score(CharacterTrait.INTERESTING, 3.0),
            competence_score=self._make_score(CharacterTrait.COMPETENT, 3.0),
            eccentricity_score=self._make_score(CharacterTrait.ECCENTRIC, 3.0),
            environment_contrast_score=self._make_score(CharacterTrait.INTERESTING, 3.0),
            dual_personality_score=self._make_score(CharacterTrait.DUAL_PERSONALITY, 3.0),
        )
        assert r.overall_score == 30.0
        assert r.depth_level == "FLAT"

    def test_weighted_calculation(self):
        # interest=8, competence=6, eccentricity=4, env_contrast=10, dual=9
        # = (8*0.20 + 6*0.15 + 4*0.15 + 10*0.20 + 9*0.30) * 10
        # = (1.6 + 0.9 + 0.6 + 2.0 + 2.7) * 10 = 78.0
        r = CharacterDepthResult(
            character_name="Test",
            interest_score=self._make_score(CharacterTrait.INTERESTING, 8.0),
            competence_score=self._make_score(CharacterTrait.COMPETENT, 6.0),
            eccentricity_score=self._make_score(CharacterTrait.ECCENTRIC, 4.0),
            environment_contrast_score=self._make_score(CharacterTrait.INTERESTING, 10.0),
            dual_personality_score=self._make_score(CharacterTrait.DUAL_PERSONALITY, 9.0),
        )
        assert abs(r.overall_score - 78.0) < 0.01
        assert r.depth_level == "DEEP"


# ============================================================
# CharacterDepthSystem (mock methods + track_dominant_emotion)
# ============================================================

class TestCharacterDepthSystem:

    def test_init_no_llm(self):
        sys = CharacterDepthSystem()
        assert sys.llm is None

    def test_mock_interest_score(self):
        sys = CharacterDepthSystem()
        s = sys._mock_interest_score()
        assert s.trait == CharacterTrait.INTERESTING
        assert s.score == 6.0

    def test_mock_eccentricity_score(self):
        sys = CharacterDepthSystem()
        s = sys._mock_eccentricity_score()
        assert s.trait == CharacterTrait.ECCENTRIC
        assert s.score == 5.0

    def test_mock_competence_score(self):
        sys = CharacterDepthSystem()
        s = sys._mock_competence_score()
        assert s.trait == CharacterTrait.COMPETENT
        assert s.score == 7.0

    def test_mock_dual_personality_score(self):
        sys = CharacterDepthSystem()
        s = sys._mock_dual_personality_score()
        assert s.trait == CharacterTrait.DUAL_PERSONALITY
        assert s.score == 4.0

    def test_mock_environment_contrast_score(self):
        sys = CharacterDepthSystem()
        s = sys._mock_environment_contrast_score()
        assert s.score == 5.0

    def test_track_dominant_emotion_same(self):
        sys = CharacterDepthSystem()
        e = sys.track_dominant_emotion("hero", "anger", "anger")
        assert e.static_emotion == "anger"
        assert e.dynamic_emotion == "anger"
        assert e.evolution == ["anger"]

    def test_track_dominant_emotion_different(self):
        sys = CharacterDepthSystem()
        e = sys.track_dominant_emotion("hero", "anger", "fear")
        assert e.evolution == ["anger", "fear"]

    def test_assess_interest_no_llm(self):
        sys = CharacterDepthSystem()
        result = asyncio.get_event_loop().run_until_complete(
            sys.assess_interest_level({"name": "test"}, "content")
        )
        assert result.trait == CharacterTrait.INTERESTING
        assert result.score == 6.0

    def test_detect_eccentricity_no_llm(self):
        sys = CharacterDepthSystem()
        result = asyncio.get_event_loop().run_until_complete(
            sys.detect_eccentricity({"name": "test"}, "content")
        )
        assert result.trait == CharacterTrait.ECCENTRIC

    def test_map_dual_personality_no_llm(self):
        sys = CharacterDepthSystem()
        score, dp = asyncio.get_event_loop().run_until_complete(
            sys.map_dual_personality({"name": "test"}, "content")
        )
        assert score.trait == CharacterTrait.DUAL_PERSONALITY
        assert dp is None

    def test_check_environment_contrast_no_llm(self):
        sys = CharacterDepthSystem()
        result = asyncio.get_event_loop().run_until_complete(
            sys.check_environment_contrast({"name": "test"}, {}, "content")
        )
        assert result.score == 5.0

    def test_evaluate_full_no_llm(self):
        sys = CharacterDepthSystem()
        result = asyncio.get_event_loop().run_until_complete(
            sys.evaluate_full({"name": "TestChar"}, {}, "content")
        )
        assert result.character_name == "TestChar"
        assert result.depth_level in ("FLAT", "MODERATE", "DEEP", "UNFORGETTABLE")
        assert result.overall_score > 0
