"""
MemoryChunk - 记忆分块系统

实现记忆的分块存储和批量嵌入生成:
- MemoryChunk: 记忆块数据结构
- ChunkBuffer: 待嵌入块的缓冲管理
- 批量嵌入生成优化
- 与 MemoryService.add() 集成

依赖:
- EmbeddingEngine: 向量嵌入生成
- MemoryService: 记忆存储服务
"""

import asyncio
import hashlib
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


# ============================================================
# MemoryChunk 数据结构
# ============================================================

@dataclass
class MemoryChunk:
    """
    记忆分块数据结构

    Attributes:
        id: 块唯一标识
        content: 文本内容
        embedding: 向量嵌入 (可为空, 待生成)
        metadata: 元数据
        created_at: 创建时间

        # 分块信息
        source_id: 源记忆 ID
        chunk_index: 块索引 (在源记忆中的位置)
        total_chunks: 源记忆的总块数

        # 状态
        embedded: 是否已生成嵌入
    """
    id: str
    content: str
    embedding: Optional[List[float]] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)

    # 分块信息
    source_id: Optional[str] = None
    chunk_index: int = 0
    total_chunks: int = 1

    # 状态
    embedded: bool = False

    @classmethod
    def create(
        cls,
        content: str,
        source_id: Optional[str] = None,
        chunk_index: int = 0,
        total_chunks: int = 1,
        metadata: Optional[Dict[str, Any]] = None
    ) -> "MemoryChunk":
        """创建新的记忆块"""
        chunk_id = str(uuid.uuid4())
        return cls(
            id=chunk_id,
            content=content,
            source_id=source_id,
            chunk_index=chunk_index,
            total_chunks=total_chunks,
            metadata=metadata or {},
            created_at=datetime.now(),
            embedded=False
        )

    @property
    def content_hash(self) -> str:
        """内容哈希 (用于去重)"""
        return hashlib.sha256(self.content.encode()).hexdigest()[:16]

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "id": self.id,
            "content": self.content,
            "embedding": self.embedding,
            "metadata": self.metadata,
            "created_at": self.created_at.isoformat(),
            "source_id": self.source_id,
            "chunk_index": self.chunk_index,
            "total_chunks": self.total_chunks,
            "embedded": self.embedded,
            "content_hash": self.content_hash
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "MemoryChunk":
        """从字典创建"""
        created_at = data.get("created_at")
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at)
        elif created_at is None:
            created_at = datetime.now()

        return cls(
            id=data["id"],
            content=data["content"],
            embedding=data.get("embedding"),
            metadata=data.get("metadata", {}),
            created_at=created_at,
            source_id=data.get("source_id"),
            chunk_index=data.get("chunk_index", 0),
            total_chunks=data.get("total_chunks", 1),
            embedded=data.get("embedded", False)
        )


# ============================================================
# ChunkBuffer - 待嵌入块的缓冲管理
# ============================================================

