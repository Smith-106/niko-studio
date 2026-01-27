from dataclasses import dataclass, asdict, field
from typing import List, Optional, Dict
import time
import uuid
import json
from ..search.vector_search import VectorSearch

@dataclass
class CoreMemory:
    """
    Core Memory Structure.
    """
    id: str
    content: str
    summary: Optional[str] = None
    archived: bool = False
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    metadata: Dict = field(default_factory=dict)

class CoreMemoryStore:
    """
    Core Memory Store.
    Persists memories using VectorSearch (SQLite + Embeddings).
    """

    def __init__(self, vector_search: VectorSearch):
        self.vector_search = vector_search

    def upsert_memory(self, content: str, memory_id: Optional[str] = None, metadata: Dict = None) -> CoreMemory:
        """
        Create or update a memory.
        """
        memory_id = memory_id or str(uuid.uuid4())
        now = time.time()
        metadata = metadata or {}

        # Construct memory object (conceptual, we store flattened)
        memory = CoreMemory(
            id=memory_id,
            content=content,
            metadata=metadata,
            created_at=now,
            updated_at=now
        )

        # Store in VectorSearch
        # We store the full memory object properties in metadata for retrieval
        store_metadata = {
            "summary": memory.summary,
            "archived": memory.archived,
            "created_at": memory.created_at,
            "updated_at": memory.updated_at,
            "extra": metadata
        }

        self.vector_search.upsert_vector(
            id=memory_id,
            content=content,
            metadata=store_metadata,
            type="memory"
        )

        return memory

    def get_memory(self, memory_id: str) -> Optional[CoreMemory]:
        """
        Retrieve a memory by ID.
        """
        # We need to access DB for direct retrieval by ID since VectorSearch
        # is optimized for search, but it's backed by SQLite items table.
        # We can use the connection from vector_search cleanly.
        with self.vector_search._get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute(
                "SELECT id, content, metadata FROM items WHERE id = ? AND type = 'memory'",
                (memory_id,)
            )
            row = cursor.fetchone()
        

        if row:
            meta = json.loads(row["metadata"])
            return CoreMemory(
                id=row["id"],
                content=row["content"],
                summary=meta.get("summary"),
                archived=meta.get("archived", False),
                created_at=meta.get("created_at", 0),
                updated_at=meta.get("updated_at", 0),
                metadata=meta.get("extra", {})
            )
        return None

    def search_memories(self, query: str, top_k: int = 5) -> List[CoreMemory]:
        """
        Semantic search for memories.
        """
        results = self.vector_search.search_memory_vectors(query, top_k=top_k)
        memories = []
        for res in results:
            meta = res["metadata"]
            memories.append(CoreMemory(
                id=res["id"],
                content=res["content"],
                summary=meta.get("summary"),
                archived=meta.get("archived", False),
                created_at=meta.get("created_at", 0),
                updated_at=meta.get("updated_at", 0),
                metadata=meta.get("extra", {})
            ))
        return memories

    def archive_memory(self, memory_id: str):
        """
        Archive a memory (soft delete).
        """
        memory = self.get_memory(memory_id)
        if memory:
            memory.archived = True
            memory.updated_at = time.time()
            # Re-upsert with updated metadata
            # Note: This regenerates embedding, which is fine
            self.upsert_memory(memory.content, memory.id, memory.metadata)

    def delete_memory(self, memory_id: str):
        """
        Hard delete a memory.
        """
        self.vector_search.delete_vector(memory_id)
