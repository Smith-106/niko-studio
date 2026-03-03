"""
Conflict Resolver Module

Extracted from unified_memory.py with enhancements:
- ConflictResolutionStrategy enum for strategy selection
- Enhanced semantic similarity detection
- Conflict resolution with configurable strategies

Strategies:
- AUTO: Newer information supersedes older (default)
- KEEP_OLD: Preserve existing information
- KEEP_NEW: Replace with new information
- MERGE: Combine both versions
- MANUAL: Defer to user decision
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Protocol, Tuple, runtime_checkable

logger = logging.getLogger("niko-conflict-resolver")


class ConflictResolutionStrategy(Enum):
    """Strategies for resolving memory conflicts."""
    AUTO = "auto"           # Automatic: newer supersedes older
    KEEP_OLD = "keep_old"   # Preserve existing information
    KEEP_NEW = "keep_new"   # Replace with new information
    MERGE = "merge"         # Combine both versions
    MANUAL = "manual"       # Defer to user decision


class ConflictType(Enum):
    """Types of detected conflicts."""
    CONTRADICTION = "contradiction"   # Direct semantic contradiction
    TEMPORAL = "temporal"             # Time-based conflict
    DUPLICATE = "duplicate"           # Near-duplicate content
    UPDATE = "update"                 # Information update
    AMBIGUOUS = "ambiguous"           # Unclear conflict


@dataclass
class ConflictInfo:
    """Information about a detected conflict."""
    id: str
    content: str
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None
    importance: float = 0.5
    conflict_type: ConflictType = ConflictType.CONTRADICTION
    similarity_score: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ResolutionResult:
    """Result of conflict resolution."""
    action: str  # "update", "reject", "merge", "defer"
    kept_ids: List[str] = field(default_factory=list)
    obsolete_ids: List[str] = field(default_factory=list)
    merged_content: Optional[str] = None
    reason: str = ""
    requires_manual: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)


@runtime_checkable
class IConflictResolver(Protocol):
    """Protocol for conflict resolution implementations."""

    async def check(
        self,
        content: str,
        entity_id: Optional[str] = None
    ) -> List[ConflictInfo]:
        """
        Check for potential conflicts.

        Args:
            content: New content to check.
            entity_id: Entity ID to scope the check.

        Returns:
            List of detected conflicts.
        """
        ...

    async def resolve(
        self,
        content: str,
        conflicts: List[ConflictInfo],
        strategy: ConflictResolutionStrategy = ConflictResolutionStrategy.AUTO
    ) -> ResolutionResult:
        """
        Resolve detected conflicts.

        Args:
            content: New content being added.
            conflicts: List of detected conflicts.
            strategy: Resolution strategy to use.

        Returns:
            ResolutionResult with action to take.
        """
        ...


class ConflictResolver:
    """
    Conflict detection and resolution engine.

    Detects contradictions, duplicates, and temporal conflicts
    in memory content and provides resolution strategies.
    """

    # Negation pairs for contradiction detection
    NEGATION_PAIRS = [
        ("is", "is not"), ("are", "are not"),
        ("was", "was not"), ("were", "were not"),
        ("has", "has not"), ("have", "have not"),
        ("can", "cannot"), ("will", "will not"),
        ("does", "does not"), ("do", "do not"),
        ("alive", "dead"), ("true", "false"),
        ("yes", "no"), ("accept", "reject"),
        ("love", "hate"), ("friend", "enemy"),
        ("success", "failure"), ("win", "lose"),
    ]

    def __init__(self, db_connection=None, similarity_threshold: float = 0.85):
        """
        Initialize ConflictResolver.

        Args:
            db_connection: Optional database connection for querying existing memories.
            similarity_threshold: Threshold for considering content as duplicate.
        """
        self.db = db_connection
        self.similarity_threshold = similarity_threshold
        self._embedder = None
        logger.info("ConflictResolver initialized")

    def set_db_connection(self, db_connection) -> None:
        """Set or update database connection."""
        self.db = db_connection

    def set_embedder(self, embedder) -> None:
        """Set embedding engine for semantic similarity."""
        self._embedder = embedder

    async def check(
        self,
        content: str,
        entity_id: Optional[str] = None
    ) -> List[ConflictInfo]:
        """
        Check for potential conflicts with existing memories.

        Args:
            content: New content to check.
            entity_id: Entity ID to scope the check.

        Returns:
            List of detected conflicts.
        """
        if not entity_id or not self.db:
            return []

        try:
            cursor = self.db.execute("""
                SELECT id, content, valid_from, valid_until, importance
                FROM memories
                WHERE entity_id = ?
                AND superseded_by IS NULL
                AND (valid_until IS NULL OR valid_until > datetime('now'))
            """, (entity_id,))

            conflicts = []
            rows = cursor.fetchall()
            for row in rows:
                existing_content = row[1]
                conflict_type, similarity = self._analyze_conflict(content, existing_content)

                if conflict_type is not None:
                    conflicts.append(ConflictInfo(
                        id=row[0],
                        content=existing_content,
                        valid_from=row[2],
                        valid_until=row[3],
                        importance=row[4] or 0.5,
                        conflict_type=conflict_type,
                        similarity_score=similarity
                    ))

            return conflicts

        except Exception as e:
            logger.error(f"Conflict check failed: {e}")
            return []

    def _analyze_conflict(
        self,
        new_content: str,
        existing_content: str
    ) -> Tuple[Optional[ConflictType], float]:
        """
        Analyze potential conflict between contents.

        Returns:
            Tuple of (conflict_type, similarity_score) or (None, 0.0) if no conflict.
        """
        # Check for contradiction
        if self._is_contradictory(new_content, existing_content):
            return ConflictType.CONTRADICTION, 0.0

        # Check for semantic similarity (duplicate/update)
        similarity = self._calculate_similarity(new_content, existing_content)

        if similarity >= self.similarity_threshold:
            return ConflictType.DUPLICATE, similarity
        elif similarity >= 0.6:
            return ConflictType.UPDATE, similarity

        return None, 0.0

    def _is_contradictory(self, content_a: str, content_b: str) -> bool:
        """
        Detect if two contents are contradictory.

        Uses negation pair detection and semantic analysis.
        """
        a_lower = content_a.lower()
        b_lower = content_b.lower()

        # Check negation pairs
        for pos, neg in self.NEGATION_PAIRS:
            if (pos in a_lower and neg in b_lower) or \
               (neg in a_lower and pos in b_lower):
                # Verify they're talking about the same subject
                if self._share_subject(content_a, content_b):
                    return True

        return False

    def _share_subject(self, content_a: str, content_b: str) -> bool:
        """Check if two contents share a common subject."""
        # Extract nouns/proper nouns (simplified)
        import re

        def extract_words(text: str) -> set:
            words = set(re.findall(r'\b[A-Za-z]+\b', text.lower()))
            # Filter out common words
            stopwords = {'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be',
                        'been', 'being', 'have', 'has', 'had', 'do', 'does',
                        'did', 'will', 'would', 'could', 'should', 'may',
                        'might', 'must', 'shall', 'can', 'need', 'to', 'of',
                        'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
                        'into', 'through', 'during', 'before', 'after',
                        'above', 'below', 'between', 'under', 'again',
                        'further', 'then', 'once', 'and', 'but', 'or', 'nor',
                        'so', 'yet', 'both', 'either', 'neither', 'not',
                        'only', 'own', 'same', 'than', 'too', 'very', 'just'}
            return words - stopwords

        words_a = extract_words(content_a)
        words_b = extract_words(content_b)

        # Check for significant overlap
        overlap = words_a & words_b
        min_size = min(len(words_a), len(words_b))

        if min_size == 0:
            return False

        return len(overlap) / min_size >= 0.3

    def _calculate_similarity(self, content_a: str, content_b: str) -> float:
        """
        Calculate semantic similarity between contents.

        Uses embedding similarity if available, falls back to lexical.
        """
        if self._embedder is not None:
            try:
                vec_a = self._embedder.embed(content_a)
                vec_b = self._embedder.embed(content_b)
                return self._embedder.similarity(vec_a, vec_b)
            except Exception as e:
                logger.debug(f"Embedding similarity failed: {e}")

        # Fallback: Jaccard similarity
        words_a = set(content_a.lower().split())
        words_b = set(content_b.lower().split())

        if not words_a or not words_b:
            return 0.0

        intersection = len(words_a & words_b)
        union = len(words_a | words_b)

        return intersection / union if union > 0 else 0.0

    async def resolve(
        self,
        content: str,
        conflicts: List[ConflictInfo],
        strategy: ConflictResolutionStrategy = ConflictResolutionStrategy.AUTO
    ) -> ResolutionResult:
        """
        Resolve detected conflicts using specified strategy.

        Args:
            content: New content being added.
            conflicts: List of detected conflicts.
            strategy: Resolution strategy to use.

        Returns:
            ResolutionResult with action to take.
        """
        if not conflicts:
            return ResolutionResult(
                action="accept",
                reason="No conflicts detected"
            )

        if strategy == ConflictResolutionStrategy.AUTO:
            return await self._resolve_auto(content, conflicts)
        elif strategy == ConflictResolutionStrategy.KEEP_OLD:
            return self._resolve_keep_old(conflicts)
        elif strategy == ConflictResolutionStrategy.KEEP_NEW:
            return self._resolve_keep_new(conflicts)
        elif strategy == ConflictResolutionStrategy.MERGE:
            return self._resolve_merge(content, conflicts)
        elif strategy == ConflictResolutionStrategy.MANUAL:
            return self._resolve_manual(content, conflicts)
        else:
            return await self._resolve_auto(content, conflicts)

    async def _resolve_auto(
        self,
        content: str,
        conflicts: List[ConflictInfo]
    ) -> ResolutionResult:
        """
        Automatic resolution: newer information supersedes older.

        For duplicates, keeps the most important.
        For contradictions, uses recency.
        """
        obsolete_ids = []

        for conflict in conflicts:
            if conflict.conflict_type == ConflictType.DUPLICATE:
                # Keep higher importance
                if conflict.importance < 0.5:
                    obsolete_ids.append(conflict.id)
            elif conflict.conflict_type in (ConflictType.CONTRADICTION, ConflictType.UPDATE):
                # Newer supersedes older
                obsolete_ids.append(conflict.id)

        return ResolutionResult(
            action="update",
            obsolete_ids=obsolete_ids,
            reason="Newer information supersedes older (auto strategy)"
        )

    def _resolve_keep_old(self, conflicts: List[ConflictInfo]) -> ResolutionResult:
        """Keep existing information, reject new content."""
        return ResolutionResult(
            action="reject",
            kept_ids=[c.id for c in conflicts],
            reason="Keeping existing information (keep_old strategy)"
        )

    def _resolve_keep_new(self, conflicts: List[ConflictInfo]) -> ResolutionResult:
        """Replace with new information."""
        return ResolutionResult(
            action="update",
            obsolete_ids=[c.id for c in conflicts],
            reason="Replacing with new information (keep_new strategy)"
        )

    def _resolve_merge(
        self,
        content: str,
        conflicts: List[ConflictInfo]
    ) -> ResolutionResult:
        """Merge old and new content."""
        # Find the most relevant conflict to merge with
        primary_conflict = max(conflicts, key=lambda c: c.importance)

        # Create merged content
        merged = f"{primary_conflict.content}\n\n[Updated]: {content}"

        return ResolutionResult(
            action="merge",
            obsolete_ids=[c.id for c in conflicts],
            merged_content=merged,
            reason="Merged old and new information (merge strategy)"
        )

    def _resolve_manual(
        self,
        content: str,
        conflicts: List[ConflictInfo]
    ) -> ResolutionResult:
        """Defer to manual resolution."""
        return ResolutionResult(
            action="defer",
            requires_manual=True,
            reason="Manual resolution required",
            metadata={
                "new_content": content,
                "conflicts": [
                    {
                        "id": c.id,
                        "content": c.content,
                        "type": c.conflict_type.value,
                        "similarity": c.similarity_score
                    }
                    for c in conflicts
                ]
            }
        )

    def detect_all_conflicts(
        self,
        memories: List[Dict[str, Any]]
    ) -> List[Tuple[str, str, ConflictType]]:
        """
        Detect all conflicts within a set of memories.

        Args:
            memories: List of memory dicts with 'id' and 'content'.

        Returns:
            List of (id_a, id_b, conflict_type) tuples.
        """
        conflicts = []

        for i, mem_a in enumerate(memories):
            for mem_b in memories[i+1:]:
                conflict_type, _ = self._analyze_conflict(
                    mem_a.get("content", ""),
                    mem_b.get("content", "")
                )
                if conflict_type is not None:
                    conflicts.append((
                        mem_a.get("id", ""),
                        mem_b.get("id", ""),
                        conflict_type
                    ))

        return conflicts


# Singleton instance
_conflict_resolver: Optional[ConflictResolver] = None


def get_conflict_resolver(
    db_connection=None,
    similarity_threshold: float = 0.85
) -> ConflictResolver:
    """Get or create ConflictResolver singleton."""
    global _conflict_resolver
    if _conflict_resolver is None:
        _conflict_resolver = ConflictResolver(db_connection, similarity_threshold)
    elif db_connection is not None and _conflict_resolver.db is None:
        _conflict_resolver.set_db_connection(db_connection)
    return _conflict_resolver


def reset_conflict_resolver() -> None:
    """Reset ConflictResolver singleton (for testing)."""
    global _conflict_resolver
    _conflict_resolver = None
