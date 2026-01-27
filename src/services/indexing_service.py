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

    @property
    def embedder(self):
        """Lazy-load FastEmbed model."""
        if self._embedder is None:
            if TextEmbedding is None:
                raise ImportError("FastEmbed is required for Semantic Search.")
            logger.info(f"Loading embedding model: {self.model_name}")
            self._embedder = TextEmbedding(model_name=self.model_name)
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
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT OR REPLACE INTO document_chunks (id, source_id, source_type, content, embedding, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (doc_id, doc_id, source_type, content, embedding_bytes, time.time())
        )
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

        # Retrieve candidates from DB
        # TODO: optimization - use vector extension if available, currently brute-force in memory for simplicity
        # This matches CCW's robust fallback implementation
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("SELECT id, content, source_type, embedding FROM document_chunks WHERE embedding IS NOT NULL")
        
        matches = []
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
        
        conn.close()
        
        # Sort and limit
        matches.sort(key=lambda x: x["score"], reverse=True)
        return matches[:top_k]
