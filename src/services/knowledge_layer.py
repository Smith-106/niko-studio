import sqlite3
import logging
import json
import time
import re
import hashlib
import threading
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple, Callable
from .indexing_service import IndexingService

logger = logging.getLogger("KnowledgeLayer")

# File sync imports
try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler, FileSystemEvent
    WATCHDOG_AVAILABLE = True
except ImportError:
    WATCHDOG_AVAILABLE = False
    logger.warning("watchdog not installed. File sync disabled.")

class AgentKnowledgeLayer:
    """
    Unified Knowledge Layer inspired by OpenKL.
    Combines Vector Search (via IndexingService) with Graph capabilities (SQLite-based Entity/Relation store).
    Acts as the "Hippocampus" for the Agent System.
    """

    def __init__(self, db_path: str):
        self.db_path = Path(db_path)
        self.vector_store = IndexingService(db_path)  # Reuses the vector implementation
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
        cursor.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts 
            USING fts5(name, entity_id UNINDEXED, tokenize='unicode61')
        """)
        
        # Triggers to keep FTS in sync
        cursor.execute("""
            CREATE TRIGGER IF NOT EXISTS entities_ai AFTER INSERT ON entities BEGIN
                INSERT INTO entities_fts(name, entity_id) VALUES (new.name, new.id);
            END;
        """)
        cursor.execute("""
            CREATE TRIGGER IF NOT EXISTS entities_ad AFTER DELETE ON entities BEGIN
                DELETE FROM entities_fts WHERE entity_id = old.id;
            END;
        """)
        cursor.execute("""
            CREATE TRIGGER IF NOT EXISTS entities_au AFTER UPDATE ON entities BEGIN
                UPDATE entities_fts SET name = new.name WHERE entity_id = old.id;
            END;
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

        # Backfill FTS if needed (if entities exists but fts is empty)
        try:
            cursor.execute("SELECT count(*) FROM entities")
            ent_row = cursor.fetchone()
            ent_count = ent_row[0] if ent_row else 0

            cursor.execute("SELECT count(*) FROM entities_fts")
            fts_row = cursor.fetchone()
            fts_count = fts_row[0] if fts_row else 0

            if ent_count > 0 and fts_count == 0:
                logger.info("Backfilling entities_fts index...")
                cursor.execute("""
                    INSERT INTO entities_fts(name, entity_id) 
                    SELECT name, id FROM entities
                """)
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

        # Update main table (triggers will handle FTS sync)
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
        2. Graph Search for entities mentioned in query (optimized with FTS).
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
        
        # Clean query to avoid FTS syntax errors
        clean_query = re.sub(r'[^\w\s]', ' ', query_text)
        tokens = [t.strip() for t in clean_query.split() if t.strip()]
        
        if tokens:
            try:
                # Construct FTS query with proper escaping
                fts_terms = []
                for t in tokens:
                    escaped_term = t.replace('"', '""')
                    fts_terms.append(f'"{escaped_term}"')
                fts_query = " OR ".join(fts_terms)
                
                # Use FTS to find candidates, then verify with SQL substring match
                # This approach is more efficient for large datasets
                query_sql = """
                    SELECT DISTINCT e.*
                    FROM entities e
                    JOIN entities_fts f ON e.id = f.entity_id
                    WHERE f.name MATCH ?
                    AND instr(lower(?), lower(e.name)) > 0
                    LIMIT 500
                """
                cursor.execute(query_sql, (fts_query, query_text))
                results["entities"] = [dict(row) for row in cursor.fetchall()]
                
            except sqlite3.OperationalError as e:
                # Fallback if FTS table doesn't exist or query is malformed
                logger.warning(f"FTS search failed: {e}. Falling back to full scan.")
                cursor.execute(
                    "SELECT * FROM entities WHERE instr(lower(?), lower(name)) > 0",
                    (query_text,)
                )
                results["entities"] = [dict(row) for row in cursor.fetchall()]
                
        else:
            # No valid tokens, fallback to substring search
            cursor.execute(
                "SELECT * FROM entities WHERE instr(lower(?), lower(name)) > 0",
                (query_text,)
            )
            results["entities"] = [dict(row) for row in cursor.fetchall()]
        
        # Apply entity filters if provided
        if entity_filter:
            existing_ids = {e['id'] for e in results["entities"]}
            missing_ids = [eid for eid in entity_filter if eid not in existing_ids]
            
            if missing_ids:
                placeholders = ','.join(['?'] * len(missing_ids))
                cursor.execute(
                    f"SELECT * FROM entities WHERE id IN ({placeholders})",
                    missing_ids
                )
                results["entities"].extend([dict(r) for r in cursor.fetchall()])
        
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

    # ========== File Sync Integration ==========

    def sync_file(self, file_path: str, force: bool = False) -> Dict[str, Any]:
        """
        Sync a file to the knowledge layer.

        Detects file changes, updates index, and syncs to memories/citations.

        Args:
            file_path: Path to file to sync.
            force: Force sync even if file unchanged.

        Returns:
            Dict with sync result: {success, action, message, content_hash}
        """
        path = Path(file_path)

        if not path.exists():
            logger.warning(f"File does not exist: {file_path}")
            return {"success": False, "action": "error", "message": "File not found"}

        try:
            # Read content
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Compute hash for change detection
            content_hash = hashlib.sha256(content.encode('utf-8')).hexdigest()

            # Generate doc_id from path
            doc_id = hashlib.md5(str(path.resolve()).encode()).hexdigest()[:16]

            # Determine source type based on path
            path_str = str(path).lower()
            if "citations" in path_str:
                source_type = "citation"
            elif "memories" in path_str:
                source_type = "memory"
            else:
                source_type = "document"

            # Add to vector store
            self.add_document(doc_id, content, source_type=source_type)

            logger.info(f"Synced file to knowledge layer: {file_path} (type={source_type})")

            return {
                "success": True,
                "action": "synced",
                "message": f"Synced as {source_type}",
                "content_hash": content_hash,
                "doc_id": doc_id
            }

        except Exception as e:
            logger.error(f"Failed to sync file {file_path}: {e}")
            return {"success": False, "action": "error", "message": str(e)}

    def create_file_watcher(self, watch_dirs: List[str] = None) -> 'FileWatcher':
        """
        Create a FileWatcher configured to sync to this knowledge layer.

        Args:
            watch_dirs: Directories to watch (default: .writing subdirs)

        Returns:
            Configured FileWatcher instance
        """
        if not WATCHDOG_AVAILABLE:
            raise ImportError("watchdog not installed. Run: pip install watchdog")

        from .file_sync import FileWatcher

        watcher = FileWatcher(patterns=["*.md", "*.txt", "*.json"])

        # Register sync callback
        def on_change(event):
            if event.event_type != "deleted":
                self.sync_file(event.path)

        watcher.on_change(on_change)

        # Start watching directories
        if watch_dirs:
            for dir_path in watch_dirs:
                watcher.watch(dir_path)

        return watcher

    def sync_directory(self, directory: str, patterns: List[str] = None) -> List[Dict[str, Any]]:
        """
        Sync all matching files in a directory.

        Args:
            directory: Directory path to sync.
            patterns: File patterns (default: ["*.md", "*.txt"])

        Returns:
            List of sync results for each file.
        """
        patterns = patterns or ["*.md", "*.txt", "*.json"]
        results = []
        dir_path = Path(directory)

        if not dir_path.exists():
            logger.warning(f"Directory does not exist: {directory}")
            return results

        for pattern in patterns:
            for file_path in dir_path.rglob(pattern):
                if file_path.is_file():
                    result = self.sync_file(str(file_path))
                    result["path"] = str(file_path)
                    results.append(result)

        logger.info(f"Directory sync complete: {len(results)} files")
        return results
