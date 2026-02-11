"""
Conflict Resolver Tests

Tests for ConflictResolver: data models, contradiction detection,
similarity calculation, resolution strategies, and detect_all_conflicts.
"""

import pytest
from src.memory.conflict_resolver import (
    ConflictResolutionStrategy,
    ConflictType,
    ConflictInfo,
    ResolutionResult,
    ConflictResolver,
    reset_conflict_resolver,
)


# ============================================================
# Data Model Tests
# ============================================================

class TestEnums:

    def test_strategies(self):
        assert ConflictResolutionStrategy.AUTO.value == "auto"
        assert ConflictResolutionStrategy.KEEP_OLD.value == "keep_old"
        assert ConflictResolutionStrategy.KEEP_NEW.value == "keep_new"
        assert ConflictResolutionStrategy.MERGE.value == "merge"
        assert ConflictResolutionStrategy.MANUAL.value == "manual"

    def test_conflict_types(self):
        assert ConflictType.CONTRADICTION.value == "contradiction"
        assert ConflictType.TEMPORAL.value == "temporal"
        assert ConflictType.DUPLICATE.value == "duplicate"
        assert ConflictType.UPDATE.value == "update"
        assert ConflictType.AMBIGUOUS.value == "ambiguous"


class TestConflictInfo:

    def test_defaults(self):
        ci = ConflictInfo(id="c1", content="test")
        assert ci.importance == 0.5
        assert ci.conflict_type == ConflictType.CONTRADICTION
        assert ci.similarity_score == 0.0
        assert ci.metadata == {}

    def test_all_fields(self):
        ci = ConflictInfo(
            id="c1", content="test",
            valid_from="2024-01-01", valid_until="2024-12-31",
            importance=0.9, conflict_type=ConflictType.DUPLICATE,
            similarity_score=0.95, metadata={"key": "val"},
        )
        assert ci.similarity_score == 0.95


class TestResolutionResult:

    def test_defaults(self):
        rr = ResolutionResult(action="accept")
        assert rr.kept_ids == []
        assert rr.obsolete_ids == []
        assert rr.merged_content is None
        assert rr.reason == ""
        assert rr.requires_manual is False


# ============================================================
# _is_contradictory Tests
# ============================================================

class TestIsContradictory:

    def test_negation_pair_alive_dead(self):
        resolver = ConflictResolver()
        assert resolver._is_contradictory(
            "The king is alive and well",
            "The king is dead now"
        ) is True

    def test_negation_pair_friend_enemy(self):
        resolver = ConflictResolver()
        assert resolver._is_contradictory(
            "Alice is a friend of Bob",
            "Alice is an enemy of Bob"
        ) is True

    def test_no_contradiction(self):
        resolver = ConflictResolver()
        assert resolver._is_contradictory(
            "The sky is blue",
            "The grass is green"
        ) is False

    def test_negation_no_shared_subject(self):
        resolver = ConflictResolver()
        # Different subjects even though negation pairs exist
        assert resolver._is_contradictory(
            "Alice is alive",
            "Bob is dead"
        ) is False

    def test_is_is_not(self):
        resolver = ConflictResolver()
        assert resolver._is_contradictory(
            "The castle is safe for the villagers",
            "The castle is not safe for the villagers"
        ) is True


# ============================================================
# _share_subject Tests
# ============================================================

class TestShareSubject:

    def test_shared_subject(self):
        resolver = ConflictResolver()
        assert resolver._share_subject(
            "Alice went to the castle",
            "Alice left the castle"
        ) is True

    def test_no_shared_subject(self):
        resolver = ConflictResolver()
        assert resolver._share_subject(
            "Alice went home",
            "Bob visited school"
        ) is False

    def test_empty_content(self):
        resolver = ConflictResolver()
        assert resolver._share_subject("", "") is False


# ============================================================
# _calculate_similarity Tests
# ============================================================

