try:
    import pysqlite3 as sqlite3
except ImportError:
    import sqlite3
import json
import time
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import numpy as np

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("IndexingService")

try:
    from fastembed import TextEmbedding
except ImportError:
    logger.warning("FastEmbed not installed. Install with `pip install fastembed`.")
    TextEmbedding = None

try:
    import sqlite_vec
    logger.info("sqlite-vec module imported successfully.")
except ImportError:
    sqlite_vec = None
    logger.warning("sqlite-vec not installed. Vector search optimization disabled.")

class IndexingService:
    """
    Semantic Search Service based on Claude Code Workflow's CodexLens architecture.
    Uses FastEmbed for embeddings and SQLite for vector storage (as BLOBs).
    """

    def __init__(self, db_path: str, model_name: str = "BAAI/bge-small-en-v1.5"):
        self.db_path = Path(db_path)
        self.model_name = model_name
        self._embedder = None
        self._init_db()

    def _init_db(self):
        """Initialize SQLite database with vector storage schema."""
        if not self.db_path.parent.exists():
            self.db_path.parent.mkdir(parents=True, exist_ok=True)

        conn = sqlite3.connect(str(self.db_path))

        # Load vector extension if available
        if sqlite_vec:
            try:
                conn.enable_load_extension(True)
                sqlite_vec.load(conn)
                conn.enable_load_extension(False)
                logger.debug("sqlite-vec extension loaded in SQLite connection.")
            except Exception as e:
                logger.error(f"Failed to load sqlite-vec extension: {e}")

        cursor = conn.cursor()
        
        # Schema adaptation from CCW memory_embedder.py
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS document_chunks (
                id TEXT PRIMARY KEY,
                source_id TEXT,
                source_type TEXT,
                content TEXT,
                embedding BLOB,
                created_at REAL
            )
        """)

        conn.commit()
        conn.close()

    def _init_vector_db(self):
        """Initialize SQLite vector table with dynamic dimension."""
        if not sqlite_vec:
            return

        conn = sqlite3.connect(str(self.db_path))
        try:
            conn.enable_load_extension(True)
            sqlite_vec.load(conn)
            conn.enable_load_extension(False)
        except Exception as e:
            logger.error(f"Failed to load sqlite-vec extension: {e}")
            conn.close()
            return

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
            CREATE VIRTUAL TABLE IF NOT EXISTS vec_document_chunks USING vec0(
                embedding float[{dim}]
            )
        """)
        conn.commit()
        conn.close()

    @property
    def embedder(self):
        """Lazy-load FastEmbed model."""
        if self._embedder is None:
            if TextEmbedding is None:
                raise ImportError("FastEmbed is required for Semantic Search.")
            logger.info(f"Loading embedding model: {self.model_name}")
            self._embedder = TextEmbedding(model_name=self.model_name)
            # Ensure vector table exists with correct dimension
            self._init_vector_db()
        return self._embedder

    def add_document(self, doc_id: str, content: str, source_type: str = "general"):
        """
        Embed and store a document chunk.
        
        Args:
            doc_id: Unique identifier for the chunk.
            content: The text content to embed.
            source_type: Category of the document (e.g., 'scene', 'character', 'plot').
        """
        start_time = time.time()
        
        # Generate embedding
        # FastEmbed returns a generator, consume it to get the vector
        embedding_gen = self.embedder.embed([content])
        embedding_vector = next(embedding_gen) # Get first item
        
        # Convert to float32 bytes for storage
        embedding_bytes = np.array(embedding_vector, dtype=np.float32).tobytes()

        # Store in DB
        conn = sqlite3.connect(str(self.db_path))
        if sqlite_vec:
            conn.enable_load_extension(True)
            sqlite_vec.load(conn)
            conn.enable_load_extension(False)

        cursor = conn.cursor()

        # Clean up old vector if it exists (for sync)
        if sqlite_vec:
            cursor.execute("SELECT rowid FROM document_chunks WHERE id = ?", (doc_id,))
            row = cursor.fetchone()
            if row:
                cursor.execute("DELETE FROM vec_document_chunks WHERE rowid = ?", (row[0],))

        cursor.execute(
            """
            INSERT OR REPLACE INTO document_chunks (id, source_id, source_type, content, embedding, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (doc_id, doc_id, source_type, content, embedding_bytes, time.time())
        )

        # Insert into vector table
        if sqlite_vec:
            try:
                new_rowid = cursor.lastrowid
                cursor.execute(
                    "INSERT INTO vec_document_chunks(rowid, embedding) VALUES (?, ?)",
                    (new_rowid, embedding_bytes)
                )
            except Exception as e:
                logger.error(f"Failed to index vector for document {doc_id}: {e}")

        conn.commit()
        conn.close()
        
        logger.info(f"Indexed document {doc_id} in {time.time() - start_time:.4f}s")

    def search(self, query: str, top_k: int = 5, min_score: float = 0.5) -> List[Dict[str, Any]]:
        """
        Perform semantic search using cosine similarity.
        
        Args:
            query: The search text.
            top_k: Number of results to return.
            min_score: Minimum similarity threshold (0-1).
            
        Returns:
            List of matches with content and score.
        """
        if not self.db_path.exists():
            return []

        # Embed query
        query_gen = self.embedder.embed([query])
        query_vector = next(query_gen)
        query_array = np.array(query_vector, dtype=np.float32)

        # Retrieve candidates
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        
        if sqlite_vec:
            conn.enable_load_extension(True)
            sqlite_vec.load(conn)
            conn.enable_load_extension(False)

        cursor = conn.cursor()
        
        matches = []
        vector_search_success = False

        if sqlite_vec:
            # Use vector search
            try:
                cursor.execute(
                    """
                    SELECT rowid, distance
                    FROM vec_document_chunks
                    WHERE embedding MATCH ?
                    ORDER BY distance
                    LIMIT ?
                    """,
                    (query_array.tobytes(), top_k)
                )
                vec_results = cursor.fetchall()

                for rowid, distance in vec_results:
                    # Retrieve metadata
                    cursor.execute("SELECT id, content, source_type FROM document_chunks WHERE rowid = ?", (rowid,))
                    doc_row = cursor.fetchone()

                    if doc_row:
                        # Convert L2 distance to cosine similarity score
                        # For normalized vectors: score = 1 - (distance^2 / 2)
                        score = 1 - (distance ** 2) / 2

                        if score >= min_score:
                            matches.append({
                                "id": doc_row["id"],
                                "content": doc_row["content"],
                                "source_type": doc_row["source_type"],
                                "score": round(float(score), 4)
                            })

                vector_search_success = True
                logger.debug("Successfully performed optimized vector search.")

            except Exception as e:
                logger.error(f"Vector search failed, falling back to brute-force: {e}")
                vector_search_success = False

        if not vector_search_success:
            logger.info("Performing brute-force search (fallback).")
            cursor.execute("SELECT id, content, source_type, embedding FROM document_chunks WHERE embedding IS NOT NULL")
            
            for row in cursor:
                emb_bytes = row["embedding"]
                emb_array = np.frombuffer(emb_bytes, dtype=np.float32)

                # Cosine similarity
                score = float(
                    np.dot(query_array, emb_array) /
                    (np.linalg.norm(query_array) * np.linalg.norm(emb_array))
                )

                if score >= min_score:
                    matches.append({
                        "id": row["id"],
                        "content": row["content"],
                        "source_type": row["source_type"],
                        "score": round(score, 4)
                    })
            
            # Sort and limit for brute-force
            matches.sort(key=lambda x: x["score"], reverse=True)
            matches = matches[:top_k]
        
        conn.close()
        return matches
