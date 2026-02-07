"""
MemoryChunk 单元测试
"""

import asyncio
import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

from src.memory.memory_chunk import (
    MemoryChunk,
    ChunkBuffer,
    TextChunker,
    ChunkedMemoryAdapter,
    get_chunk_buffer,
    get_text_chunker,
    reset_chunk_buffer,
    reset_text_chunker,
)


class TestMemoryChunk:
    """MemoryChunk 数据结构测试"""

    def test_create_chunk(self):
        """测试创建记忆块"""
        chunk = MemoryChunk.create(
            content="测试内容",
            source_id="source-123",
            chunk_index=0,
            total_chunks=3,
            metadata={"key": "value"}
        )

        assert chunk.content == "测试内容"
        assert chunk.source_id == "source-123"
        assert chunk.chunk_index == 0
        assert chunk.total_chunks == 3
        assert chunk.metadata == {"key": "value"}
        assert chunk.embedded is False
        assert chunk.embedding is None
        assert chunk.id is not None

    def test_content_hash(self):
        """测试内容哈希"""
        chunk1 = MemoryChunk.create(content="相同内容")
        chunk2 = MemoryChunk.create(content="相同内容")
        chunk3 = MemoryChunk.create(content="不同内容")

        assert chunk1.content_hash == chunk2.content_hash
        assert chunk1.content_hash != chunk3.content_hash

    def test_to_dict(self):
        """测试转换为字典"""
        chunk = MemoryChunk.create(content="测试")
        data = chunk.to_dict()

        assert data["content"] == "测试"
        assert "id" in data
        assert "created_at" in data
        assert data["embedded"] is False

    def test_from_dict(self):
        """测试从字典创建"""
        data = {
            "id": "test-id",
            "content": "测试内容",
            "embedding": [0.1, 0.2, 0.3],
            "metadata": {"key": "value"},
            "created_at": "2026-01-01T00:00:00",
            "source_id": "source-123",
            "chunk_index": 1,
            "total_chunks": 5,
            "embedded": True
        }
        chunk = MemoryChunk.from_dict(data)

        assert chunk.id == "test-id"
        assert chunk.content == "测试内容"
        assert chunk.embedding == [0.1, 0.2, 0.3]
        assert chunk.embedded is True


class TestChunkBuffer:
    """ChunkBuffer 缓冲管理测试"""

    def setup_method(self):
        """每个测试前重置"""
        reset_chunk_buffer()

    def test_add_chunk(self):
        """测试添加块"""
        buffer = ChunkBuffer(batch_size=10)
        chunk = MemoryChunk.create(content="测试")

        result = buffer.add(chunk)

        assert result is True
        assert buffer.size == 1

    def test_deduplication(self):
        """测试去重"""
        buffer = ChunkBuffer(batch_size=10)
        chunk1 = MemoryChunk.create(content="相同内容")
        chunk2 = MemoryChunk.create(content="相同内容")

        buffer.add(chunk1)
        result = buffer.add(chunk2)

        assert result is False
        assert buffer.size == 1
        assert buffer.stats["total_deduplicated"] == 1

    def test_add_many(self):
        """测试批量添加"""
        buffer = ChunkBuffer(batch_size=10)
        chunks = [
            MemoryChunk.create(content=f"内容{i}")
            for i in range(5)
        ]

        added = buffer.add_many(chunks)

        assert added == 5
        assert buffer.size == 5

    def test_is_batch_ready(self):
        """测试批次就绪检测"""
        buffer = ChunkBuffer(batch_size=3)

        for i in range(2):
            buffer.add(MemoryChunk.create(content=f"内容{i}"))
        assert buffer.is_batch_ready is False

        buffer.add(MemoryChunk.create(content="内容2"))
        assert buffer.is_batch_ready is True

    @pytest.mark.asyncio
    async def test_flush(self):
        """测试刷新缓冲区"""
        buffer = ChunkBuffer(batch_size=10)
        for i in range(3):
            buffer.add(MemoryChunk.create(content=f"内容{i}"))

        # Mock embedder with embed_batch method
        embedder = MagicMock()
        embedder.embed_batch = MagicMock(return_value=[
            [0.1, 0.2, 0.3],
            [0.1, 0.2, 0.3],
            [0.1, 0.2, 0.3]
        ])

        embedded = await buffer.flush(embedder)

        assert len(embedded) == 3
        assert all(c.embedded for c in embedded)
        assert all(c.embedding == [0.1, 0.2, 0.3] for c in embedded)
        assert buffer.size == 0

    @pytest.mark.asyncio
    async def test_flush_batch(self):
        """测试刷新单个批次"""
        buffer = ChunkBuffer(batch_size=2)
        for i in range(5):
            buffer.add(MemoryChunk.create(content=f"内容{i}"))

        embedder = MagicMock()
        embedder.embed = MagicMock(return_value=[0.1, 0.2])

        embedded = await buffer.flush_batch(embedder)

        assert len(embedded) == 2
        assert buffer.size == 3

    def test_max_buffer_size(self):
        """测试缓冲区容量限制"""
        buffer = ChunkBuffer(batch_size=10, max_buffer_size=5)

        for i in range(10):
            buffer.add(MemoryChunk.create(content=f"内容{i}"))

        assert buffer.size == 5

    def test_stats(self):
        """测试统计信息"""
        buffer = ChunkBuffer(batch_size=10)
        buffer.add(MemoryChunk.create(content="内容1"))
        buffer.add(MemoryChunk.create(content="内容1"))  # 重复
        buffer.add(MemoryChunk.create(content="内容2"))

        stats = buffer.stats

        assert stats["buffer_size"] == 2
        assert stats["total_added"] == 2
        assert stats["total_deduplicated"] == 1


