"""
MemoryService - 向量记忆服务

实现 IMemoryService 接口，提供：
- 向量记忆的添加、搜索、删除
- 混合搜索（向量 + 关键词）
- 会话历史管理
- RRF 融合排序

依赖：
- EmbeddingServiceImpl: 向量嵌入
- VectorSearch: 向量存储与检索
- UnifiedMemoryEngine: 统一记忆引擎
"""

import asyncio
import json
import logging
import math
import re
import sqlite3
import uuid
import hashlib
import struct
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


DEFAULT_EMBEDDING_MODEL = "BAAI/bge-small-zh-v1.5"
DEFAULT_MIN_SCORE = 0.3


# ============================================================
# 数据类型定义 (与 memory_contracts.py 保持一致)
# ============================================================

@dataclass
class Message:
    """消息结构"""
    role: str  # "user" | "assistant" | "system"
    content: str
    timestamp: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class AddOptions:
    """添加记忆的选项"""
    namespace: str = "default"
    tags: Optional[List[str]] = None
    importance: float = 0.5  # 0.0-1.0
    ttl: Optional[int] = None  # 秒，None 表示永久


@dataclass
class SearchOptions:
    """搜索选项"""
    namespace: str = "default"
    limit: int = 10
    threshold: float = 0.7  # 相似度阈值
    include_metadata: bool = True
    time_range: Optional[tuple] = None  # (start_datetime, end_datetime)


@dataclass
class SearchResult:
    """搜索结果"""
    id: str
    content: str
    score: float  # 相似度分数
    metadata: Dict[str, Any]
    source: str  # 来源标识
    chunk_index: Optional[int] = None


def _pack_embedding(values: Optional[List[float]]) -> Optional[bytes]:
    if not values:
        return None
    return struct.pack(f"<{len(values)}f", *values)


def _unpack_embedding(blob: Optional[bytes]) -> List[float]:
    if not blob:
        return []
    count = len(blob) // 4
    if count <= 0:
        return []
    return list(struct.unpack(f"<{count}f", blob[: count * 4]))


@dataclass
class Memory:
    """记忆实体"""
    id: str
    content: str
    embedding: Optional[List[float]] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ============================================================
# MemoryService 实现
# ============================================================

