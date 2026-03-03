"""
Six-Dimensional Memory Tests

Tests for dimension processors, classification, entity extraction,
DimensionRouter, and helper functions.
"""

import pytest
from src.memory.six_dimensional_memory import (
    DimensionType,
    DimensionScore,
    ClassificationResult,
    ProcessedContent,
    BaseDimensionProcessor,
    TimelineProcessor,
    ContextProcessor,
    CharacterProcessor,
    WorldviewProcessor,
    PreferenceProcessor,
    ExperienceProcessor,
    DimensionRouter,
    reset_dimension_router,
    get_dimension_router,
)


# ============================================================
# Data Model Tests
# ============================================================

class TestDimensionType:

    def test_all_values(self):
        assert DimensionType.TIMELINE.value == "timeline"
        assert DimensionType.CONTEXT.value == "context"
        assert DimensionType.CHARACTER.value == "character"
        assert DimensionType.WORLDVIEW.value == "worldview"
        assert DimensionType.PREFERENCE.value == "preference"
        assert DimensionType.EXPERIENCE.value == "experience"

    def test_six_dimensions(self):
        assert len(DimensionType) == 6


class TestDimensionScore:

    def test_defaults(self):
        ds = DimensionScore(dimension=DimensionType.TIMELINE, score=0.5, confidence=0.8)
        assert ds.keywords_matched == []

    def test_with_keywords(self):
        ds = DimensionScore(
            dimension=DimensionType.CHARACTER,
            score=0.9, confidence=0.95,
            keywords_matched=["hero", "villain"]
        )
        assert len(ds.keywords_matched) == 2


class TestClassificationResult:

    def test_get_score_found(self):
        scores = [
            DimensionScore(dimension=DimensionType.TIMELINE, score=0.8, confidence=0.9),
            DimensionScore(dimension=DimensionType.CHARACTER, score=0.3, confidence=0.5),
        ]
        cr = ClassificationResult(
            content="test",
            primary_dimension=DimensionType.TIMELINE,
            scores=scores,
        )
        assert cr.get_score(DimensionType.TIMELINE) == 0.8
        assert cr.get_score(DimensionType.CHARACTER) == 0.3

    def test_get_score_not_found(self):
        cr = ClassificationResult(
            content="test",
            primary_dimension=DimensionType.CONTEXT,
            scores=[],
        )
        assert cr.get_score(DimensionType.WORLDVIEW) == 0.0


class TestProcessedContent:

    def test_defaults(self):
        pc = ProcessedContent(
            original="test",
            processed="test",
            dimension=DimensionType.CONTEXT,
        )
        assert pc.extracted_data == {}
        assert pc.tags == []
        assert pc.importance == 0.5


# ============================================================
# BaseDimensionProcessor Tests
# ============================================================

class TestBaseDimensionProcessor:

    def test_classify_empty_content(self):
        proc = BaseDimensionProcessor(DimensionType.CONTEXT, ["scene", "chapter"])
        score = proc.classify("")
        assert score.score == 0.0
        assert score.confidence == 0.0

    def test_classify_no_match(self):
        proc = BaseDimensionProcessor(DimensionType.CONTEXT, ["scene", "chapter"])
        score = proc.classify("hello world nothing relevant here at all")
        assert score.score == 0.0
        assert score.keywords_matched == []

    def test_classify_with_match(self):
        proc = BaseDimensionProcessor(DimensionType.CONTEXT, ["scene", "chapter"])
        score = proc.classify("This scene in chapter 3 was intense")
        assert score.score > 0
        assert "scene" in score.keywords_matched
        assert "chapter" in score.keywords_matched

    def test_classify_confidence_increases_with_matches(self):
        proc = BaseDimensionProcessor(DimensionType.CONTEXT, ["a", "b", "c", "d"])
        score1 = proc.classify("word a is here")
        score2 = proc.classify("word a b c are here")
        assert score2.confidence >= score1.confidence

    def test_dimension_property(self):
        proc = BaseDimensionProcessor(DimensionType.WORLDVIEW, ["magic"])
        assert proc.dimension == DimensionType.WORLDVIEW

    def test_extract_entities_default(self):
        proc = BaseDimensionProcessor(DimensionType.CONTEXT, ["test"])
        assert proc.extract_entities("anything") == []

    def test_generate_tags(self):
        proc = BaseDimensionProcessor(DimensionType.CONTEXT, ["scene", "chapter", "story"])
        tags = proc._generate_tags("This scene and story")
        assert "scene" in tags
        assert "story" in tags

    def test_generate_tags_max_5(self):
        keywords = [f"kw{i}" for i in range(10)]
        proc = BaseDimensionProcessor(DimensionType.CONTEXT, keywords)
        content = " ".join(keywords)
        tags = proc._generate_tags(content)
        assert len(tags) <= 5

    def test_calculate_importance(self):
        proc = BaseDimensionProcessor(DimensionType.CONTEXT, ["scene", "chapter"])
        imp = proc._calculate_importance("This is a scene in a chapter with lots of content " * 5)
        assert 0.3 <= imp <= 1.0

    def test_calculate_importance_short_content(self):
        proc = BaseDimensionProcessor(DimensionType.CONTEXT, ["test"])
        imp = proc._calculate_importance("short")
        assert imp >= 0.3

    def test_process(self):
        proc = BaseDimensionProcessor(DimensionType.CONTEXT, ["scene"])
        result = proc.process("A scene unfolds")
        assert result.original == "A scene unfolds"
        assert result.dimension == DimensionType.CONTEXT
        assert "scene" in result.tags


