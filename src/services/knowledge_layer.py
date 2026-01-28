import sqlite3
import logging
import json
import time
import re
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from .indexing_service import IndexingService

logger = logging.getLogger("KnowledgeLayer")

class AgentKnowledgeLayer:
    """
    Unified Knowledge Layer inspired by OpenKL.
    Combines Vector Search (via IndexingService) with Graph capabilities (SQLite-based Entity/Relation store).
    Acts as the "Hippocampus" for the Agent System.
    """

    def __init__(self, db_path: str):
        self.db_path = Path(db_path)
        self.vector_store = IndexingService(db_path) # Reuses the vector implementation
        self._init_graph_schema()

    def _init_graph_schema(self):
        """Initialize Graph tables in the same SQLite DB as Vector store."""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        # Entity Table (OpenKL style)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS entities (
                id TEXT PRIMARY KEY,
                name TEXT,
                type TEXT,
                description TEXT,
                properties TEXT, -- JSON
                created_at REAL
            )
        """)
        
        # Relation Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS relations (
                id TEXT PRIMARY KEY,
                source_id TEXT,
                target_id TEXT,
                type TEXT,
                properties TEXT, -- JSON
                created_at REAL,
                FOREIGN KEY(source_id) REFERENCES entities(id),
                FOREIGN KEY(target_id) REFERENCES entities(id)
            )
        """)
        
        # Provenance: Link Entities back to Source Documents (Chunks)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS provenance (
                entity_id TEXT,
                chunk_id TEXT,
                FOREIGN KEY(entity_id) REFERENCES entities(id),
                FOREIGN KEY(chunk_id) REFERENCES document_chunks(id)
            )
        """)

        # FTS Index for Entities
        # We store id as UNINDEXED column to retrieve it without joining
        cursor.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(name, id UNINDEXED, tokenize='unicode61')
        """)
        
        # Migration: Populate FTS if empty but entities exist
        try:
            cursor.execute("SELECT count(*) FROM entities")
            ent_row = cursor.fetchone()
            ent_count = ent_row[0] if ent_row else 0

            cursor.execute("SELECT count(*) FROM entities_fts")
            fts_row = cursor.fetchone()
            fts_count = fts_row[0] if fts_row else 0

            if ent_count > 0 and fts_count == 0:
                logger.info("Populating entities_fts from entities table...")
                cursor.execute("INSERT INTO entities_fts(name, id) SELECT name, id FROM entities")
        except Exception as e:
            logger.warning(f"Failed to populate FTS (schema might be initializing): {e}")

        conn.commit()
        conn.close()

    def add_document(self, doc_id: str, content: str, source_type: str = "general"):
        """
        Ingest a document:
        1. Store content & embedding in Vector Store.
        2. (Optional Future) Trigger Graph Extraction to autopopulate entities.
        """
        # 1. Vector Store via IndexingService
        self.vector_store.add_document(doc_id, content, source_type)
        logger.info(f"Ingested document {doc_id} into unified store.")

    def add_entity(self, entity_id: str, name: str, type: str, desc: str = "", props: Dict = None):
        """Add node to Knowledge Graph"""
        props_json = json.dumps(props or {})
        conn = sqlite3.connect(str(self.db_path))

        # Update main table
        conn.execute(
            "INSERT OR REPLACE INTO entities (id, name, type, description, properties, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (entity_id, name, type, desc, props_json, time.time())
        )

        # Update FTS (Append-only strategy for simplicity and performance)
        # We just insert the new name mapping. Query logic handles duplicates.
        conn.execute(
            "INSERT INTO entities_fts (name, id) VALUES (?, ?)",
            (name, entity_id)
        )

        conn.commit()
        conn.close()

    def add_relation(self, src: str, tgt: str, rel_type: str, props: Dict = None):
        """Add edge to Knowledge Graph"""
        rel_id = f"{src}-{rel_type}-{tgt}"
        props_json = json.dumps(props or {})
        conn = sqlite3.connect(str(self.db_path))
        conn.execute(
            "INSERT OR REPLACE INTO relations (id, source_id, target_id, type, properties, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (rel_id, src, tgt, rel_type, props_json, time.time())
        )
        conn.commit()
        conn.close()

    def query_hybrid(self, query_text: str, entity_filter: List[str] = None, top_k: int = 5):
        """
        Hybrid Search:
        1. Semantic Search for relevant chunks.
        2. Graph Search for entities mentioned in query (simple lookup for now).
        """
        results = {
            "chunks": [],
            "entities": []
        }
        
        # 1. Vector Search
        results["chunks"] = self.vector_store.search(query_text, top_k=top_k)
        
        # 2. Graph Search optimized with FTS
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Extract potential tokens from query
        # Remove special characters to avoid FTS syntax errors
        clean_query = re.sub(r'[^\w\s]', ' ', query_text)
        tokens = clean_query.split()

        candidate_ids = set()

        # Find candidates via FTS
        if tokens:
            # Construct OR query for FTS
            # wrap in quotes to handle keywords/spaces if any, and replace internal quotes
            fts_terms = [f'"{t.replace('"', '""')}"' for t in tokens if t.strip()]
            if fts_terms:
                fts_query = " OR ".join(fts_terms)
                try:
                    # Limit candidates to avoid massive fetch if query has common words
                    # 500 should be enough for "entities mentioned in query"
                    cursor.execute("SELECT id, name FROM entities_fts WHERE entities_fts MATCH ? LIMIT 500", (fts_query,))

                    query_lower = query_text.lower()

                    for row in cursor.fetchall():
                        # Verification step: Strict substring check
                        # This preserves original behavior (mostly) and filters FTS false positives (e.g. "Apple" matches "Big Apple", but verify "Big Apple" in "I like Apple" -> False)
                        if row['name'].lower() in query_lower:
                            candidate_ids.add(row['id'])
                except Exception as e:
                    logger.warning(f"FTS search failed: {e}. Falling back to scan.")
                    # Fallback to full scan if FTS fails
                    cursor.execute("SELECT * FROM entities WHERE instr(lower(?), lower(name)) > 0", (query_text,))
                    results["entities"] = [dict(row) for row in cursor.fetchall()]
                    conn.close()
                    return results

        # Fetch full entities for candidates
        if candidate_ids:
            placeholders = ','.join(['?'] * len(candidate_ids))
            cursor.execute(f"SELECT * FROM entities WHERE id IN ({placeholders})", list(candidate_ids))
            entities = [dict(r) for r in cursor.fetchall()]
            results["entities"] = entities

        # If specific filters provided (append them if not already found)
        if entity_filter:
            # Check if any filtered entities are missing from results
            existing_ids = {e['id'] for e in results["entities"]}
            missing_ids = [eid for eid in entity_filter if eid not in existing_ids]

            if missing_ids:
                placeholders = ','.join(['?'] * len(missing_ids))
                cursor.execute(f"SELECT * FROM entities WHERE id IN ({placeholders})", missing_ids)
                filtered_entities = [dict(r) for r in cursor.fetchall()]
                results["entities"].extend(filtered_entities)

        conn.close()
        return results

    def get_neighbors(self, entity_id: str) -> List[Dict]:
        """Get 1-hop neighbors from graph."""
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT r.type as rel_type, e.name as target_name, e.type as target_type, e.description
            FROM relations r
            JOIN entities e ON r.target_id = e.id
            WHERE r.source_id = ?
        """, (entity_id,))
        
        neighbors = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return neighbors
