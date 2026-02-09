"""
Memory Layer Handlers - Four-Layer Memory Architecture

Implements IMemoryLayer Protocol with 4 layer handlers:
- EphemeralLayer: Temporary memory (< 1 hour TTL)
- SessionLayer: Current task scope
- UserLayer: Long-term user preferences
- ProjectLayer: Novel-level scope

Each layer has different TTL, scope, and persistence characteristics.
"""

import logging
from abc import abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Protocol, runtime_checkable

logger = logging.getLogger("niko-memory-layers")


class LayerType(Enum):
    """Memory layer types with TTL characteristics."""
    EPHEMERAL = "ephemeral"   # < 1 hour
    SESSION = "session"       # Current task
    USER = "user"             # Long-term preferences
    PROJECT = "project"       # Novel-level scope


@dataclass
class LayerConfig:
    """Configuration for a memory layer."""
    layer_type: LayerType
    default_ttl_seconds: Optional[int] = None  # None = no expiration
    max_entries: int = 10000
    auto_expire: bool = True
    persist_on_close: bool = True


# Default configurations for each layer
LAYER_CONFIGS: Dict[LayerType, LayerConfig] = {
    LayerType.EPHEMERAL: LayerConfig(
        layer_type=LayerType.EPHEMERAL,
        default_ttl_seconds=3600,  # 1 hour
        max_entries=1000,
        auto_expire=True,
        persist_on_close=False
    ),
    LayerType.SESSION: LayerConfig(
        layer_type=LayerType.SESSION,
        default_ttl_seconds=86400,  # 24 hours
        max_entries=5000,
        auto_expire=True,
        persist_on_close=True
    ),
    LayerType.USER: LayerConfig(
        layer_type=LayerType.USER,
        default_ttl_seconds=None,  # No expiration
        max_entries=10000,
        auto_expire=False,
        persist_on_close=True
    ),
    LayerType.PROJECT: LayerConfig(
        layer_type=LayerType.PROJECT,
        default_ttl_seconds=None,  # No expiration
        max_entries=50000,
        auto_expire=False,
        persist_on_close=True
    ),
}


@dataclass
class LayerEntry:
    """Entry stored in a memory layer."""
    id: str
    content: str
    created_at: datetime = field(default_factory=datetime.now)
    expires_at: Optional[datetime] = None
    importance: float = 0.5
    access_count: int = 0
    last_accessed: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def is_expired(self) -> bool:
        """Check if entry has expired."""
        if self.expires_at is None:
            return False
        return datetime.now() > self.expires_at

    def touch(self) -> None:
        """Update access tracking."""
        self.access_count += 1
        self.last_accessed = datetime.now()


@dataclass
class LayerStats:
    """Statistics for a memory layer."""
    layer_type: LayerType
    total_entries: int
    expired_entries: int
    total_access_count: int
    avg_importance: float
    oldest_entry: Optional[datetime]
    newest_entry: Optional[datetime]


