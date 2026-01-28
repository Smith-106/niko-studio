import logging
import time
import json
import sqlite3
import numpy as np
from pathlib import Path
from typing import List, Dict, Any, Optional, Union

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

logger = logging.getLogger(__name__)

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
                        matches.append({
                            "id": row["id"],
                            "content": row["content"],
                            "metadata": json.loads(row["metadata"]),
                            "type": item_type,
                            "score": round(float(score), 4)
                        })

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
                    m["content"] = row["content"]
                    m["metadata"] = json.loads(row["metadata"])
                    final_results.append(m)

            return final_results

        return []

    def search_memory_vectors(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """Specific search for memories."""
        return self.search(query, type_filter="memory", top_k=top_k)

    def search_chunk_vectors(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """Specific search for document chunks."""
        return self.search(query, type_filter="chunk", top_k=top_k)
