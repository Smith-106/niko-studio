"""
Query Embedding Cache with LRU and TTL

Features:
- LRU cache with configurable max size (default: 1000)
- TTL-based expiration (default: 1 hour)
- Thread-safe async operations
- Memory-efficient storage
"""

import asyncio
import hashlib
import logging
import time
from collections import OrderedDict
from dataclasses import dataclass
from typing import List, Optional, Tuple

logger = logging.getLogger("niko-cache")


@dataclass
class CacheEntry:
    """Cache entry with embedding and timestamp."""
    embedding: List[float]
    created_at: float
    access_count: int = 0


class QueryEmbeddingCache:
    """
    LRU cache for query embeddings with TTL support.

    Usage:
        cache = QueryEmbeddingCache(max_size=1000, ttl_seconds=3600)

        # Try to get from cache
        embedding = cache.get(query)
        if embedding is None:
            embedding = embedder.embed(query)
            cache.put(query, embedding)
    """

    def __init__(
        self,
        max_size: int = 1000,
        ttl_seconds: float = 3600.0  # 1 hour default
    ):
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds

        self._cache: OrderedDict[str, CacheEntry] = OrderedDict()
        self._lock = asyncio.Lock()

        # Statistics
        self._hits = 0
        self._misses = 0

    def _hash_query(self, query: str) -> str:
        """Generate a consistent hash for the query."""
        return hashlib.sha256(query.encode('utf-8')).hexdigest()[:16]

    def _is_expired(self, entry: CacheEntry) -> bool:
        """Check if a cache entry has expired."""
        return (time.time() - entry.created_at) > self.ttl_seconds

    def get(self, query: str) -> Optional[List[float]]:
        """
        Get embedding from cache (sync version).

        Args:
            query: The query string

        Returns:
            Embedding list if found and not expired, None otherwise
        """
        key = self._hash_query(query)

        if key not in self._cache:
            self._misses += 1
            return None

        entry = self._cache[key]

        # Check TTL
        if self._is_expired(entry):
            del self._cache[key]
            self._misses += 1
            return None

        # Move to end (most recently used)
        self._cache.move_to_end(key)
        entry.access_count += 1
        self._hits += 1

        return entry.embedding

    async def get_async(self, query: str) -> Optional[List[float]]:
        """
        Get embedding from cache (async version).

        Args:
            query: The query string

        Returns:
            Embedding list if found and not expired, None otherwise
        """
        async with self._lock:
            return self.get(query)

    def put(self, query: str, embedding: List[float]) -> None:
        """
        Store embedding in cache (sync version).

        Args:
            query: The query string
            embedding: The embedding vector
        """
        key = self._hash_query(query)

        # Evict oldest if at capacity
        while len(self._cache) >= self.max_size:
            self._cache.popitem(last=False)

        self._cache[key] = CacheEntry(
            embedding=embedding,
            created_at=time.time(),
            access_count=1
        )

    async def put_async(self, query: str, embedding: List[float]) -> None:
        """
        Store embedding in cache (async version).

        Args:
            query: The query string
            embedding: The embedding vector
        """
        async with self._lock:
            self.put(query, embedding)

    def get_or_compute(
        self,
        query: str,
        compute_fn
    ) -> List[float]:
        """
        Get from cache or compute and store.

        Args:
            query: The query string
            compute_fn: Function to compute embedding if not cached

        Returns:
            Embedding vector
        """
        cached = self.get(query)
        if cached is not None:
            return cached

        embedding = compute_fn(query)
        self.put(query, embedding)
        return embedding

    async def get_or_compute_async(
        self,
        query: str,
        compute_fn
    ) -> List[float]:
        """
        Get from cache or compute and store (async version).

        Args:
            query: The query string
            compute_fn: Async or sync function to compute embedding

        Returns:
            Embedding vector
        """
        async with self._lock:
            cached = self.get(query)
            if cached is not None:
                return cached

        # Compute outside lock to avoid blocking
        if asyncio.iscoroutinefunction(compute_fn):
            embedding = await compute_fn(query)
        else:
            embedding = compute_fn(query)

        async with self._lock:
            self.put(query, embedding)

        return embedding

    def invalidate(self, query: str) -> bool:
        """
        Remove a specific query from cache.

        Args:
            query: The query string

        Returns:
            True if entry was removed, False if not found
        """
        key = self._hash_query(query)
        if key in self._cache:
            del self._cache[key]
            return True
        return False

    def clear(self) -> int:
        """
        Clear all entries from cache.

        Returns:
            Number of entries cleared
        """
        count = len(self._cache)
        self._cache.clear()
        return count

    def cleanup_expired(self) -> int:
        """
        Remove all expired entries.

        Returns:
            Number of entries removed
        """
        now = time.time()
        expired_keys = [
            key for key, entry in self._cache.items()
            if (now - entry.created_at) > self.ttl_seconds
        ]

        for key in expired_keys:
            del self._cache[key]

        return len(expired_keys)

    @property
    def size(self) -> int:
        """Current number of entries in cache."""
        return len(self._cache)

    @property
    def hit_rate(self) -> float:
        """Cache hit rate (0.0 - 1.0)."""
        total = self._hits + self._misses
        if total == 0:
            return 0.0
        return self._hits / total

    @property
    def stats(self) -> dict:
        """Get cache statistics."""
        return {
            "size": self.size,
            "max_size": self.max_size,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": round(self.hit_rate, 4),
            "ttl_seconds": self.ttl_seconds
        }


# Global cache instance
_global_cache: Optional[QueryEmbeddingCache] = None


def get_query_cache(
    max_size: int = 1000,
    ttl_seconds: float = 3600.0
) -> QueryEmbeddingCache:
    """
    Get or create the global query embedding cache.

    Args:
        max_size: Maximum cache entries
        ttl_seconds: TTL in seconds

    Returns:
        QueryEmbeddingCache instance
    """
    global _global_cache
    if _global_cache is None:
        _global_cache = QueryEmbeddingCache(
            max_size=max_size,
            ttl_seconds=ttl_seconds
        )
        logger.info(
            f"Query embedding cache initialized: "
            f"max_size={max_size}, ttl={ttl_seconds}s"
        )
    return _global_cache
