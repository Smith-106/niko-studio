"""
统一记忆引擎 - 合并 Mem0 四层 + LobeHub 六维 + Zep 时序

核心特性:
1. 四层记忆 (垂直维度 - 生命周期)
2. 六维记忆 (水平维度 - 内容类型)
3. 时序追踪 (Zep Graphiti 模式)
4. 冲突检测与解决
5. 作用域隔离
6. 查询嵌入缓存 (优化性能)
"""

import uuid
import sqlite3
import json
import logging
import hashlib
import struct
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple, Iterable, Protocol
from enum import Enum
from pathlib import Path

from src.config import get_config_value

from .query_cache import get_query_cache

logger = logging.getLogger("niko-memory")


DEFAULT_EMBEDDING_MODEL = str(get_config_value("memory.embedding_model", "BAAI/bge-small-zh-v1.5"))
DEFAULT_MIN_SCORE = float(get_config_value("memory.min_score", 0.3))


class MemoryLayer(Enum):
    """四层记忆 (垂直维度 - 生命周期)"""
    EPHEMERAL = "ephemeral"   # 临时 (< 1小时)
    SESSION = "session"       # 会话 (当前任务)
    USER = "user"             # 用户 (长期偏好)
    PROJECT = "project"       # 项目 (小说级别)


class MemoryDimension(Enum):
    """六维记忆 (水平维度 - 内容类型)"""
    TIMELINE = "timeline"       # 事件时间线
    CONTEXT = "context"         # 故事上下文
    CHARACTER = "character"     # 角色身份
    WORLDVIEW = "worldview"     # 世界设定
    PREFERENCE = "preference"   # 创作偏好
    EXPERIENCE = "experience"   # 写作经验


@dataclass
class UnifiedMemory:
    """统一记忆结构"""
    id: str
    content: str

    # 垂直维度: 生命周期
    layer: str = "session"

    # 水平维度: 内容类型
    dimension: Optional[str] = None

    # 时序追踪 (Zep Graphiti)
    entity_id: Optional[str] = None
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None
    supersedes: Optional[str] = None
    superseded_by: Optional[str] = None

    # 作用域隔离
    user_id: Optional[str] = None
    project_id: Optional[str] = None
    session_id: Optional[str] = None

    # 元数据
    embedding: List[float] = field(default_factory=list)
    embedding_blob: Optional[bytes] = None
    embedding_model: Optional[str] = None
    embedding_dim: Optional[int] = None
    content_hash: Optional[str] = None
    last_accessed_at: Optional[str] = None
    importance: float = 0.5
    confidence: float = 1.0
    source: str = "user"
    tags: List[str] = field(default_factory=list)
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> dict:
        """转换为字典"""
        data = asdict(self)
        raw_embedding = data.get("embedding") or []
        if not data.get("embedding_blob") and raw_embedding:
            data["embedding_blob"] = _pack_embedding(raw_embedding)
        data["tags"] = json.dumps(data["tags"])
        data["embedding"] = json.dumps(raw_embedding)
        return data

    @classmethod
    def from_dict(cls, data: dict) -> "UnifiedMemory":
        """从字典创建"""
        if isinstance(data.get("tags"), str):
            data["tags"] = json.loads(data["tags"])
        if isinstance(data.get("embedding"), str):
            data["embedding"] = json.loads(data["embedding"])
        if not data.get("embedding") and data.get("embedding_blob"):
            data["embedding"] = _unpack_embedding(data["embedding_blob"])
        return cls(**data)


def _pack_embedding(values: List[float]) -> bytes:
    if not values:
        return b""
    return struct.pack(f"<{len(values)}f", *values)


def _unpack_embedding(blob: bytes) -> List[float]:
    if not blob:
        return []
    count = len(blob) // 4
    if count <= 0:
        return []
    return list(struct.unpack(f"<{count}f", blob[: count * 4]))


