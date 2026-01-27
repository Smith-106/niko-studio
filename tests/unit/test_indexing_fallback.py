import pytest
import shutil
import tempfile
import sys
import os
from pathlib import Path
import numpy as np

# Fix path: tests/unit/ -> ../../src
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../src')))

try:
    import pysqlite3 as sqlite3
except ImportError:
    import sqlite3
import sqlite_vec

from services.indexing_service import IndexingService

class MockEmbedding:
    def __init__(self, model_name="BAAI/bge-small-en-v1.5", **kwargs):
        self.model_name = model_name

    def embed(self, documents):
        for doc in documents:
            seed = sum(ord(c) for c in doc) % 2**32
            rng = np.random.RandomState(seed)
            vec = rng.rand(384).astype(np.float32)
            vec = vec / np.linalg.norm(vec)
            yield vec

@pytest.fixture
def mock_embedding(monkeypatch):
    import services.indexing_service
    monkeypatch.setattr(services.indexing_service, "TextEmbedding", MockEmbedding)

def test_fallback_on_vector_failure(mock_embedding):
    temp_dir = tempfile.mkdtemp()
    db_path = Path(temp_dir) / "test_fallback.db"

    try:
        service = IndexingService(str(db_path))

        # Add doc
        content = "Hello world"
        service.add_document("1", content, "test")

        # Manually break the vector table
        conn = sqlite3.connect(str(db_path))
        conn.enable_load_extension(True)
        sqlite_vec.load(conn)
        conn.enable_load_extension(False)

        conn.execute("DROP TABLE vec_document_chunks")
        conn.commit()
        conn.close()

        # Search should still work via fallback
        # Using exact content to ensure match with our deterministic random mock
        results = service.search(content, top_k=1)

        assert len(results) == 1
        assert results[0]["id"] == "1"

    finally:
        shutil.rmtree(temp_dir)
