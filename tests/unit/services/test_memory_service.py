# -*- coding: utf-8 -*-
"""
MemoryService Tests

Tests for Message, AddOptions, SearchOptions, SearchResult, Memory dataclasses,
MemoryService CRUD (add/search/get/delete/update), session history,
keyword extraction, RRF fusion, SimpleEmbedder, _compute_similarity,
_cleanup_expired, list_namespaces, count, close.
"""

import asyncio
import json
import pytest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, AsyncMock
from src.services.memory_service import (
    Message,
    AddOptions,
    SearchOptions,
    SearchResult,
    Memory,
    MemoryService,
    SimpleEmbedder,
    reset_memory_service,
)


# ============================================================
# Dataclasses
# ============================================================

class TestMessage:

    def test_basic(self):
        m = Message(role="user", content="hello")
        assert m.role == "user"
        assert m.content == "hello"
        assert m.timestamp is None
        assert m.metadata is None

    def test_with_metadata(self):
        m = Message(role="assistant", content="hi",
                    timestamp=datetime(2025, 1, 1),
                    metadata={"key": "val"})
        assert m.metadata["key"] == "val"


class TestAddOptions:

    def test_defaults(self):
        o = AddOptions()
        assert o.namespace == "default"
        assert o.tags is None
        assert o.importance == 0.5
        assert o.ttl is None

    def test_custom(self):
        o = AddOptions(namespace="writing", tags=["a"], importance=0.9, ttl=3600)
        assert o.namespace == "writing"
        assert o.ttl == 3600


class TestSearchOptions:

    def test_defaults(self):
        o = SearchOptions()
        assert o.namespace == "default"
        assert o.limit == 10
        assert o.threshold == 0.7
        assert o.include_metadata is True
        assert o.time_range is None


class TestSearchResult:

    def test_basic(self):
        r = SearchResult(id="r1", content="text", score=0.95,
                         metadata={"k": "v"}, source="memory:default")
        assert r.chunk_index is None
        assert r.source == "memory:default"


class TestMemoryDataclass:

    def test_defaults(self):
        m = Memory(id="m1", content="test")
        assert m.embedding is None
        assert m.metadata is None
        assert m.created_at is None


# ============================================================
# SimpleEmbedder
# ============================================================

class TestSimpleEmbedder:

    def test_embed_returns_correct_dim(self):
        e = SimpleEmbedder(dim=128)
        vec = e.embed("hello world")
        assert len(vec) == 128

    def test_embed_deterministic(self):
        e = SimpleEmbedder()
        vec1 = e.embed("test")
        vec2 = e.embed("test")
        assert vec1 == vec2

    def test_embed_different_texts(self):
        e = SimpleEmbedder()
        vec1 = e.embed("hello")
        vec2 = e.embed("world")
        assert vec1 != vec2

    def test_similarity_identical(self):
        e = SimpleEmbedder()
        vec = e.embed("test")
        sim = e.similarity(vec, vec)
        assert abs(sim - 1.0) < 0.01

    def test_similarity_empty(self):
        e = SimpleEmbedder()
        assert e.similarity([], []) == 0.0

    def test_similarity_zero_norm(self):
        e = SimpleEmbedder()
        assert e.similarity([0.0, 0.0], [1.0, 2.0]) == 0.0


# ============================================================
# MemoryService._compute_similarity
# ============================================================

class TestComputeSimilarity:

    @pytest.fixture
    def service(self, tmp_path):
        db = str(tmp_path / "test_mem.db")
        return MemoryService(db_path=db)

    def test_identical_vectors(self, service):
        vec = [1.0, 0.0, 0.0]
        assert abs(service._compute_similarity(vec, vec) - 1.0) < 0.01

    def test_orthogonal_vectors(self, service):
        assert abs(service._compute_similarity([1, 0], [0, 1])) < 0.01

    def test_empty_vectors(self, service):
        assert service._compute_similarity([], []) == 0.0

    def test_mismatched_length(self, service):
        assert service._compute_similarity([1, 0], [1, 0, 0]) == 0.0

    def test_zero_vector(self, service):
        assert service._compute_similarity([0, 0], [1, 1]) == 0.0


# ============================================================
# MemoryService._extract_keywords
# ============================================================

