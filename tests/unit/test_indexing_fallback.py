import pytest
import shutil
import tempfile
import sys
import os
from pathlib import Path

# Fix path: tests/unit/ -> ../../src
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../src')))

try:
    import pysqlite3 as sqlite3
except ImportError:
    import sqlite3
import sqlite_vec

from services.indexing_service import IndexingService

def test_fallback_on_vector_failure():
    temp_dir = tempfile.mkdtemp()
    db_path = Path(temp_dir) / "test_fallback.db"

    try:
        service = IndexingService(str(db_path))

        # Add doc
        service.add_document("1", "Hello world", "test")

        # Manually break the vector table
        conn = sqlite3.connect(str(db_path))
        # Must load extension to interact with virtual table (even to drop it)
        conn.enable_load_extension(True)
        sqlite_vec.load(conn)
        conn.enable_load_extension(False)

        conn.execute("DROP TABLE vec_document_chunks")
        conn.commit()
        conn.close()

        # Search should still work via fallback
        results = service.search("Hello", top_k=1)

        assert len(results) == 1
        assert results[0]["id"] == "1"

    finally:
        shutil.rmtree(temp_dir)