class MemoryService:
    """
    向量记忆服务实现

    提供记忆的增删改查和向量搜索功能。
    支持混合搜索（向量 + 关键词 + RRF 融合）。

    Usage:
        service = MemoryService(db_path=".writing/memory.db")
        memory_id = await service.add(messages, AddOptions(namespace="writing"))
        results = await service.search("角色设定", SearchOptions(limit=5))
    """

    def __init__(
        self,
        db_path: Optional[str] = None,
        embedding_service: Optional[Any] = None,
        vector_search: Optional[Any] = None,
        config: Optional[Any] = None
    ):
        """
        初始化 MemoryService

        Args:
            db_path: 数据库路径，默认 .writing/memory_service.db
            embedding_service: 可选的 EmbeddingServiceImpl 实例
            vector_search: 可选的 VectorSearch 实例
            config: 可选的配置对象
        """
        # 配置
        self._config = config
        if db_path is None:
            if config:
                db_path = getattr(config.memory, 'vector_db_path', '.writing/memory_service.db')
            else:
                db_path = '.writing/memory_service.db'

        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        # 外部服务
        self._embedding_service = embedding_service
        self._vector_search = vector_search
        self._embedder = None  # 延迟初始化

        # 数据库连接
        self._db: Optional[sqlite3.Connection] = None
        self._init_db()

        logger.info(f"MemoryService initialized: {self.db_path}")

    def _get_db(self) -> sqlite3.Connection:
        """获取数据库连接"""
        if self._db is None:
            self._db = sqlite3.connect(str(self.db_path), check_same_thread=False)
            self._db.row_factory = sqlite3.Row
        return self._db

    def _init_db(self):
        """初始化数据库 Schema"""
        db = self._get_db()
        db.executescript("""
            -- 记忆存储表
            CREATE TABLE IF NOT EXISTS memories (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                embedding TEXT,  -- JSON 格式的向量
                namespace TEXT DEFAULT 'default',
                importance REAL DEFAULT 0.5,
                tags TEXT DEFAULT '[]',  -- JSON 格式
                ttl INTEGER,  -- 过期时间（秒）
                expires_at TEXT,  -- 过期时间点
                metadata TEXT DEFAULT '{}',  -- JSON 格式
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            -- 会话历史表
            CREATE TABLE IF NOT EXISTS session_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                metadata TEXT DEFAULT '{}'
            );

            -- 索引
            CREATE INDEX IF NOT EXISTS idx_memories_namespace ON memories(namespace);
            CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at);
            CREATE INDEX IF NOT EXISTS idx_memories_expires ON memories(expires_at);
            CREATE INDEX IF NOT EXISTS idx_session_history_session ON session_history(session_id);
            CREATE INDEX IF NOT EXISTS idx_session_history_timestamp ON session_history(timestamp);
        """)

        self._ensure_column("memories", "embedding_blob", "BLOB")
        self._ensure_column("memories", "embedding_model", "TEXT")
        self._ensure_column("memories", "embedding_dim", "INTEGER")
        self._ensure_column("memories", "content_hash", "TEXT")
        self._ensure_column("memories", "last_accessed_at", "TEXT")

        db.execute("""
            CREATE TABLE IF NOT EXISTS retrieval_profiles (
                profile_name TEXT PRIMARY KEY,
                source_weights_json TEXT NOT NULL,
                thresholds_json TEXT NOT NULL,
                budget_json TEXT NOT NULL,
                enabled INTEGER DEFAULT 1,
                updated_at TEXT NOT NULL
            )
        """)
        db.execute("""
            CREATE TABLE IF NOT EXISTS retrieval_cache (
                cache_key TEXT PRIMARY KEY,
                payload_json TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                hit_count INTEGER DEFAULT 0
            )
        """)
        db.execute("CREATE INDEX IF NOT EXISTS idx_retrieval_cache_expires ON retrieval_cache(expires_at)")
        db.commit()

    def _ensure_column(self, table_name: str, column_name: str, column_type: str) -> None:
        db = self._get_db()
        cursor = db.execute(f"PRAGMA table_info({table_name})")
        columns = {row[1] for row in cursor.fetchall()}
        if column_name in columns:
            return
        db.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}")

    @property
    def embedder(self):
        """延迟初始化嵌入引擎"""
        if self._embedder is None:
            if self._embedding_service:
                self._embedder = self._embedding_service
            else:
                # 使用 UnifiedMemory 的 EmbeddingEngine
                try:
                    from src.memory.unified_memory import EmbeddingEngine
                    self._embedder = EmbeddingEngine()
                except ImportError:
                    # 回退到简单实现
                    self._embedder = SimpleEmbedder()
        return self._embedder

    async def _embed_text(self, text: str) -> List[float]:
        """生成文本嵌入"""
        if hasattr(self.embedder, 'embed'):
            # EmbeddingServiceImpl 或 EmbeddingEngine
            if asyncio.iscoroutinefunction(self.embedder.embed):
                return await self.embedder.embed(text)
            else:
                return self.embedder.embed(text)
        elif hasattr(self.embedder, 'embed_batch'):
            # EmbeddingServiceImpl
            embeddings = await self.embedder.embed_batch([text])
            return embeddings[0]
        else:
            raise RuntimeError("No valid embedding method found")

    def _compute_similarity(self, vec_a: List[float], vec_b: List[float]) -> float:
        """计算余弦相似度"""
        if not vec_a or not vec_b or len(vec_a) != len(vec_b):
            return 0.0

        norm_a_sq = sum(a * a for a in vec_a)
        norm_b_sq = sum(b * b for b in vec_b)
        if norm_a_sq == 0 or norm_b_sq == 0:
            return 0.0

        dot_product = sum(a * b for a, b in zip(vec_a, vec_b))
        return dot_product / ((norm_a_sq ** 0.5) * (norm_b_sq ** 0.5))

    def _compute_similarity_with_norms(
        self,
        vec_a: List[float],
        vec_b: List[float],
        norm_a: Optional[float] = None,
        norm_b: Optional[float] = None,
    ) -> float:
        """计算余弦相似度（支持复用预计算范数）"""
        if not vec_a or not vec_b or len(vec_a) != len(vec_b):
            return 0.0

        effective_norm_a = norm_a if norm_a is not None else math.sqrt(sum(a * a for a in vec_a))
        effective_norm_b = norm_b if norm_b is not None else math.sqrt(sum(b * b for b in vec_b))
        if effective_norm_a == 0 or effective_norm_b == 0:
            return 0.0

        dot_product = sum(a * b for a, b in zip(vec_a, vec_b))
        return dot_product / (effective_norm_a * effective_norm_b)

    @staticmethod
    def _clamp_01(value: float) -> float:
        return max(0.0, min(1.0, value))

    @staticmethod
    def _parse_datetime(raw: Any) -> Optional[datetime]:
        if not isinstance(raw, str) or not raw:
            return None
        try:
            return datetime.fromisoformat(raw)
        except ValueError:
            return None

    @staticmethod
    def _safe_float(raw: Any, default: float = 0.0) -> float:
        try:
            return float(raw)
        except (TypeError, ValueError):
            return default

    def _compute_observability_metrics(
        self,
        fused_results: List[SearchResult],
        limit: int,
    ) -> Dict[str, float]:
        """计算检索可观测指标（C_effective / S_final / R_memory）"""
        if not fused_results:
            return {
                "c_effective": 0.0,
                "s_final": 0.0,
                "r_memory": 0.0,
            }

        effective_count = len(fused_results)
        safe_limit = max(limit, 1)
        c_effective = self._clamp_01(effective_count / safe_limit)

        max_score = max(result.score for result in fused_results)
        if max_score <= 0:
            s_final = 0.0
        else:
            normalized_scores = [self._clamp_01(result.score / max_score) for result in fused_results]
            s_final = self._clamp_01(sum(normalized_scores) / len(normalized_scores))

        now = datetime.now()
        decay_reinforcement_scores: List[float] = []
        for result in fused_results:
            metadata = result.metadata if isinstance(result.metadata, dict) else {}

            created_at = self._parse_datetime(metadata.get("created_at"))
            last_accessed = self._parse_datetime(metadata.get("last_accessed"))
            expires_at = self._parse_datetime(metadata.get("expires_at"))

            importance = self._clamp_01(self._safe_float(metadata.get("importance"), 0.5))
            access_count = max(0.0, self._safe_float(metadata.get("access_count"), 0.0))

            freshness = 0.5
            if created_at:
                age_days = max((now - created_at).total_seconds(), 0.0) / 86400
                freshness = math.exp(-age_days / 30.0)

            access_reinforcement = self._clamp_01(math.log1p(access_count) / math.log1p(20.0))

            access_recency = 0.0
            if last_accessed:
                access_age_days = max((now - last_accessed).total_seconds(), 0.0) / 86400
                access_recency = math.exp(-access_age_days / 14.0)

            expiry_factor = 1.0
            if expires_at and expires_at <= now:
                expiry_factor = 0.0

            combined = (
                0.35 * self._clamp_01(freshness)
                + 0.25 * access_reinforcement
                + 0.20 * self._clamp_01(access_recency)
                + 0.20 * importance
            ) * expiry_factor

            decay_reinforcement_scores.append(self._clamp_01(combined))

        r_memory = self._clamp_01(sum(decay_reinforcement_scores) / len(decay_reinforcement_scores))

        return {
            "c_effective": round(c_effective, 4),
            "s_final": round(s_final, 4),
            "r_memory": round(r_memory, 4),
        }

    # ============================================================
    # IMemoryService 接口实现
    # ============================================================

    async def add(self, messages: List[Message], options: AddOptions) -> str:
        """
        添加消息到记忆存储

        Args:
            messages: 消息列表
            options: 添加选项

        Returns:
            记忆 ID
        """
        # 合并消息内容
        content_parts = []
        for msg in messages:
            role_prefix = f"[{msg.role}]" if msg.role else ""
            content_parts.append(f"{role_prefix} {msg.content}")
        content = "\n".join(content_parts)

        # 生成嵌入
        embedding = await self._embed_text(content)

        # 生成 ID
        memory_id = str(uuid.uuid4())

        # 计算过期时间
        now = datetime.now()
        expires_at = None
        if options.ttl:
            from datetime import timedelta
            expires_at = (now + timedelta(seconds=options.ttl)).isoformat()

        # 构建元数据
        metadata = {
            "message_count": len(messages),
            "roles": list(set(msg.role for msg in messages)),
            "first_timestamp": messages[0].timestamp.isoformat() if messages and messages[0].timestamp else None,
            "last_timestamp": messages[-1].timestamp.isoformat() if messages and messages[-1].timestamp else None,
        }

        # 合并用户提供的元数据
        for msg in messages:
            if msg.metadata:
                metadata.update(msg.metadata)

        # 存储
        db = self._get_db()
        db.execute("""
            INSERT INTO memories (
                id, content, embedding, namespace, importance, tags,
                ttl, expires_at, metadata, created_at, updated_at,
                embedding_blob, embedding_model, embedding_dim, content_hash, last_accessed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            memory_id,
            content,
            json.dumps(embedding),
            options.namespace,
            options.importance,
            json.dumps(options.tags or []),
            options.ttl,
            expires_at,
            json.dumps(metadata),
            now.isoformat(),
            now.isoformat(),
            _pack_embedding(embedding),
            DEFAULT_EMBEDDING_MODEL,
            len(embedding),
            hashlib.sha256(content.encode("utf-8")).hexdigest(),
            now.isoformat(),
        ))
        db.commit()

        logger.info(f"Memory added: {memory_id[:8]}... namespace={options.namespace}")
        return memory_id

    async def search(self, query: str, options: SearchOptions) -> List[SearchResult]:
        """
        向量搜索

        Args:
            query: 查询文本
            options: 搜索选项

        Returns:
            搜索结果列表，按相似度降序
        """
        # 生成查询嵌入
        query_embedding = await self._embed_text(query)

        # 清理过期记忆
        self._cleanup_expired()

        # 构建 SQL 查询
        sql = """
            SELECT id, content, embedding, embedding_blob, namespace, importance, tags, metadata, created_at, expires_at, last_accessed_at
            FROM memories
            WHERE namespace = ?
            AND (expires_at IS NULL OR expires_at > ?)
        """
        params: List[Any] = [options.namespace, datetime.now().isoformat()]

        # 时间范围过滤
        if options.time_range:
            start_time, end_time = options.time_range
            sql += " AND created_at >= ? AND created_at <= ?"
            params.extend([
                start_time.isoformat() if hasattr(start_time, 'isoformat') else start_time,
                end_time.isoformat() if hasattr(end_time, 'isoformat') else end_time
            ])

        db = self._get_db()
        cursor = db.execute(sql, params)
        rows = cursor.fetchall()

        # 计算相似度并过滤
        results = []
        threshold = options.threshold if options.threshold is not None else DEFAULT_MIN_SCORE
        now_iso = datetime.now().isoformat()
        query_norm = math.sqrt(sum(value * value for value in query_embedding)) if query_embedding else 0.0
        for row in rows:
            embedding = []
            if row["embedding_blob"]:
                embedding = _unpack_embedding(row["embedding_blob"])
            elif row["embedding"]:
                embedding = json.loads(row["embedding"])

            embedding_norm = math.sqrt(sum(value * value for value in embedding)) if embedding else 0.0
            score = self._compute_similarity_with_norms(
                query_embedding,
                embedding,
                norm_a=query_norm,
                norm_b=embedding_norm,
            )

            if score >= threshold:
                metadata = json.loads(row['metadata']) if row['metadata'] else {}
                metadata.setdefault('created_at', row['created_at'])
                metadata.setdefault('expires_at', row['expires_at'])
                metadata.setdefault('last_accessed_at', row['last_accessed_at'])
                if options.include_metadata:
                    metadata['importance'] = row['importance']
                    metadata['tags'] = json.loads(row['tags']) if row['tags'] else []

                db.execute(
                    "UPDATE memories SET last_accessed_at = ?, updated_at = ? WHERE id = ?",
                    (now_iso, now_iso, row['id']),
                )

                results.append(SearchResult(
                    id=row['id'],
                    content=row['content'],
                    score=round(score, 4),
                    metadata=metadata,
                    source=f"memory:{options.namespace}",
                    chunk_index=None
                ))

        db.commit()
        # 按分数降序排序
        results.sort(key=lambda x: x.score, reverse=True)

        return results[:options.limit]

    async def hybrid_search(self, query: str, options: Optional[SearchOptions] = None) -> List[SearchResult]:
        """
        混合搜索（向量 + 关键词）

        使用 RRF (Reciprocal Rank Fusion) 融合多路召回结果。

        Args:
            query: 查询文本

        Returns:
            融合后的搜索结果
        """
        if options is None:
            options = SearchOptions()

        # 1. 向量搜索
        vector_results = await self.search(query, SearchOptions(
            namespace=options.namespace,
            limit=options.limit * 2,  # 多召回一些用于融合
            threshold=options.threshold * 0.8,  # 降低阈值
            include_metadata=options.include_metadata
        ))

        # 2. 关键词搜索
        keyword_results = await self._keyword_search(query, options)

        # 3. RRF 融合
        fused_results = self._rrf_fusion(
            [vector_results, keyword_results],
            k=60  # RRF 常数
        )

        limited_results = fused_results[:options.limit]
        metrics = self._compute_observability_metrics(
            fused_results=limited_results,
            limit=options.limit,
        )
        for result in limited_results:
            result.metadata = {
                **result.metadata,
                "c_effective": metrics["c_effective"],
                "s_final": metrics["s_final"],
                "r_memory": metrics["r_memory"],
            }

        return limited_results

    async def _keyword_search(self, query: str, options: SearchOptions) -> List[SearchResult]:
        """关键词搜索"""
        keywords = self._extract_keywords(query)
        if not keywords:
            return []

        conditions = []
        params: List[Any] = [options.namespace, datetime.now().isoformat()]

        for kw in keywords:
            conditions.append("content LIKE ?")
            params.append(f"%{kw}%")

        sql = f"""
            SELECT id, content, embedding, embedding_blob, namespace, importance, tags, metadata, created_at, expires_at, last_accessed_at
            FROM memories
            WHERE namespace = ?
            AND (expires_at IS NULL OR expires_at > ?)
            AND ({' OR '.join(conditions)})
        """

        db = self._get_db()
        cursor = db.execute(sql, params)
        rows = cursor.fetchall()

        results = []
        now_iso = datetime.now().isoformat()
        for row in rows:
            content_lower = row['content'].lower()
            match_count = sum(1 for kw in keywords if kw.lower() in content_lower)
            score = match_count / len(keywords)

            if score > 0:
                metadata = json.loads(row['metadata']) if row['metadata'] else {}
                metadata.setdefault('created_at', row['created_at'])
                metadata.setdefault('expires_at', row['expires_at'])
                metadata.setdefault('last_accessed_at', row['last_accessed_at'])
                if options.include_metadata:
                    metadata['importance'] = row['importance']
                    metadata['tags'] = json.loads(row['tags']) if row['tags'] else []
                    metadata['keyword_matches'] = match_count

                db.execute(
                    "UPDATE memories SET last_accessed_at = ?, updated_at = ? WHERE id = ?",
                    (now_iso, now_iso, row['id']),
                )

                results.append(SearchResult(
                    id=row['id'],
                    content=row['content'],
                    score=round(score, 4),
                    metadata=metadata,
                    source=f"keyword:{options.namespace}",
                    chunk_index=None
                ))

        db.commit()
        results.sort(key=lambda x: x.score, reverse=True)
        return results[:options.limit * 2]

    def _extract_keywords(self, text: str) -> List[str]:
        """提取关键词（简单分词）"""
        # 移除标点符号
        text = re.sub(r'[^\w\s]', ' ', text)
        # 分词
        words = text.split()
        # 过滤停用词和短词
        stopwords = {'的', '了', '是', '在', '和', '有', '这', '个', '为', '与',
                     'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
                     'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'but'}
        keywords = [w for w in words if len(w) >= 2 and w.lower() not in stopwords]
        return keywords[:10]  # 限制关键词数量

    def _rrf_fusion(
        self,
        result_lists: List[List[SearchResult]],
        k: int = 60
    ) -> List[SearchResult]:
        """
        RRF (Reciprocal Rank Fusion) 融合

        Args:
            result_lists: 多个搜索结果列表
            k: RRF 常数（默认 60）

        Returns:
            融合后的结果列表
        """
        scores: Dict[str, float] = {}
        result_map: Dict[str, SearchResult] = {}

        for results in result_lists:
            for rank, result in enumerate(results):
                # RRF 公式: 1 / (k + rank)
                rrf_score = 1.0 / (k + rank + 1)

                if result.id in scores:
                    scores[result.id] += rrf_score
                else:
                    scores[result.id] = rrf_score
                    result_map[result.id] = result

        # 按融合分数排序
        sorted_ids = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)

        fused_results = []
        for id_ in sorted_ids:
            result = result_map[id_]
            # 更新分数为融合分数
            fused_results.append(SearchResult(
                id=result.id,
                content=result.content,
                score=round(scores[id_], 4),
                metadata={**result.metadata, 'original_score': result.score, 'fusion': 'rrf'},
                source=result.source,
                chunk_index=result.chunk_index
            ))

        return fused_results

    def get_retrieval_profile(self, profile_name: str) -> Optional[Dict[str, Any]]:
        db = self._get_db()
        cursor = db.execute(
            """
            SELECT profile_name, source_weights_json, thresholds_json, budget_json, enabled, updated_at
            FROM retrieval_profiles
            WHERE profile_name = ?
            """,
            (profile_name,),
        )
        row = cursor.fetchone()
        if not row:
            return None
        return {
            "profile_name": row["profile_name"],
            "source_weights_json": json.loads(row["source_weights_json"]) if row["source_weights_json"] else {},
            "thresholds_json": json.loads(row["thresholds_json"]) if row["thresholds_json"] else {},
            "budget_json": json.loads(row["budget_json"]) if row["budget_json"] else {},
            "enabled": bool(row["enabled"]),
            "updated_at": row["updated_at"],
        }

    def upsert_retrieval_profile(
        self,
        profile_name: str,
        source_weights: Dict[str, Any],
        thresholds: Dict[str, Any],
        budget: Dict[str, Any],
        enabled: bool = True,
    ) -> None:
        db = self._get_db()
        now = datetime.now().isoformat()
        db.execute(
            """
            INSERT INTO retrieval_profiles(profile_name, source_weights_json, thresholds_json, budget_json, enabled, updated_at)
            VALUES(?, ?, ?, ?, ?, ?)
            ON CONFLICT(profile_name) DO UPDATE SET
                source_weights_json=excluded.source_weights_json,
                thresholds_json=excluded.thresholds_json,
                budget_json=excluded.budget_json,
                enabled=excluded.enabled,
                updated_at=excluded.updated_at
            """,
            (
                profile_name,
                json.dumps(source_weights or {}),
                json.dumps(thresholds or {}),
                json.dumps(budget or {}),
                1 if enabled else 0,
                now,
            ),
        )
        db.commit()

    def cache_pack(self, cache_key: str, payload: Dict[str, Any], ttl_seconds: int = 300, status: str = "ready") -> None:
        db = self._get_db()
        now = datetime.now()
        expires_at = datetime.fromtimestamp(now.timestamp() + max(ttl_seconds, 1)).isoformat()
        db.execute(
            """
            INSERT INTO retrieval_cache(cache_key, payload_json, status, created_at, expires_at, hit_count)
            VALUES(?, ?, ?, ?, ?, 0)
            ON CONFLICT(cache_key) DO UPDATE SET
                payload_json=excluded.payload_json,
                status=excluded.status,
                created_at=excluded.created_at,
                expires_at=excluded.expires_at
            """,
            (cache_key, json.dumps(payload), status, now.isoformat(), expires_at),
        )
        db.commit()

    def cache_read(self, cache_key: str) -> Optional[Dict[str, Any]]:
        db = self._get_db()
        cursor = db.execute(
            "SELECT payload_json, status, expires_at, hit_count FROM retrieval_cache WHERE cache_key = ?",
            (cache_key,),
        )
        row = cursor.fetchone()
        if not row:
            return None

        if row["expires_at"] and row["expires_at"] <= datetime.now().isoformat():
            self.cache_release(cache_key)
            return None

        db.execute("UPDATE retrieval_cache SET hit_count = hit_count + 1 WHERE cache_key = ?", (cache_key,))
        db.commit()
        return {
            "payload": json.loads(row["payload_json"]) if row["payload_json"] else {},
            "status": row["status"],
            "expires_at": row["expires_at"],
            "hit_count": int(row["hit_count"]) + 1,
        }

    def cache_status(self, cache_key: str) -> Optional[str]:
        db = self._get_db()
        cursor = db.execute("SELECT status FROM retrieval_cache WHERE cache_key = ?", (cache_key,))
        row = cursor.fetchone()
        return row["status"] if row else None

    def cache_release(self, cache_key: str) -> None:
        db = self._get_db()
        db.execute("DELETE FROM retrieval_cache WHERE cache_key = ?", (cache_key,))
        db.commit()

    def cache_cleanup(self) -> int:
        db = self._get_db()
        cursor = db.execute("DELETE FROM retrieval_cache WHERE expires_at <= ?", (datetime.now().isoformat(),))
        db.commit()
        return int(cursor.rowcount)

    async def add_history(self, session_id: str, messages: List[Message]) -> None:
        """
        添加会话历史

        Args:
            session_id: 会话 ID
            messages: 消息列表
        """
        db = self._get_db()
        now = datetime.now().isoformat()

        for msg in messages:
            timestamp = msg.timestamp.isoformat() if msg.timestamp else now
            metadata = json.dumps(msg.metadata or {})

            db.execute("""
                INSERT INTO session_history (session_id, role, content, timestamp, metadata)
                VALUES (?, ?, ?, ?, ?)
            """, (session_id, msg.role, msg.content, timestamp, metadata))

        db.commit()
        logger.info(f"Added {len(messages)} messages to session {session_id[:8]}...")

    async def get_history(
        self,
        session_id: str,
        limit: int = 50,
        before: Optional[datetime] = None
    ) -> List[Message]:
        """
        获取会话历史

        Args:
            session_id: 会话 ID
            limit: 返回数量限制
            before: 只返回此时间之前的消息

        Returns:
            消息列表
        """
        sql = "SELECT role, content, timestamp, metadata FROM session_history WHERE session_id = ?"
        params: List[Any] = [session_id]

        if before:
            sql += " AND timestamp < ?"
            params.append(before.isoformat())

        sql += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)

        db = self._get_db()
        cursor = db.execute(sql, params)
        rows = cursor.fetchall()

        messages = []
        for row in reversed(rows):  # 恢复时间顺序
            messages.append(Message(
                role=row['role'],
                content=row['content'],
                timestamp=datetime.fromisoformat(row['timestamp']) if row['timestamp'] else None,
                metadata=json.loads(row['metadata']) if row['metadata'] else None
            ))

        return messages

    async def get(self, memory_id: str) -> Optional[Memory]:
        """
        获取单条记忆

        Args:
            memory_id: 记忆 ID

        Returns:
            记忆实体，不存在返回 None
        """
        db = self._get_db()
        cursor = db.execute("""
            SELECT id, content, embedding, embedding_blob, metadata, created_at, updated_at
            FROM memories
            WHERE id = ?
        """, (memory_id,))

        row = cursor.fetchone()
        if not row:
            return None

        embedding = []
        if row['embedding_blob']:
            embedding = _unpack_embedding(row['embedding_blob'])
        elif row['embedding']:
            embedding = json.loads(row['embedding'])

        return Memory(
            id=row['id'],
            content=row['content'],
            embedding=embedding or None,
            metadata=json.loads(row['metadata']) if row['metadata'] else None,
            created_at=datetime.fromisoformat(row['created_at']) if row['created_at'] else None,
            updated_at=datetime.fromisoformat(row['updated_at']) if row['updated_at'] else None
        )

    async def delete(self, memory_id: str) -> bool:
        """
        删除记忆

        Args:
            memory_id: 记忆 ID

        Returns:
            是否删除成功
        """
        db = self._get_db()
        cursor = db.execute("DELETE FROM memories WHERE id = ?", (memory_id,))
        db.commit()

        deleted = cursor.rowcount > 0
        if deleted:
            logger.info(f"Memory deleted: {memory_id[:8]}...")
        return deleted

    async def update(
        self,
        memory_id: str,
        content: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        importance: Optional[float] = None,
        tags: Optional[List[str]] = None
    ) -> bool:
        """
        更新记忆

        Args:
            memory_id: 记忆 ID
            content: 新内容（可选）
            metadata: 新元数据（可选）
            importance: 新重要性（可选）
            tags: 新标签（可选）

        Returns:
            是否更新成功
        """
        updates = []
        params = []

        if content is not None:
            updates.append("content = ?")
            params.append(content)
            # 重新生成嵌入
            embedding = await self._embed_text(content)
            updates.append("embedding = ?")
            params.append(json.dumps(embedding))
            updates.append("embedding_blob = ?")
            params.append(_pack_embedding(embedding))
            updates.append("embedding_model = ?")
            params.append(DEFAULT_EMBEDDING_MODEL)
            updates.append("embedding_dim = ?")
            params.append(len(embedding))
            updates.append("content_hash = ?")
            params.append(hashlib.sha256(content.encode("utf-8")).hexdigest())

        if metadata is not None:
            updates.append("metadata = ?")
            params.append(json.dumps(metadata))

        if importance is not None:
            updates.append("importance = ?")
            params.append(importance)

        if tags is not None:
            updates.append("tags = ?")
            params.append(json.dumps(tags))

        if not updates:
            return False

        updates.append("updated_at = ?")
        params.append(datetime.now().isoformat())
        params.append(memory_id)

        db = self._get_db()
        cursor = db.execute(
            f"UPDATE memories SET {', '.join(updates)} WHERE id = ?",
            params
        )
        db.commit()

        return cursor.rowcount > 0

    def _cleanup_expired(self):
        """清理过期记忆"""
        db = self._get_db()
        now = datetime.now().isoformat()
        cursor = db.execute(
            "DELETE FROM memories WHERE expires_at IS NOT NULL AND expires_at < ?",
            (now,)
        )
        db.commit()
        if cursor.rowcount > 0:
            logger.debug(f"Cleaned up {cursor.rowcount} expired memories")

    async def list_namespaces(self) -> List[str]:
        """列出所有命名空间"""
        db = self._get_db()
        cursor = db.execute("SELECT DISTINCT namespace FROM memories")
        return [row['namespace'] for row in cursor.fetchall()]

    async def count(self, namespace: Optional[str] = None) -> int:
        """统计记忆数量"""
        db = self._get_db()
        if namespace:
            cursor = db.execute(
                "SELECT COUNT(*) FROM memories WHERE namespace = ?",
                (namespace,)
            )
        else:
            cursor = db.execute("SELECT COUNT(*) FROM memories")
        return cursor.fetchone()[0]

    def close(self):
        """关闭服务"""
        if self._db:
            self._db.close()
            self._db = None
        logger.info("MemoryService closed")


class SimpleEmbedder:
    """简单嵌入器（回退实现）"""

    def __init__(self, dim: int = 384):
        self.dim = dim

    def embed(self, text: str) -> List[float]:
        """生成简单哈希嵌入"""
        import hashlib
        hash_bytes = hashlib.sha256(text.encode()).digest()
        # 扩展到目标维度
        embedding = []
        for i in range(self.dim):
            byte_idx = i % len(hash_bytes)
            embedding.append((hash_bytes[byte_idx] - 128) / 128.0)
        return embedding

    def similarity(self, vec_a: List[float], vec_b: List[float]) -> float:
        """计算余弦相似度"""
        if not vec_a or not vec_b:
            return 0.0
        dot_product = sum(a * b for a, b in zip(vec_a, vec_b))
        norm_a = sum(a * a for a in vec_a) ** 0.5
        norm_b = sum(b * b for b in vec_b) ** 0.5
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot_product / (norm_a * norm_b)


# ============================================================
# 工厂函数
# ============================================================

_memory_service: Optional[MemoryService] = None
_memory_engine_provider: Optional[Callable[[], Any]] = None


def configure_memory_engine_provider(provider: Optional[Callable[[], Any]]) -> None:
    """配置统一记忆引擎提供者（用于边界收敛和测试注入）"""
    global _memory_engine_provider
    _memory_engine_provider = provider


def _resolve_memory_engine() -> Optional[Any]:
    """解析统一记忆引擎实例，失败时返回 None"""
    if _memory_engine_provider is not None:
        try:
            return _memory_engine_provider()
        except Exception as exc:
            logger.warning("Memory engine provider resolution failed: %s", exc)
            return None

    try:
        from src.memory.unified_memory import UnifiedMemoryEngine

        db_path = str(Path.home() / ".niko" / "memory.db")
        engine = UnifiedMemoryEngine(db_path=db_path)
        return engine
    except Exception as exc:
        logger.warning("UnifiedMemoryEngine unavailable, fallback to MemoryService-only mode: %s", exc)
        return None


def get_memory_service(
    db_path: Optional[str] = None,
    config: Optional[Any] = None
) -> MemoryService:
    """
    获取 MemoryService 单例

    Args:
        db_path: 数据库路径
        config: 配置对象

    Returns:
        MemoryService 实例
    """
    global _memory_service
    if _memory_service is None:
        memory_engine = _resolve_memory_engine()
        _memory_service = MemoryService(
            db_path=db_path,
            config=config,
            embedding_service=getattr(memory_engine, "embedder", None),
        )
    return _memory_service


def reset_memory_service():
    """重置 MemoryService 单例（仅用于测试）"""
    global _memory_service, _memory_engine_provider
    if _memory_service:
        _memory_service.close()
    _memory_service = None
    _memory_engine_provider = None