class TestTextChunker:
    """TextChunker 文本分块器测试"""

    def setup_method(self):
        """每个测试前重置"""
        reset_text_chunker()

    def test_short_text(self):
        """测试短文本不分块"""
        chunker = TextChunker(chunk_size=100)
        chunks = chunker.chunk_text("短文本")

        assert len(chunks) == 1
        assert chunks[0].content == "短文本"
        assert chunks[0].total_chunks == 1

    def test_paragraph_chunking(self):
        """测试按段落分块"""
        chunker = TextChunker(chunk_size=50)
        text = "第一段内容。\n\n第二段内容。\n\n第三段内容。"

        chunks = chunker.chunk_text(text)

        assert len(chunks) >= 1
        assert all(c.source_id is None for c in chunks)

    def test_chunk_with_source_id(self):
        """测试带源ID分块"""
        chunker = TextChunker(chunk_size=50)
        text = "第一段。\n\n第二段。"

        chunks = chunker.chunk_text(text, source_id="src-123")

        assert all(c.source_id == "src-123" for c in chunks)

    def test_chunk_indices(self):
        """测试块索引"""
        chunker = TextChunker(chunk_size=20)
        text = "段落一。\n\n段落二。\n\n段落三。"

        chunks = chunker.chunk_text(text)

        for i, chunk in enumerate(chunks):
            assert chunk.chunk_index == i
            assert chunk.total_chunks == len(chunks)

    def test_long_paragraph(self):
        """测试长段落分割"""
        chunker = TextChunker(chunk_size=50, chunk_overlap=10)
        text = "这是一个很长的段落。" * 20

        chunks = chunker.chunk_text(text)

        assert len(chunks) > 1
        # 验证每个块不超过 chunk_size 太多
        for chunk in chunks:
            assert len(chunk.content) <= 100  # 允许一定余量

    def test_metadata_preservation(self):
        """测试元数据保留"""
        chunker = TextChunker(chunk_size=50)
        text = "段落一。\n\n段落二。"
        metadata = {"author": "test", "category": "fiction"}

        chunks = chunker.chunk_text(text, metadata=metadata)

        for chunk in chunks:
            assert chunk.metadata.get("author") == "test"
            assert chunk.metadata.get("category") == "fiction"


class TestChunkedMemoryAdapter:
    """ChunkedMemoryAdapter 集成测试"""

    @pytest.mark.asyncio
    async def test_add_chunked(self):
        """测试添加分块记忆"""
        # Mock MemoryService
        mock_service = MagicMock()
        mock_service.embedder = MagicMock()
        mock_service.embedder.embed = MagicMock(return_value=[0.1, 0.2, 0.3])
        mock_service.add = AsyncMock(return_value="memory-id-123")

        adapter = ChunkedMemoryAdapter(
            memory_service=mock_service,
            chunk_size=50,
            batch_size=10
        )

        result = await adapter.add_chunked(
            content="第一段内容。\n\n第二段内容。",
            namespace="test",
            importance=0.8,
            tags=["tag1"]
        )

        assert result["status"] == "created"
        assert "source_id" in result
        assert "chunk_ids" in result
        assert mock_service.add.called


class TestFactoryFunctions:
    """工厂函数测试"""

    def setup_method(self):
        """每个测试前重置"""
        reset_chunk_buffer()
        reset_text_chunker()

    def test_get_chunk_buffer_singleton(self):
        """测试 ChunkBuffer 单例"""
        buffer1 = get_chunk_buffer(batch_size=32)
        buffer2 = get_chunk_buffer(batch_size=64)

        assert buffer1 is buffer2

    def test_get_text_chunker_singleton(self):
        """测试 TextChunker 单例"""
        chunker1 = get_text_chunker(chunk_size=512)
        chunker2 = get_text_chunker(chunk_size=1024)

        assert chunker1 is chunker2

    def test_reset_functions(self):
        """测试重置函数"""
        buffer = get_chunk_buffer()
        buffer.add(MemoryChunk.create(content="test"))

        reset_chunk_buffer()
        new_buffer = get_chunk_buffer()

        assert new_buffer.size == 0