class TestExtractKeywords:

    @pytest.fixture
    def service(self, tmp_path):
        db = str(tmp_path / "test_mem.db")
        return MemoryService(db_path=db)

    def test_basic(self, service):
        kw = service._extract_keywords("角色设定 故事背景")
        assert "角色设定" in kw
        assert "故事背景" in kw

    def test_stopwords_removed(self, service):
        kw = service._extract_keywords("the quick brown fox")
        assert "the" not in kw
        assert "quick" in kw

    def test_short_words_removed(self, service):
        kw = service._extract_keywords("a b cd efg")
        assert "a" not in kw
        assert "b" not in kw
        assert "cd" in kw

    def test_limit_ten(self, service):
        text = " ".join([f"keyword{i}" for i in range(20)])
        kw = service._extract_keywords(text)
        assert len(kw) <= 10

    def test_punctuation_removed(self, service):
        kw = service._extract_keywords("hello! world? test.")
        assert all("!" not in k and "?" not in k for k in kw)


# ============================================================
# MemoryService._rrf_fusion
# ============================================================

class TestRRFFusion:

    @pytest.fixture
    def service(self, tmp_path):
        db = str(tmp_path / "test_mem.db")
        return MemoryService(db_path=db)

    def _make_result(self, id_, score):
        return SearchResult(id=id_, content=f"content_{id_}",
                            score=score, metadata={}, source="test")

    def test_single_list(self, service):
        results = [self._make_result("a", 0.9), self._make_result("b", 0.8)]
        fused = service._rrf_fusion([results])
        assert len(fused) == 2
        # First result should have higher RRF score
        assert fused[0].id == "a"

    def test_two_lists_overlap(self, service):
        list1 = [self._make_result("a", 0.9), self._make_result("b", 0.8)]
        list2 = [self._make_result("b", 0.95), self._make_result("c", 0.7)]
        fused = service._rrf_fusion([list1, list2])
        # b appears in both lists, should have highest combined RRF
        assert fused[0].id == "b"

    def test_empty_lists(self, service):
        fused = service._rrf_fusion([[], []])
        assert fused == []

    def test_fusion_metadata_contains_original_score(self, service):
        results = [self._make_result("a", 0.9)]
        fused = service._rrf_fusion([results])
        assert "original_score" in fused[0].metadata
        assert fused[0].metadata["fusion"] == "rrf"


class TestObservabilityMetrics:

    @pytest.fixture
    def service(self, tmp_path):
        db = str(tmp_path / "test_observability.db")
        return MemoryService(db_path=db)

    def test_compute_observability_metrics_empty_results(self, service):
        metrics = service._compute_observability_metrics([], limit=5)
        assert metrics == {
            "c_effective": 0.0,
            "s_final": 0.0,
            "r_memory": 0.0,
        }

    def test_compute_observability_metrics_single_result(self, service):
        result = SearchResult(
            id="a",
            content="content_a",
            score=0.9,
            metadata={"importance": 0.8},
            source="test",
        )

        metrics = service._compute_observability_metrics([result], limit=4)

        assert metrics["c_effective"] == 0.25
        assert metrics["s_final"] == 1.0
        assert 0.0 <= metrics["r_memory"] <= 1.0

    def test_compute_observability_metrics_missing_metadata_fields(self, service):
        results = [
            SearchResult(id="a", content="a", score=0.02, metadata={}, source="test"),
            SearchResult(id="b", content="b", score=0.01, metadata={}, source="test"),
        ]

        metrics = service._compute_observability_metrics(results, limit=2)

        assert metrics["c_effective"] == 1.0
        assert 0.0 <= metrics["s_final"] <= 1.0
        assert 0.0 <= metrics["r_memory"] <= 1.0


# ============================================================
# MemoryService CRUD (with SimpleEmbedder fallback)
# ============================================================