@runtime_checkable
class IMemoryLayer(Protocol):
    """
    Protocol for memory layer implementations.

    Each layer handles storage, retrieval, and expiration
    of memories within its scope.
    """

    @property
    def layer_type(self) -> LayerType:
        """Get the layer type."""
        ...

    @property
    def config(self) -> LayerConfig:
        """Get layer configuration."""
        ...

    async def store(
        self,
        id: str,
        content: str,
        importance: float = 0.5,
        ttl_seconds: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> LayerEntry:
        """
        Store content in this layer.

        Args:
            id: Unique identifier for the entry.
            content: Content to store.
            importance: Importance score (0.0-1.0).
            ttl_seconds: Time-to-live in seconds (overrides default).
            metadata: Additional metadata.

        Returns:
            Created LayerEntry.
        """
        ...

    async def retrieve(self, id: str) -> Optional[LayerEntry]:
        """
        Retrieve an entry by ID.

        Args:
            id: Entry identifier.

        Returns:
            LayerEntry or None if not found/expired.
        """
        ...

    async def expire(self, id: str) -> bool:
        """
        Manually expire an entry.

        Args:
            id: Entry identifier.

        Returns:
            True if expired, False if not found.
        """
        ...

    async def expire_all(self) -> int:
        """
        Expire all entries that have passed their TTL.

        Returns:
            Number of entries expired.
        """
        ...

    async def stats(self) -> LayerStats:
        """
        Get layer statistics.

        Returns:
            LayerStats with current state.
        """
        ...

    async def list_entries(
        self,
        limit: int = 100,
        include_expired: bool = False
    ) -> List[LayerEntry]:
        """
        List entries in this layer.

        Args:
            limit: Maximum entries to return.
            include_expired: Whether to include expired entries.

        Returns:
            List of LayerEntry objects.
        """
        ...

    async def clear(self) -> int:
        """
        Clear all entries from this layer.

        Returns:
            Number of entries cleared.
        """
        ...


class BaseMemoryLayer:
    """
    Base implementation for memory layers.

    Provides common functionality for all layer types.
    """

    def __init__(self, config: LayerConfig):
        self._config = config
        self._entries: Dict[str, LayerEntry] = {}
        logger.info(f"Initialized {config.layer_type.value} layer")

    @property
    def layer_type(self) -> LayerType:
        return self._config.layer_type

    @property
    def config(self) -> LayerConfig:
        return self._config

    async def store(
        self,
        id: str,
        content: str,
        importance: float = 0.5,
        ttl_seconds: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> LayerEntry:
        # Calculate expiration
        expires_at = None
        ttl = ttl_seconds or self._config.default_ttl_seconds
        if ttl is not None:
            expires_at = datetime.now() + timedelta(seconds=ttl)

        entry = LayerEntry(
            id=id,
            content=content,
            importance=importance,
            expires_at=expires_at,
            metadata=metadata or {}
        )

        # Check capacity
        if len(self._entries) >= self._config.max_entries:
            await self._evict_oldest()

        self._entries[id] = entry
        logger.debug(f"Stored entry {id} in {self.layer_type.value} layer")
        return entry

    async def retrieve(self, id: str) -> Optional[LayerEntry]:
        entry = self._entries.get(id)
        if entry is None:
            return None

        if entry.is_expired():
            if self._config.auto_expire:
                del self._entries[id]
            return None

        entry.touch()
        return entry

    async def expire(self, id: str) -> bool:
        if id in self._entries:
            del self._entries[id]
            logger.debug(f"Expired entry {id} from {self.layer_type.value} layer")
            return True
        return False

    async def expire_all(self) -> int:
        expired_ids = [
            id for id, entry in self._entries.items()
            if entry.is_expired()
        ]
        for id in expired_ids:
            del self._entries[id]

        if expired_ids:
            logger.info(f"Expired {len(expired_ids)} entries from {self.layer_type.value} layer")
        return len(expired_ids)

    async def stats(self) -> LayerStats:
        entries = list(self._entries.values())
        expired_count = sum(1 for e in entries if e.is_expired())
        total_access = sum(e.access_count for e in entries)
        avg_importance = (
            sum(e.importance for e in entries) / len(entries)
            if entries else 0.0
        )

        created_times = [e.created_at for e in entries]
        oldest = min(created_times) if created_times else None
        newest = max(created_times) if created_times else None

        return LayerStats(
            layer_type=self.layer_type,
            total_entries=len(entries),
            expired_entries=expired_count,
            total_access_count=total_access,
            avg_importance=avg_importance,
            oldest_entry=oldest,
            newest_entry=newest
        )

    async def list_entries(
        self,
        limit: int = 100,
        include_expired: bool = False
    ) -> List[LayerEntry]:
        entries = list(self._entries.values())

        if not include_expired:
            entries = [e for e in entries if not e.is_expired()]

        # Sort by importance (descending), then by created_at (descending)
        entries.sort(key=lambda e: (e.importance, e.created_at), reverse=True)
        return entries[:limit]

    async def clear(self) -> int:
        count = len(self._entries)
        self._entries.clear()
        logger.info(f"Cleared {count} entries from {self.layer_type.value} layer")
        return count

    async def _evict_oldest(self) -> None:
        """Evict oldest entry to make room."""
        if not self._entries:
            return

        # Find oldest entry
        oldest_id = min(
            self._entries.keys(),
            key=lambda id: self._entries[id].created_at
        )
        del self._entries[oldest_id]
        logger.debug(f"Evicted oldest entry {oldest_id} from {self.layer_type.value} layer")


class EphemeralLayer(BaseMemoryLayer):
    """
    Ephemeral memory layer.

    Short-lived memories with < 1 hour TTL.
    Used for temporary context, scratch data, and intermediate results.
    """

    def __init__(self, config: Optional[LayerConfig] = None):
        super().__init__(config or LAYER_CONFIGS[LayerType.EPHEMERAL])

    async def store(
        self,
        id: str,
        content: str,
        importance: float = 0.5,
        ttl_seconds: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> LayerEntry:
        # Ephemeral layer enforces max TTL of 1 hour
        max_ttl = 3600
        if ttl_seconds is not None:
            ttl_seconds = min(ttl_seconds, max_ttl)
        else:
            ttl_seconds = self._config.default_ttl_seconds or max_ttl

        return await super().store(id, content, importance, ttl_seconds, metadata)


class SessionLayer(BaseMemoryLayer):
    """
    Session memory layer.

    Task-scoped memories that persist for the current session.
    Used for conversation context, task state, and working memory.
    """

    def __init__(
        self,
        session_id: Optional[str] = None,
        config: Optional[LayerConfig] = None
    ):
        super().__init__(config or LAYER_CONFIGS[LayerType.SESSION])
        self.session_id = session_id

    async def store(
        self,
        id: str,
        content: str,
        importance: float = 0.5,
        ttl_seconds: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> LayerEntry:
        # Add session_id to metadata
        metadata = metadata or {}
        if self.session_id:
            metadata["session_id"] = self.session_id

        return await super().store(id, content, importance, ttl_seconds, metadata)


class UserLayer(BaseMemoryLayer):
    """
    User memory layer.

    Long-term user preferences and learned behaviors.
    No automatic expiration, persists across sessions.
    """

    def __init__(
        self,
        user_id: Optional[str] = None,
        config: Optional[LayerConfig] = None
    ):
        super().__init__(config or LAYER_CONFIGS[LayerType.USER])
        self.user_id = user_id

    async def store(
        self,
        id: str,
        content: str,
        importance: float = 0.5,
        ttl_seconds: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> LayerEntry:
        # User layer typically doesn't expire
        if ttl_seconds is None:
            ttl_seconds = self._config.default_ttl_seconds  # None

        metadata = metadata or {}
        if self.user_id:
            metadata["user_id"] = self.user_id

        return await super().store(id, content, importance, ttl_seconds, metadata)


class ProjectLayer(BaseMemoryLayer):
    """
    Project memory layer.

    Novel-level scope for story-wide information.
    Characters, world-building, plot structures, etc.
    No automatic expiration.
    """

    def __init__(
        self,
        project_id: Optional[str] = None,
        config: Optional[LayerConfig] = None
    ):
        super().__init__(config or LAYER_CONFIGS[LayerType.PROJECT])
        self.project_id = project_id

    async def store(
        self,
        id: str,
        content: str,
        importance: float = 0.5,
        ttl_seconds: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> LayerEntry:
        metadata = metadata or {}
        if self.project_id:
            metadata["project_id"] = self.project_id

        return await super().store(id, content, importance, ttl_seconds, metadata)


class LayerManager:
    """
    Manager for all memory layers.

    Provides unified access to layer operations.
    """

    def __init__(
        self,
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
        project_id: Optional[str] = None
    ):
        self._layers: Dict[LayerType, BaseMemoryLayer] = {
            LayerType.EPHEMERAL: EphemeralLayer(),
            LayerType.SESSION: SessionLayer(session_id),
            LayerType.USER: UserLayer(user_id),
            LayerType.PROJECT: ProjectLayer(project_id),
        }
        logger.info("LayerManager initialized with all layers")

    def get_layer(self, layer_type: LayerType) -> BaseMemoryLayer:
        """Get a specific layer."""
        return self._layers[layer_type]

    async def store(
        self,
        layer_type: LayerType,
        id: str,
        content: str,
        importance: float = 0.5,
        ttl_seconds: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> LayerEntry:
        """Store content in specified layer."""
        layer = self._layers[layer_type]
        return await layer.store(id, content, importance, ttl_seconds, metadata)

    async def retrieve(
        self,
        id: str,
        layer_type: Optional[LayerType] = None
    ) -> Optional[LayerEntry]:
        """
        Retrieve entry by ID.

        If layer_type is None, searches all layers.
        """
        if layer_type is not None:
            return await self._layers[layer_type].retrieve(id)

        # Search all layers (most persistent first)
        for lt in [LayerType.PROJECT, LayerType.USER, LayerType.SESSION, LayerType.EPHEMERAL]:
            entry = await self._layers[lt].retrieve(id)
            if entry is not None:
                return entry
        return None

    async def expire_all_layers(self) -> Dict[LayerType, int]:
        """Expire entries in all layers."""
        results = {}
        for lt, layer in self._layers.items():
            results[lt] = await layer.expire_all()
        return results

    async def stats_all(self) -> Dict[LayerType, LayerStats]:
        """Get stats for all layers."""
        results = {}
        for lt, layer in self._layers.items():
            results[lt] = await layer.stats()
        return results


def create_layer(layer_type: LayerType, **kwargs) -> BaseMemoryLayer:
    """
    Factory function to create a memory layer.

    Args:
        layer_type: Type of layer to create.
        **kwargs: Additional arguments for the layer.

    Returns:
        Configured memory layer instance.
    """
    layer_classes = {
        LayerType.EPHEMERAL: EphemeralLayer,
        LayerType.SESSION: SessionLayer,
        LayerType.USER: UserLayer,
        LayerType.PROJECT: ProjectLayer,
    }

    layer_class = layer_classes.get(layer_type)
    if layer_class is None:
        raise ValueError(f"Unknown layer type: {layer_type}")

    return layer_class(**kwargs)
