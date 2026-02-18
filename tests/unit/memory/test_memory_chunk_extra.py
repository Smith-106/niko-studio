# -*- coding: utf-8 -*-
"""MemoryChunk, ChunkBuffer, TextChunker tests."""

import pytest
import asyncio
from unittest.mock import MagicMock, AsyncMock

from src.memory.memory_chunk import MemoryChunk, ChunkBuffer, TextChunker, ChunkSplitter, ChunkedMemoryAdapter


class TestMemoryChunk:
    def test_create(self):
        c = MemoryChunk.create(content="hello world", source_id="src1")
        assert c.content == "hello world"
        assert c.source_id == "src1"
        assert c.chunk_index == 0
        assert c.total_chunks == 1
        assert c.embedded is False
        assert c.id  # auto-generated

    def test_content_hash(self):
        c = MemoryChunk.create(content="test")
        h = c.content_hash
        assert isinstance(h, str)
        assert len(h) == 16
        # Same content = same hash
        c2 = MemoryChunk.create(content="test")
        assert c2.content_hash == h

    def test_to_dict(self):
        c = MemoryChunk.create(content="text", source_id="s1", chunk_index=2, total_chunks=5)
        d = c.to_dict()
        assert d["content"] == "text"
        assert d["source_id"] == "s1"
        assert d["chunk_index"] == 2
        assert d["total_chunks"] == 5
        assert d["embedded"] is False
        assert "content_hash" in d

    def test_from_dict(self):
        d = {
            "id": "c1", "content": "text", "embedding": [0.1, 0.2],
            "metadata": {"k": "v"}, "created_at": "2025-01-01T00:00:00",
            "source_id": "s1", "chunk_index": 1, "total_chunks": 3,
            "embedded": True,
        }
        c = MemoryChunk.from_dict(d)
        assert c.id == "c1"
        assert c.embedding == [0.1, 0.2]
        assert c.chunk_index == 1
        assert c.embedded is True

    def test_from_dict_minimal(self):
        d = {"id": "c2", "content": "min"}
        c = MemoryChunk.from_dict(d)
        assert c.chunk_index == 0
        assert c.total_chunks == 1
        assert c.embedded is False
        assert c.embedding is None

    def test_from_dict_none_created_at(self):
        d = {"id": "c3", "content": "x", "created_at": None}
        c = MemoryChunk.from_dict(d)
        assert c.created_at is not None


