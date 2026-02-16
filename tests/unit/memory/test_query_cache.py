"""
Query Embedding Cache Tests

Tests for QueryEmbeddingCache: LRU eviction, TTL expiration,
get/put, invalidate, clear, cleanup_expired, hit_rate, stats,
get_or_compute, and async variants.
"""

import time
import pytest
from unittest.mock import MagicMock, AsyncMock
from src.memory.query_cache import (
    QueryEmbeddingCache,
    CacheEntry,
)


class TestCacheEntry:

    def test_defaults(self):
        entry = CacheEntry(embedding=[1.0, 2.0], created_at=time.time())
        assert entry.access_count == 0

    def test_with_access_count(self):
        entry = CacheEntry(embedding=[1.0], created_at=time.time(), access_count=5)
        assert entry.access_count == 5


class TestHashQuery:

    def test_consistent_hash(self):
        cache = QueryEmbeddingCache()
        h1 = cache._hash_query("hello")
        h2 = cache._hash_query("hello")
        assert h1 == h2

    def test_different_queries_different_hash(self):
        cache = QueryEmbeddingCache()
        h1 = cache._hash_query("hello")
        h2 = cache._hash_query("world")
        assert h1 != h2

    def test_hash_length(self):
        cache = QueryEmbeddingCache()
        h = cache._hash_query("test")
        assert len(h) == 16


class TestIsExpired:

    def test_not_expired(self):
        cache = QueryEmbeddingCache(ttl_seconds=3600)
        entry = CacheEntry(embedding=[1.0], created_at=time.time())
        assert cache._is_expired(entry) is False

    def test_expired(self):
        cache = QueryEmbeddingCache(ttl_seconds=1)
        entry = CacheEntry(embedding=[1.0], created_at=time.time() - 10)
        assert cache._is_expired(entry) is True


class TestGetPut:

    def test_put_and_get(self):
        cache = QueryEmbeddingCache()
        cache.put("hello", [1.0, 2.0, 3.0])
        result = cache.get("hello")
        assert result == [1.0, 2.0, 3.0]

    def test_get_miss(self):
        cache = QueryEmbeddingCache()
        result = cache.get("nonexistent")
        assert result is None

    def test_get_expired(self):
        cache = QueryEmbeddingCache(ttl_seconds=0.001)
        cache.put("hello", [1.0])
        time.sleep(0.01)
        result = cache.get("hello")
        assert result is None

    def test_get_updates_access_count(self):
        cache = QueryEmbeddingCache()
        cache.put("hello", [1.0])
        cache.get("hello")
        cache.get("hello")
        # Access count should be incremented (initial 1 + 2 gets)
        key = cache._hash_query("hello")
        assert cache._cache[key].access_count == 3

    def test_lru_eviction(self):
        cache = QueryEmbeddingCache(max_size=2)
        cache.put("a", [1.0])
        cache.put("b", [2.0])
        cache.put("c", [3.0])  # Should evict "a"
        assert cache.get("a") is None
        assert cache.get("b") == [2.0]
        assert cache.get("c") == [3.0]

    def test_lru_order_updated_on_get(self):
        cache = QueryEmbeddingCache(max_size=2)
        cache.put("a", [1.0])
        cache.put("b", [2.0])
        cache.get("a")  # Move "a" to most recent
        cache.put("c", [3.0])  # Should evict "b" (least recently used)
        assert cache.get("a") == [1.0]
        assert cache.get("b") is None
        assert cache.get("c") == [3.0]

    def test_overwrite_existing(self):
        cache = QueryEmbeddingCache()
        cache.put("hello", [1.0])
        cache.put("hello", [2.0])
        assert cache.get("hello") == [2.0]
        assert cache.size == 1


class TestInvalidate:

    def test_invalidate_existing(self):
        cache = QueryEmbeddingCache()
        cache.put("hello", [1.0])
        result = cache.invalidate("hello")
        assert result is True
        assert cache.get("hello") is None

    def test_invalidate_nonexistent(self):
        cache = QueryEmbeddingCache()
        result = cache.invalidate("nonexistent")
        assert result is False


class TestClear:

    def test_clear_returns_count(self):
        cache = QueryEmbeddingCache()
        cache.put("a", [1.0])
        cache.put("b", [2.0])
        count = cache.clear()
        assert count == 2
        assert cache.size == 0

    def test_clear_empty(self):
        cache = QueryEmbeddingCache()
        count = cache.clear()
        assert count == 0