class TestCalculateSimilarity:

    def test_identical_content(self):
        resolver = ConflictResolver()
        sim = resolver._calculate_similarity("hello world", "hello world")
        assert sim == 1.0

    def test_completely_different(self):
        resolver = ConflictResolver()
        sim = resolver._calculate_similarity("alpha beta", "gamma delta")
        assert sim == 0.0

    def test_partial_overlap(self):
        resolver = ConflictResolver()
        sim = resolver._calculate_similarity("hello world foo", "hello world bar")
        assert 0.0 < sim < 1.0

    def test_empty_content(self):
        resolver = ConflictResolver()
        sim = resolver._calculate_similarity("", "")
        assert sim == 0.0

    def test_one_empty(self):
        resolver = ConflictResolver()
        sim = resolver._calculate_similarity("hello", "")
        assert sim == 0.0

    def test_with_embedder_fallback(self):
        resolver = ConflictResolver()
        mock_embedder = type('MockEmbedder', (), {
            'embed': lambda self, text: None,  # Will raise
            'similarity': lambda self, a, b: 0.0,
        })()
        mock_embedder.embed = lambda text: (_ for _ in ()).throw(RuntimeError("fail"))
        resolver.set_embedder(mock_embedder)
        # Should fall back to Jaccard
        sim = resolver._calculate_similarity("hello world", "hello world")
        assert sim == 1.0


# ============================================================
# _analyze_conflict Tests
# ============================================================

class TestAnalyzeConflict:

    def test_contradiction(self):
        resolver = ConflictResolver()
        ct, sim = resolver._analyze_conflict(
            "The king is alive and well in the castle",
            "The king is dead in the castle now"
        )
        assert ct == ConflictType.CONTRADICTION

    def test_duplicate(self):
        resolver = ConflictResolver(similarity_threshold=0.8)
        ct, sim = resolver._analyze_conflict(
            "Alice went to the store",
            "Alice went to the store"
        )
        assert ct == ConflictType.DUPLICATE
        assert sim >= 0.8

    def test_update(self):
        resolver = ConflictResolver(similarity_threshold=0.9)
        # Use content that shares words but doesn't trigger negation pairs
        ct, sim = resolver._analyze_conflict(
            "Alice visited the garden on Monday morning",
            "Alice visited the garden on Tuesday afternoon"
        )
        # Should be UPDATE (similarity between 0.6 and threshold)
        if ct is not None:
            assert ct in (ConflictType.UPDATE, ConflictType.DUPLICATE)

    def test_no_conflict(self):
        resolver = ConflictResolver()
        ct, sim = resolver._analyze_conflict(
            "The weather is sunny today",
            "Alice bought groceries from the store"
        )
        assert ct is None
        assert sim == 0.0


# ============================================================
# resolve Tests
# ============================================================