class ConflictResolver:
    """冲突检测与解决"""
    
    def __init__(self, db_connection):
        self.db = db_connection
    
    async def check(self, content: str, entity_id: str = None) -> List[Dict]:
        """检测潜在冲突"""
        if not entity_id:
            return []
        
        cursor = self.db.execute("""
            SELECT id, content, valid_from, valid_until
            FROM memories
            WHERE entity_id = ?
            AND superseded_by IS NULL
            AND (valid_until IS NULL OR valid_until > datetime('now'))
        """, (entity_id,))
        
        conflicts = []
        rows = cursor.fetchall()
        for row in rows:
            # 简单的语义冲突检测 (实际应用中使用嵌入向量)
            if self._is_contradictory(content, row[1]):
                conflicts.append({
                    "id": row[0],
                    "content": row[1],
                    "valid_from": row[2],
                    "valid_until": row[3]
                })
        
        return conflicts
    
    def _is_contradictory(self, content_a: str, content_b: str) -> bool:
        """检测两条内容是否矛盾 (简化版)"""
        # 否定词检测
        negation_pairs = [
            ("是", "不是"), ("有", "没有"), ("能", "不能"),
            ("会", "不会"), ("alive", "dead"), ("true", "false")
        ]
        
        for pos, neg in negation_pairs:
            if (pos in content_a and neg in content_b) or \
               (neg in content_a and pos in content_b):
                return True
        
        return False
    
    async def resolve(
        self, 
        content: str, 
        conflicts: List[Dict],
        strategy: str = "auto"
    ) -> Dict:
        """解决冲突"""
        if strategy == "auto":
            # 自动策略: 新内容覆盖旧内容 (时序优先)
            return {
                "action": "update",
                "obsolete_ids": [c["id"] for c in conflicts],
                "reason": "Newer information supersedes older"
            }
        elif strategy == "keep_old":
            return {
                "action": "reject",
                "reason": "Keeping existing information"
            }
        elif strategy == "merge":
            merged = f"{conflicts[0]['content']}; 更新: {content}"
            return {
                "action": "merge",
                "merged_content": merged,
                "obsolete_ids": [c["id"] for c in conflicts]
            }
        else:
            return {"action": "update", "obsolete_ids": []}


class EmbeddingEngine:
    """嵌入向量引擎 (使用 FastEmbed + 查询缓存)"""

    def __init__(self, model_name: Optional[str] = None):
        self._model = None
        self._model_name = model_name or DEFAULT_EMBEDDING_MODEL
        self._cache = get_query_cache(max_size=1000, ttl_seconds=3600)

    @property
    def model(self):
        if self._model is None:
            try:
                from fastembed import TextEmbedding

                self._model = TextEmbedding(model_name=self._model_name)
            except ImportError:
                logger.warning("FastEmbed not installed, using dummy embeddings")
                self._model = "dummy"
            except Exception as exc:
                logger.warning(
                    "FastEmbed model '%s' unavailable (%s), using dummy embeddings",
                    self._model_name,
                    exc,
                )
                self._model = "dummy"
        return self._model

    def embed(self, text: str, use_cache: bool = False) -> List[float]:
        """
        生成嵌入向量

        Args:
            text: 文本内容
            use_cache: 是否使用缓存 (仅用于查询,不用于存储)
        """
        if use_cache:
            cached = self._cache.get(text)
            if cached is not None:
                return cached

        if self.model == "dummy":
            # 返回固定长度的随机向量作为占位
            import hashlib
            hash_val = hashlib.md5(text.encode()).hexdigest()
            embedding = [int(hash_val[i:i+2], 16) / 255.0 for i in range(0, 32, 2)][:384]
        else:
            embeddings = list(self.model.embed([text]))
            embedding = embeddings[0].tolist()

        if use_cache:
            self._cache.put(text, embedding)

        return embedding

    def embed_cached(self, text: str) -> List[float]:
        """生成嵌入向量 (带缓存,用于查询)"""
        return self.embed(text, use_cache=True)

    @property
    def cache_stats(self) -> dict:
        """获取缓存统计信息"""
        return self._cache.stats
    
    def similarity(self, vec_a: List[float], vec_b: List[float]) -> float:
        """计算余弦相似度"""
        if not vec_a or not vec_b:
            return 0.0
        if len(vec_a) != len(vec_b):
            return 0.0

        dot_product = sum(a * b for a, b in zip(vec_a, vec_b))
        norm_a = sum(a * a for a in vec_a) ** 0.5
        norm_b = sum(b * b for b in vec_b) ** 0.5

        if norm_a == 0 or norm_b == 0:
            return 0.0

        return dot_product / (norm_a * norm_b)


