# -*- coding: utf-8 -*-
"""MemoryService extra tests - data classes, compute_similarity, extract_keywords, rrf_fusion."""

import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from pathlib import Path
from datetime import datetime

from src.services.memory_service import (
    MemoryService, Message, AddOptions, SearchOptions, SearchResult, Memory,
    get_memory_service, reset_memory_service,
)
import src.services.memory_service as memory_service_module


class TestDataClasses:
    def test_message(self):
        m = Message(role="user", content="hello")
        assert m.role == "user"
        assert m.timestamp is None

    def test_add_options_defaults(self):
        o = AddOptions()
        assert o.namespace == "default"
        assert o.importance == 0.5
        assert o.ttl is None

    def test_search_options_defaults(self):
        o = SearchOptions()
        assert o.limit == 10
        assert o.threshold == 0.7

    def test_search_result(self):
        r = SearchResult(id="1", content="text", score=0.9, metadata={}, source="mem")
        assert r.chunk_index is None

    def test_memory(self):
        m = Memory(id="1", content="text")
        assert m.embedding is None
        assert m.created_at is None


class TestMemoryService:
    @pytest.fixture()
    def svc(self, tmp_path):
        return MemoryService(db_path=str(tmp_path / "mem.db"))

    def test_init(self, svc):
        assert svc.db_path.exists()

    def test_compute_similarity_identical(self, svc):
        v = [1.0, 0.0, 0.0]
        assert svc._compute_similarity(v, v) == pytest.approx(1.0)

    def test_compute_similarity_orthogonal(self, svc):
        a = [1.0, 0.0]
        b = [0.0, 1.0]
        assert svc._compute_similarity(a, b) == pytest.approx(0.0)

    def test_compute_similarity_empty(self, svc):
        assert svc._compute_similarity([], []) == 0.0

    def test_compute_similarity_different_len(self, svc):
        assert svc._compute_similarity([1.0], [1.0, 2.0]) == 0.0

    def test_compute_similarity_zero_norm(self, svc):
        assert svc._compute_similarity([0.0, 0.0], [1.0, 0.0]) == 0.0

    def test_extract_keywords(self, svc):
        kws = svc._extract_keywords("角色设定 和 故事背景")
        assert "角色设定" in kws
        assert "故事背景" in kws
        # stopword '和' should be filtered
        assert "和" not in kws

    def test_extract_keywords_english(self, svc):
        kws = svc._extract_keywords("the character is important")
        assert "character" in kws
        assert "important" in kws
        assert "the" not in kws
        assert "is" not in kws

    def test_extract_keywords_empty(self, svc):
        assert svc._extract_keywords("") == []

    def test_extract_keywords_limit(self, svc):
        text = " ".join([f"word{i}" for i in range(20)])
        kws = svc._extract_keywords(text)
        assert len(kws) <= 10

    def test_rrf_fusion_empty(self, svc):
        result = svc._rrf_fusion([[], []])
        assert result == []

    def test_rrf_fusion_single_list(self, svc):
        r1 = SearchResult(id="1", content="a", score=0.9, metadata={}, source="v")
        r2 = SearchResult(id="2", content="b", score=0.8, metadata={}, source="v")
        result = svc._rrf_fusion([[r1, r2]])
        assert len(result) == 2

    def test_rrf_fusion_dedup(self, svc):
        r1 = SearchResult(id="1", content="a", score=0.9, metadata={}, source="v")
        r2 = SearchResult(id="1", content="a", score=0.7, metadata={}, source="k")
        result = svc._rrf_fusion([[r1], [r2]])
        ids = [r.id for r in result]
        assert ids.count("1") == 1

    def test_embedder_property_with_service(self, svc):
        mock_emb = MagicMock()
        svc._embedding_service = mock_emb
        svc._embedder = None
        assert svc.embedder is mock_emb

    def test_embedder_property_fallback(self, svc):
        svc._embedding_service = None
        svc._embedder = None
        with patch("src.services.memory_service.SimpleEmbedder") as mock_se:
            mock_se.return_value = MagicMock()
            with patch.dict("sys.modules", {"src.memory.unified_memory": None}):
                with patch("builtins.__import__", side_effect=ImportError):
                    emb = svc.embedder
                    assert emb is not None