# ============================================================
# TimelineProcessor Tests
# ============================================================

class TestTimelineProcessor:

    def test_classify_timeline_content(self):
        proc = TimelineProcessor()
        score = proc.classify("First the event happened, then later another occurred")
        assert score.score > 0
        assert len(score.keywords_matched) > 0

    def test_extract_date_yyyy_mm_dd(self):
        proc = TimelineProcessor()
        entities = proc.extract_entities("On 2024-01-15 at 10:00 the event happened")
        assert "2024-01-15" in entities

    def test_extract_time(self):
        proc = TimelineProcessor()
        entities = proc.extract_entities("On 2024-01-01 meeting at 14:30 was canceled")
        assert "14:30" in entities

    def test_extract_no_patterns(self):
        proc = TimelineProcessor()
        entities = proc.extract_entities("No dates or times here")
        assert entities == []

    def test_classify_works_without_extract(self):
        """classify() doesn't call extract_entities, so it works fine."""
        proc = TimelineProcessor()
        score = proc.classify("First the event happened, then later another occurred")
        assert score.score > 0
        assert len(score.keywords_matched) > 0

    def test_timeline_process_marks_sequence_and_preserves_time_refs(self):
        """Timeline processor should execute and expose stable regression behavior."""
        proc = TimelineProcessor()
        result = proc.process("On 2024-01-01 first we went, then came back at 14:30")
        assert result.extracted_data["has_sequence"] is True

        entities = proc.extract_entities("On 2024-01-01 first we went, then came back at 14:30")
        assert any("2024-01-01" in entity for entity in entities)


# ============================================================
# ContextProcessor Tests
# ============================================================

class TestContextProcessor:

    def test_classify_context_content(self):
        proc = ContextProcessor()
        score = proc.classify("The scene opens in chapter 3 with rising tension")
        assert score.score > 0

    def test_extract_chapter_refs(self):
        proc = ContextProcessor()
        entities = proc.extract_entities("In Chapter 5, the scene changes")
        # Regex captures "Chapter 5" or similar
        assert any("Chapter" in e for e in entities)

    def test_extract_pov_markers(self):
        proc = ContextProcessor()
        entities = proc.extract_entities("Written in first-person perspective")
        assert "first-person" in entities


# ============================================================
# CharacterProcessor Tests
# ============================================================

class TestCharacterProcessor:

    def test_classify_character_content(self):
        proc = CharacterProcessor()
        score = proc.classify("The protagonist has a strong personality and clear motivation")
        assert score.score > 0

    def test_extract_dialogue_speakers(self):
        proc = CharacterProcessor()
        entities = proc.extract_entities('"Hello there" said Alice')
        assert "Alice" in entities

    def test_process_traits(self):
        proc = CharacterProcessor()
        result = proc.process("The brave warrior was also cunning and wise")
        assert "brave" in result.extracted_data["traits"]
        assert "cunning" in result.extracted_data["traits"]
        assert "wise" in result.extracted_data["traits"]

    def test_process_relationships(self):
        proc = CharacterProcessor()
        result = proc.process("They were friends but she had a secret enemy")
        assert result.extracted_data["has_relationships"] is True

    def test_process_no_relationships(self):
        proc = CharacterProcessor()
        result = proc.process("The sky was clear and blue")
        assert result.extracted_data["has_relationships"] is False


# ============================================================
# WorldviewProcessor Tests
# ============================================================