class TestMemoryServiceCRUD:

    @pytest.fixture
    def service(self, tmp_path):
        db = str(tmp_path / "test_crud.db")
        return MemoryService(db_path=db)

    def test_init(self, service):
        assert service.db_path.exists()

    def test_add_and_get(self, service):
        msgs = [Message(role="user", content="hello world")]
        opts = AddOptions(namespace="test")
        memory_id = asyncio.get_event_loop().run_until_complete(
            service.add(msgs, opts)
        )
        assert memory_id is not None

        db = service._get_db()
        row = db.execute(
            "SELECT embedding_blob, embedding_model, embedding_dim, content_hash, last_accessed_at FROM memories WHERE id = ?",
            (memory_id,),
        ).fetchone()
        assert row["embedding_blob"] is not None
        assert row["embedding_model"] == "BAAI/bge-small-zh-v1.5"
        assert row["embedding_dim"] > 0
        assert row["content_hash"]
        assert row["last_accessed_at"]

        mem = asyncio.get_event_loop().run_until_complete(
            service.get(memory_id)
        )
        assert mem is not None
        assert "hello world" in mem.content
        assert mem.embedding is not None

    def test_get_nonexistent(self, service):
        mem = asyncio.get_event_loop().run_until_complete(
            service.get("nonexistent-id")
        )
        assert mem is None

    def test_delete(self, service):
        msgs = [Message(role="user", content="to delete")]
        opts = AddOptions()
        memory_id = asyncio.get_event_loop().run_until_complete(
            service.add(msgs, opts)
        )
        deleted = asyncio.get_event_loop().run_until_complete(
            service.delete(memory_id)
        )
        assert deleted is True

        # Verify gone
        mem = asyncio.get_event_loop().run_until_complete(
            service.get(memory_id)
        )
        assert mem is None

    def test_delete_nonexistent(self, service):
        deleted = asyncio.get_event_loop().run_until_complete(
            service.delete("nonexistent")
        )
        assert deleted is False

    def test_count(self, service):
        count = asyncio.get_event_loop().run_until_complete(service.count())
        assert count == 0

        msgs = [Message(role="user", content="item")]
        asyncio.get_event_loop().run_until_complete(
            service.add(msgs, AddOptions(namespace="ns1"))
        )
        asyncio.get_event_loop().run_until_complete(
            service.add(msgs, AddOptions(namespace="ns2"))
        )

        total = asyncio.get_event_loop().run_until_complete(service.count())
        assert total == 2

        ns1_count = asyncio.get_event_loop().run_until_complete(
            service.count(namespace="ns1")
        )
        assert ns1_count == 1

    def test_list_namespaces(self, service):
        msgs = [Message(role="user", content="test")]
        asyncio.get_event_loop().run_until_complete(
            service.add(msgs, AddOptions(namespace="alpha"))
        )
        asyncio.get_event_loop().run_until_complete(
            service.add(msgs, AddOptions(namespace="beta"))
        )
        ns = asyncio.get_event_loop().run_until_complete(
            service.list_namespaces()
        )
        assert set(ns) == {"alpha", "beta"}

    def test_close(self, service):
        service.close()
        assert service._db is None
        # Double close should not error
        service.close()

    def test_add_with_ttl(self, service):
        msgs = [Message(role="user", content="expiring")]
        opts = AddOptions(ttl=3600)
        memory_id = asyncio.get_event_loop().run_until_complete(
            service.add(msgs, opts)
        )
        mem = asyncio.get_event_loop().run_until_complete(
            service.get(memory_id)
        )
        assert mem is not None

    def test_add_multiple_messages(self, service):
        msgs = [
            Message(role="user", content="question"),
            Message(role="assistant", content="answer"),
        ]
        opts = AddOptions()
        memory_id = asyncio.get_event_loop().run_until_complete(
            service.add(msgs, opts)
        )
        mem = asyncio.get_event_loop().run_until_complete(
            service.get(memory_id)
        )
        assert "question" in mem.content
        assert "answer" in mem.content


# ============================================================
# MemoryService Search
# ============================================================

class TestMemoryServiceSearch:

    @pytest.fixture
    def populated_service(self, tmp_path):
        db = str(tmp_path / "test_search.db")
        svc = MemoryService(db_path=db)
        loop = asyncio.get_event_loop()

        # Add some memories with distinct content
        loop.run_until_complete(svc.add(
            [Message(role="user", content="角色李明是一个勇敢的战士")],
            AddOptions(namespace="writing")
        ))
        loop.run_until_complete(svc.add(
            [Message(role="user", content="故事发生在古代长安城")],
            AddOptions(namespace="writing")
        ))
        loop.run_until_complete(svc.add(
            [Message(role="user", content="代码实现了向量搜索功能")],
            AddOptions(namespace="code")
        ))
        return svc

    def test_search_basic(self, populated_service):
        # SimpleEmbedder produces hash-based embeddings, so similarity may not
        # be semantically meaningful, but the plumbing should work
        results = asyncio.get_event_loop().run_until_complete(
            populated_service.search("李明", SearchOptions(
                namespace="writing", threshold=0.0  # Low threshold for hash embedder
            ))
        )
        assert isinstance(results, list)
        # All writing namespace items returned (threshold=0 passes everything)
        assert len(results) >= 1

    def test_search_wrong_namespace(self, populated_service):
        results = asyncio.get_event_loop().run_until_complete(
            populated_service.search("test", SearchOptions(
                namespace="nonexistent", threshold=0.0
            ))
        )
        assert len(results) == 0

    def test_search_respects_limit(self, populated_service):
        results = asyncio.get_event_loop().run_until_complete(
            populated_service.search("test", SearchOptions(
                namespace="writing", threshold=0.0, limit=1
            ))
        )
        assert len(results) <= 1

    def test_keyword_search(self, populated_service):
        results = asyncio.get_event_loop().run_until_complete(
            populated_service._keyword_search(
                "李明 战士",
                SearchOptions(namespace="writing")
            )
        )
        assert len(results) >= 1
        assert any("李明" in r.content for r in results)

    def test_keyword_search_no_match(self, populated_service):
        results = asyncio.get_event_loop().run_until_complete(
            populated_service._keyword_search(
                "完全不存在的关键词xyz",
                SearchOptions(namespace="writing")
            )
        )
        assert len(results) == 0