class ChunkBuffer:
    """
    待嵌入块的缓冲管理

    功能:
    - 批量收集待嵌入的块
    - 达到阈值时触发批量嵌入
    - 支持手动刷新
    - 去重处理

    Usage:
        buffer = ChunkBuffer(batch_size=32)
        buffer.add(chunk1)
        buffer.add(chunk2)
        # 当达到 batch_size 时自动触发嵌入
        # 或手动刷新
        embedded_chunks = await buffer.flush(embedder)
    """

    def __init__(
        self,
        batch_size: int = 32,
        max_buffer_size: int = 1000,
        on_batch_ready: Optional[Callable[[List[MemoryChunk]], None]] = None
    ):
        """
        初始化 ChunkBuffer

        Args:
            batch_size: 批量嵌入的大小
            max_buffer_size: 缓冲区最大容量
            on_batch_ready: 批次准备就绪时的回调
        """
        self._buffer: List[MemoryChunk] = []
        self._seen_hashes: set = set()
        self.batch_size = batch_size
        self.max_buffer_size = max_buffer_size
        self._on_batch_ready = on_batch_ready
        self._lock = asyncio.Lock()

        # 统计
        self._total_added = 0
        self._total_deduplicated = 0
        self._total_embedded = 0

    def add(self, chunk: MemoryChunk) -> bool:
        """
        添加块到缓冲区

        Args:
            chunk: 记忆块

        Returns:
            是否添加成功 (去重后可能失败)
        """
        # 去重检查
        content_hash = chunk.content_hash
        if content_hash in self._seen_hashes:
            self._total_deduplicated += 1
            logger.debug(f"Chunk deduplicated: {chunk.id[:8]}...")
            return False

        # 容量检查
        if len(self._buffer) >= self.max_buffer_size:
            logger.warning(f"Buffer full ({self.max_buffer_size}), rejecting chunk")
            return False

        self._buffer.append(chunk)
        self._seen_hashes.add(content_hash)
        self._total_added += 1

        logger.debug(f"Chunk added to buffer: {chunk.id[:8]}... ({len(self._buffer)}/{self.batch_size})")
        return True

    def add_many(self, chunks: List[MemoryChunk]) -> int:
        """
        批量添加块

        Returns:
            成功添加的数量
        """
        added = 0
        for chunk in chunks:
            if self.add(chunk):
                added += 1
        return added

    async def flush(self, embedder: Any) -> List[MemoryChunk]:
        """
        刷新缓冲区, 生成所有待处理块的嵌入

        Args:
            embedder: 嵌入引擎 (需要有 embed 或 embed_batch 方法)

        Returns:
            已嵌入的块列表
        """
        async with self._lock:
            if not self._buffer:
                return []

            # 取出所有块 (包括未嵌入的)
            chunks_to_embed = list(self._buffer)
            if not chunks_to_embed:
                return []

            logger.info(f"Flushing buffer: {len(chunks_to_embed)} chunks")

            # 批量生成嵌入
            embedded_chunks = await self._embed_batch(chunks_to_embed, embedder)

            # 更新统计
            self._total_embedded += len(embedded_chunks)

            # 清空缓冲区
            self._buffer.clear()
            self._seen_hashes.clear()

            return embedded_chunks

    async def flush_batch(self, embedder: Any) -> List[MemoryChunk]:
        """
        刷新一个批次, 生成 batch_size 个块的嵌入

        Returns:
            已嵌入的块列表
        """
        async with self._lock:
            if len(self._buffer) < self.batch_size:
                return []

            # 取出一个批次
            batch = self._buffer[:self.batch_size]
            self._buffer = self._buffer[self.batch_size:]

            # 批量生成嵌入
            embedded_chunks = await self._embed_batch(batch, embedder)
            self._total_embedded += len(embedded_chunks)

            return embedded_chunks

    async def _embed_batch(
        self,
        chunks: List[MemoryChunk],
        embedder: Any
    ) -> List[MemoryChunk]:
        """
        批量生成嵌入

        Args:
            chunks: 块列表
            embedder: 嵌入引擎

        Returns:
            已嵌入的块列表
        """
        if not chunks:
            return []

        texts = [c.content for c in chunks]

        try:
            # 尝试批量嵌入
            if hasattr(embedder, "embed_batch"):
                if asyncio.iscoroutinefunction(embedder.embed_batch):
                    embeddings = await embedder.embed_batch(texts)
                else:
                    embeddings = embedder.embed_batch(texts)
            elif hasattr(embedder, "embed"):
                # 回退到单个嵌入
                embeddings = []
                for text in texts:
                    if asyncio.iscoroutinefunction(embedder.embed):
                        emb = await embedder.embed(text)
                    else:
                        emb = embedder.embed(text)
                    embeddings.append(emb)
            else:
                raise ValueError("Embedder must have embed or embed_batch method")

            # 更新块的嵌入
            for chunk, embedding in zip(chunks, embeddings):
                chunk.embedding = embedding
                chunk.embedded = True

            logger.info(f"Embedded {len(chunks)} chunks")
            return chunks

        except Exception as e:
            logger.error(f"Batch embedding failed: {e}")
            raise

    @property
    def size(self) -> int:
        """当前缓冲区大小"""
        return len(self._buffer)

    @property
    def is_batch_ready(self) -> bool:
        """是否有一个完整批次准备就绪"""
        return len(self._buffer) >= self.batch_size

    @property
    def stats(self) -> Dict[str, int]:
        """统计信息"""
        return {
            "buffer_size": len(self._buffer),
            "total_added": self._total_added,
            "total_deduplicated": self._total_deduplicated,
            "total_embedded": self._total_embedded
        }

    def clear(self):
        """清空缓冲区"""
        self._buffer.clear()
        self._seen_hashes.clear()


