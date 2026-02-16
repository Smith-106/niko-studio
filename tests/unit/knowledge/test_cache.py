# -*- coding: utf-8 -*-
"""InMemoryEmbeddingCache tests."""

import asyncio
import pytest

from src.knowledge.services.cache import InMemoryEmbeddingCache


class TestInMemoryEmbeddingCache:
    def test_make_key_deterministic_and_model_sensitive(self):
        cache = InMemoryEmbeddingCache()
        key1 = cache._make_key("hello", "m1")
        key2 = cache._make_key("hello", "m1")
        key3 = cache._make_key("hello", "m2")

        assert key1 == key2
        assert key1 != key3

    def test_is_expired_zero_never_expires(self):
        cache = InMemoryEmbeddingCache()
        assert cache._is_expired(0) is False

    def test_evict_if_needed_lru(self):
        cache = InMemoryEmbeddingCache(max_size=1)
        loop = asyncio.get_event_loop()

        loop.run_until_complete(cache.set("a", "m", [1.0]))
        loop.run_until_complete(cache.set("b", "m", [2.0]))

        assert loop.run_until_complete(cache.get("a", "m")) is None
        assert loop.run_until_complete(cache.get("b", "m")) == [2.0]

    @pytest.mark.asyncio
    async def test_get_miss_increments_misses(self):
        cache = InMemoryEmbeddingCache()
        assert await cache.get("missing", "m") is None

        stats = await cache.stats()
        assert stats["misses"] == 1
        assert stats["hits"] == 0

    @pytest.mark.asyncio
    async def test_set_and_get_hit(self):
        cache = InMemoryEmbeddingCache()
        await cache.set("hello", "m", [1.0, 2.0])

        assert await cache.get("hello", "m") == [1.0, 2.0]
        stats = await cache.stats()
        assert stats["hits"] == 1

    @pytest.mark.asyncio
    async def test_ttl_expire_branch(self):
        cache = InMemoryEmbeddingCache(default_ttl=1)
        await cache.set("hello", "m", [1.0], ttl=1)

        key = cache._make_key("hello", "m")
        emb, expire_time = cache._cache[key]
        cache._cache[key] = (emb, 1.0)

        assert await cache.get("hello", "m") is None
        assert key not in cache._cache

    @pytest.mark.asyncio
    async def test_ttl_zero_never_expires(self):
        cache = InMemoryEmbeddingCache(default_ttl=1)
        await cache.set("hello", "m", [1.0], ttl=0)

        key = cache._make_key("hello", "m")
        assert cache._cache[key][1] == 0
        assert await cache.get("hello", "m") == [1.0]

    @pytest.mark.asyncio
    async def test_get_batch_and_set_batch(self):
        cache = InMemoryEmbeddingCache()
        await cache.set_batch({"a": [1.0], "b": [2.0]}, "m")

        result = await cache.get_batch(["a", "b", "c"], "m")
        assert result["a"] == [1.0]
        assert result["b"] == [2.0]
        assert result["c"] is None

    @pytest.mark.asyncio
    async def test_clear_resets_cache_and_counters(self):
        cache = InMemoryEmbeddingCache()
        await cache.set("a", "m", [1.0])
        await cache.get("a", "m")
        await cache.get("missing", "m")

        await cache.clear()
        stats = await cache.stats()
        assert stats["size"] == 0
        assert stats["hits"] == 0
        assert stats["misses"] == 0
        assert stats["hit_rate"] == 0.0

    @pytest.mark.asyncio
    async def test_stats_hit_rate(self):
        cache = InMemoryEmbeddingCache()
        await cache.set("a", "m", [1.0])
        await cache.get("a", "m")
        await cache.get("missing", "m")

        stats = await cache.stats()
        assert stats["size"] == 1
        assert stats["max_size"] == 10000
        assert stats["hits"] == 1
        assert stats["misses"] == 1
        assert stats["hit_rate"] == 0.5