class TestChunkBuffer:
    def test_add(self):
        buf = ChunkBuffer(batch_size=4)
        c = MemoryChunk.create(content="hello")
        assert buf.add(c) is True
        assert buf.size == 1

    def test_add_dedup(self):
        buf = ChunkBuffer()
        c1 = MemoryChunk.create(content="same")
        c2 = MemoryChunk.create(content="same")
        buf.add(c1)
        assert buf.add(c2) is False
        assert buf.size == 1

    def test_add_full(self):
        buf = ChunkBuffer(max_buffer_size=2)
        buf.add(MemoryChunk.create(content="a"))
        buf.add(MemoryChunk.create(content="b"))
        assert buf.add(MemoryChunk.create(content="c")) is False

    def test_add_many(self):
        buf = ChunkBuffer()
        chunks = [MemoryChunk.create(content=f"chunk{i}") for i in range(5)]
        added = buf.add_many(chunks)
        assert added == 5
        assert buf.size == 5

    def test_add_many_with_dupes(self):
        buf = ChunkBuffer()
        chunks = [
            MemoryChunk.create(content="a"),
            MemoryChunk.create(content="b"),
            MemoryChunk.create(content="a"),  # dupe
        ]
        added = buf.add_many(chunks)
        assert added == 2

    def test_is_batch_ready(self):
        buf = ChunkBuffer(batch_size=2)
        assert buf.is_batch_ready is False
        buf.add(MemoryChunk.create(content="a"))
        assert buf.is_batch_ready is False
        buf.add(MemoryChunk.create(content="b"))
        assert buf.is_batch_ready is True

    def test_stats(self):
        buf = ChunkBuffer()
        buf.add(MemoryChunk.create(content="a"))
        buf.add(MemoryChunk.create(content="a"))  # dupe
        s = buf.stats
        assert s["buffer_size"] == 1
        assert s["total_added"] == 1
        assert s["total_deduplicated"] == 1

    def test_clear(self):
        buf = ChunkBuffer()
        buf.add(MemoryChunk.create(content="a"))
        buf.clear()
        assert buf.size == 0
        # Can add same content again after clear
        assert buf.add(MemoryChunk.create(content="a")) is True

    @pytest.mark.asyncio
    async def test_flush_empty(self):
        buf = ChunkBuffer()
        embedder = MagicMock()
        result = await buf.flush(embedder)
        assert result == []

    @pytest.mark.asyncio
    async def test_flush_with_embed_batch(self):
        buf = ChunkBuffer()
        buf.add(MemoryChunk.create(content="hello"))
        buf.add(MemoryChunk.create(content="world"))

        embedder = MagicMock()
        embedder.embed_batch = AsyncMock(return_value=[[0.1, 0.2], [0.3, 0.4]])

        result = await buf.flush(embedder)
        assert len(result) == 2
        assert result[0].embedded is True
        assert result[0].embedding == [0.1, 0.2]
        assert buf.size == 0

    @pytest.mark.asyncio
    async def test_flush_with_sync_embed_batch(self):
        buf = ChunkBuffer()
        buf.add(MemoryChunk.create(content="test"))

        embedder = MagicMock()
        embedder.embed_batch = MagicMock(return_value=[[0.5]])

        result = await buf.flush(embedder)
        assert len(result) == 1
        assert result[0].embedded is True

    @pytest.mark.asyncio
    async def test_flush_fallback_to_embed(self):
        buf = ChunkBuffer()
        buf.add(MemoryChunk.create(content="single"))

        embedder = MagicMock(spec=[])  # no embed_batch
        embedder.embed = AsyncMock(return_value=[0.9])

        result = await buf.flush(embedder)
        assert len(result) == 1
        assert result[0].embedding == [0.9]

    @pytest.mark.asyncio
    async def test_flush_batch_not_enough(self):
        buf = ChunkBuffer(batch_size=5)
        buf.add(MemoryChunk.create(content="only one"))
        embedder = MagicMock()
        result = await buf.flush_batch(embedder)
        assert result == []  # not enough for a batch

    @pytest.mark.asyncio
    async def test_flush_batch_enough(self):
        buf = ChunkBuffer(batch_size=2)
        buf.add(MemoryChunk.create(content="a"))
        buf.add(MemoryChunk.create(content="b"))
        buf.add(MemoryChunk.create(content="c"))

        embedder = MagicMock()
        embedder.embed_batch = AsyncMock(return_value=[[0.1], [0.2]])

        result = await buf.flush_batch(embedder)
        assert len(result) == 2
        assert buf.size == 1  # one remaining




