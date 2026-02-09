import pytest
import shutil
import tempfile
import os
from pathlib import Path
import sys
import numpy as np
from unittest.mock import MagicMock, patch
import sqlite3

# Ensure src is in path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../src')))

from services.indexing_service import IndexingService
import services.indexing_service

class MockEmbedding:
    def __init__(self, model_name="BAAI/bge-small-en-v1.5", **kwargs):
        self.model_name = model_name

    def embed(self, documents):
        for doc in documents:
            # Deterministic pseudo-random vector based on content
            seed = sum(ord(c) for c in doc) % 2**32
            rng = np.random.RandomState(seed)
            vec = rng.rand(384).astype(np.float32)
            # Normalize
            vec = vec / np.linalg.norm(vec)
            yield vec

@pytest.fixture
def mock_embedding(monkeypatch):
    # Patch the class in the module where it is used
    monkeypatch.setattr(services.indexing_service, "TextEmbedding", MockEmbedding)

@pytest.fixture
def test_db_path():
    # Create a temp dir
    temp_dir = tempfile.mkdtemp()
    db_path = Path(temp_dir) / "test_index.db"
    yield db_path
    # Cleanup
    shutil.rmtree(temp_dir)

def test_indexing_and_search(test_db_path, mock_embedding):
    service = IndexingService(str(test_db_path))

    docs = [
        ("1", "The quick brown fox jumps over the lazy dog.", "test"),
        ("2", "A fast dark animal leaps over a sleepy canine.", "test"),
        ("3", "Python is a popular programming language.", "code"),
        ("4", "Machine learning involves vector embeddings.", "ai")
    ]

    for doc_id, content, source_type in docs:
        service.add_document(doc_id, content, source_type)

    results = service.search("The quick brown fox jumps over the lazy dog.", top_k=2)

    assert len(results) >= 1
    assert results[0]['id'] == "1"
    assert results[0]['score'] > 0.9

def test_search_optimized_path(test_db_path, mock_embedding, monkeypatch):
    # Mock sqlite_vec being present
    mock_vec_module = MagicMock()
    monkeypatch.setattr(services.indexing_service, "sqlite_vec", mock_vec_module)

    original_connect = services.indexing_service.sqlite3.connect

    class MockCursor:
        def __init__(self, real_cursor):
            self.real_cursor = real_cursor
            self.last_query = ""

        def execute(self, sql, params=()):
            self.last_query = sql
            # Ignore virtual table creation and vector insertion/search
            if "FROM vec_document_chunks" in sql:
                return self
            elif "CREATE VIRTUAL TABLE" in sql and "vec0" in sql:
                return self
            elif "INSERT INTO vec_document_chunks" in sql:
                return self
            return self.real_cursor.execute(sql, params)

        def __iter__(self):
            if "FROM vec_document_chunks" in self.last_query:
                # Simulate the result of the JOIN query
                # SELECT doc.id, doc.content, doc.source_type, vec.distance
                # Return docs in specific order: 3, 1, 2
                yield {"id": "3", "content": "Doc Three", "source_type": "type3", "distance": 0.1}
                yield {"id": "1", "content": "Doc One", "source_type": "type1", "distance": 0.2}
                yield {"id": "2", "content": "Doc Two", "source_type": "type2", "distance": 0.3}
            else:
                yield from self.real_cursor

        def fetchall(self):
            if "FROM vec_document_chunks" in self.last_query:
                return list(self)
            return self.real_cursor.fetchall()

        def fetchone(self):
            return self.real_cursor.fetchone()

        @property
        def lastrowid(self):
            return self.real_cursor.lastrowid

        def __getattr__(self, name):
            return getattr(self.real_cursor, name)

    class MockConnection:
        def __init__(self, real_conn):
            self.real_conn = real_conn
            self.row_factory = None

        def cursor(self):
            self.real_conn.row_factory = self.row_factory
            return MockCursor(self.real_conn.cursor())

        def enable_load_extension(self, enabled):
            pass

        def close(self):
            self.real_conn.close()

        def commit(self):
            self.real_conn.commit()

        def __getattr__(self, name):
            return getattr(self.real_conn, name)

    def side_effect_connect(db_path, **kwargs):
        real_conn = original_connect(db_path, **kwargs)
        return MockConnection(real_conn)

    # Patch connect for the entire duration of the test
    with patch.object(services.indexing_service.sqlite3, 'connect', side_effect=side_effect_connect):
        # Initialize service
        service = IndexingService(str(test_db_path))

        # Manually populate document_chunks using standard sqlite3 (bypassing the patch or using it)
        # If we use sqlite3.connect directly (not the one in services.indexing_service), we get a real connection.
        # But we need to use the SAME database file.
        # And we need to make sure the table exists. IndexingService init should have created it
        # (MockCursor allows real_cursor.execute for non-vec queries).

        conn = sqlite3.connect(str(test_db_path))
        cursor = conn.cursor()

        docs = [
            ("1", "Doc One", "type1"),
            ("2", "Doc Two", "type2"),
            ("3", "Doc Three", "type3"),
        ]

        for doc_id, content, stype in docs:
            embedding = np.random.rand(384).astype(np.float32).tobytes()
            cursor.execute(
                "INSERT INTO document_chunks (id, source_id, source_type, content, embedding, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (doc_id, doc_id, stype, content, embedding, 0.0)
            )
        conn.commit()
        conn.close()

        results = service.search("query", top_k=3)

        # Verify results
        assert len(results) == 3
        # Order should be preserved: 3, 1, 2 based on the mocked vector search result order
        assert results[0]['id'] == "3"
        assert results[1]['id'] == "1"
        assert results[2]['id'] == "2"

        # Check scores
        # distance 0.1 -> score = 1 - 0.01/2 = 0.995
        assert results[0]['score'] >= 0.99