# ============================================================
# MemoryService Session History
# ============================================================

    def test_search_updates_last_accessed_at(self, populated_service):
        db = populated_service._get_db()
        row = db.execute(
            "SELECT id, last_accessed_at FROM memories WHERE namespace = ? LIMIT 1",
            ("writing",),
        ).fetchone()
        assert row is not None
        before = row["last_accessed_at"]

        asyncio.get_event_loop().run_until_complete(
            populated_service.search(
                "李明",
                SearchOptions(namespace="writing", threshold=0.0),
            )
        )

        after_row = db.execute("SELECT last_accessed_at FROM memories WHERE id = ?", (row["id"],)).fetchone()
        assert after_row is not None
        assert after_row["last_accessed_at"] is not None
        if before is not None:
            assert after_row["last_accessed_at"] >= before


    @pytest.fixture
    def service(self, tmp_path):
        db = str(tmp_path / "test_history.db")
        return MemoryService(db_path=db)

    def test_add_and_get_history(self, service):
        loop = asyncio.get_event_loop()
        session_id = "test-session-001"
        # Use distinct timestamps to guarantee ordering
        msgs = [
            Message(role="user", content="hello",
                    timestamp=datetime(2025, 1, 1, 10, 0, 0)),
            Message(role="assistant", content="hi there",
                    timestamp=datetime(2025, 1, 1, 10, 0, 1)),
        ]
        loop.run_until_complete(service.add_history(session_id, msgs))

        history = loop.run_until_complete(service.get_history(session_id))
        assert len(history) == 2
        assert history[0].role == "user"
        assert history[1].role == "assistant"

    def test_get_history_empty(self, service):
        history = asyncio.get_event_loop().run_until_complete(
            service.get_history("nonexistent")
        )
        assert history == []

    def test_get_history_with_limit(self, service):
        loop = asyncio.get_event_loop()
        session_id = "test-limit"
        msgs = [Message(role="user", content=f"msg{i}") for i in range(10)]
        loop.run_until_complete(service.add_history(session_id, msgs))

        history = loop.run_until_complete(
            service.get_history(session_id, limit=3)
        )
        assert len(history) == 3

    def test_add_history_with_timestamp(self, service):
        loop = asyncio.get_event_loop()
        session_id = "test-ts"
        ts = datetime(2025, 6, 15, 10, 30)
        msgs = [Message(role="user", content="timed", timestamp=ts)]
        loop.run_until_complete(service.add_history(session_id, msgs))

        history = loop.run_until_complete(service.get_history(session_id))
        assert history[0].timestamp == ts