class TestChunkSplitter:
    def test_split_by_tokens_empty(self):
        splitter = ChunkSplitter()
        assert splitter.split_by_tokens("") == []

    def test_split_by_tokens_respects_min_chunk(self):
        splitter = ChunkSplitter(overlap_tokens=1, min_chunk_length=5)
        chunks = splitter.split_by_tokens("alpha beta gamma delta", max_tokens=2, source_id="s1")
        assert len(chunks) >= 1
        assert all(c.metadata["chunk_method"] == "tokens" for c in chunks)

    def test_split_by_sentences_empty(self):
        splitter = ChunkSplitter()
        assert splitter.split_by_sentences("") == []

    def test_split_by_sentences_plain_text_without_punctuation(self):
        splitter = ChunkSplitter(min_chunk_length=1)
        chunks = splitter.split_by_sentences("plain text", max_sentences=1, source_id="x")
        assert len(chunks) == 1
        assert chunks[0].metadata["chunk_method"] == "sentences"

    def test_split_by_sentences_overlap_guard(self):
        splitter = ChunkSplitter(overlap_sentences=5, min_chunk_length=1)
        chunks = splitter.split_by_sentences("A. B. C. D.", max_sentences=2)
        assert len(chunks) >= 2

    def test_split_by_paragraphs_empty(self):
        splitter = ChunkSplitter()
        assert splitter.split_by_paragraphs("") == []

    def test_split_by_paragraphs_all_short_merges(self):
        splitter = ChunkSplitter(min_chunk_length=50)
        chunks = splitter.split_by_paragraphs("a\n\nb\n\nc", source_id="z")
        assert len(chunks) == 1
        assert chunks[0].content == "a\n\nb\n\nc"

    def test_find_sentence_boundary_no_punctuation(self):
        splitter = ChunkSplitter()
        text = "abcdefghij"
        assert splitter._find_sentence_boundary(text, 0, 5) == 5


class TestChunkedMemoryAdapterAdditional:
    @pytest.mark.asyncio
    async def test_add_chunked_empty_content_returns_empty(self):
        mock_service = MagicMock()
        mock_service.embedder = MagicMock()
        mock_service.embedder.embed_batch = MagicMock(return_value=[])
        mock_service.add = AsyncMock(return_value="id")

        adapter = ChunkedMemoryAdapter(memory_service=mock_service, chunk_size=10, batch_size=2)
        result = await adapter.add_chunked(content="", namespace="n")
        assert result["status"] == "created"
        assert result["chunk_ids"] == ["id"]
        assert result["total_chunks"] == 1

    @pytest.mark.asyncio
    async def test_search_with_context_zero_window(self):
        result_item = MagicMock()
        result_item.metadata = {"source_id": "s", "chunk_index": 0}
        mock_service = MagicMock()
        mock_service.search = AsyncMock(return_value=[result_item])

        adapter = ChunkedMemoryAdapter(memory_service=mock_service)
        results = await adapter.search_with_context("q", context_window=0)
        assert len(results) == 1
        assert results[0]["context"] == []

    @pytest.mark.asyncio
    async def test_get_context_chunks_filters_main_chunk(self):
        main = MagicMock()
        main.metadata = {"chunk_index": 2}
        left = MagicMock()
        left.metadata = {"chunk_index": 1}
        right = MagicMock()
        right.metadata = {"chunk_index": 3}

        mock_service = MagicMock()
        mock_service.search = AsyncMock(return_value=[main, left, right])

        adapter = ChunkedMemoryAdapter(memory_service=mock_service)
        context = await adapter._get_context_chunks("s", 2, "n", window=1)
        assert [c.metadata["chunk_index"] for c in context] == [1, 3]


class _TruthyEmptyBuffer:
    def __bool__(self):
        return True

    def __iter__(self):
        return iter(())


