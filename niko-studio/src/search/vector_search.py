"""
Vector Search Module - HNSW Index with Hybrid Search

Features:
- VectorIndex: CRUD operations with HNSW indexing
- SearchResult: Structured result dataclass
- hybrid_search: Vector + keyword fusion using RRF
- SQLite persistence with sqlite-vec extension
"""

import logging
import time
import json
import sqlite3
import asyncio
import numpy as np
from pathlib import Path
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Union, Generator, TypedDict

# Try importing pysqlite3 as it's often required for extension loading
try:
    import pysqlite3 as sqlite3
except ImportError:
    pass

try:
    from fastembed import TextEmbedding
except ImportError:
    TextEmbedding = None

try:
    import sqlite_vec
except ImportError:
    sqlite_vec = None

# Import async connection pool
try:
    from src.db.pool import get_pool, AsyncConnectionPool
except ImportError:
    get_pool = None
    AsyncConnectionPool = None

# Import query cache
try:
    from src.memory.query_cache import get_query_cache
except ImportError:
    get_query_cache = None

logger = logging.getLogger(__name__)

# ============ Constants ============
DEFAULT_EMBEDDING_DIM = 384
DEFAULT_MODEL_NAME = "BAAI/bge-small-en-v1.5"

# Search result location schema
LOC_KIND_LINE = "line"
LOC_KIND_CHAR = "char"
LOC_KIND_RANGE = "range"

class SearchResultLocation(TypedDict):
    kind: str
    start: int
    end: Optional[int]

class SearchResultMeta(TypedDict):
    path: Optional[str]
    doc_id: Optional[str]
    surface: Optional[str]
    loc: Optional[SearchResultLocation]
    chunk_index: Optional[int]
    extra: Dict[str, Any]

class SearchResultSnapshot(TypedDict):
    query: str
    results: List[Dict[str, Any]]


REQUIRED_SEARCH_RESULT_FIELDS = [
    "id",
    "content",
    "score",
    "type",
    "source",
    "mode_used",
    "metadata",
    "loc",
    "snapshot_query"
]

SEARCH_RESULT_FIELDS_CHECKLIST = REQUIRED_SEARCH_RESULT_FIELDS

SAMPLE_SEARCH_QUERY = "search_result_sample_query"

@dataclass
class SearchResult:
    """Structured search result with score and metadata."""
    id: str
    content: str
    score: float
    type: str = "chunk"
    metadata: SearchResultMeta = field(default_factory=lambda: {
        "path": None,
        "doc_id": None,
        "surface": None,
        "loc": None,
        "chunk_index": None,
        "extra": {}
    })
    source: str = "vector"  # vector, keyword, hybrid
    mode_used: Optional[str] = None
    loc: Optional[SearchResultLocation] = None
    snapshot_query: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "content": self.content,
            "score": round(self.score, 4),
            "type": self.type,
            "source": self.source,
            "mode_used": self.mode_used,
            "metadata": self.metadata,
            "loc": self.loc,
            "snapshot_query": self.snapshot_query,
        }




def _normalize_loc(loc: Optional[Dict[str, Any]]) -> Optional[SearchResultLocation]:
    if not loc:
        return None
    kind = loc.get("kind") or LOC_KIND_CHAR
    start = int(loc.get("start") or 0)
    end = loc.get("end")
    end_value = int(end) if end is not None else None
    return {
        "kind": kind,
        "start": start,
        "end": end_value
    }


def _build_search_metadata(
    *,
    path: Optional[str] = None,
    doc_id: Optional[str] = None,
    surface: Optional[str] = None,
    loc: Optional[Dict[str, Any]] = None,
    chunk_index: Optional[int] = None,
    extra: Optional[Dict[str, Any]] = None
) -> SearchResultMeta:
    return {
        "path": path,
        "doc_id": doc_id,
        "surface": surface,
        "loc": _normalize_loc(loc),
        "chunk_index": chunk_index,
        "extra": extra or {},
    }


