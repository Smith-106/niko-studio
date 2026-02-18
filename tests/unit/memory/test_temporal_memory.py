"""
Temporal Memory Tests

Tests for ValidityWindow, TemporalFact, SupersessionChain,
and TemporalMemoryTracker (in-memory operations without DB).
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock
from src.memory.temporal_memory import (
    ValidityWindow,
    TemporalFact,
    SupersessionChain,
    TemporalMemoryTracker,
    get_temporal_tracker,
    reset_temporal_tracker,
)


# ============================================================
# ValidityWindow Tests
# ============================================================

class TestValidityWindow:

    def test_is_valid_at_within(self):
        now = datetime.now()
        w = ValidityWindow(valid_from=now - timedelta(hours=1), valid_until=now + timedelta(hours=1))
        assert w.is_valid_at(now) is True

    def test_is_valid_at_before(self):
        now = datetime.now()
        w = ValidityWindow(valid_from=now, valid_until=now + timedelta(hours=1))
        assert w.is_valid_at(now - timedelta(hours=1)) is False

    def test_is_valid_at_after(self):
        now = datetime.now()
        w = ValidityWindow(valid_from=now - timedelta(hours=2), valid_until=now - timedelta(hours=1))
        assert w.is_valid_at(now) is False

    def test_is_valid_at_no_end(self):
        now = datetime.now()
        w = ValidityWindow(valid_from=now - timedelta(hours=1))
        assert w.is_valid_at(now) is True

    def test_is_valid_at_exact_end(self):
        now = datetime.now()
        w = ValidityWindow(valid_from=now - timedelta(hours=1), valid_until=now)
        # valid_until is exclusive (>= check)
        assert w.is_valid_at(now) is False

    def test_is_currently_valid(self):
        w = ValidityWindow(valid_from=datetime.now() - timedelta(hours=1))
        assert w.is_currently_valid() is True

    def test_is_currently_valid_expired(self):
        w = ValidityWindow(
            valid_from=datetime.now() - timedelta(hours=2),
            valid_until=datetime.now() - timedelta(hours=1),
        )
        assert w.is_currently_valid() is False

    def test_duration_with_end(self):
        start = datetime(2024, 1, 1)
        end = datetime(2024, 1, 2)
        w = ValidityWindow(valid_from=start, valid_until=end)
        assert w.duration() == timedelta(days=1)

    def test_duration_no_end(self):
        w = ValidityWindow(valid_from=datetime.now())
        assert w.duration() is None

    def test_overlaps_both_open(self):
        w1 = ValidityWindow(valid_from=datetime(2024, 1, 1))
        w2 = ValidityWindow(valid_from=datetime(2024, 6, 1))
        assert w1.overlaps(w2) is True

    def test_overlaps_one_open(self):
        w1 = ValidityWindow(valid_from=datetime(2024, 1, 1))
        w2 = ValidityWindow(valid_from=datetime(2024, 3, 1), valid_until=datetime(2024, 6, 1))
        assert w1.overlaps(w2) is True

    def test_overlaps_partial(self):
        w1 = ValidityWindow(valid_from=datetime(2024, 1, 1), valid_until=datetime(2024, 6, 1))
        w2 = ValidityWindow(valid_from=datetime(2024, 3, 1), valid_until=datetime(2024, 9, 1))
        assert w1.overlaps(w2) is True

    def test_no_overlap(self):
        w1 = ValidityWindow(valid_from=datetime(2024, 1, 1), valid_until=datetime(2024, 3, 1))
        w2 = ValidityWindow(valid_from=datetime(2024, 6, 1), valid_until=datetime(2024, 9, 1))
        assert w1.overlaps(w2) is False

    def test_no_overlap_adjacent(self):
        w1 = ValidityWindow(valid_from=datetime(2024, 1, 1), valid_until=datetime(2024, 3, 1))
        w2 = ValidityWindow(valid_from=datetime(2024, 3, 1), valid_until=datetime(2024, 6, 1))
        assert w1.overlaps(w2) is False

    def test_overlaps_second_open_no_overlap(self):
        w1 = ValidityWindow(valid_from=datetime(2024, 1, 1), valid_until=datetime(2024, 3, 1))
        w2 = ValidityWindow(valid_from=datetime(2024, 6, 1))
        assert w1.overlaps(w2) is False


# ============================================================
# TemporalFact Tests
# ============================================================

class TestTemporalFact:

    def test_is_current_valid(self):
        f = TemporalFact(
            id="f1", content="test", entity_id="e1",
            validity=ValidityWindow(valid_from=datetime.now() - timedelta(hours=1)),
        )
        assert f.is_current() is True

    def test_is_current_superseded(self):
        f = TemporalFact(
            id="f1", content="test", entity_id="e1",
            validity=ValidityWindow(valid_from=datetime.now() - timedelta(hours=1)),
            superseded_by="f2",
        )
        assert f.is_current() is False

    def test_is_current_expired(self):
        f = TemporalFact(
            id="f1", content="test", entity_id="e1",
            validity=ValidityWindow(
                valid_from=datetime.now() - timedelta(hours=2),
                valid_until=datetime.now() - timedelta(hours=1),
            ),
        )
        assert f.is_current() is False

    def test_is_valid_at(self):
        now = datetime.now()
        f = TemporalFact(
            id="f1", content="test", entity_id="e1",
            validity=ValidityWindow(valid_from=now - timedelta(hours=1)),
        )
        assert f.is_valid_at(now) is True
        assert f.is_valid_at(now - timedelta(hours=2)) is False


# ============================================================
# SupersessionChain Tests
# ============================================================

class TestSupersessionChain:

    def test_get_at_time(self):
        now = datetime.now()
        f1 = TemporalFact(
            id="f1", content="old", entity_id="e1",
            validity=ValidityWindow(
                valid_from=now - timedelta(days=2),
                valid_until=now - timedelta(days=1),
            ),
        )
        f2 = TemporalFact(
            id="f2", content="new", entity_id="e1",
            validity=ValidityWindow(valid_from=now - timedelta(days=1)),
        )
        chain = SupersessionChain(entity_id="e1", facts=[f1, f2])

        # Query at old time
        result = chain.get_at_time(now - timedelta(days=1, hours=12))
        assert result.id == "f1"

        # Query at current time
        result = chain.get_at_time(now)
        assert result.id == "f2"

    def test_get_at_time_none(self):
        chain = SupersessionChain(entity_id="e1", facts=[])
        assert chain.get_at_time(datetime.now()) is None

    def test_get_history(self):
        now = datetime.now()
        f2 = TemporalFact(
            id="f2", content="newer", entity_id="e1",
            validity=ValidityWindow(valid_from=now),
        )
        f1 = TemporalFact(
            id="f1", content="older", entity_id="e1",
            validity=ValidityWindow(valid_from=now - timedelta(days=1)),
        )
        # Deliberately out of order
        chain = SupersessionChain(entity_id="e1", facts=[f2, f1])
        history = chain.get_history()
        assert history[0].id == "f1"  # Older first
        assert history[1].id == "f2"


# ============================================================
# TemporalMemoryTracker Tests (in-memory, no DB)
# ============================================================

class TestTemporalMemoryTracker:

    def setup_method(self):
        reset_temporal_tracker()

    @pytest.mark.asyncio
    async def test_add_fact(self):
        tracker = TemporalMemoryTracker()
        fact = await tracker.add_fact("Alice is brave", "alice")
        assert fact.content == "Alice is brave"
        assert fact.entity_id == "alice"
        assert fact.id.startswith("tf-")

    @pytest.mark.asyncio
    async def test_add_fact_custom_id(self):
        tracker = TemporalMemoryTracker()
        fact = await tracker.add_fact("test", "e1", fact_id="custom-id")
        assert fact.id == "custom-id"

    @pytest.mark.asyncio
    async def test_get_current_facts(self):
        tracker = TemporalMemoryTracker()
        await tracker.add_fact("fact1", "e1")
        await tracker.add_fact("fact2", "e1")
        facts = await tracker.get_current_facts("e1")
        assert len(facts) == 2

    @pytest.mark.asyncio
    async def test_get_current_facts_empty(self):
        tracker = TemporalMemoryTracker()
        facts = await tracker.get_current_facts("nonexistent")
        assert facts == []

    @pytest.mark.asyncio
    async def test_supersede(self):
        tracker = TemporalMemoryTracker()
        f1 = await tracker.add_fact("Alice is cautious", "alice", fact_id="f1")
        f2 = await tracker.supersede("f1", "Alice is brave")
        assert f2.supersedes == "f1"
        assert f1.superseded_by == f2.id

    @pytest.mark.asyncio
    async def test_supersede_not_found(self):
        tracker = TemporalMemoryTracker()
        with pytest.raises(ValueError, match="Fact not found"):
            await tracker.supersede("nonexistent", "new content")

    @pytest.mark.asyncio
    async def test_get_facts_at(self):
        tracker = TemporalMemoryTracker()
        now = datetime.now()
        await tracker.add_fact(
            "old fact", "e1", fact_id="f1",
            valid_from=now - timedelta(days=2),
            valid_until=now - timedelta(days=1),
        )
        await tracker.add_fact(
            "current fact", "e1", fact_id="f2",
            valid_from=now - timedelta(days=1),
        )
        # Query at old time
        facts = await tracker.get_facts_at("e1", now - timedelta(days=1, hours=12))
        assert len(facts) == 1
        assert facts[0].id == "f1"

    @pytest.mark.asyncio
    async def test_get_chain(self):
        tracker = TemporalMemoryTracker()
        await tracker.add_fact("v1", "e1", fact_id="f1")
        await tracker.supersede("f1", "v2")
        chain = await tracker.get_chain("e1")
        assert chain.entity_id == "e1"
        assert len(chain.facts) == 2

    @pytest.mark.asyncio
    async def test_expire_fact(self):
        tracker = TemporalMemoryTracker()
        await tracker.add_fact("test", "e1", fact_id="f1")
        result = await tracker.expire_fact("f1")
        assert result is True
        facts = await tracker.get_current_facts("e1")
        assert len(facts) == 0

    @pytest.mark.asyncio
    async def test_expire_fact_not_found(self):
        tracker = TemporalMemoryTracker()
        result = await tracker.expire_fact("nonexistent")
        assert result is False

    @pytest.mark.asyncio
    async def test_delete_fact(self):
        tracker = TemporalMemoryTracker()
        await tracker.add_fact("test", "e1", fact_id="f1")
        result = await tracker.delete_fact("f1")
        assert result is True
        facts = await tracker.get_current_facts("e1")
        assert len(facts) == 0

    @pytest.mark.asyncio
    async def test_delete_fact_not_found(self):
        tracker = TemporalMemoryTracker()
        result = await tracker.delete_fact("nonexistent")
        assert result is False

    @pytest.mark.asyncio
    async def test_delete_fact_updates_chain(self):
        tracker = TemporalMemoryTracker()
        await tracker.add_fact("v1", "e1", fact_id="f1")
        f2 = await tracker.supersede("f1", "v2")
        f3 = await tracker.supersede(f2.id, "v3")
        # Delete middle fact
        await tracker.delete_fact(f2.id)
        # f1 should point to f3, f3 should point back to f1
        assert tracker._facts["f1"].superseded_by == f3.id
        assert tracker._facts[f3.id].supersedes == "f1"

    @pytest.mark.asyncio
    async def test_query_temporal_all(self):
        tracker = TemporalMemoryTracker()
        await tracker.add_fact("fact1", "e1", fact_id="f1")
        await tracker.add_fact("fact2", "e2", fact_id="f2")
        results = await tracker.query_temporal()
        assert len(results) == 2

    @pytest.mark.asyncio
    async def test_query_temporal_by_entity(self):
        tracker = TemporalMemoryTracker()
        await tracker.add_fact("fact1", "e1", fact_id="f1")
        await tracker.add_fact("fact2", "e2", fact_id="f2")
        results = await tracker.query_temporal(entity_id="e1")
        assert len(results) == 1
        assert results[0].entity_id == "e1"

    @pytest.mark.asyncio
    async def test_query_temporal_by_dimension(self):
        tracker = TemporalMemoryTracker()
        await tracker.add_fact("fact1", "e1", fact_id="f1", dimension="character")
        await tracker.add_fact("fact2", "e1", fact_id="f2", dimension="worldview")
        results = await tracker.query_temporal(dimension="character")
        assert len(results) == 1

    @pytest.mark.asyncio
    async def test_query_temporal_exclude_superseded(self):
        tracker = TemporalMemoryTracker()
        await tracker.add_fact("old", "e1", fact_id="f1")
        await tracker.supersede("f1", "new")
        results = await tracker.query_temporal(entity_id="e1", include_superseded=False)
        assert len(results) == 1
        assert results[0].content == "new"

    @pytest.mark.asyncio
    async def test_query_temporal_include_superseded(self):
        tracker = TemporalMemoryTracker()
        await tracker.add_fact("old", "e1", fact_id="f1")
        await tracker.supersede("f1", "new")
        results = await tracker.query_temporal(entity_id="e1", include_superseded=True)
        assert len(results) == 2

    @pytest.mark.asyncio
    async def test_query_temporal_limit(self):
        tracker = TemporalMemoryTracker()
        for i in range(10):
            await tracker.add_fact(f"fact{i}", "e1", fact_id=f"f{i}")
        results = await tracker.query_temporal(limit=3)
        assert len(results) == 3

    @pytest.mark.asyncio
    async def test_get_history(self):
        tracker = TemporalMemoryTracker()
        now = datetime.now()
        await tracker.add_fact("v1", "e1", fact_id="f1", valid_from=now - timedelta(days=2))
        await tracker.add_fact("v2", "e1", fact_id="f2", valid_from=now - timedelta(days=1))
        await tracker.add_fact("v3", "e1", fact_id="f3", valid_from=now)
        history = await tracker.get_history("e1")
        assert len(history) == 3
        assert history[0].id == "f1"  # Oldest first

    @pytest.mark.asyncio
    async def test_get_history_time_range(self):
        tracker = TemporalMemoryTracker()
        now = datetime.now()
        await tracker.add_fact("v1", "e1", fact_id="f1", valid_from=now - timedelta(days=3))
        await tracker.add_fact("v2", "e1", fact_id="f2", valid_from=now - timedelta(days=1))
        await tracker.add_fact("v3", "e1", fact_id="f3", valid_from=now)
        history = await tracker.get_history(
            "e1",
            start_time=now - timedelta(days=2),
            end_time=now - timedelta(hours=1),
        )
        assert len(history) == 1
        assert history[0].id == "f2"

    def test_stats(self):
        tracker = TemporalMemoryTracker()
        stats = tracker.stats()
        assert stats["total_facts"] == 0
        assert stats["entities_tracked"] == 0

    @pytest.mark.asyncio
    async def test_get_facts_at_skips_superseded_successor_already_valid(self):
        tracker = TemporalMemoryTracker()
        now = datetime.now()
        await tracker.add_fact("old", "e1", fact_id="f1", valid_from=now - timedelta(days=2))
        successor = await tracker.supersede("f1", "new", valid_from=now - timedelta(days=1))

        # Force old fact to still be valid so superseded-branch logic executes.
        tracker._facts["f1"].validity.valid_until = None

        facts = await tracker.get_facts_at("e1", successor.validity.valid_from)
        assert len(facts) == 1
        assert facts[0].content == "new"

    @pytest.mark.asyncio
    async def test_expire_fact_with_db_calls_update_validity(self):
        db = MagicMock()
        tracker = TemporalMemoryTracker(db_connection=db)
        await tracker.add_fact("x", "e1", fact_id="f1")
        tracker._update_validity = AsyncMock()

        result = await tracker.expire_fact("f1")

        assert result is True
        tracker._update_validity.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_delete_fact_with_db_calls_delete_from_db(self):
        db = MagicMock()
        tracker = TemporalMemoryTracker(db_connection=db)
        await tracker.add_fact("x", "e1", fact_id="f1")
        tracker._delete_from_db = AsyncMock()

        result = await tracker.delete_fact("f1")

        assert result is True
        tracker._delete_from_db.assert_awaited_once_with("f1")

    @pytest.mark.asyncio
    async def test_query_temporal_filters_valid_at(self):
        tracker = TemporalMemoryTracker()
        now = datetime.now()
        await tracker.add_fact("old", "e1", fact_id="f1", valid_from=now - timedelta(days=3), valid_until=now - timedelta(days=2))
        await tracker.add_fact("current", "e1", fact_id="f2", valid_from=now - timedelta(days=1))

        results = await tracker.query_temporal(entity_id="e1", valid_at=now)

        assert len(results) == 1
        assert results[0].id == "f2"

    @pytest.mark.asyncio
    async def test_persist_fact_no_db_branch(self):
        tracker = TemporalMemoryTracker()
        fact = await tracker.add_fact("x", "e1", fact_id="f1")
        await tracker._persist_fact(fact)

    @pytest.mark.asyncio
    async def test_persist_fact_exception_branch(self):
        db = MagicMock()
        db.execute.side_effect = RuntimeError("db-fail")
        tracker = TemporalMemoryTracker(db_connection=db)
        fact = TemporalFact(
            id="f1",
            content="x",
            entity_id="e1",
            validity=ValidityWindow(valid_from=datetime.now()),
        )

        await tracker._persist_fact(fact)

    @pytest.mark.asyncio
    async def test_update_validity_no_db_branch(self):
        tracker = TemporalMemoryTracker()
        await tracker._update_validity("f1", ValidityWindow(valid_from=datetime.now()))

    @pytest.mark.asyncio
    async def test_update_validity_success_branch(self):
        db = MagicMock()
        tracker = TemporalMemoryTracker(db_connection=db)

        await tracker._update_validity("f1", ValidityWindow(valid_from=datetime.now(), valid_until=datetime.now()))

        db.execute.assert_called_once()
        db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_validity_exception_branch(self):
        class BadDB:
            def execute(self, *args, **kwargs):
                raise RuntimeError("db-fail")

            def commit(self):
                return None

        tracker = TemporalMemoryTracker(db_connection=BadDB())

        await tracker._update_validity("f1", ValidityWindow(valid_from=datetime.now(), valid_until=datetime.now()))

    @pytest.mark.asyncio
    async def test_delete_from_db_no_db_branch(self):
        tracker = TemporalMemoryTracker()
        await tracker._delete_from_db("f1")

    @pytest.mark.asyncio
    async def test_delete_from_db_success_branch(self):
        db = MagicMock()
        tracker = TemporalMemoryTracker(db_connection=db)

        await tracker._delete_from_db("f1")

        db.execute.assert_called_once_with("DELETE FROM memories WHERE id = ?", ("f1",))
        db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_from_db_exception_branch(self):
        class BadDB:
            def execute(self, *args, **kwargs):
                raise RuntimeError("db-fail")

            def commit(self):
                return None

        tracker = TemporalMemoryTracker(db_connection=BadDB())

        await tracker._delete_from_db("f1")


def test_get_temporal_tracker_singleton_and_db_attachment():
    reset_temporal_tracker()

    first = get_temporal_tracker()
    assert first.db is None

    db = MagicMock()
    second = get_temporal_tracker(db)
    assert second is first
    assert second.db is db


def test_get_temporal_tracker_keeps_existing_db():
    reset_temporal_tracker()

    db1 = MagicMock()
    db2 = MagicMock()

    first = get_temporal_tracker(db1)
    second = get_temporal_tracker(db2)

    assert second is first
    assert second.db is db1