class TestMemoryChunkUncoveredBranches:
    @pytest.mark.asyncio
    async def test_flush_truthy_empty_buffer_returns_empty(self):
        buf = ChunkBuffer()
        buf._buffer = _TruthyEmptyBuffer()

        out = await buf.flush(MagicMock())
        assert out == []

    @pytest.mark.asyncio
    async def test_embed_batch_empty_and_invalid_embedder(self):
        buf = ChunkBuffer()

        assert await buf._embed_batch([], MagicMock()) == []

        with pytest.raises(ValueError):
            await buf._embed_batch([MemoryChunk.create(content="x")], MagicMock(spec=[]))

    @pytest.mark.asyncio
    async def test_embed_batch_fallback_sync_embed_and_error(self):
        buf = ChunkBuffer()
        chunks = [MemoryChunk.create(content="a")]

        embedder = MagicMock(spec=[])
        embedder.embed = MagicMock(return_value=[0.1])
        embedded = await buf._embed_batch(chunks, embedder)
        assert embedded[0].embedded is True
        assert embedded[0].embedding == [0.1]

        bad = MagicMock(spec=[])
        bad.embed = MagicMock(side_effect=RuntimeError("boom"))
        with pytest.raises(RuntimeError):
            await buf._embed_batch([MemoryChunk.create(content="b")], bad)

    def test_text_chunker_merge_and_split_branches(self):
        chunker = TextChunker(chunk_size=10, min_chunk_size=1)

        paragraphs = ["a", "bb", "c" * 20, "d", "ee"]
        out = chunker._merge_and_split(paragraphs)

        assert len(out) >= 3
        assert any("bb" in c for c in out)

    def test_text_chunker_split_sentence_and_length_branches(self):
        chunker = TextChunker(chunk_size=8, chunk_overlap=2, min_chunk_size=2)
        text = "X" * 30

        out = chunker._split_by_sentence(text)
        assert len(out) >= 2
        assert all(len(x) >= 2 for x in out)

    def test_split_by_sentences_whitespace_fallback(self):
        splitter = ChunkSplitter(min_chunk_length=1)
        chunks = splitter.split_by_sentences("   ", source_id="sid")

        assert len(chunks) == 1
        assert chunks[0].metadata["chunk_method"] == "sentences"

    def test_split_by_paragraphs_whitespace_fallback_and_valid_path(self):
        splitter = ChunkSplitter(min_chunk_length=3)

        fallback = splitter.split_by_paragraphs("\n\n  \n", source_id="sid")
        assert len(fallback) == 1
        assert fallback[0].metadata["chunk_method"] == "paragraphs"

        valid = splitter.split_by_paragraphs("aaaa\n\nbbbb", source_id="sid")
        assert len(valid) == 2

    def test_create_chunks_and_sentence_boundary_match(self):
        splitter = ChunkSplitter()
        chunks = splitter._create_chunks(["a", "b"], source_id="s", metadata={"x": 1}, method="m")
        assert [c.chunk_index for c in chunks] == [0, 1]

        boundary = splitter._find_sentence_boundary("abc.def", 0, 7)
        assert boundary == 4

    @pytest.mark.asyncio
    async def test_add_chunked_empty_chunks_branch(self):
        mock_service = MagicMock()
        mock_service.embedder = MagicMock()
        adapter = ChunkedMemoryAdapter(memory_service=mock_service)

        adapter.chunker.chunk_text = MagicMock(return_value=[])
        result = await adapter.add_chunked("anything")

        assert result["status"] == "empty"
        assert result["chunk_ids"] == []

    @pytest.mark.asyncio
    async def test_search_with_context_duplicate_source_and_no_source(self):
        first = MagicMock()
        first.metadata = {"source_id": "s1", "chunk_index": 1}
        duplicate = MagicMock()
        duplicate.metadata = {"source_id": "s1", "chunk_index": 2}
        no_source = MagicMock()
        no_source.metadata = {}

        mock_service = MagicMock()
        mock_service.search = AsyncMock(return_value=[first, duplicate, no_source])

        adapter = ChunkedMemoryAdapter(memory_service=mock_service)
        adapter._get_context_chunks = AsyncMock(return_value=["ctx"])

        results = await adapter.search_with_context("q", context_window=1, limit=3)
        assert results[0]["context"] == ["ctx"]
        assert results[1]["context"] == []
        assert results[2]["context"] == []

    def test_get_chunk_buffer_initialization_branch(self):
        from src.memory.memory_chunk import reset_chunk_buffer, get_chunk_buffer

        reset_chunk_buffer()
        buf = get_chunk_buffer(batch_size=7, max_buffer_size=9)
        assert buf.batch_size == 7
        assert buf.max_buffer_size == 9