class EnginePlugin(Protocol):
    """主系统引擎插件协议"""

    name: str

    async def load(self, engine: "UnifiedMemoryEngine") -> None:
        """加载插件"""

    async def health_check(self) -> Dict[str, Any]:
        """插件健康检查"""

    async def on_memory_added(self, memory: "UnifiedMemory") -> None:
        """记忆新增回调"""


class UnifiedMemoryEngine:
    """统一记忆引擎 (主系统)"""

    _CONTRADICTION_HINTS = ("不是", "没有", "不能", "不会", "dead", "false")

    def __init__(self, db_path: str = None, plugins: Optional[Iterable[EnginePlugin]] = None):
        self.is_primary_engine = True
        self.plugins: List[EnginePlugin] = []
        self._plugin_health: Dict[str, Dict[str, Any]] = {}
        if db_path is None:
            db_path = get_config_value("memory.db_path", None)
        if db_path is None:
            data_dir = get_config_value("data_dir", None)
            if data_dir:
                db_path = Path(data_dir) / "memory.db"
        if db_path is None:
            db_path = Path.home() / ".niko" / "memory.db"

        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        self.db = sqlite3.connect(str(self.db_path), check_same_thread=False)
        self.embedder = EmbeddingEngine()
        self.conflict_resolver = ConflictResolver(self.db)

        self._init_schema()
        logger.info(f"Memory engine initialized: {self.db_path}")

        if plugins:
            self._register_plugins(plugins)

    def _register_plugins(self, plugins: Iterable[EnginePlugin]) -> None:
        for plugin in plugins:
            if plugin in self.plugins:
                continue
            self.plugins.append(plugin)

    async def initialize(self) -> None:
        for plugin in self.plugins:
            try:
                await plugin.load(self)
            except Exception as exc:
                logger.error(f"Memory plugin load failed: {getattr(plugin, 'name', 'unknown')}: {exc}")
                self._plugin_health[getattr(plugin, "name", "unknown")] = {
                    "status": "error",
                    "error": str(exc)
                }

    async def health_check(self) -> Dict[str, Any]:
        plugin_status = {}
        for plugin in self.plugins:
            name = getattr(plugin, "name", "unknown")
            try:
                plugin_status[name] = await plugin.health_check()
            except Exception as exc:
                plugin_status[name] = {"status": "error", "error": str(exc)}
        self._plugin_health = plugin_status
        db_ok = True
        error = None
        try:
            self.db.execute("SELECT 1")
        except Exception as exc:
            db_ok = False
            error = str(exc)
        return {
            "engine": "primary",
            "db_path": str(self.db_path),
            "db_ok": db_ok,
            "error": error,
            "plugins": plugin_status
        }

    def _init_schema(self):
        """初始化数据库 Schema"""
        self.db.executescript("""
            CREATE TABLE IF NOT EXISTS memories (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                layer TEXT DEFAULT 'session',
                dimension TEXT,
                entity_id TEXT,
                valid_from TEXT,
                valid_until TEXT,
                supersedes TEXT,
                superseded_by TEXT,
                user_id TEXT,
                project_id TEXT,
                session_id TEXT,
                embedding TEXT,
                importance REAL DEFAULT 0.5,
                confidence REAL DEFAULT 1.0,
                source TEXT DEFAULT 'user',
                tags TEXT DEFAULT '[]',
                created_at TEXT,
                updated_at TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_memories_layer ON memories(layer);
            CREATE INDEX IF NOT EXISTS idx_memories_dimension ON memories(dimension);
            CREATE INDEX IF NOT EXISTS idx_memories_entity ON memories(entity_id);
            CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project_id);
            CREATE INDEX IF NOT EXISTS idx_memories_valid ON memories(valid_from, valid_until);

            CREATE TABLE IF NOT EXISTS retrieval_profiles (
                profile_name TEXT PRIMARY KEY,
                source_weights_json TEXT NOT NULL,
                thresholds_json TEXT NOT NULL,
                budget_json TEXT NOT NULL,
                enabled INTEGER DEFAULT 1,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS retrieval_cache (
                cache_key TEXT PRIMARY KEY,
                payload_json TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                hit_count INTEGER DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_retrieval_cache_expires ON retrieval_cache(expires_at);
        """)

        self._ensure_column("memories", "embedding_blob", "BLOB")
        self._ensure_column("memories", "embedding_model", "TEXT")
        self._ensure_column("memories", "embedding_dim", "INTEGER")
        self._ensure_column("memories", "content_hash", "TEXT")
        self._ensure_column("memories", "last_accessed_at", "TEXT")
        self.db.commit()

    def _ensure_column(self, table_name: str, column_name: str, column_type: str) -> None:
        cursor = self.db.execute(f"PRAGMA table_info({table_name})")
        columns = {row[1] for row in cursor.fetchall()}
        if column_name in columns:
            return
        self.db.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}")

    async def add(
        self,
        content: str,
        layer: str = "session",
        dimension: str = None,
        entity_id: str = None,
        valid_from: str = None,
        valid_until: str = None,
        importance: float = 0.5,
        tags: List[str] = None,
        **kwargs
    ) -> dict:
        """添加记忆 - 统一入口"""

        # 1. 冲突检测
        conflicts = await self.conflict_resolver.check(content, entity_id)
        if conflicts:
            resolution = await self.conflict_resolver.resolve(content, conflicts)
            if resolution["action"] == "reject":
                return {"status": "rejected", "reason": resolution["reason"]}
            elif resolution["action"] == "merge":
                content = resolution["merged_content"]

            # 标记旧记忆为已取代
            for old_id in resolution.get("obsolete_ids", []):
                await self._mark_superseded(old_id)

        # 2. 生成嵌入向量
        embedding = self.embedder.embed(content)

        # 3. 创建记忆
        now = datetime.now().isoformat()
        memory = UnifiedMemory(
            id=str(uuid.uuid4()),
            content=content,
            layer=layer,
            dimension=dimension,
            entity_id=entity_id,
            valid_from=valid_from or now,
            valid_until=valid_until,
            embedding=embedding,
            embedding_blob=_pack_embedding(embedding),
            embedding_model=DEFAULT_EMBEDDING_MODEL,
            embedding_dim=len(embedding),
            content_hash=hashlib.sha256(content.encode("utf-8")).hexdigest(),
            last_accessed_at=now,
            importance=importance,
            tags=tags or [],
            **kwargs
        )

        # 4. 存储
        self._store(memory)

        # 5. 插件通知
        for plugin in self.plugins:
            try:
                await plugin.on_memory_added(memory)
            except Exception as exc:
                logger.error(f"Memory plugin callback failed: {getattr(plugin, 'name', 'unknown')}: {exc}")

        logger.info(f"Memory added: {memory.id[:8]}... [{layer}]")
        return {"id": memory.id, "status": "created"}
    
    def _store(self, memory: UnifiedMemory):
        """存储记忆到数据库"""
        data = memory.to_dict()
        columns = ', '.join(data.keys())
        placeholders = ', '.join(['?' for _ in data])
        
        self.db.execute(
            f"INSERT OR REPLACE INTO memories ({columns}) VALUES ({placeholders})",
            list(data.values())
        )
        self.db.commit()
    
    async def _mark_superseded(self, memory_id: str, superseded_by: str = None):
        """标记记忆为已取代"""
        self.db.execute("""
            UPDATE memories 
            SET superseded_by = ?, updated_at = ?
            WHERE id = ?
        """, (superseded_by or "new", datetime.now().isoformat(), memory_id))
        self.db.commit()
    
    async def search(
        self,
        query: str,
        layer: str = None,
        dimensions: List[str] = None,
        entity_id: str = None,
        at_time: str = None,
        limit: int = 10,
        min_score: Optional[float] = None,
    ) -> list:
        """搜索记忆 - 支持多维度 + 时序"""

        query_embedding = self.embedder.embed_cached(query)

        sql = "SELECT * FROM memories WHERE superseded_by IS NULL"
        params = []

        if layer:
            sql += " AND layer = ?"
            params.append(layer)

        if dimensions:
            placeholders = ",".join(["?" for _ in dimensions])
            sql += f" AND dimension IN ({placeholders})"
            params.extend(dimensions)

        if entity_id:
            sql += " AND entity_id = ?"
            params.append(entity_id)

        if at_time:
            sql += """
                AND (valid_from IS NULL OR valid_from <= ?)
                AND (valid_until IS NULL OR valid_until > ?)
            """
            params.extend([at_time, at_time])

        cursor = self.db.execute(sql, params)
        rows = cursor.fetchall()

        threshold = DEFAULT_MIN_SCORE if min_score is None else min_score

        results = []
        columns = [desc[0] for desc in cursor.description]

        for row in rows:
            data = dict(zip(columns, row))
            memory = UnifiedMemory.from_dict(data)

            if not memory.embedding and data.get("embedding_blob"):
                memory.embedding = _unpack_embedding(data.get("embedding_blob"))

            score = self.embedder.similarity(query_embedding, memory.embedding)

            if score > threshold:
                now = datetime.now().isoformat()
                self.db.execute(
                    "UPDATE memories SET last_accessed_at = ?, updated_at = ? WHERE id = ?",
                    (now, now, memory.id),
                )
                results.append(
                    {
                        "id": memory.id,
                        "content": memory.content,
                        "layer": memory.layer,
                        "dimension": memory.dimension,
                        "entity_id": memory.entity_id,
                        "score": round(score, 4),
                        "importance": memory.importance,
                        "created_at": memory.created_at,
                        "last_accessed_at": now,
                    }
                )

        self.db.commit()
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:limit]
    
    async def get_temporal_facts(
        self,
        entity_id: str,
        at_time: str = None
    ) -> list:
        """获取实体在特定时间点的事实"""
        if at_time is None:
            at_time = datetime.now().isoformat()
        
        cursor = self.db.execute("""
            SELECT id, content, dimension, valid_from, valid_until, importance
            FROM memories
            WHERE entity_id = ?
            AND superseded_by IS NULL
            AND (valid_from IS NULL OR valid_from <= ?)
            AND (valid_until IS NULL OR valid_until > ?)
            ORDER BY importance DESC, valid_from DESC
        """, (entity_id, at_time, at_time))
        
        return [
            {
                "id": row[0],
                "content": row[1],
                "dimension": row[2],
                "valid_from": row[3],
                "valid_until": row[4],
                "importance": row[5]
            }
            for row in cursor.fetchall()
        ]
    
    async def detect_conflicts(self, entity_id: str) -> list:
        """检测实体的所有冲突"""
        cursor = self.db.execute("""
            SELECT id, content, valid_from, valid_until
            FROM memories
            WHERE entity_id = ?
            AND superseded_by IS NULL
            ORDER BY valid_from DESC
        """, (entity_id,))

        memories = cursor.fetchall()
        conflicts = []

        def _is_candidate(content: str) -> bool:
            lowered = content.lower()
            return any(hint in content for hint in self._CONTRADICTION_HINTS) or any(
                hint in lowered for hint in self._CONTRADICTION_HINTS if hint.isascii()
            )

        candidate_indices = [index for index, row in enumerate(memories) if _is_candidate(row[1] or "")]

        compared_pairs = set()
        for idx in candidate_indices:
            mem_a = memories[idx]
            for jdx, mem_b in enumerate(memories):
                if jdx == idx:
                    continue

                pair_key = tuple(sorted((idx, jdx)))
                if pair_key in compared_pairs:
                    continue
                compared_pairs.add(pair_key)

                if self.conflict_resolver._is_contradictory(mem_a[1], mem_b[1]):
                    conflicts.append({
                        "memory_a": {"id": mem_a[0], "content": mem_a[1]},
                        "memory_b": {"id": mem_b[0], "content": mem_b[1]},
                        "conflict_type": "contradiction"
                    })

        return conflicts
    
    async def resolve_conflict(
        self,
        memory_id_a: str,
        memory_id_b: str,
        resolution: str = "auto"
    ) -> dict:
        """解决记忆冲突"""
        if resolution == "keep_a":
            await self._mark_superseded(memory_id_b, memory_id_a)
            return {"status": "resolved", "kept": memory_id_a, "removed": memory_id_b}
        elif resolution == "keep_b":
            await self._mark_superseded(memory_id_a, memory_id_b)
            return {"status": "resolved", "kept": memory_id_b, "removed": memory_id_a}
        else:  # auto - 保留更新的
            cursor = self.db.execute("""
                SELECT id FROM memories 
                WHERE id IN (?, ?) 
                ORDER BY created_at DESC LIMIT 1
            """, (memory_id_a, memory_id_b))
            
            newer_id = cursor.fetchone()[0]
            older_id = memory_id_b if newer_id == memory_id_a else memory_id_a
            
            await self._mark_superseded(older_id, newer_id)
            return {"status": "resolved", "kept": newer_id, "removed": older_id}
    
    def get_retrieval_profile(self, profile_name: str) -> Optional[Dict[str, Any]]:
        cursor = self.db.execute(
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
            "profile_name": row[0],
            "source_weights_json": json.loads(row[1]) if row[1] else {},
            "thresholds_json": json.loads(row[2]) if row[2] else {},
            "budget_json": json.loads(row[3]) if row[3] else {},
            "enabled": bool(row[4]),
            "updated_at": row[5],
        }

    def upsert_retrieval_profile(
        self,
        profile_name: str,
        source_weights: Dict[str, Any],
        thresholds: Dict[str, Any],
        budget: Dict[str, Any],
        enabled: bool = True,
    ) -> None:
        now = datetime.now().isoformat()
        self.db.execute(
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
        self.db.commit()

    def cache_pack(self, cache_key: str, payload: Dict[str, Any], ttl_seconds: int = 300, status: str = "ready") -> None:
        now = datetime.now()
        expires_at = datetime.fromtimestamp(now.timestamp() + max(ttl_seconds, 1)).isoformat()
        self.db.execute(
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
        self.db.commit()

    def cache_read(self, cache_key: str) -> Optional[Dict[str, Any]]:
        cursor = self.db.execute(
            """
            SELECT payload_json, status, expires_at, hit_count
            FROM retrieval_cache
            WHERE cache_key = ?
            """,
            (cache_key,),
        )
        row = cursor.fetchone()
        if not row:
            return None

        expires_at = row[2]
        if expires_at and expires_at <= datetime.now().isoformat():
            self.cache_release(cache_key)
            return None

        self.db.execute(
            "UPDATE retrieval_cache SET hit_count = hit_count + 1 WHERE cache_key = ?",
            (cache_key,),
        )
        self.db.commit()
        return {
            "payload": json.loads(row[0]) if row[0] else {},
            "status": row[1],
            "expires_at": row[2],
            "hit_count": int(row[3]) + 1,
        }

    def cache_status(self, cache_key: str) -> Optional[str]:
        cursor = self.db.execute(
            "SELECT status FROM retrieval_cache WHERE cache_key = ?",
            (cache_key,),
        )
        row = cursor.fetchone()
        return row[0] if row else None

    def cache_release(self, cache_key: str) -> None:
        self.db.execute("DELETE FROM retrieval_cache WHERE cache_key = ?", (cache_key,))
        self.db.commit()

    def cache_cleanup(self) -> int:
        cursor = self.db.execute(
            "DELETE FROM retrieval_cache WHERE expires_at <= ?",
            (datetime.now().isoformat(),),
        )
        self.db.commit()
        return int(cursor.rowcount)

    def close(self):
        """关闭数据库连接"""
        self.db.close()

    @classmethod
    def from_config(cls, plugins: Optional[Iterable[EnginePlugin]] = None) -> "UnifiedMemoryEngine":
        db_path = get_config_value("memory.db_path", None)
        if db_path is None:
            data_dir = get_config_value("data_dir", None)
            if data_dir:
                db_path = Path(data_dir) / "memory.db"
        if db_path is None:
            db_path = get_config_value("memory.vector_db_path", None)
        return cls(db_path=db_path, plugins=plugins)