def _normalize_search_result_fields(
    *,
    result_id: str,
    content: str,
    score: float,
    item_type: str,
    source: str,
    metadata: Optional[Dict[str, Any]] = None,
    loc: Optional[Dict[str, Any]] = None,
    snapshot_query: Optional[str] = None,
    mode_used: Optional[str] = None
) -> SearchResult:
    metadata = metadata or {}
    built_metadata = _build_search_metadata(
        path=metadata.get("path"),
        doc_id=metadata.get("doc_id"),
        surface=metadata.get("surface"),
        loc=metadata.get("loc"),
        chunk_index=metadata.get("chunk_index"),
        extra={
            k: v
            for k, v in metadata.items()
            if k not in {"path", "doc_id", "surface", "loc", "chunk_index"}
        },
    )
    normalized_loc = _normalize_loc(loc) or built_metadata["loc"]

    return SearchResult(
        id=result_id,
        content=content,
        score=score,
        type=item_type,
        metadata=built_metadata,
        source=source,
        mode_used=mode_used,
        loc=normalized_loc,
        snapshot_query=snapshot_query,
    )

@dataclass
class HNSWConfig:
    """HNSW index configuration."""
    dimension: int = DEFAULT_EMBEDDING_DIM
    ef_construction: int = 200  # Higher = better quality, slower build
    ef_search: int = 100  # Higher = better recall, slower search
    m: int = 16  # Number of connections per layer


