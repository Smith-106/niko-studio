# -*- coding: utf-8 -*-
"""MemoryChunk, ChunkBuffer, TextChunker tests."""

import pytest
import asyncio
from unittest.mock import MagicMock, AsyncMock

from src.memory.memory_chunk import MemoryChunk, ChunkBuffer, TextChunker


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


class TestTextChunker:
    def test_short_text(self):
        tc = TextChunker(chunk_size=100)
        chunks = tc.chunk_text("short text")
        assert len(chunks) == 1
        assert chunks[0].content == "short text"

    def test_empty_text(self):
        tc = TextChunker()
        chunks = tc.chunk_text("")
        assert len(chunks) == 1

    def test_paragraph_split(self):
        text = "Para one.\n\nPara two.\n\nPara three."
        tc = TextChunker(chunk_size=20)
        chunks = tc.chunk_text(text, source_id="doc1")
        assert len(chunks) >= 2
        assert all(c.source_id == "doc1" for c in chunks)

    def test_large_paragraph_split(self):
        # Single paragraph larger than chunk_size
        text = "这是一个很长的句子。" * 50
        tc = TextChunker(chunk_size=50, chunk_overlap=10)
        chunks = tc.chunk_text(text)
        assert len(chunks) > 1
        for i, c in enumerate(chunks):
            assert c.chunk_index == i
            assert c.total_chunks == len(chunks)

    def test_metadata_passed(self):
        tc = TextChunker(chunk_size=100)
        chunks = tc.chunk_text("text", metadata={"key": "val"})
        assert chunks[0].metadata.get("key") == "val"

    def test_split_paragraphs(self):
        tc = TextChunker()
        paras = tc._split_paragraphs("a\n\nb\n\n\n\nc")
        assert len(paras) == 3
        assert paras[0] == "a"

    def test_split_by_length(self):
        tc = TextChunker(chunk_size=10, chunk_overlap=3, min_chunk_size=5)
        result = tc._split_by_length("abcdefghijklmnopqrst")
        assert len(result) >= 2
        # Each chunk should be <= chunk_size
        for r in result:
            assert len(r) <= 10

    def test_split_by_length_min_chunk(self):
        tc = TextChunker(chunk_size=10, chunk_overlap=3, min_chunk_size=5)
        result = tc._split_by_length("abcde")
        assert len(result) == 1

    def test_merge_and_split(self):
        tc = TextChunker(chunk_size=30, chunk_overlap=5, min_chunk_size=5)
        paras = ["short", "also short", "a" * 50]
        result = tc._merge_and_split(paras)
        assert len(result) >= 2