class TestRetrievalProfileAndCache:

    @pytest.fixture
    def service(self, tmp_path):
        db = str(tmp_path / "test_profile_cache.db")
        return MemoryService(db_path=db)

    def test_retrieval_profile_upsert_and_get(self, service):
        service.upsert_retrieval_profile(
            profile_name="standard_balanced",
            source_weights={"memory": 1.0, "graph": 0.9, "file": 0.8},
            thresholds={"min_score": 0.25},
            budget={"budget_tokens": 1200},
            enabled=True,
        )

        profile = service.get_retrieval_profile("standard_balanced")
        assert profile is not None
        assert profile["enabled"] is True
        assert profile["source_weights_json"]["memory"] == 1.0
        assert profile["thresholds_json"]["min_score"] == 0.25
        assert profile["budget_json"]["budget_tokens"] == 1200

    def test_retrieval_cache_pack_read_and_cleanup(self, service):
        cache_key = "session:abc:query:hello"
        payload = {"results": [{"id": "m1"}]}

        service.cache_pack(cache_key, payload, ttl_seconds=60, status="ready")
        first = service.cache_read(cache_key)
        second = service.cache_read(cache_key)

        assert first is not None
        assert first["status"] == "ready"
        assert first["payload"]["results"][0]["id"] == "m1"
        assert second is not None
        assert second["hit_count"] >= 2
        assert service.cache_status(cache_key) == "ready"

        service.cache_release(cache_key)
        assert service.cache_read(cache_key) is None

        service.cache_pack("expired", {"x": 1}, ttl_seconds=1)
        db = service._get_db()
        db.execute(
            "UPDATE retrieval_cache SET expires_at = ? WHERE cache_key = ?",
            ("2000-01-01T00:00:00", "expired"),
        )
        db.commit()

        cleaned = service.cache_cleanup()
        assert cleaned >= 1


# ============================================================
# MemoryService Update
# ============================================================

class TestMemoryServiceUpdate:

    @pytest.fixture
    def service_with_memory(self, tmp_path):
        db = str(tmp_path / "test_update.db")
        svc = MemoryService(db_path=db)
        loop = asyncio.get_event_loop()
        memory_id = loop.run_until_complete(svc.add(
            [Message(role="user", content="original content")],
            AddOptions()
        ))
        return svc, memory_id

    def test_update_metadata(self, service_with_memory):
        svc, mid = service_with_memory
        loop = asyncio.get_event_loop()
        updated = loop.run_until_complete(
            svc.update(mid, metadata={"new_key": "new_val"})
        )
        assert updated is True

        mem = loop.run_until_complete(svc.get(mid))
        assert mem.metadata["new_key"] == "new_val"

    def test_update_importance(self, service_with_memory):
        svc, mid = service_with_memory
        loop = asyncio.get_event_loop()
        updated = loop.run_until_complete(svc.update(mid, importance=0.9))
        assert updated is True

    def test_update_tags(self, service_with_memory):
        svc, mid = service_with_memory
        loop = asyncio.get_event_loop()
        updated = loop.run_until_complete(
            svc.update(mid, tags=["tag1", "tag2"])
        )
        assert updated is True

    def test_update_no_changes(self, service_with_memory):
        svc, mid = service_with_memory
        loop = asyncio.get_event_loop()
        updated = loop.run_until_complete(svc.update(mid))
        assert updated is False

    def test_update_nonexistent(self, service_with_memory):
        svc, _ = service_with_memory
        loop = asyncio.get_event_loop()
        updated = loop.run_until_complete(
            svc.update("nonexistent", metadata={"k": "v"})
        )
        assert updated is False


# ============================================================
# MemoryService Cleanup Expired
# ============================================================

class TestCleanupExpired:

    def test_cleanup_removes_expired(self, tmp_path):
        db = str(tmp_path / "test_expire.db")
        svc = MemoryService(db_path=db)
        loop = asyncio.get_event_loop()

        # Add with very short TTL
        memory_id = loop.run_until_complete(svc.add(
            [Message(role="user", content="ephemeral")],
            AddOptions(ttl=1)  # 1 second
        ))

        # Manually set expires_at to past
        conn = svc._get_db()
        past = (datetime.now() - timedelta(hours=1)).isoformat()
        conn.execute(
            "UPDATE memories SET expires_at = ? WHERE id = ?",
            (past, memory_id)
        )
        conn.commit()

        # Cleanup
        svc._cleanup_expired()

        # Verify removed
        mem = loop.run_until_complete(svc.get(memory_id))
        assert mem is None

    def test_cleanup_keeps_non_expired(self, tmp_path):
        db = str(tmp_path / "test_keep.db")
        svc = MemoryService(db_path=db)
        loop = asyncio.get_event_loop()

        memory_id = loop.run_until_complete(svc.add(
            [Message(role="user", content="permanent")],
            AddOptions()  # No TTL = permanent
        ))

        svc._cleanup_expired()
        mem = loop.run_until_complete(svc.get(memory_id))
        assert mem is not None


# ============================================================
# Factory Functions
# ============================================================

class TestFactoryFunctions:

    def test_reset_memory_service(self):
        # Just ensure it doesn't error
        reset_memory_service()
