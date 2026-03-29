from dataclasses import dataclass, asdict, field
from typing import List, Optional, Dict, Any, Callable, TYPE_CHECKING
from pathlib import Path
import time
import uuid
import json
import logging
import sqlite3
import re

if TYPE_CHECKING:
    from ..knowledge.services.protocols import SearchInterface

logger = logging.getLogger("niko-core-memory")


@dataclass
class CoreMemory:
    """
    Core Memory Structure.

    Attributes:
        id: Unique memory identifier
        content: Full memory content
        summary: AI-generated summary (optional)
        archived: Whether memory is archived (soft delete)
        created_at: Creation timestamp
        updated_at: Last update timestamp
        metadata: Additional metadata (tags, source, etc.)
        importance: Memory importance score (0.0-1.0)
        access_count: Number of times accessed
    """
    id: str
    content: str
    summary: Optional[str] = None
    archived: bool = False
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    metadata: Dict = field(default_factory=dict)
    importance: float = 0.5
    access_count: int = 0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'CoreMemory':
        """Create from dictionary."""
        # Handle legacy data without new fields
        data.setdefault('importance', 0.5)
        data.setdefault('access_count', 0)
        return cls(**data)

class CoreMemoryStore:
    """
    Core Memory Store.
    Persists memories using VectorSearch (SQLite + Embeddings).

    Features:
    - CRUD operations for core memories
    - Semantic search via vector embeddings
    - AI-powered summary generation
    - Soft delete (archive) and hard delete
    - Importance scoring and access tracking
    """

    def __init__(
        self,
        vector_search: Optional["SearchInterface"] = None,
        summary_generator: Optional[Callable[[str], str]] = None,
        db_path: Optional[str] = None,
    ):
        """
        Initialize CoreMemoryStore.

        Args:
            vector_search: Optional SearchInterface instance for embedding storage
            summary_generator: Optional callable for generating summaries
                               Signature: (content: str) -> str
            db_path: Optional SQLite path for core memory persistence
        """
        self.vector_search = vector_search
        self._summary_generator = summary_generator

        if db_path is None:
            if vector_search is not None:
                db_path = str(vector_search.db_path)
            else:
                db_path = ".writing/core_memory.db"

        db_path_obj = Path(db_path)
        db_path_obj.parent.mkdir(parents=True, exist_ok=True)
        self._db_path = str(db_path_obj)
        self._init_schema()

    def _get_core_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_schema(self) -> None:
        conn = self._get_core_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS core_memories (
                    id TEXT PRIMARY KEY,
                    content TEXT NOT NULL,
                    summary TEXT,
                    archived INTEGER NOT NULL DEFAULT 0,
                    created_at REAL,
                    updated_at REAL,
                    metadata TEXT NOT NULL DEFAULT '{}',
                    importance REAL DEFAULT 0.5,
                    access_count INTEGER DEFAULT 0,
                    pending_vector_sync INTEGER NOT NULL DEFAULT 0
                );
                """
            )
            self._ensure_core_columns(cursor)
            conn.commit()
        finally:
            conn.close()

    def _ensure_core_columns(self, cursor: sqlite3.Cursor) -> None:
        cursor.execute("PRAGMA table_info(core_memories)")
        existing = {row["name"] for row in cursor.fetchall()}
        required = {
            "created_at": "REAL DEFAULT 0",
            "updated_at": "REAL DEFAULT 0",
            "metadata": "TEXT NOT NULL DEFAULT '{}'",
            "importance": "REAL DEFAULT 0.5",
            "access_count": "INTEGER DEFAULT 0",
            "pending_vector_sync": "INTEGER NOT NULL DEFAULT 0",
        }
        for name, ddl in required.items():
            if name not in existing:
                cursor.execute(f"ALTER TABLE core_memories ADD COLUMN {name} {ddl}")

        defaults = {
            "created_at": 0,
            "updated_at": 0,
            "metadata": "{}",
            "importance": 0.5,
            "access_count": 0,
            "pending_vector_sync": 0,
        }
        for name, value in defaults.items():
            cursor.execute(
                f"UPDATE core_memories SET {name} = ? WHERE {name} IS NULL",
                (value,)
            )

    def _parse_metadata(self, raw: Optional[str]) -> Dict[str, Any]:
        if not raw:
            return {}
        try:
            data = json.loads(raw)
        except Exception:
            return {}
        return data if isinstance(data, dict) else {}

    def _set_pending_vector_sync(self, memory_id: str, pending: bool) -> None:
        conn = self._get_core_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE core_memories SET pending_vector_sync = ? WHERE id = ?",
                (1 if pending else 0, memory_id)
            )
            conn.commit()
        finally:
            conn.close()

    def _update_sqlite_access_count(self, memory_id: str, count: int) -> None:
        conn = self._get_core_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "UPDATE core_memories SET access_count = ?, updated_at = ? WHERE id = ?",
                (count, time.time(), memory_id)
            )
            conn.commit()
        finally:
            conn.close()

    def upsert(
        self,
        content: str,
        memory_id: Optional[str] = None,
        metadata: Optional[Dict] = None,
        importance: float = 0.5,
        summary: Optional[str] = None
    ) -> CoreMemory:
        """
        Create or update a memory (unified upsert API).

        Args:
            content: Memory content
            memory_id: Optional ID (auto-generated if not provided)
            metadata: Additional metadata
            importance: Importance score (0.0-1.0)
            summary: Optional pre-computed summary

        Returns:
            CoreMemory object
        """
        memory_id = memory_id or str(uuid.uuid4())
        now = time.time()
        metadata = metadata or {}

        # Check if updating existing memory
        existing = self.get(memory_id)
        created_at = existing.created_at if existing else now
        access_count = existing.access_count if existing else 0

        memory = CoreMemory(
            id=memory_id,
            content=content,
            summary=summary,
            archived=False,
            created_at=created_at,
            updated_at=now,
            metadata=metadata,
            importance=importance,
            access_count=access_count
        )

        # Store in VectorSearch with full metadata
        store_metadata = {
            "summary": memory.summary,
            "archived": memory.archived,
            "created_at": memory.created_at,
            "updated_at": memory.updated_at,
            "importance": memory.importance,
            "access_count": memory.access_count,
            "extra": metadata
        }

        self.vector_search.upsert_vector(
            id=memory_id,
            content=content,
            metadata=store_metadata,
            type="memory"
        )

        logger.debug(f"Upserted memory: {memory_id[:8]}...")
        return memory

    def upsert_memory(self, *args, **kwargs) -> CoreMemory:
        """
        Create or update a memory in the core_memories table.

        Supported call styles:
        - upsert_memory(content, memory_id="m1", metadata=..., summary=..., archived=False)
        - upsert_memory("m1", "content", summary, archived)
        """
        content = None
        memory_id = None
        summary = None
        archived = False
        metadata = None
        importance = kwargs.get("importance")
        access_count = kwargs.get("access_count")
        created_at = kwargs.get("created_at")
        updated_at = kwargs.get("updated_at")

        if "memory_id" in kwargs or "content" in kwargs:
            content = kwargs.get("content", args[0] if args else None)
            memory_id = kwargs.get("memory_id")
            summary = kwargs.get("summary")
            archived = kwargs.get("archived", False)
            metadata = kwargs.get("metadata")
        else:
            if len(args) >= 2:
                first = args[0]
                second = args[1]
                third = args[2] if len(args) > 2 else None
                fourth = args[3] if len(args) > 3 else False

                if isinstance(first, str) and isinstance(second, str):
                    if (" " in first and " " not in second) and third is None:
                        content = first
                        memory_id = second
                        summary = kwargs.get("summary")
                        archived = kwargs.get("archived", False)
                        metadata = kwargs.get("metadata")
                    else:
                        memory_id = first
                        content = second
                        summary = third
                        archived = bool(fourth)
                        metadata = kwargs.get("metadata")
                else:
                    memory_id = first
                    content = second
                    summary = third
                    archived = bool(fourth)
            elif len(args) == 1:
                content = args[0]
                memory_id = kwargs.get("memory_id")
                summary = kwargs.get("summary")
                archived = kwargs.get("archived", False)
                metadata = kwargs.get("metadata")

        if content is None:
            raise ValueError("content is required")

        if memory_id is None:
            memory_id = str(uuid.uuid4())

        now = time.time()
        archived_value = 1 if archived else 0
        conn = self._get_core_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT created_at, metadata, importance, access_count FROM core_memories WHERE id = ?",
                (memory_id,)
            )
            row = cursor.fetchone()
            exists = row is not None

            if exists:
                existing_metadata = self._parse_metadata(row["metadata"])
                if metadata is None:
                    metadata = existing_metadata
                if created_at is None:
                    created_at = row["created_at"] if row["created_at"] is not None else now
                if importance is None:
                    importance = row["importance"] if row["importance"] is not None else 0.5
                if access_count is None:
                    access_count = row["access_count"] if row["access_count"] is not None else 0
            else:
                if metadata is None:
                    metadata = {}
                if created_at is None:
                    created_at = now
                if importance is None:
                    importance = 0.5
                if access_count is None:
                    access_count = 0

            if updated_at is None:
                updated_at = now

            if not isinstance(metadata, dict):
                metadata = {"value": metadata}

            pending_vector_sync = 1 if self.vector_search is None else 0

            if exists:
                cursor.execute(
                    """
                    UPDATE core_memories
                    SET content = ?, summary = ?, archived = ?, updated_at = ?, metadata = ?,
                        importance = ?, access_count = ?, pending_vector_sync = ?
                    WHERE id = ?
                    """,
                    (
                        content,
                        summary,
                        archived_value,
                        updated_at,
                        json.dumps(metadata),
                        importance,
                        access_count,
                        pending_vector_sync,
                        memory_id,
                    )
                )
            else:
                cursor.execute(
                    """
                    INSERT INTO core_memories (
                        id, content, summary, archived, created_at, updated_at,
                        metadata, importance, access_count, pending_vector_sync
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        memory_id,
                        content,
                        summary,
                        archived_value,
                        created_at,
                        updated_at,
                        json.dumps(metadata),
                        importance,
                        access_count,
                        pending_vector_sync,
                    )
                )
            conn.commit()
        finally:
            conn.close()

        if self.vector_search is not None:
            try:
                self.upsert(
                    content=content,
                    memory_id=memory_id,
                    metadata=metadata,
                    importance=importance if importance is not None else 0.5,
                    summary=summary,
                )
                if archived:
                    if not self.archive(memory_id):
                        raise RuntimeError("Vector archive failed")
                self._set_pending_vector_sync(memory_id, False)
            except Exception as e:
                logger.warning(f"Vector upsert failed for memory {memory_id[:8]}...: {e}")
                self._set_pending_vector_sync(memory_id, True)

        return CoreMemory(
            id=memory_id,
            content=content,
            summary=summary,
            archived=archived,
            metadata=metadata or {},
            created_at=created_at if created_at is not None else now,
            updated_at=updated_at if updated_at is not None else now,
            importance=importance if importance is not None else 0.5,
            access_count=access_count if access_count is not None else 0,
        )

    def get(self, memory_id: str, track_access: bool = False) -> Optional[CoreMemory]:
        """
        Retrieve a memory by ID (primary API).

        Args:
            memory_id: Memory identifier
            track_access: Whether to increment access count

        Returns:
            CoreMemory object or None if not found
        """
        if self.vector_search is None:
            memory = self._get_memory_sqlite(memory_id)
            if memory and track_access:
                memory.access_count += 1
                self._update_sqlite_access_count(memory_id, memory.access_count)
            return memory

        conn = self.vector_search._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, content, metadata FROM items WHERE id = ? AND type = 'memory'",
                (memory_id,)
            )
            row = cursor.fetchone()

            if not row:
                return None

            meta = json.loads(row["metadata"])
            memory = CoreMemory(
                id=row["id"],
                content=row["content"],
                summary=meta.get("summary"),
                archived=meta.get("archived", False),
                created_at=meta.get("created_at", 0),
                updated_at=meta.get("updated_at", 0),
                metadata=meta.get("extra", {}),
                importance=meta.get("importance", 0.5),
                access_count=meta.get("access_count", 0)
            )

            # Track access if requested
            if track_access:
                memory.access_count += 1
                self._update_access_count(memory_id, memory.access_count)
                self._update_sqlite_access_count(memory_id, memory.access_count)

            return memory
        finally:
            conn.close()

    def _get_memory_sqlite(self, memory_id: str) -> Optional[CoreMemory]:
        conn = self._get_core_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, content, summary, archived, created_at, updated_at,
                       metadata, importance, access_count
                FROM core_memories WHERE id = ?
                """,
                (memory_id,)
            )
            row = cursor.fetchone()
        finally:
            conn.close()

        if not row:
            return None

        metadata = self._parse_metadata(row["metadata"])
        return CoreMemory(
            id=row["id"],
            content=row["content"],
            summary=row["summary"],
            archived=bool(row["archived"]),
            created_at=row["created_at"] if row["created_at"] is not None else 0,
            updated_at=row["updated_at"] if row["updated_at"] is not None else 0,
            metadata=metadata,
            importance=row["importance"] if row["importance"] is not None else 0.5,
            access_count=row["access_count"] if row["access_count"] is not None else 0,
        )

    def get_memory(self, memory_id: str) -> Optional[CoreMemory]:
        """
        Retrieve a memory by ID (legacy API).
        """
        memory = self._get_memory_sqlite(memory_id)
        if memory:
            return memory

        if self.vector_search is not None:
            return self.get(memory_id)
        return None

    def get_memories(
        self,
        include_archived: bool = False,
        limit: Optional[int] = None,
    ) -> List[CoreMemory]:
        """
        Retrieve all memories, optionally including archived entries.
        """
        conn = self._get_core_connection()
        try:
            cursor = conn.cursor()
            query = (
                "SELECT id, content, summary, archived, created_at, updated_at, "
                "metadata, importance, access_count FROM core_memories"
            )
            params = []
            if not include_archived:
                query += " WHERE archived = 0"
            if limit is not None:
                query += " LIMIT ?"
                params.append(limit)
            cursor.execute(query, params)
            rows = cursor.fetchall()
        finally:
            conn.close()

        memories = []
        for row in rows:
            metadata = self._parse_metadata(row["metadata"])
            memories.append(CoreMemory(
                id=row["id"],
                content=row["content"],
                summary=row["summary"],
                archived=bool(row["archived"]),
                created_at=row["created_at"] if row["created_at"] is not None else 0,
                updated_at=row["updated_at"] if row["updated_at"] is not None else 0,
                metadata=metadata,
                importance=row["importance"] if row["importance"] is not None else 0.5,
                access_count=row["access_count"] if row["access_count"] is not None else 0,
            ))

        return memories

    def _update_access_count(self, memory_id: str, count: int):
        """Update access count in storage."""
        conn = self.vector_search._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT metadata FROM items WHERE id = ?",
                (memory_id,)
            )
            row = cursor.fetchone()
            if row:
                meta = json.loads(row["metadata"])
                meta["access_count"] = count
                cursor.execute(
                    "UPDATE items SET metadata = ? WHERE id = ?",
                    (json.dumps(meta), memory_id)
                )
                conn.commit()
        finally:
            conn.close()

    def _update_vector_summary(self, memory_id: str, summary: str):
        """Update summary in vector metadata."""
        if self.vector_search is None:
            return
        conn = self.vector_search._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT metadata FROM items WHERE id = ?",
                (memory_id,)
            )
            row = cursor.fetchone()
            if row:
                meta = json.loads(row["metadata"])
                meta["summary"] = summary
                meta["updated_at"] = time.time()
                cursor.execute(
                    "UPDATE items SET metadata = ? WHERE id = ?",
                    (json.dumps(meta), memory_id)
                )
                conn.commit()
        finally:
            conn.close()

    def _search_memories_sqlite(
        self,
        query: str,
        top_k: int = 5,
        include_archived: bool = False,
    ) -> List[CoreMemory]:
        """Fallback memory search using sqlite content matching."""
        query = (query or "").strip()
        if not query:
            return []

        normalized_query = query.lower()
        alt_terms: List[str] = []
        if "science fiction" in normalized_query:
            alt_terms.append("sci-fi")

        tokens = [t for t in re.split(r"\s+", query) if t]
        search_terms = list(dict.fromkeys([normalized_query, *alt_terms, *[t.lower() for t in tokens]]))
        if not search_terms:
            return []

        conn = self._get_core_connection()
        try:
            cursor = conn.cursor()
            like_clause = " OR ".join(["LOWER(content) LIKE ?" for _ in search_terms])
            sql = (
                "SELECT id, content, summary, archived, created_at, updated_at, "
                "metadata, importance, access_count "
                "FROM core_memories WHERE (" + like_clause + ")"
            )
            params: List[Any] = [f"%{t}%" for t in search_terms]
            if not include_archived:
                sql += " AND archived = 0"
            sql += " ORDER BY updated_at DESC LIMIT ?"
            params.append(max(top_k * 3, top_k))

            cursor.execute(sql, params)
            rows = cursor.fetchall()
        finally:
            conn.close()

        scored: List[tuple[int, CoreMemory]] = []
        for row in rows:
            content_lower = (row["content"] or "").lower()
            score = sum(1 for t in search_terms if t in content_lower)
            if score == 0:
                continue
            metadata = self._parse_metadata(row["metadata"])
            scored.append((
                score,
                CoreMemory(
                    id=row["id"],
                    content=row["content"],
                    summary=row["summary"],
                    archived=bool(row["archived"]),
                    created_at=row["created_at"] if row["created_at"] is not None else 0,
                    updated_at=row["updated_at"] if row["updated_at"] is not None else 0,
                    metadata=metadata,
                    importance=row["importance"] if row["importance"] is not None else 0.5,
                    access_count=row["access_count"] if row["access_count"] is not None else 0,
                )
            ))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [m for _, m in scored[:top_k]]

    def search_memories(
        self,
        query: str,
        top_k: int = 5,
        include_archived: bool = False
    ) -> List[CoreMemory]:
        """
        Semantic search for memories.

        Args:
            query: Search query
            top_k: Maximum results to return
            include_archived: Whether to include archived memories

        Returns:
            List of matching CoreMemory objects
        """
        if self.vector_search is None:
            return self._search_memories_sqlite(query, top_k=top_k, include_archived=include_archived)

        try:
            results = self.vector_search.search_memory_vectors(query, top_k=top_k * 2)
            if not results:
                return self._search_memories_sqlite(query, top_k=top_k, include_archived=include_archived)
        except Exception as e:
            logger.warning(f"Vector search failed, fallback to sqlite search: {e}")
            return self._search_memories_sqlite(query, top_k=top_k, include_archived=include_archived)
        memories = []

        for res in results:
            meta = res["metadata"]
            archived = meta.get("archived", False)

            # Filter archived unless explicitly included
            if archived and not include_archived:
                continue

            memories.append(CoreMemory(
                id=res["id"],
                content=res["content"],
                summary=meta.get("summary"),
                archived=archived,
                created_at=meta.get("created_at", 0),
                updated_at=meta.get("updated_at", 0),
                metadata=meta.get("extra", {}),
                importance=meta.get("importance", 0.5),
                access_count=meta.get("access_count", 0)
            ))

            if len(memories) >= top_k:
                break

        return memories

    def archive(self, memory_id: str) -> bool:
        """
        Archive a memory (soft delete).

        Args:
            memory_id: Memory identifier

        Returns:
            True if archived, False if not found
        """
        memory = self.get(memory_id)
        if not memory:
            return False

        memory.archived = True
        memory.updated_at = time.time()

        # Update metadata in storage
        conn = self.vector_search._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT metadata FROM items WHERE id = ?",
                (memory_id,)
            )
            row = cursor.fetchone()
            if row:
                meta = json.loads(row["metadata"])
                meta["archived"] = True
                meta["updated_at"] = memory.updated_at
                cursor.execute(
                    "UPDATE items SET metadata = ? WHERE id = ?",
                    (json.dumps(meta), memory_id)
                )
                conn.commit()
                logger.info(f"Archived memory: {memory_id[:8]}...")
                return True
        finally:
            conn.close()
        return False

    def archive_memory(self, memory_id: str) -> bool:
        """
        Archive a memory (soft delete) - legacy API.
        """
        now = time.time()
        pending_vector_sync = 1 if self.vector_search is None else 0
        conn = self._get_core_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                UPDATE core_memories
                SET archived = 1, updated_at = ?, pending_vector_sync = ?
                WHERE id = ?
                """,
                (now, pending_vector_sync, memory_id)
            )
            conn.commit()
        finally:
            conn.close()

        if self.vector_search is not None:
            try:
                if not self.archive(memory_id):
                    raise RuntimeError("Vector archive failed")
                self._set_pending_vector_sync(memory_id, False)
            except Exception as e:
                logger.error(f"Vector archive failed for memory {memory_id[:8]}...: {e}")
                self._set_pending_vector_sync(memory_id, True)
                return False

        return True

    def delete(self, memory_id: str) -> bool:
        """
        Hard delete a memory.

        Args:
            memory_id: Memory identifier

        Returns:
            True if deleted
        """
        self.vector_search.delete_vector(memory_id)
        logger.info(f"Deleted memory: {memory_id[:8]}...")
        return True

    def delete_memory(self, memory_id: str) -> bool:
        """
        Hard delete a memory - legacy API.
        """
        if self.vector_search is not None:
            try:
                self.delete(memory_id)
            except Exception as e:
                logger.error(f"Vector delete failed for memory {memory_id[:8]}...: {e}")
                return False

        conn = self._get_core_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "DELETE FROM core_memories WHERE id = ?",
                (memory_id,)
            )
            conn.commit()
        finally:
            conn.close()

        return True

    def generate_summary(
        self,
        memory_id: str,
        tool: Optional[Any] = None,
        force: bool = False
    ) -> str:
        """
        Generate AI summary for a memory.
        """
        if isinstance(tool, bool):
            force = tool
            tool = None

        memory = self.get_memory(memory_id)
        if memory is None and self.vector_search is not None:
            memory = self.get(memory_id)

        if not memory:
            logger.warning(f"Memory not found: {memory_id}")
            return ""

        if memory.summary and not force:
            return memory.summary

        summary = None
        if tool is not None:
            try:
                if hasattr(tool, "summarize"):
                    summary = tool.summarize(memory.content)
                elif callable(tool):
                    summary = tool(memory.content)
            except Exception as e:
                logger.error(f"Summary generation failed: {e}")
                summary = None

        if summary is None and self._summary_generator:
            try:
                summary = self._summary_generator(memory.content)
            except Exception as e:
                logger.error(f"Summary generation failed: {e}")
                summary = None

        if summary is None:
            summary = memory.content[:120]

        updated_at = time.time()
        conn = self._get_core_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT metadata FROM core_memories WHERE id = ?",
                (memory_id,)
            )
            row = cursor.fetchone()
            metadata = self._parse_metadata(row["metadata"] if row else None)
            metadata["summary"] = summary
            cursor.execute(
                "UPDATE core_memories SET summary = ?, metadata = ?, updated_at = ? WHERE id = ?",
                (summary, json.dumps(metadata), updated_at, memory_id)
            )
            conn.commit()
        finally:
            conn.close()

        if self.vector_search is not None:
            try:
                self._update_vector_summary(memory_id, summary)
                self._set_pending_vector_sync(memory_id, False)
            except Exception as e:
                logger.error(f"Vector summary update failed for memory {memory_id[:8]}...: {e}")
                self._set_pending_vector_sync(memory_id, True)

        logger.debug(f"Generated summary for: {memory_id[:8]}...")
        return summary

    def _default_summary(self, content: str, max_length: int = 200) -> str:
        """
        Generate a simple extractive summary.

        Args:
            content: Content to summarize
            max_length: Maximum summary length

        Returns:
            Extractive summary
        """
        # Simple extractive summary: first sentence or truncated content
        sentences = content.replace('\n', ' ').split('.')
        if sentences:
            first_sentence = sentences[0].strip()
            if len(first_sentence) <= max_length:
                return first_sentence + '.' if not first_sentence.endswith('.') else first_sentence

        # Truncate if too long
        if len(content) > max_length:
            return content[:max_length - 3].strip() + '...'
        return content

    def list_all(
        self,
        include_archived: bool = False,
        limit: int = 100
    ) -> List[CoreMemory]:
        """
        List all memories.

        Args:
            include_archived: Whether to include archived memories
            limit: Maximum number of memories to return

        Returns:
            List of CoreMemory objects
        """
        if self.vector_search is None:
            return self.get_memories(include_archived=include_archived, limit=limit)

        conn = self.vector_search._get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT id, content, metadata FROM items WHERE type = 'memory' LIMIT ?",
                (limit,)
            )
            rows = cursor.fetchall()

            memories = []
            for row in rows:
                meta = json.loads(row["metadata"])
                archived = meta.get("archived", False)

                if archived and not include_archived:
                    continue

                memories.append(CoreMemory(
                    id=row["id"],
                    content=row["content"],
                    summary=meta.get("summary"),
                    archived=archived,
                    created_at=meta.get("created_at", 0),
                    updated_at=meta.get("updated_at", 0),
                    metadata=meta.get("extra", {}),
                    importance=meta.get("importance", 0.5),
                    access_count=meta.get("access_count", 0)
                ))

            return memories
        finally:
            conn.close()