class TestWorldviewProcessor:

    def test_classify_worldview_content(self):
        proc = WorldviewProcessor()
        score = proc.classify("The magic system in this world follows strict rules")
        assert score.score > 0

    def test_extract_place_names(self):
        proc = WorldviewProcessor()
        entities = proc.extract_entities("The Golden Kingdom was vast")
        # Regex captures group before "Kingdom" - may include "The"
        assert any("Golden" in e for e in entities)

    def test_extract_system_names(self):
        proc = WorldviewProcessor()
        entities = proc.extract_entities("The Arcane Magic was powerful")
        assert any("Arcane" in e for e in entities)


# ============================================================
# PreferenceProcessor Tests
# ============================================================

class TestPreferenceProcessor:

    def test_classify_preference_content(self):
        proc = PreferenceProcessor()
        score = proc.classify("I prefer a dark tone and always avoid cliches")
        assert score.score > 0

    def test_extract_preferences(self):
        proc = PreferenceProcessor()
        entities = proc.extract_entities("I prefer dark atmospheres")
        assert any("dark atmospheres" in e for e in entities)

    def test_extract_avoidances(self):
        proc = PreferenceProcessor()
        entities = proc.extract_entities("avoid using cliches and tropes")
        assert any("avoid:" in e for e in entities)


# ============================================================
# ExperienceProcessor Tests
# ============================================================

class TestExperienceProcessor:

    def test_classify_experience_content(self):
        proc = ExperienceProcessor()
        score = proc.classify("I learned that this technique works well through practice")
        assert score.score > 0

    def test_extract_learnings(self):
        proc = ExperienceProcessor()
        entities = proc.extract_entities("I learned that shorter sentences work better")
        assert any("shorter sentences" in e for e in entities)


# ============================================================
# DimensionRouter Tests
# ============================================================

class TestDimensionRouter:

    def setup_method(self):
        reset_dimension_router()

    def test_get_processor(self):
        router = DimensionRouter()
        proc = router.get_processor(DimensionType.TIMELINE)
        assert isinstance(proc, TimelineProcessor)

    def test_classify_returns_all_scores(self):
        router = DimensionRouter()
        result = router.classify("The hero fought bravely in the magic kingdom")
        assert len(result.scores) == 6

    def test_classify_primary_dimension(self):
        router = DimensionRouter()
        result = router.classify("The protagonist character had a strong personality and clear motivation for growth and development")
        assert result.primary_dimension is not None

    def test_classify_multi_dimensional(self):
        router = DimensionRouter()
        result = router.classify(
            "The hero character in this magic world prefers a dark style "
            "and the protagonist has a strong personality with clear motivation"
        )
        assert isinstance(result.multi_dimensional, bool)

    def test_classify_empty_content(self):
        router = DimensionRouter()
        result = router.classify("")
        # Should not crash on empty content
        assert result.primary_dimension is not None

    def test_process_auto_dimension(self):
        router = DimensionRouter()
        result = router.process("The brave hero fought")
        assert isinstance(result, ProcessedContent)

    def test_process_specific_dimension(self):
        router = DimensionRouter()
        result = router.process("anything", dimension=DimensionType.WORLDVIEW)
        assert result.dimension == DimensionType.WORLDVIEW

    def test_process_all(self):
        router = DimensionRouter()
        results = router.process_all("The hero character has a strong personality")
        assert isinstance(results, dict)
        assert len(results) == 6

    def test_get_relevant_dimensions(self):
        router = DimensionRouter()
        dims = router.get_relevant_dimensions(
            "The character hero has a strong personality and clear motivation",
            threshold=0.1
        )
        assert isinstance(dims, list)



class TestSixDimensionalUncoveredBranches:
    def test_timeline_extract_entities_with_and_without_matches(self):
        p = TimelineProcessor()

        with_match = p.extract_entities("At 12:34 PM on 2026-02-18, event happened.")
        assert any("12:34" in e for e in with_match)

        no_match = p.extract_entities("No dates or times here")
        assert no_match == []

    def test_timeline_and_character_process_extra_fields(self):
        timeline = TimelineProcessor().process("First we start, then next, finally after that.")
        assert timeline.extracted_data["has_sequence"] is True

        character = CharacterProcessor().process("The hero is brave and trusts a friend.")
        assert "brave" in character.extracted_data["traits"]
        assert character.extracted_data["has_relationships"] is True

    def test_character_extract_entities_and_router_singletons(self):
        p = CharacterProcessor()
        out = p.extract_entities('"hello" said Alice. Bob looked around.')
        assert any(name in out for name in ["Alice", "Bob"])

        reset_dimension_router()
        r1 = get_dimension_router()
        r2 = get_dimension_router()
        assert r1 is r2