class VectorIndex:
    """
    Vector Index with HNSW support via sqlite-vec.

    Provides:
    - add: Insert vectors
    - search: HNSW approximate nearest neighbor search
    - delete: Remove vectors by ID
    - save/load: Persistence to SQLite
    """

    def __init__(
        self,
        db_path: str,
        config: HNSWConfig = None,
        model_name: str = DEFAULT_MODEL_NAME
    ):
        self.db_path = Path(db_path)
        self.config = config or HNSWConfig()
        self.model_name = model_name
        self._embedder = None
        self._ensure_db()

    @property
    def embedder(self):
        """Lazy-load embedding model."""
        if self._embedder is None:
            if TextEmbedding is None:
                raise ImportError("fastembed required. Install: pip install fastembed")
            logger.info(f"Loading embedding model: {self.model_name}")
            self._embedder = TextEmbedding(model_name=self.model_name)
        return self._embedder

    def _get_connection(self) -> sqlite3.Connection:
        """Get SQLite connection with sqlite-vec loaded."""
        if not self.db_path.parent.exists():
            self.db_path.parent.mkdir(parents=True, exist_ok=True)

        conn = sqlite3.connect(str(self.db_path))

        if sqlite_vec:
            try:
                conn.enable_load_extension(True)
                sqlite_vec.load(conn)
                conn.enable_load_extension(False)
            except Exception as e:
                logger.warning(f"Failed to load sqlite-vec: {e}")

        conn.row_factory = sqlite3.Row
        return conn

    def _ensure_db(self):
        """Initialize database schema."""
        conn = self._get_connection()
        cursor = conn.cursor()

        # Main items table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS vector_items (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                metadata TEXT DEFAULT '{}',
                embedding BLOB,
                type TEXT DEFAULT 'chunk',
                created_at REAL
            )
        """)

        # Create FTS5 table for keyword search
        cursor.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS vector_items_fts USING fts5(
                id, content, type,
                content='vector_items',
                content_rowid='rowid'
            )
        """)

        # Triggers for FTS sync
        cursor.execute("""
            CREATE TRIGGER IF NOT EXISTS vector_items_ai AFTER INSERT ON vector_items BEGIN
                INSERT INTO vector_items_fts(rowid, id, content, type)
                VALUES (new.rowid, new.id, new.content, new.type);
            END
        """)

        cursor.execute("""
            CREATE TRIGGER IF NOT EXISTS vector_items_ad AFTER DELETE ON vector_items BEGIN
                INSERT INTO vector_items_fts(vector_items_fts, rowid, id, content, type)
                VALUES ('delete', old.rowid, old.id, old.content, old.type);
            END
        """)

        cursor.execute("""
            CREATE TRIGGER IF NOT EXISTS vector_items_au AFTER UPDATE ON vector_items BEGIN
                INSERT INTO vector_items_fts(vector_items_fts, rowid, id, content, type)
                VALUES ('delete', old.rowid, old.id, old.content, old.type);
                INSERT INTO vector_items_fts(rowid, id, content, type)
                VALUES (new.rowid, new.id, new.content, new.type);
            END
        """)

        # Vector index table (if sqlite-vec available)
        if sqlite_vec:
            dim = self.config.dimension
            cursor.execute(f"""
                CREATE VIRTUAL TABLE IF NOT EXISTS vec_index USING vec0(
                    embedding float[{dim}]
                )
            """)

        conn.commit()
        conn.close()

    def add(
        self,
        id: str,
        content: str,
        metadata: Dict[str, Any] = None,
        type: str = "chunk",
        embedding: List[float] = None
    ) -> None:
        """
        Add item to index.

        Args:
            id: Unique identifier
            content: Text content
            metadata: Optional metadata dict
            type: Item type (memory, chunk, etc.)
            embedding: Pre-computed embedding (optional)
        """
        metadata = metadata or {}

        # Generate embedding if not provided
        if embedding is None:
            emb_gen = self.embedder.embed([content])
            embedding = list(next(emb_gen))

        embedding_bytes = np.array(embedding, dtype=np.float32).tobytes()

        conn = self._get_connection()
        cursor = conn.cursor()

        # Handle upsert for vec_index
        if sqlite_vec:
            cursor.execute("SELECT rowid FROM vector_items WHERE id = ?", (id,))
            existing = cursor.fetchone()
            if existing:
                cursor.execute("DELETE FROM vec_index WHERE rowid = ?", (existing["rowid"],))

        # Insert/replace main record
        cursor.execute("""
            INSERT OR REPLACE INTO vector_items (id, content, metadata, embedding, type, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (id, content, json.dumps(metadata), embedding_bytes, type, time.time()))

        # Insert into vector index
        if sqlite_vec:
            new_rowid = cursor.lastrowid
            cursor.execute(
                "INSERT INTO vec_index(rowid, embedding) VALUES (?, ?)",
                (new_rowid, embedding_bytes)
            )

        conn.commit()
        conn.close()
        logger.debug(f"Added vector: {id}")

    def add_batch(
        self,
        items: List[Dict[str, Any]],
        batch_size: int = 32
    ) -> int:
        """
        Batch add items to index.

        Args:
            items: List of dicts with id, content, metadata, type
            batch_size: Embedding batch size

        Returns:
            Number of items added
        """
        count = 0

        # Process in batches for embedding
        for i in range(0, len(items), batch_size):
            batch = items[i:i + batch_size]
            contents = [item["content"] for item in batch]

            # Batch embed
            embeddings = list(self.embedder.embed(contents))

            # Add each item
            for item, embedding in zip(batch, embeddings):
                self.add(
                    id=item["id"],
                    content=item["content"],
                    metadata=item.get("metadata", {}),
                    type=item.get("type", "chunk"),
                    embedding=list(embedding)
                )
                count += 1

        logger.info(f"Batch added {count} vectors")
        return count

    def search(
        self,
        query: str,
        top_k: int = 5,
        min_score: float = 0.0,
        type_filter: str = None
    ) -> List[SearchResult]:
        """
        Vector similarity search using HNSW.

        Args:
            query: Search query text
            top_k: Number of results
            min_score: Minimum similarity score (0-1)
            type_filter: Filter by item type

        Returns:
            List of SearchResult
        """
        # Embed query
        query_gen = self.embedder.embed([query])
        query_vector = np.array(next(query_gen), dtype=np.float32)

        conn = self._get_connection()
        cursor = conn.cursor()
        results = []

        if sqlite_vec:
            try:
                # HNSW search via sqlite-vec
                limit = top_k * 2 if type_filter else top_k

                cursor.execute("""
                    SELECT
                        vi.id,
                        vi.content,
                        vi.metadata,
                        vi.type,
                        vec.distance
                    FROM vec_index AS vec
                    JOIN vector_items AS vi ON vi.rowid = vec.rowid
                    WHERE vec.embedding MATCH ? AND k = ?
                    ORDER BY vec.distance
                """, (query_vector.tobytes(), limit))

                for row in cursor:
                    if type_filter and row["type"] != type_filter:
                        continue

                    # Convert L2 distance to cosine similarity
                    distance = row["distance"]
                    score = 1 - (distance ** 2) / 2

                    if score >= min_score:
                        raw_metadata = json.loads(row["metadata"]) if row["metadata"] else {}
                        results.append(_normalize_search_result_fields(
                            result_id=row["id"],
                            content=row["content"],
                            score=score,
                            item_type=row["type"],
                            source="vector",
                            metadata=raw_metadata,
                            loc=raw_metadata.get("loc"),
                            snapshot_query=SAMPLE_SEARCH_QUERY,
                            mode_used=None,
                        ))

                    if len(results) >= top_k:
                        break

            except Exception as e:
                logger.warning(f"HNSW search failed, using brute force: {e}")
                results = self._brute_force_search(
                    conn, query_vector, top_k, min_score, type_filter
                )
        else:
            results = self._brute_force_search(
                conn, query_vector, top_k, min_score, type_filter
            )
        conn.close()
        return results

    def _brute_force_search(
        self,
        conn: sqlite3.Connection,
        query_vector: np.ndarray,
        top_k: int,
        min_score: float,
        type_filter: str = None
    ) -> List[SearchResult]:
        """Fallback brute-force cosine similarity search."""
        cursor = conn.cursor()

        sql = "SELECT id, content, metadata, type, embedding FROM vector_items WHERE embedding IS NOT NULL"
        params = []
        if type_filter:
            sql += " AND type = ?"
            params.append(type_filter)

        cursor.execute(sql, params)

        candidates = []
        for row in cursor:
            emb = np.frombuffer(row["embedding"], dtype=np.float32)

            # Cosine similarity
            norm_q = np.linalg.norm(query_vector)
            norm_e = np.linalg.norm(emb)
            if norm_q > 0 and norm_e > 0:
                score = float(np.dot(query_vector, emb) / (norm_q * norm_e))
            else:
                score = 0.0

            if score >= min_score:
                raw_metadata = json.loads(row["metadata"]) if row["metadata"] else {}
                candidates.append(_normalize_search_result_fields(
                    result_id=row["id"],
                    content=row["content"],
                    score=score,
                    item_type=row["type"],
                    source="vector",
                    metadata=raw_metadata,
                    loc=raw_metadata.get("loc"),
                    snapshot_query=SAMPLE_SEARCH_QUERY,
                    mode_used=None,
                ))

        candidates.sort(key=lambda x: x.score, reverse=True)
        return candidates[:top_k]

    def delete(self, id: str) -> bool:
        """
        Delete item by ID.

        Returns:
            True if deleted, False if not found
        """
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT rowid FROM vector_items WHERE id = ?", (id,))
        row = cursor.fetchone()

        if row:
            if sqlite_vec:
                cursor.execute("DELETE FROM vec_index WHERE rowid = ?", (row["rowid"],))
            cursor.execute("DELETE FROM vector_items WHERE id = ?", (id,))
            conn.commit()
            conn.close()
            logger.debug(f"Deleted vector: {id}")
            return True

        conn.close()
        return False

    def save(self, path: str = None) -> str:
        """
        Save index to file (SQLite is already persistent).

        Args:
            path: Optional backup path

        Returns:
            Path to saved database
        """
        if path is None:
            return str(self.db_path)

        import shutil
        backup_path = Path(path)
        backup_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(self.db_path, backup_path)
        logger.info(f"Index saved to: {backup_path}")
        return str(backup_path)

    def load(self, path: str) -> None:
        """
        Load index from file.

        Args:
            path: Path to database file
        """
        import shutil
        source = Path(path)
        if not source.exists():
            raise FileNotFoundError(f"Index file not found: {path}")

        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, self.db_path)
        logger.info(f"Index loaded from: {path}")

    def get_stats(self) -> Dict[str, Any]:
        """Get index statistics."""
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) as count FROM vector_items")
        total = cursor.fetchone()["count"]

        cursor.execute("SELECT type, COUNT(*) as count FROM vector_items GROUP BY type")
        by_type = {row["type"]: row["count"] for row in cursor}

        conn.close()

        return {
            "total_items": total,
            "by_type": by_type,
            "dimension": self.config.dimension,
            "db_path": str(self.db_path),
            "sqlite_vec_available": sqlite_vec is not None
        }


# ============ Hybrid Search Function ============
def hybrid_search(
    index: VectorIndex,
    query: str,
    top_k: int = 5,
    vector_weight: float = 0.7,
    keyword_weight: float = 0.3,
    min_score: float = 0.0,
    type_filter: str = None,
    rrf_k: int = 60
) -> List[SearchResult]:
    """
    Hybrid search combining vector similarity and keyword matching.

    Uses Reciprocal Rank Fusion (RRF) to merge results.

    Args:
        index: VectorIndex instance
        query: Search query
        top_k: Number of results
        vector_weight: Weight for vector results (0-1)
        keyword_weight: Weight for keyword results (0-1)
        min_score: Minimum score threshold
        type_filter: Filter by item type
        rrf_k: RRF constant (default 60)

    Returns:
        List of SearchResult with combined scores
    """
    # 1. Vector search
    vector_results = index.search(
        query=query,
        top_k=top_k * 2,
        min_score=0.0,
        type_filter=type_filter
    )
    vector_result_map = {result.id: result for result in vector_results}

    # 2. Keyword search (FTS5)
    keyword_results = _keyword_search(
        index=index,
        query=query,
        top_k=top_k * 2,
        type_filter=type_filter
    )
    keyword_result_map = {result.id: result for result in keyword_results}

    # 3. RRF Fusion
    scores = {}
    metadata_map = {}

    # Process vector results
    for rank, result in enumerate(vector_results):
        doc_id = result.id
        rrf_score = vector_weight / (rrf_k + rank + 1)
        scores[doc_id] = scores.get(doc_id, 0) + rrf_score
        metadata_map[doc_id] = result

    # Process keyword results
    for rank, result in enumerate(keyword_results):
        doc_id = result.id
        rrf_score = keyword_weight / (rrf_k + rank + 1)
        scores[doc_id] = scores.get(doc_id, 0) + rrf_score
        if doc_id not in metadata_map:
            metadata_map[doc_id] = result

    # Sort by combined score
    sorted_ids = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)

    results = []
    for doc_id in sorted_ids[:top_k]:
        combined_score = scores[doc_id]
        if combined_score < min_score:
            continue

        if doc_id in vector_result_map:
            result = vector_result_map[doc_id]
        else:
            result = keyword_result_map[doc_id]

        results.append(_normalize_search_result_fields(
            result_id=result.id,
            content=result.content,
            score=combined_score,
            item_type=result.type,
            source="hybrid",
            metadata=result.metadata,
            loc=result.loc,
            snapshot_query=SAMPLE_SEARCH_QUERY,
            mode_used=None,
        ))

    return results


def _keyword_search(
    index: VectorIndex,
    query: str,
    top_k: int = 10,
    type_filter: str = None
) -> List[SearchResult]:
    """
    Keyword search using FTS5.

    Args:
        index: VectorIndex instance
        query: Search query
        top_k: Number of results
        type_filter: Filter by type

    Returns:
        List of SearchResult
    """
    conn = index._get_connection()
    cursor = conn.cursor()

    # Tokenize and build FTS query
    tokens = query.split()
    if not tokens:
        conn.close()
        return []

    # FTS5 query with OR
    fts_query = " OR ".join(f'"{t}"' for t in tokens if t.strip())

    try:
        sql = """
            SELECT
                vi.id,
                vi.content,
                vi.metadata,
                vi.type,
                bm25(vector_items_fts) as rank
            FROM vector_items_fts
            JOIN vector_items vi ON vi.id = vector_items_fts.id
            WHERE vector_items_fts MATCH ?
        """
        params = [fts_query]

        if type_filter:
            sql += " AND vi.type = ?"
            params.append(type_filter)

        sql += " ORDER BY rank LIMIT ?"
        params.append(top_k)

        cursor.execute(sql, params)

        results = []
        for row in cursor:
            # Normalize BM25 score (negative values, lower is better)
            # Convert to 0-1 range
            bm25_score = abs(row["rank"])
            normalized_score = 1.0 / (1.0 + bm25_score)

            raw_metadata = json.loads(row["metadata"]) if row["metadata"] else {}
            results.append(_normalize_search_result_fields(
                result_id=row["id"],
                content=row["content"],
                score=normalized_score,
                item_type=row["type"],
                source="keyword",
                metadata=raw_metadata,
                loc=raw_metadata.get("loc"),
                snapshot_query=SAMPLE_SEARCH_QUERY,
                mode_used=None,
            ))

        conn.close()
        return results

    except Exception as e:
        logger.warning(f"FTS search failed, using LIKE fallback: {e}")
        conn.close()
        return _like_search(index, query, top_k, type_filter)


def _like_search(
    index: VectorIndex,
    query: str,
    top_k: int,
    type_filter: str = None
) -> List[SearchResult]:
    """Fallback LIKE-based keyword search."""
    conn = index._get_connection()
    cursor = conn.cursor()

    tokens = query.split()
    if not tokens:
        conn.close()
        return []

    conditions = [f"content LIKE ?" for _ in tokens]
    params = [f"%{t}%" for t in tokens]
    where = " OR ".join(conditions)

    sql = f"SELECT id, content, metadata, type FROM vector_items WHERE ({where})"

    if type_filter:
        sql += " AND type = ?"
        params.append(type_filter)

    sql += f" LIMIT {top_k * 2}"

    cursor.execute(sql, params)

    results = []
    for row in cursor:
        # Score by token match count
        content_lower = row["content"].lower()
        match_count = sum(1 for t in tokens if t.lower() in content_lower)
        score = match_count / len(tokens) if tokens else 0

        raw_metadata = json.loads(row["metadata"]) if row["metadata"] else {}
        results.append(_normalize_search_result_fields(
            result_id=row["id"],
            content=row["content"],
            score=score,
            item_type=row["type"],
            source="keyword",
            metadata=raw_metadata,
            loc=raw_metadata.get("loc"),
            snapshot_query=SAMPLE_SEARCH_QUERY,
            mode_used=None,
        ))

    conn.close()
    results.sort(key=lambda x: x.score, reverse=True)
    return results[:top_k]


# ============ Convenience Functions ============
def create_vector_index(
    db_path: str = ".writing/vectors.db",
    dimension: int = DEFAULT_EMBEDDING_DIM,
    model_name: str = DEFAULT_MODEL_NAME
) -> VectorIndex:
    """
    Create a new vector index with HNSW configuration.

    Args:
        db_path: Database file path
        dimension: Embedding dimension (default 384)
        model_name: Embedding model name

    Returns:
        Configured VectorIndex instance
    """
    config = HNSWConfig(dimension=dimension)
    return VectorIndex(db_path=db_path, config=config, model_name=model_name)


def search_memory_vectors(
    index: VectorIndex,
    query: str,
    top_k: int = 5
) -> List[SearchResult]:
    """Search memory vectors specifically."""
    return index.search(query=query, top_k=top_k, type_filter="memory")


def search_chunk_vectors(
    index: VectorIndex,
    query: str,
    top_k: int = 5
) -> List[SearchResult]:
    """Search document chunk vectors specifically."""
    return index.search(query=query, top_k=top_k, type_filter="chunk")


def get_vector_stats(index: VectorIndex) -> Dict[str, Any]:
    """Get vector index statistics."""
    return index.get_stats()




def build_search_result_snapshot(results: List[SearchResult]) -> SearchResultSnapshot:
    return {
        "query": SAMPLE_SEARCH_QUERY,
        "results": [result.to_dict() for result in results],
    }


class VectorSearch:
    """
    Vector Search Service using sqlite-vec and fastembed.
    Supports storing and searching vectors for different types of content (memories, chunks).
    """

    def __init__(self, db_path: str, model_name: str = "BAAI/bge-small-en-v1.5"):
        self.db_path = Path(db_path)
        self.model_name = model_name
        self._embedder = None
        self._init_db()

    @property
    def embedder(self):
        """Lazy-load FastEmbed model."""
        if self._embedder is None:
            if TextEmbedding is None:
                raise ImportError("FastEmbed is required for VectorSearch. Install with `pip install fastembed`.")
            logger.info(f"Loading embedding model: {self.model_name}")
            self._embedder = TextEmbedding(model_name=self.model_name)
            # Ensure vector table exists with correct dimension
            self._init_vector_db()
        return self._embedder

    def _get_connection(self) -> sqlite3.Connection:
        """Get a SQLite connection with vector extension loaded if available."""
        if not self.db_path.parent.exists():
            self.db_path.parent.mkdir(parents=True, exist_ok=True)

        conn = sqlite3.connect(str(self.db_path))

        if sqlite_vec:
            try:
                conn.enable_load_extension(True)
                sqlite_vec.load(conn)
                conn.enable_load_extension(False)
            except Exception as e:
                logger.warning(f"Failed to load sqlite-vec extension: {e}")

        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        """Initialize SQLite database with vector tables."""
        conn = self._get_connection()
        cursor = conn.cursor()

        # Table for storing raw text and metadata
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS items (
                id TEXT PRIMARY KEY,
                content TEXT,
                metadata TEXT,  -- JSON
                embedding BLOB, -- Raw float32 bytes for backup/fallback
                type TEXT,      -- 'memory', 'chunk', etc.
                created_at REAL
            )
        """)

        conn.commit()
        conn.close()

    def _init_vector_db(self):
        """Initialize SQLite vector table with dynamic dimension."""
        if not sqlite_vec:
            return

        conn = self._get_connection()
        cursor = conn.cursor()

        # Get dimension from loaded embedder
        try:
            # Try to get dimension from loaded embedder instance
            if hasattr(self._embedder, "embedding_size"):
                dim = self._embedder.embedding_size
            else:
                # Fallback to model registry look up if possible or default
                logger.warning("Could not determine embedding size from instance, defaulting to 384")
                dim = 384
        except Exception as e:
            logger.warning(f"Error determining embedding size: {e}, defaulting to 384")
            dim = 384

        logger.debug(f"Initializing vector table with dimension: {dim}")
        cursor.execute(f"""
            CREATE VIRTUAL TABLE IF NOT EXISTS vec_items USING vec0(
                embedding float[{dim}]
            )
        """)
        conn.commit()
        conn.close()

    def upsert_vector(
        self,
        id: str,
        content: str,
        metadata: Dict[str, Any] = None,
        type: str = "chunk"
    ):
        """
        Insert or update a vector entry.
        """
        metadata = metadata or {}

        # Generate embedding
        embedding_gen = self.embedder.embed([content])
        embedding_vector = next(embedding_gen)
        embedding_bytes = np.array(embedding_vector, dtype=np.float32).tobytes()

        conn = self._get_connection()
        cursor = conn.cursor()

        # Check if item exists to handle vec_items cleanup
        if sqlite_vec:
            cursor.execute("SELECT rowid FROM items WHERE id = ?", (id,))
            row = cursor.fetchone()
            if row:
                cursor.execute("DELETE FROM vec_items WHERE rowid = ?", (row["rowid"],))

        # Insert into items
        cursor.execute(
            """
            INSERT OR REPLACE INTO items (id, content, metadata, embedding, type, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (id, content, json.dumps(metadata), embedding_bytes, type, time.time())
        )

        # Insert into vec_items
        if sqlite_vec:
            new_rowid = cursor.lastrowid
            cursor.execute(
                "INSERT INTO vec_items(rowid, embedding) VALUES (?, ?)",
                (new_rowid, embedding_bytes)
            )

        conn.commit()
        conn.close()

    def delete_vector(self, id: str):
        """
        Delete a vector entry by ID.
        """
        conn = self._get_connection()
        cursor = conn.cursor()

        # Check if item exists to handle vec_items cleanup
        cursor.execute("SELECT rowid FROM items WHERE id = ?", (id,))
        row = cursor.fetchone()

        if row:
            if sqlite_vec:
                cursor.execute("DELETE FROM vec_items WHERE rowid = ?", (row["rowid"],))

            cursor.execute("DELETE FROM items WHERE id = ?", (id,))

        conn.commit()
        conn.close()

    def search(
        self,
        query: str,
        type_filter: Optional[str] = None,
        top_k: int = 5,
        min_score: float = 0.5
    ) -> List[Dict[str, Any]]:
        """
        Search for similar items.
        """
        # Embed query
        query_gen = self.embedder.embed([query])
        query_vector = next(query_gen)
        query_array = np.array(query_vector, dtype=np.float32)

        conn = self._get_connection()
        cursor = conn.cursor()

        matches = []

        if sqlite_vec:
            try:
                # Optimized vector search
                # 1. Get similar vectors and fetch item details in a single query
                # Uses a JOIN to avoid N+1 query problem where we would fetch rowids then items
                limit = top_k * 2 if type_filter else top_k

                cursor.execute(
                    """
                    SELECT
                        items.id,
                        items.content,
                        items.metadata,
                        items.type,
                        vec.distance
                    FROM vec_items AS vec
                    JOIN items ON items.rowid = vec.rowid
                    WHERE vec.embedding MATCH ? AND k = ?
                    ORDER BY vec.distance
                    """,
                    (query_array.tobytes(), limit)
                )

                for row in cursor:
                    item_type = row["type"]
                    if type_filter and item_type != type_filter:
                        continue

                    distance = row["distance"]
                    # Convert L2 distance to cosine similarity
                    # score = 1 - (distance^2 / 2) for normalized vectors
                    score = 1 - (distance ** 2) / 2

                    if score >= min_score:
                        raw_metadata = json.loads(row["metadata"]) if row["metadata"] else {}
                        matches.append(_normalize_search_result_fields(
                            result_id=row["id"],
                            content=row["content"],
                            score=score,
                            item_type=item_type,
                            source="vector",
                            metadata=raw_metadata,
                            loc=raw_metadata.get("loc"),
                            snapshot_query=SAMPLE_SEARCH_QUERY,
                            mode_used=None,
                        ).to_dict())

                    if len(matches) >= top_k:
                        break

            except Exception as e:
                logger.error(f"Vector search error: {e}, falling back to brute force.")
                matches = self._brute_force_search(conn, query_array, type_filter, top_k, min_score)
        else:
            matches = self._brute_force_search(conn, query_array, type_filter, top_k, min_score)

        conn.close()
        return matches

    def _brute_force_search(
        self,
        conn: sqlite3.Connection,
        query_array: np.ndarray,
        type_filter: Optional[str],
        top_k: int,
        min_score: float
    ) -> List[Dict[str, Any]]:
        """Fallback brute force search using numpy."""
        cursor = conn.cursor()

        # Optimization: Fetch only necessary columns for scoring (id, embedding, type)
        # This prevents loading large content/metadata for items that will be filtered out.
        query = "SELECT id, embedding, type FROM items"
        params = []
        if type_filter:
            query += " WHERE type = ?"
            params.append(type_filter)

        cursor.execute(query, params)

        matches = []
        for row in cursor:
            if not row["embedding"]:
                continue

            emb_array = np.frombuffer(row["embedding"], dtype=np.float32)

            # Cosine similarity
            score = float(
                np.dot(query_array, emb_array) /
                (np.linalg.norm(query_array) * np.linalg.norm(emb_array))
            )

            if score >= min_score:
                matches.append({
                    "id": row["id"],
                    "score": round(score, 4),
                    "type": row["type"]
                })

        # Sort and take top_k
        matches.sort(key=lambda x: x["score"], reverse=True)
        top_matches = matches[:top_k]

        # Fetch full content and metadata only for the winners
        if top_matches:
            ids = [m["id"] for m in top_matches]
            placeholders = ",".join("?" for _ in ids)

            # Use a dictionary to map IDs to their rows for faster lookup
            cursor.execute(
                f"SELECT id, content, metadata FROM items WHERE id IN ({placeholders})",
                ids
            )

            content_map = {row["id"]: row for row in cursor}

            final_results = []
            for m in top_matches:
                if m["id"] in content_map:
                    row = content_map[m["id"]]
                    raw_metadata = json.loads(row["metadata"]) if row["metadata"] else {}
                    normalized = _normalize_search_result_fields(
                        result_id=m["id"],
                        content=row["content"],
                        score=m["score"],
                        item_type=m["type"],
                        source="vector",
                        metadata=raw_metadata,
                        loc=raw_metadata.get("loc"),
                        snapshot_query=SAMPLE_SEARCH_QUERY,
                        mode_used=None,
                    )
                    final_results.append(normalized.to_dict())

            return final_results

        return []

    def search_memory_vectors(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """Specific search for memories."""
        return self.search(query, type_filter="memory", top_k=top_k)

    def search_chunk_vectors(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """Specific search for document chunks."""
        return self.search(query, type_filter="chunk", top_k=top_k)

    # ============ Async Methods (using connection pool) ============

    async def search_async(
        self,
        query: str,
        type_filter: Optional[str] = None,
        top_k: int = 5,
        min_score: float = 0.5
    ) -> List[Dict[str, Any]]:
        """
        Async search using connection pool and query cache.

        Args:
            query: Search query
            type_filter: Filter by item type
            top_k: Number of results
            min_score: Minimum similarity score

        Returns:
            List of matching items
        """
        # Use query cache for embedding
        if get_query_cache is not None:
            cache = get_query_cache()
            query_vector = cache.get(query)
            if query_vector is None:
                query_gen = self.embedder.embed([query])
                query_vector = list(next(query_gen))
                cache.put(query, query_vector)
        else:
            query_gen = self.embedder.embed([query])
            query_vector = list(next(query_gen))

        query_array = np.array(query_vector, dtype=np.float32)

        # Use sync search for now (aiosqlite integration would require more changes)
        # Run in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None,
            lambda: self.search(query, type_filter, top_k, min_score)
        )

    async def search_memory_vectors_async(
        self,
        query: str,
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """Async search for memories."""
        return await self.search_async(query, type_filter="memory", top_k=top_k)

    async def search_chunk_vectors_async(
        self,
        query: str,
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """Async search for document chunks."""
        return await self.search_async(query, type_filter="chunk", top_k=top_k)