class TestMemoryServiceExtraBranches:
    @pytest.fixture()
    def svc(self, tmp_path):
        return MemoryService(db_path=str(tmp_path / "mem-extra.db"))


    @pytest.mark.asyncio
    async def test_embed_text_async_embed_method(self, svc):
        embedder = MagicMock()
        embedder.embed = AsyncMock(return_value=[0.55, 0.66])
        svc._embedder = embedder

        result = await svc._embed_text("async")
        assert result == [0.55, 0.66]

    @pytest.mark.asyncio
    async def test_embed_text_embed_batch_branch(self, svc):
        embedder = MagicMock(spec=[])
        embedder.embed_batch = AsyncMock(return_value=[[0.33, 0.44]])
        svc._embedder = embedder

        result = await svc._embed_text("abc")
        assert result == [0.33, 0.44]

    @pytest.mark.asyncio
    async def test_embed_text_invalid_method_raises(self, svc):
        svc._embedder = MagicMock(spec=[])
        with pytest.raises(RuntimeError, match="No valid embedding method"):
            await svc._embed_text("abc")

    @pytest.mark.asyncio
    async def test_search_with_time_range_datetimes(self, svc):
        svc._embedder = MagicMock()
        svc._embedder.embed.return_value = [1.0, 0.0]

        await svc.add(
            [Message(role="user", content="hello", metadata={"source": "unit"})],
            AddOptions(namespace="time-range"),
        )

        now = datetime.now()
        results = await svc.search(
            "hello",
            SearchOptions(
                namespace="time-range",
                threshold=0.0,
                time_range=(now.replace(year=2000), now.replace(year=2100)),
            ),
        )
        assert len(results) == 1

    @pytest.mark.asyncio
    async def test_hybrid_search_default_options_and_empty_keywords(self, svc):
        svc._embedder = MagicMock()
        svc._embedder.embed.return_value = [1.0, 0.0]

        await svc.add([Message(role="user", content="hello world")], AddOptions())
        results = await svc.hybrid_search("a")
        assert isinstance(results, list)

    @pytest.mark.asyncio
    async def test_get_history_with_before_filter(self, svc):
        await svc.add_history(
            "s1",
            [
                Message(role="user", content="old", timestamp=datetime(2024, 1, 1, 10, 0, 0)),
                Message(role="assistant", content="new", timestamp=datetime(2025, 1, 1, 10, 0, 0)),
            ],
        )

        results = await svc.get_history("s1", before=datetime(2024, 6, 1, 0, 0, 0))
        assert len(results) == 1
        assert results[0].content == "old"

    @pytest.mark.asyncio
    async def test_update_content_reembeds(self, svc):
        svc._embedder = MagicMock()
        svc._embedder.embed.return_value = [0.1, 0.2]

        memory_id = await svc.add([Message(role="user", content="old")], AddOptions())

        svc._embedder.embed.return_value = [0.9, 0.8]
        updated = await svc.update(memory_id, content="new content")
        assert updated is True

        mem = await svc.get(memory_id)
        assert mem.content == "new content"
        assert mem.embedding == [0.9, 0.8]








class TestMemoryServiceInitBranches:
    def test_init_uses_default_db_path_without_config(self):
        svc = MemoryService(db_path=None, config=None)
        assert svc.db_path.as_posix().endswith(".writing/memory_service.db")
        svc.close()

    def test_init_uses_config_vector_db_path(self, tmp_path):
        class Cfg:
            class memory:
                vector_db_path = str(tmp_path / "cfg-memory.db")

        svc = MemoryService(db_path=None, config=Cfg())
        assert svc.db_path == tmp_path / "cfg-memory.db"
        svc.close()


class TestMemoryServiceFactoryBranches:
    def test_get_memory_service_singleton_branch(self):
        memory_service_module._memory_service = None

        class DummyMemoryService:
            def __init__(self, db_path=None, config=None):
                self.db_path = db_path
                self.config = config
                self.closed = False

            def close(self):
                self.closed = True

        with patch("src.services.memory_service.MemoryService", DummyMemoryService):
            first = get_memory_service(db_path="/tmp/a.db")
            second = get_memory_service(db_path="/tmp/b.db")

        assert first is second
        assert first.db_path == "/tmp/a.db"

    def test_reset_memory_service_closes_existing_singleton(self):
        existing = MagicMock()
        memory_service_module._memory_service = existing

        reset_memory_service()

        existing.close.assert_called_once()
        assert memory_service_module._memory_service is None