class TestCleanupExpired:

    def test_cleanup_removes_expired(self, monkeypatch):
        cache = QueryEmbeddingCache(ttl_seconds=0.001)

        timeline = iter([1.0, 1.0195, 1.02, 1.02])
        monkeypatch.setattr("src.memory.query_cache.time.time", lambda: next(timeline))

        cache.put("old", [1.0])
        cache.put("new", [2.0])
        removed = cache.cleanup_expired()

        assert removed == 1
        assert cache.get("new") == [2.0]

    def test_cleanup_nothing_expired(self):
        cache = QueryEmbeddingCache(ttl_seconds=3600)
        cache.put("a", [1.0])
        removed = cache.cleanup_expired()
        assert removed == 0


class TestProperties:

    def test_size(self):
        cache = QueryEmbeddingCache()
        assert cache.size == 0
        cache.put("a", [1.0])
        assert cache.size == 1

    def test_hit_rate_no_queries(self):
        cache = QueryEmbeddingCache()
        assert cache.hit_rate == 0.0

    def test_hit_rate_all_hits(self):
        cache = QueryEmbeddingCache()
        cache.put("a", [1.0])
        cache.get("a")
        cache.get("a")
        assert cache.hit_rate == 1.0

    def test_hit_rate_all_misses(self):
        cache = QueryEmbeddingCache()
        cache.get("nonexistent")
        assert cache.hit_rate == 0.0

    def test_hit_rate_mixed(self):
        cache = QueryEmbeddingCache()
        cache.put("a", [1.0])
        cache.get("a")       # hit
        cache.get("missing")  # miss
        assert cache.hit_rate == 0.5

    def test_stats(self):
        cache = QueryEmbeddingCache(max_size=100, ttl_seconds=3600)
        cache.put("a", [1.0])
        cache.get("a")
        cache.get("miss")
        stats = cache.stats
        assert stats["size"] == 1
        assert stats["max_size"] == 100
        assert stats["hits"] == 1
        assert stats["misses"] == 1
        assert stats["hit_rate"] == 0.5
        assert stats["ttl_seconds"] == 3600


class TestGetOrCompute:

    def test_cache_hit(self):
        cache = QueryEmbeddingCache()
        cache.put("hello", [1.0, 2.0])
        compute_fn = MagicMock(return_value=[9.0])
        result = cache.get_or_compute("hello", compute_fn)
        assert result == [1.0, 2.0]
        compute_fn.assert_not_called()

    def test_cache_miss_computes(self):
        cache = QueryEmbeddingCache()
        compute_fn = MagicMock(return_value=[5.0, 6.0])
        result = cache.get_or_compute("hello", compute_fn)
        assert result == [5.0, 6.0]
        compute_fn.assert_called_once_with("hello")
        # Should be cached now
        assert cache.get("hello") == [5.0, 6.0]


class TestAsyncMethods:

    @pytest.mark.asyncio
    async def test_get_async(self):
        cache = QueryEmbeddingCache()
        cache.put("hello", [1.0])
        result = await cache.get_async("hello")
        assert result == [1.0]

    @pytest.mark.asyncio
    async def test_put_async(self):
        cache = QueryEmbeddingCache()
        await cache.put_async("hello", [1.0])
        assert cache.get("hello") == [1.0]

    @pytest.mark.asyncio
    async def test_get_or_compute_async_sync_fn(self):
        cache = QueryEmbeddingCache()
        compute_fn = MagicMock(return_value=[3.0])
        result = await cache.get_or_compute_async("hello", compute_fn)
        assert result == [3.0]
        compute_fn.assert_called_once_with("hello")

    @pytest.mark.asyncio
    async def test_get_or_compute_async_async_fn(self):
        cache = QueryEmbeddingCache()
        compute_fn = AsyncMock(return_value=[4.0])
        result = await cache.get_or_compute_async("hello", compute_fn)
        assert result == [4.0]
        compute_fn.assert_called_once_with("hello")

    @pytest.mark.asyncio
    async def test_get_or_compute_async_cached(self):
        cache = QueryEmbeddingCache()
        cache.put("hello", [7.0])
        compute_fn = MagicMock(return_value=[9.0])
        result = await cache.get_or_compute_async("hello", compute_fn)
        assert result == [7.0]
        compute_fn.assert_not_called()
