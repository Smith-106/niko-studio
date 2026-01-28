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
        
        # FTS5 Entity Table for fast lookup
        try:
            cursor.execute("CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(name, entity_id UNINDEXED)")

            # Triggers to keep FTS in sync
            cursor.execute("""
                CREATE TRIGGER IF NOT EXISTS entities_ai AFTER INSERT ON entities BEGIN
                    INSERT INTO entities_fts(rowid, name, entity_id) VALUES (new.rowid, new.name, new.id);
                END;
            """)
            cursor.execute("""
                CREATE TRIGGER IF NOT EXISTS entities_ad AFTER DELETE ON entities BEGIN
                    DELETE FROM entities_fts WHERE rowid = old.rowid;
                END;
            """)
            cursor.execute("""
                CREATE TRIGGER IF NOT EXISTS entities_au AFTER UPDATE ON entities BEGIN
                    UPDATE entities_fts SET name = new.name, entity_id = new.id WHERE rowid = new.rowid;
                END;
            """)

            # Backfill if needed (if entities exists but fts is empty)
            cursor.execute("SELECT count(*) FROM entities_fts")
            if cursor.fetchone()[0] == 0:
                cursor.execute("SELECT count(*) FROM entities")
                if cursor.fetchone()[0] > 0:
                    logger.info("Backfilling entities_fts index...")
                    cursor.execute("INSERT INTO entities_fts(rowid, name, entity_id) SELECT rowid, name, id FROM entities")

        except Exception as e:
            logger.warning(f"Could not enable FTS5 optimization: {e}")

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
        conn.execute(
            "INSERT OR REPLACE INTO entities (id, name, type, description, properties, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (entity_id, name, type, desc, props_json, time.time())
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
        
        # 2. Graph Search (Simple keyword match in name/desc for now)
        # In a real Kuzu DB, this would be a Cypher query
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Find entities whose name is in the query text
        # Optimized: Use FTS5 to find candidates, then verify exact match
        try:
            # Tokenize query to create OR condition for FTS
            # Use robust cleaning (inspired by main branch) to avoid FTS syntax errors
            clean_query = re.sub(r'[^\w\s]', ' ', query_text)
            tokens = clean_query.split()

            if tokens:
                # Wrap in quotes to handle exact tokens
                fts_query = " OR ".join(f'"{t}"' for t in tokens)

                # Use FTS to find candidates (entities having at least one word from query in their name)
                # Then verify exact substring match using JOIN for performance
                query_sql = """
                    SELECT e.*
                    FROM entities e
                    JOIN entities_fts f ON e.id = f.entity_id
                    WHERE f.name MATCH ?
                    AND instr(lower(?), lower(e.name)) > 0
                """
                cursor.execute(query_sql, (fts_query, query_text))
                results["entities"] = [dict(row) for row in cursor.fetchall()]
            else:
                # Fallback if no tokens (e.g. query is all symbols)
                cursor.execute("SELECT * FROM entities WHERE instr(lower(?), lower(name)) > 0", (query_text,))
                results["entities"] = [dict(row) for row in cursor.fetchall()]

        except sqlite3.OperationalError:
            # Fallback if FTS table doesn't exist
            cursor.execute("SELECT * FROM entities WHERE instr(lower(?), lower(name)) > 0", (query_text,))
            results["entities"] = [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            # Catch other FTS errors and fallback
            logger.warning(f"FTS search failed: {e}. Falling back to scan.")
            cursor.execute("SELECT * FROM entities WHERE instr(lower(?), lower(name)) > 0", (query_text,))
            results["entities"] = [dict(row) for row in cursor.fetchall()]
                
        # If specific filters provided
        if entity_filter:
            placeholders = ','.join(['?'] * len(entity_filter))
            cursor.execute(f"SELECT * FROM entities WHERE id IN ({placeholders})", entity_filter)
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