# ============================================================
# TextChunker - 文本分块器
# ============================================================

class TextChunker:
    """
    文本分块器

    将长文本分割成适合嵌入的小块。

    分块策略:
    - 按段落分割
    - 按句子分割
    - 按固定长度分割 (带重叠)
    """

    def __init__(
        self,
        chunk_size: int = 512,
        chunk_overlap: int = 50,
        min_chunk_size: int = 50
    ):
        """
        初始化分块器

        Args:
            chunk_size: 目标块大小 (字符数)
            chunk_overlap: 块之间的重叠 (字符数)
            min_chunk_size: 最小块大小
        """
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.min_chunk_size = min_chunk_size

    def chunk_text(
        self,
        text: str,
        source_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> List[MemoryChunk]:
        """
        将文本分割成块

        Args:
            text: 源文本
            source_id: 源记忆 ID
            metadata: 共享元数据

        Returns:
            MemoryChunk 列表
        """
        if not text or len(text) <= self.chunk_size:
            # 文本足够短, 不需要分块
            return [MemoryChunk.create(
                content=text,
                source_id=source_id,
                chunk_index=0,
                total_chunks=1,
                metadata=metadata
            )]

        # 按段落分割
        paragraphs = self._split_paragraphs(text)

        # 合并小段落, 分割大段落
        chunks_text = self._merge_and_split(paragraphs)

        # 创建 MemoryChunk 对象
        total_chunks = len(chunks_text)
        chunks = []
        for i, chunk_text in enumerate(chunks_text):
            chunk = MemoryChunk.create(
                content=chunk_text,
                source_id=source_id,
                chunk_index=i,
                total_chunks=total_chunks,
                metadata={**(metadata or {}), "chunk_method": "paragraph"}
            )
            chunks.append(chunk)

        logger.debug(f"Text chunked: {len(text)} chars -> {len(chunks)} chunks")
        return chunks

    def _split_paragraphs(self, text: str) -> List[str]:
        """按段落分割"""
        # 按双换行分割
        paragraphs = text.split("\n\n")
        # 过滤空段落
        return [p.strip() for p in paragraphs if p.strip()]

    def _merge_and_split(self, paragraphs: List[str]) -> List[str]:
        """合并小段落, 分割大段落"""
        result = []
        current_chunk = ""

        for para in paragraphs:
            # 如果段落本身就超过 chunk_size, 需要进一步分割
            if len(para) > self.chunk_size:
                # 先保存当前累积的内容
                if current_chunk:
                    result.append(current_chunk)
                    current_chunk = ""

                # 分割大段落
                sub_chunks = self._split_by_sentence(para)
                result.extend(sub_chunks)
            else:
                # 尝试合并
                if len(current_chunk) + len(para) + 2 <= self.chunk_size:
                    if current_chunk:
                        current_chunk += "\n\n" + para
                    else:
                        current_chunk = para
                else:
                    # 当前块已满, 保存并开始新块
                    if current_chunk:
                        result.append(current_chunk)
                    current_chunk = para

        # 保存最后一个块
        if current_chunk:
            result.append(current_chunk)

        return result

    def _split_by_sentence(self, text: str) -> List[str]:
        """按句子分割 (用于大段落)"""
        import re
        # 中英文句子分隔符
        sentences = re.split(r'(?<=[.!?。！？])\s*', text)
        sentences = [s.strip() for s in sentences if s.strip()]

        result = []
        current_chunk = ""

        for sentence in sentences:
            if len(current_chunk) + len(sentence) + 1 <= self.chunk_size:
                if current_chunk:
                    current_chunk += " " + sentence
                else:
                    current_chunk = sentence
            else:
                if current_chunk:
                    result.append(current_chunk)
                # 如果单个句子超过限制, 按固定长度分割
                if len(sentence) > self.chunk_size:
                    result.extend(self._split_by_length(sentence))
                    current_chunk = ""
                else:
                    current_chunk = sentence

        if current_chunk:
            result.append(current_chunk)

        return result

    def _split_by_length(self, text: str) -> List[str]:
        """按固定长度分割 (带重叠)"""
        result = []
        start = 0
        step = max(1, self.chunk_size - self.chunk_overlap)

        while start < len(text):
            end = start + self.chunk_size
            chunk = text[start:end]

            if len(chunk) >= self.min_chunk_size:
                result.append(chunk)

            # 带重叠移动，确保游标单调前进
            start += step

        return result


# ============================================================
# ChunkSplitter - 分块策略
# ============================================================

class ChunkSplitter:
    """
    分块策略类

    提供多种文本分块策略:
    - split_by_tokens: 按 token 数分割
    - split_by_sentences: 按句子数分割
    - split_by_paragraphs: 按段落分割

    Usage:
        splitter = ChunkSplitter()
        chunks = splitter.split_by_tokens(text, max_tokens=256)
        chunks = splitter.split_by_sentences(text, max_sentences=5)
        chunks = splitter.split_by_paragraphs(text)
    """

    def __init__(
        self,
        overlap_tokens: int = 20,
        overlap_sentences: int = 1,
        min_chunk_length: int = 50
    ):
        """
        初始化分块策略

        Args:
            overlap_tokens: token 分割时的重叠数
            overlap_sentences: 句子分割时的重叠数
            min_chunk_length: 最小块长度 (字符)
        """
        self.overlap_tokens = overlap_tokens
        self.overlap_sentences = overlap_sentences
        self.min_chunk_length = min_chunk_length

    def split_by_tokens(
        self,
        text: str,
        max_tokens: int = 256,
        source_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> List[MemoryChunk]:
        """
        按 token 数分割文本

        使用简单的字符估算 (中文约 1.5 字符/token, 英文约 4 字符/token)

        Args:
            text: 源文本
            max_tokens: 每块最大 token 数
            source_id: 源记忆 ID
            metadata: 元数据

        Returns:
            MemoryChunk 列表
        """
        if not text:
            return []

        # 估算字符数 (混合中英文取平均值约 2.5 字符/token)
        chars_per_token = 2.5
        max_chars = int(max_tokens * chars_per_token)
        overlap_chars = int(self.overlap_tokens * chars_per_token)

        chunks_text = []
        start = 0

        while start < len(text):
            end = min(start + max_chars, len(text))

            # 尝试在句子边界断开
            if end < len(text):
                boundary = self._find_sentence_boundary(text, start, end)
                if boundary > start:
                    end = boundary

            chunk_text = text[start:end].strip()
            if len(chunk_text) >= self.min_chunk_length:
                chunks_text.append(chunk_text)

            # 带重叠移动
            start = max(start + 1, end - overlap_chars)

        # 创建 MemoryChunk 对象
        return self._create_chunks(chunks_text, source_id, metadata, "tokens")

    def split_by_sentences(
        self,
        text: str,
        max_sentences: int = 5,
        source_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> List[MemoryChunk]:
        """
        按句子数分割文本

        Args:
            text: 源文本
            max_sentences: 每块最大句子数
            source_id: 源记忆 ID
            metadata: 元数据

        Returns:
            MemoryChunk 列表
        """
        if not text:
            return []

        import re
        # 中英文句子分隔符
        sentences = re.split(r'(?<=[.!?。！？])\s*', text)
        sentences = [s.strip() for s in sentences if s.strip()]

        if not sentences:
            return [MemoryChunk.create(
                content=text,
                source_id=source_id,
                chunk_index=0,
                total_chunks=1,
                metadata={**(metadata or {}), "chunk_method": "sentences"}
            )]

        chunks_text = []
        i = 0

        while i < len(sentences):
            # 取 max_sentences 个句子
            end_idx = min(i + max_sentences, len(sentences))
            chunk_sentences = sentences[i:end_idx]
            chunk_text = " ".join(chunk_sentences)

            if len(chunk_text) >= self.min_chunk_length:
                chunks_text.append(chunk_text)

            # 带重叠移动
            i = end_idx - self.overlap_sentences
            if i <= (end_idx - max_sentences):
                i = end_idx  # 防止无限循环

        return self._create_chunks(chunks_text, source_id, metadata, "sentences")

    def split_by_paragraphs(
        self,
        text: str,
        source_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> List[MemoryChunk]:
        """
        按段落分割文本

        每个段落作为一个独立的块

        Args:
            text: 源文本
            source_id: 源记忆 ID
            metadata: 元数据

        Returns:
            MemoryChunk 列表
        """
        if not text:
            return []

        # 按双换行或单换行分割段落
        import re
        paragraphs = re.split(r'\n\s*\n|\n', text)
        paragraphs = [p.strip() for p in paragraphs if p.strip()]

        if not paragraphs:
            return [MemoryChunk.create(
                content=text,
                source_id=source_id,
                chunk_index=0,
                total_chunks=1,
                metadata={**(metadata or {}), "chunk_method": "paragraphs"}
            )]

        # 过滤过短的段落
        valid_paragraphs = [
            p for p in paragraphs
            if len(p) >= self.min_chunk_length
        ]

        # 如果过滤后没有有效段落，合并所有短段落
        if not valid_paragraphs and paragraphs:
            merged = "\n\n".join(paragraphs)
            return [MemoryChunk.create(
                content=merged,
                source_id=source_id,
                chunk_index=0,
                total_chunks=1,
                metadata={**(metadata or {}), "chunk_method": "paragraphs"}
            )]

        return self._create_chunks(valid_paragraphs, source_id, metadata, "paragraphs")

    def _find_sentence_boundary(self, text: str, start: int, end: int) -> int:
        """在指定范围内找到最近的句子边界"""
        import re
        # 从 end 向前搜索句子结束符
        search_text = text[start:end]
        matches = list(re.finditer(r'[.!?。！？]', search_text))

        if matches:
            # 返回最后一个匹配的位置
            return start + matches[-1].end()

        return end

    def _create_chunks(
        self,
        chunks_text: List[str],
        source_id: Optional[str],
        metadata: Optional[Dict[str, Any]],
        method: str
    ) -> List[MemoryChunk]:
        """创建 MemoryChunk 对象列表"""
        total_chunks = len(chunks_text)
        chunks = []

        for i, chunk_text in enumerate(chunks_text):
            chunk = MemoryChunk.create(
                content=chunk_text,
                source_id=source_id,
                chunk_index=i,
                total_chunks=total_chunks,
                metadata={**(metadata or {}), "chunk_method": method}
            )
            chunks.append(chunk)

        logger.debug(f"Split text into {len(chunks)} chunks using {method} strategy")
        return chunks


# ============================================================
# MemoryService 集成
# ============================================================

class ChunkedMemoryAdapter:
    """
    分块记忆适配器

    将分块功能集成到 MemoryService。

    Usage:
        from src.services.memory_service import MemoryService
        service = MemoryService()
        adapter = ChunkedMemoryAdapter(service)
        await adapter.add_chunked(long_text, namespace="writing")
    """

    def __init__(
        self,
        memory_service: Any,
        chunk_size: int = 512,
        batch_size: int = 32
    ):
        """
        初始化适配器

        Args:
            memory_service: MemoryService 实例
            chunk_size: 块大小
            batch_size: 批量嵌入大小
        """
        self.memory_service = memory_service
        self.chunker = TextChunker(chunk_size=chunk_size)
        self.buffer = ChunkBuffer(batch_size=batch_size)

    async def add_chunked(
        self,
        content: str,
        namespace: str = "default",
        importance: float = 0.5,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        添加分块记忆

        Args:
            content: 文本内容
            namespace: 命名空间
            importance: 重要性
            tags: 标签
            metadata: 元数据

        Returns:
            添加结果, 包含 source_id 和 chunk_ids
        """
        source_id = str(uuid.uuid4())

        # 分块
        chunks = self.chunker.chunk_text(
            text=content,
            source_id=source_id,
            metadata={
                **(metadata or {}),
                "namespace": namespace,
                "importance": importance,
                "tags": tags or []
            }
        )

        if not chunks:
            return {"source_id": source_id, "chunk_ids": [], "status": "empty"}

        # 添加到缓冲区
        self.buffer.add_many(chunks)

        # 生成嵌入
        embedder = self.memory_service.embedder
        embedded_chunks = await self.buffer.flush(embedder)

        # 存储到 MemoryService
        chunk_ids = []
        for chunk in embedded_chunks:
            from src.services.memory_service import Message, AddOptions
            message = Message(
                role="system",
                content=chunk.content,
                metadata={
                    **chunk.metadata,
                    "source_id": chunk.source_id,
                    "chunk_index": chunk.chunk_index,
                    "total_chunks": chunk.total_chunks
                }
            )
            memory_id = await self.memory_service.add(
                messages=[message],
                options=AddOptions(
                    namespace=namespace,
                    importance=importance,
                    tags=tags
                )
            )
            chunk_ids.append(memory_id)

        logger.info(f"Added chunked memory: {source_id[:8]}... ({len(chunk_ids)} chunks)")

        return {
            "source_id": source_id,
            "chunk_ids": chunk_ids,
            "total_chunks": len(chunks),
            "status": "created"
        }

    async def search_with_context(
        self,
        query: str,
        namespace: str = "default",
        limit: int = 5,
        context_window: int = 1
    ) -> List[Dict[str, Any]]:
        """
        搜索并返回上下文块

        Args:
            query: 查询文本
            namespace: 命名空间
            limit: 结果数量
            context_window: 上下文窗口 (返回相邻块)

        Returns:
            搜索结果列表
        """
        from src.services.memory_service import SearchOptions

        # 基本搜索
        results = await self.memory_service.search(
            query=query,
            options=SearchOptions(
                namespace=namespace,
                limit=limit * 2,  # 多搜一些用于去重
                threshold=0.5
            )
        )

        # 如果需要上下文, 获取相邻块
        if context_window > 0:
            enriched_results = []
            seen_sources = set()

            for result in results:
                source_id = result.metadata.get("source_id")
                if source_id and source_id not in seen_sources:
                    seen_sources.add(source_id)
                    # 获取相邻块
                    context_results = await self._get_context_chunks(
                        source_id=source_id,
                        chunk_index=result.metadata.get("chunk_index", 0),
                        namespace=namespace,
                        window=context_window
                    )
                    enriched_results.append({
                        "main": result,
                        "context": context_results
                    })
                else:
                    enriched_results.append({
                        "main": result,
                        "context": []
                    })

            return enriched_results[:limit]

        return [{"main": r, "context": []} for r in results[:limit]]

    async def _get_context_chunks(
        self,
        source_id: str,
        chunk_index: int,
        namespace: str,
        window: int
    ) -> List[Any]:
        """获取上下文块"""
        # 简化实现: 通过 metadata 搜索相邻块
        from src.services.memory_service import SearchOptions

        # 搜索同源的块
        results = await self.memory_service.search(
            query=f"source:{source_id}",
            options=SearchOptions(
                namespace=namespace,
                limit=window * 2 + 1,
                threshold=0.0
            )
        )

        # 过滤出相邻块
        context = []
        for r in results:
            r_index = r.metadata.get("chunk_index", 0)
            if abs(r_index - chunk_index) <= window and r_index != chunk_index:
                context.append(r)

        return sorted(context, key=lambda x: x.metadata.get("chunk_index", 0))


# ============================================================
# 工厂函数
# ============================================================

_chunk_buffer: Optional[ChunkBuffer] = None
_text_chunker: Optional[TextChunker] = None


def get_chunk_buffer(
    batch_size: int = 32,
    max_buffer_size: int = 1000
) -> ChunkBuffer:
    """获取 ChunkBuffer 单例"""
    global _chunk_buffer
    if _chunk_buffer is None:
        _chunk_buffer = ChunkBuffer(
            batch_size=batch_size,
            max_buffer_size=max_buffer_size
        )
    return _chunk_buffer


def get_text_chunker(
    chunk_size: int = 512,
    chunk_overlap: int = 50
) -> TextChunker:
    """获取 TextChunker 单例"""
    global _text_chunker
    if _text_chunker is None:
        _text_chunker = TextChunker(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap
        )
    return _text_chunker


def reset_chunk_buffer():
    """重置 ChunkBuffer 单例 (仅用于测试)"""
    global _chunk_buffer
    if _chunk_buffer:
        _chunk_buffer.clear()
    _chunk_buffer = None


def reset_text_chunker():
    """重置 TextChunker 单例 (仅用于测试)"""
    global _text_chunker
    _text_chunker = None