class TestResolve:

    @pytest.mark.asyncio
    async def test_no_conflicts(self):
        resolver = ConflictResolver()
        result = await resolver.resolve("new content", [])
        assert result.action == "accept"

    @pytest.mark.asyncio
    async def test_keep_old(self):
        resolver = ConflictResolver()
        conflicts = [ConflictInfo(id="c1", content="old")]
        result = await resolver.resolve(
            "new", conflicts,
            strategy=ConflictResolutionStrategy.KEEP_OLD
        )
        assert result.action == "reject"
        assert "c1" in result.kept_ids

    @pytest.mark.asyncio
    async def test_keep_new(self):
        resolver = ConflictResolver()
        conflicts = [ConflictInfo(id="c1", content="old")]
        result = await resolver.resolve(
            "new", conflicts,
            strategy=ConflictResolutionStrategy.KEEP_NEW
        )
        assert result.action == "update"
        assert "c1" in result.obsolete_ids

    @pytest.mark.asyncio
    async def test_merge(self):
        resolver = ConflictResolver()
        conflicts = [ConflictInfo(id="c1", content="old content", importance=0.8)]
        result = await resolver.resolve(
            "new content", conflicts,
            strategy=ConflictResolutionStrategy.MERGE
        )
        assert result.action == "merge"
        assert "old content" in result.merged_content
        assert "new content" in result.merged_content

    @pytest.mark.asyncio
    async def test_manual(self):
        resolver = ConflictResolver()
        conflicts = [ConflictInfo(id="c1", content="old")]
        result = await resolver.resolve(
            "new", conflicts,
            strategy=ConflictResolutionStrategy.MANUAL
        )
        assert result.action == "defer"
        assert result.requires_manual is True
        assert "conflicts" in result.metadata

    @pytest.mark.asyncio
    async def test_auto_contradiction(self):
        resolver = ConflictResolver()
        conflicts = [
            ConflictInfo(
                id="c1", content="old",
                conflict_type=ConflictType.CONTRADICTION,
            )
        ]
        result = await resolver.resolve("new", conflicts)
        assert result.action == "update"
        assert "c1" in result.obsolete_ids

    @pytest.mark.asyncio
    async def test_auto_duplicate_low_importance(self):
        resolver = ConflictResolver()
        conflicts = [
            ConflictInfo(
                id="c1", content="old",
                conflict_type=ConflictType.DUPLICATE,
                importance=0.3,
            )
        ]
        result = await resolver.resolve("new", conflicts)
        assert "c1" in result.obsolete_ids

    @pytest.mark.asyncio
    async def test_auto_duplicate_high_importance(self):
        resolver = ConflictResolver()
        conflicts = [
            ConflictInfo(
                id="c1", content="old",
                conflict_type=ConflictType.DUPLICATE,
                importance=0.8,
            )
        ]
        result = await resolver.resolve("new", conflicts)
        assert "c1" not in result.obsolete_ids


# ============================================================
# detect_all_conflicts Tests
# ============================================================

class TestDetectAllConflicts:

    def test_no_conflicts(self):
        resolver = ConflictResolver()
        memories = [
            {"id": "m1", "content": "The sky is blue today"},
            {"id": "m2", "content": "Alice went shopping at the mall"},
        ]
        conflicts = resolver.detect_all_conflicts(memories)
        assert len(conflicts) == 0

    def test_detects_contradiction(self):
        resolver = ConflictResolver()
        memories = [
            {"id": "m1", "content": "The king is alive and rules the kingdom"},
            {"id": "m2", "content": "The king is dead and the kingdom mourns"},
        ]
        conflicts = resolver.detect_all_conflicts(memories)
        assert len(conflicts) >= 1
        assert conflicts[0][2] == ConflictType.CONTRADICTION

    def test_detects_duplicate(self):
        resolver = ConflictResolver(similarity_threshold=0.8)
        memories = [
            {"id": "m1", "content": "Alice went to the store"},
            {"id": "m2", "content": "Alice went to the store"},
        ]
        conflicts = resolver.detect_all_conflicts(memories)
        assert len(conflicts) >= 1

    def test_empty_memories(self):
        resolver = ConflictResolver()
        conflicts = resolver.detect_all_conflicts([])
        assert conflicts == []

    def test_single_memory(self):
        resolver = ConflictResolver()
        conflicts = resolver.detect_all_conflicts([{"id": "m1", "content": "solo"}])
        assert conflicts == []


# ============================================================
# check() Tests (requires DB - test no-db path)
# ============================================================

class TestCheck:

    @pytest.mark.asyncio
    async def test_no_db_returns_empty(self):
        resolver = ConflictResolver()
        result = await resolver.check("new content", entity_id="e1")
        assert result == []

    @pytest.mark.asyncio
    async def test_no_entity_returns_empty(self):
        resolver = ConflictResolver()
        result = await resolver.check("new content")
        assert result == []


# ============================================================
# Singleton Tests
# ============================================================

class TestSingleton:

    def test_reset(self):
        reset_conflict_resolver()
        # Should not raise
