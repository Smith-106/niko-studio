import sys
import os
import logging
import numpy as np
import shutil
from pathlib import Path

# Add src to path
sys.path.append(os.path.abspath("src"))

# Patch dependencies before import
try:
    import pysqlite3 as sqlite3
except ImportError:
    import sqlite3

# Mock TextEmbedding
class MockEmbedding:
    def __init__(self, model_name="BAAI/bge-small-en-v1.5", **kwargs):
        pass

    def embed(self, documents):
        for _ in documents:
            vec = np.random.rand(384).astype(np.float32)
            vec = vec / np.linalg.norm(vec)
            yield vec

from services import indexing_service
indexing_service.TextEmbedding = MockEmbedding

from services.indexing_service import IndexingService

def main():
    # Force log level
    logger = logging.getLogger("IndexingService")
    logger.setLevel(logging.DEBUG)
    # Also set root logger to handle output
    logging.getLogger().setLevel(logging.DEBUG)

    db_path = Path("test_verify.db")
    if db_path.exists():
        os.remove(db_path)

    try:
        service = IndexingService(str(db_path))

        print("\n--- Adding Document ---")
        service.add_document("1", "Hello world", "test")

        print("\n--- Searching Document ---")
        results = service.search("Hello", top_k=1)

        print("\n--- Results ---")
        print(results)

        # Verify table existence
        conn = sqlite3.connect(str(db_path))

        import sqlite_vec
        conn.enable_load_extension(True)
        sqlite_vec.load(conn)
        conn.enable_load_extension(False)

        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='vec_document_chunks'")
        if cursor.fetchone():
            print("\nSUCCESS: 'vec_document_chunks' virtual table exists.")
        else:
            print("\nFAILURE: 'vec_document_chunks' virtual table missing.")
        conn.close()

    finally:
        if db_path.exists():
            os.remove(db_path)

if __name__ == "__main__":
    main()
