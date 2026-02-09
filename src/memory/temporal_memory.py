"""
Temporal Memory Tracker

Implements temporal tracking and versioning for memories:
- Validity window management (valid_from, valid_until)
- Supersession chain tracking (supersedes, superseded_by)
- Point-in-time queries
- Version history navigation

Inspired by Zep Graphiti temporal model.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Protocol, Tuple, runtime_checkable

logger = logging.getLogger("niko-temporal-memory")


@dataclass
class ValidityWindow:
    """Represents a temporal validity window."""
    valid_from: datetime
    valid_until: Optional[datetime] = None  # None = still valid

    def is_valid_at(self, point_in_time: datetime) -> bool:
        """Check if window is valid at a specific time."""
        if point_in_time < self.valid_from:
            return False
        if self.valid_until is not None and point_in_time >= self.valid_until:
            return False
        return True

    def is_currently_valid(self) -> bool:
        """Check if window is currently valid."""
        return self.is_valid_at(datetime.now())

    def duration(self) -> Optional[timedelta]:
        """Get duration of validity window."""
        if self.valid_until is None:
            return None
        return self.valid_until - self.valid_from

    def overlaps(self, other: "ValidityWindow") -> bool:
        """Check if this window overlaps with another."""
        # If either has no end, check start overlap
        if self.valid_until is None and other.valid_until is None:
            return True
        if self.valid_until is None:
            return self.valid_from < other.valid_until
        if other.valid_until is None:
            return other.valid_from < self.valid_until

        # Both have ends
        return (self.valid_from < other.valid_until and
                other.valid_from < self.valid_until)


@dataclass
class TemporalFact:
    """A fact with temporal validity."""
    id: str
    content: str
    entity_id: str
    validity: ValidityWindow
    supersedes: Optional[str] = None      # ID of fact this supersedes
    superseded_by: Optional[str] = None   # ID of fact that superseded this
    importance: float = 0.5
    dimension: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def is_current(self) -> bool:
        """Check if fact is currently valid and not superseded."""
        return self.superseded_by is None and self.validity.is_currently_valid()

    def is_valid_at(self, point_in_time: datetime) -> bool:
        """Check if fact was valid at a specific time."""
        return self.validity.is_valid_at(point_in_time)


@dataclass
class SupersessionChain:
    """Chain of superseded facts for an entity."""
    entity_id: str
    facts: List[TemporalFact]  # Ordered from oldest to newest
    current_fact: Optional[TemporalFact] = None

    def get_at_time(self, point_in_time: datetime) -> Optional[TemporalFact]:
        """Get the fact that was valid at a specific time."""
        for fact in reversed(self.facts):
            if fact.is_valid_at(point_in_time):
                return fact
        return None

    def get_history(self) -> List[TemporalFact]:
        """Get full history of facts (oldest first)."""
        return sorted(self.facts, key=lambda f: f.validity.valid_from)


@runtime_checkable
class ITemporalTracker(Protocol):
    """Protocol for temporal memory tracking."""

    async def add_fact(
        self,
        content: str,
        entity_id: str,
        valid_from: Optional[datetime] = None,
        valid_until: Optional[datetime] = None,
        supersedes: Optional[str] = None,
        **kwargs
    ) -> TemporalFact:
        """Add a temporal fact."""
        ...

    async def get_facts_at(
        self,
        entity_id: str,
        point_in_time: datetime
    ) -> List[TemporalFact]:
        """Get facts valid at a specific time."""
        ...

    async def get_current_facts(
        self,
        entity_id: str
    ) -> List[TemporalFact]:
        """Get currently valid facts for an entity."""
        ...

    async def supersede(
        self,
        old_fact_id: str,
        new_content: str
    ) -> TemporalFact:
        """Create a new fact that supersedes an existing one."""
        ...

    async def get_chain(
        self,
        entity_id: str
    ) -> SupersessionChain:
        """Get supersession chain for an entity."""
        ...


class TemporalMemoryTracker:
    """
    Tracks temporal validity and supersession of memories.

    Provides point-in-time queries and version history navigation.
    """

    def __init__(self, db_connection=None):
        """
        Initialize TemporalMemoryTracker.

        Args:
            db_connection: Optional database connection.
        """
        self.db = db_connection
        self._facts: Dict[str, TemporalFact] = {}
        self._entity_index: Dict[str, List[str]] = {}  # entity_id -> [fact_ids]
        logger.info("TemporalMemoryTracker initialized")

    def set_db_connection(self, db_connection) -> None:
        """Set or update database connection."""
        self.db = db_connection

    async def add_fact(
        self,
        content: str,
        entity_id: str,
        fact_id: Optional[str] = None,
        valid_from: Optional[datetime] = None,
        valid_until: Optional[datetime] = None,
        supersedes: Optional[str] = None,
        importance: float = 0.5,
        dimension: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> TemporalFact:
        """
        Add a temporal fact.

        Args:
            content: Fact content.
            entity_id: Entity this fact is about.
            fact_id: Optional fact ID (generated if not provided).
            valid_from: Start of validity (defaults to now).
            valid_until: End of validity (None = indefinite).
            supersedes: ID of fact this supersedes.
            importance: Importance score.
            dimension: Memory dimension.
            metadata: Additional metadata.

        Returns:
            Created TemporalFact.
        """
        import uuid

        if fact_id is None:
            fact_id = f"tf-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:8]}"

        validity = ValidityWindow(
            valid_from=valid_from or datetime.now(),
            valid_until=valid_until
        )

        fact = TemporalFact(
            id=fact_id,
            content=content,
            entity_id=entity_id,
            validity=validity,
            supersedes=supersedes,
            importance=importance,
            dimension=dimension,
            metadata=metadata or {}
        )

        # If superseding, update the old fact
        if supersedes and supersedes in self._facts:
            old_fact = self._facts[supersedes]
            old_fact.superseded_by = fact_id
            if old_fact.validity.valid_until is None:
                old_fact.validity.valid_until = validity.valid_from

        # Store fact
        self._facts[fact_id] = fact

        # Update entity index
        if entity_id not in self._entity_index:
            self._entity_index[entity_id] = []
        self._entity_index[entity_id].append(fact_id)

        # Persist to database if available
        if self.db:
            await self._persist_fact(fact)

        logger.debug(f"Added temporal fact {fact_id} for entity {entity_id}")
        return fact

    async def get_facts_at(
        self,
        entity_id: str,
        point_in_time: datetime
    ) -> List[TemporalFact]:
        """
        Get facts valid at a specific point in time.

        Args:
            entity_id: Entity to query.
            point_in_time: Point in time to query.

        Returns:
            List of facts valid at that time.
        """
        fact_ids = self._entity_index.get(entity_id, [])
        valid_facts = []

        for fact_id in fact_ids:
            fact = self._facts.get(fact_id)
            if fact and fact.is_valid_at(point_in_time):
                # Check if not superseded at that time
                if fact.superseded_by:
                    successor = self._facts.get(fact.superseded_by)
                    if successor and successor.validity.valid_from <= point_in_time:
                        continue  # Was superseded by this time
                valid_facts.append(fact)

        # Sort by importance
        valid_facts.sort(key=lambda f: f.importance, reverse=True)
        return valid_facts

    async def get_current_facts(self, entity_id: str) -> List[TemporalFact]:
        """
        Get currently valid facts for an entity.

        Args:
            entity_id: Entity to query.

        Returns:
            List of current facts.
        """
        fact_ids = self._entity_index.get(entity_id, [])
        current_facts = []

        for fact_id in fact_ids:
            fact = self._facts.get(fact_id)
            if fact and fact.is_current():
                current_facts.append(fact)

        current_facts.sort(key=lambda f: f.importance, reverse=True)
        return current_facts

    async def supersede(
        self,
        old_fact_id: str,
        new_content: str,
        valid_from: Optional[datetime] = None
    ) -> TemporalFact:
        """
        Create a new fact that supersedes an existing one.

        Args:
            old_fact_id: ID of fact to supersede.
            new_content: Content of new fact.
            valid_from: When new fact becomes valid (defaults to now).

        Returns:
            New TemporalFact.

        Raises:
            ValueError: If old fact not found.
        """
        old_fact = self._facts.get(old_fact_id)
        if old_fact is None:
            raise ValueError(f"Fact not found: {old_fact_id}")

        return await self.add_fact(
            content=new_content,
            entity_id=old_fact.entity_id,
            valid_from=valid_from,
            supersedes=old_fact_id,
            importance=old_fact.importance,
            dimension=old_fact.dimension
        )

    async def get_chain(self, entity_id: str) -> SupersessionChain:
        """
        Get supersession chain for an entity.

        Args:
            entity_id: Entity to query.

        Returns:
            SupersessionChain with full history.
        """
        fact_ids = self._entity_index.get(entity_id, [])
        facts = [self._facts[fid] for fid in fact_ids if fid in self._facts]

        # Find current fact (not superseded, currently valid)
        current = None
        for fact in facts:
            if fact.is_current():
                current = fact
                break

        return SupersessionChain(
            entity_id=entity_id,
            facts=facts,
            current_fact=current
        )

    async def get_history(
        self,
        entity_id: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> List[TemporalFact]:
        """
        Get history of facts for an entity within a time range.

        Args:
            entity_id: Entity to query.
            start_time: Start of time range (defaults to beginning).
            end_time: End of time range (defaults to now).

        Returns:
            List of facts ordered by valid_from.
        """
        chain = await self.get_chain(entity_id)
        history = chain.get_history()

        if start_time:
            history = [f for f in history if f.validity.valid_from >= start_time]
        if end_time:
            history = [f for f in history
                      if f.validity.valid_from <= end_time]

        return history

    async def expire_fact(
        self,
        fact_id: str,
        valid_until: Optional[datetime] = None
    ) -> bool:
        """
        Expire a fact (set valid_until).

        Args:
            fact_id: Fact to expire.
            valid_until: Expiration time (defaults to now).

        Returns:
            True if expired, False if not found.
        """
        fact = self._facts.get(fact_id)
        if fact is None:
            return False

        fact.validity.valid_until = valid_until or datetime.now()

        if self.db:
            await self._update_validity(fact_id, fact.validity)

        logger.debug(f"Expired fact {fact_id}")
        return True

    async def delete_fact(self, fact_id: str) -> bool:
        """
        Delete a fact entirely.

        Args:
            fact_id: Fact to delete.

        Returns:
            True if deleted, False if not found.
        """
        fact = self._facts.get(fact_id)
        if fact is None:
            return False

        # Update supersession chain
        if fact.supersedes and fact.supersedes in self._facts:
            predecessor = self._facts[fact.supersedes]
            predecessor.superseded_by = fact.superseded_by

        if fact.superseded_by and fact.superseded_by in self._facts:
            successor = self._facts[fact.superseded_by]
            successor.supersedes = fact.supersedes

        # Remove from indexes
        del self._facts[fact_id]
        if fact.entity_id in self._entity_index:
            self._entity_index[fact.entity_id] = [
                fid for fid in self._entity_index[fact.entity_id]
                if fid != fact_id
            ]

        if self.db:
            await self._delete_from_db(fact_id)

        logger.debug(f"Deleted fact {fact_id}")
        return True

    async def query_temporal(
        self,
        entity_id: Optional[str] = None,
        dimension: Optional[str] = None,
        valid_at: Optional[datetime] = None,
        include_superseded: bool = False,
        limit: int = 100
    ) -> List[TemporalFact]:
        """
        Query temporal facts with filters.

        Args:
            entity_id: Filter by entity.
            dimension: Filter by dimension.
            valid_at: Filter by validity at time.
            include_superseded: Include superseded facts.
            limit: Maximum results.

        Returns:
            List of matching facts.
        """
        results = []

        for fact in self._facts.values():
            # Apply filters
            if entity_id and fact.entity_id != entity_id:
                continue
            if dimension and fact.dimension != dimension:
                continue
            if valid_at and not fact.is_valid_at(valid_at):
                continue
            if not include_superseded and fact.superseded_by:
                continue

            results.append(fact)

            if len(results) >= limit:
                break

        # Sort by importance and recency
        results.sort(key=lambda f: (f.importance, f.validity.valid_from), reverse=True)
        return results

    async def _persist_fact(self, fact: TemporalFact) -> None:
        """Persist fact to database."""
        if not self.db:
            return

        try:
            self.db.execute("""
                INSERT OR REPLACE INTO memories
                (id, content, entity_id, valid_from, valid_until,
                 supersedes, superseded_by, importance, dimension)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                fact.id,
                fact.content,
                fact.entity_id,
                fact.validity.valid_from.isoformat(),
                fact.validity.valid_until.isoformat() if fact.validity.valid_until else None,
                fact.supersedes,
                fact.superseded_by,
                fact.importance,
                fact.dimension
            ))
            self.db.commit()
        except Exception as e:
            logger.error(f"Failed to persist fact {fact.id}: {e}")

    async def _update_validity(self, fact_id: str, validity: ValidityWindow) -> None:
        """Update validity in database."""
        if not self.db:
            return

        try:
            self.db.execute("""
                UPDATE memories
                SET valid_until = ?, updated_at = ?
                WHERE id = ?
            """, (
                validity.valid_until.isoformat() if validity.valid_until else None,
                datetime.now().isoformat(),
                fact_id
            ))
            self.db.commit()
        except Exception as e:
            logger.error(f"Failed to update validity for {fact_id}: {e}")

    async def _delete_from_db(self, fact_id: str) -> None:
        """Delete fact from database."""
        if not self.db:
            return

        try:
            self.db.execute("DELETE FROM memories WHERE id = ?", (fact_id,))
            self.db.commit()
        except Exception as e:
            logger.error(f"Failed to delete fact {fact_id}: {e}")

    def stats(self) -> Dict[str, Any]:
        """Get tracker statistics."""
        total = len(self._facts)
        current = sum(1 for f in self._facts.values() if f.is_current())
        superseded = sum(1 for f in self._facts.values() if f.superseded_by)
        expired = sum(1 for f in self._facts.values()
                     if not f.validity.is_currently_valid())

        return {
            "total_facts": total,
            "current_facts": current,
            "superseded_facts": superseded,
            "expired_facts": expired,
            "entities_tracked": len(self._entity_index)
        }


# Singleton instance
_temporal_tracker: Optional[TemporalMemoryTracker] = None


def get_temporal_tracker(db_connection=None) -> TemporalMemoryTracker:
    """Get or create TemporalMemoryTracker singleton."""
    global _temporal_tracker
    if _temporal_tracker is None:
        _temporal_tracker = TemporalMemoryTracker(db_connection)
    elif db_connection is not None and _temporal_tracker.db is None:
        _temporal_tracker.set_db_connection(db_connection)
    return _temporal_tracker


def reset_temporal_tracker() -> None:
    """Reset TemporalMemoryTracker singleton (for testing)."""
    global _temporal_tracker
    _temporal_tracker = None
