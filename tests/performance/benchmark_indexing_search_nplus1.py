import time
import sqlite3
import numpy as np
import sys
import os
import logging
from unittest.mock import MagicMock, patch
from pathlib import Path

# Add src to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../src')))

# Mock sqlite_vec before importing indexing_service
mock_sqlite_vec = MagicMock()
sys.modules['sqlite_vec'] = mock_sqlite_vec

import services.indexing_service
from services.indexing_service import IndexingService

# Configure logging
logging.basicConfig(level=logging.ERROR)

class MockCursor:
    def __init__(self, real_cursor, num_docs=1000):
        self.real_cursor = real_cursor
        self.last_query = ""
        self.num_docs = num_docs

    def execute(self, sql, params=()):
        self.last_query = sql
        # Check if this is the vector search query
        if "FROM vec_document_chunks" in sql:
            return self
        elif "CREATE VIRTUAL TABLE" in sql and "vec0" in sql:
            return self
        elif "INSERT INTO vec_document_chunks" in sql:
            return self
        else:
            return self.real_cursor.execute(sql, params)

    def fetchall(self):
        if "FROM vec_document_chunks" in self.last_query:
            # Return dummy vector results: list of (rowid, distance)
            return [(i, 0.1) for i in range(1, self.num_docs + 1)]
        return self.real_cursor.fetchall()

    def fetchone(self):
        return self.real_cursor.fetchone()

    @property
    def lastrowid(self):
        return self.real_cursor.lastrowid

    def __getattr__(self, name):
        return getattr(self.real_cursor, name)

class MockConnection:
    def __init__(self, real_conn, num_docs=1000):
        self.real_conn = real_conn
        self.row_factory = None
        self.num_docs = num_docs

    def cursor(self):
        self.real_conn.row_factory = self.row_factory
        return MockCursor(self.real_conn.cursor(), self.num_docs)

    def enable_load_extension(self, enabled):
        pass

    def close(self):
        self.real_conn.close()

    def commit(self):
        self.real_conn.commit()

    def __getattr__(self, name):
        return getattr(self.real_conn, name)

class MockEmbeddingModel:
    def __init__(self, model_name="test"):
        pass
    def embed(self, texts):
        # Return random vectors
        for _ in texts:
            yield np.random.rand(384).astype(np.float32)

class BenchmarkIndexingSearch:
    def __init__(self, db_path, num_docs=1000):
        self.db_path = db_path
        self.num_docs = num_docs
        self.service = None

    def setup(self):
        if os.path.exists(self.db_path):
            os.remove(self.db_path)

        target_sqlite = services.indexing_service.sqlite3
        original_connect = target_sqlite.connect

        def side_effect_connect(db_path, **kwargs):
            real_conn = original_connect(db_path, **kwargs)
            return MockConnection(real_conn, self.num_docs)

        # Patch TextEmbedding to avoid model loading overhead
        with patch('services.indexing_service.TextEmbedding', MockEmbeddingModel):
            with patch.object(target_sqlite, 'connect', side_effect=side_effect_connect):
                self.service = IndexingService(self.db_path)

        # Populate DB using real connection
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        logging.info(f"Inserting {self.num_docs} documents...")
        data = []
        for i in range(1, self.num_docs + 1):
            content = f"This is document number {i} with some content."
            embedding = np.random.rand(384).astype(np.float32).tobytes()
            data.append((str(i), str(i), "test", content, embedding, time.time()))

        cursor.executemany(
            "INSERT INTO document_chunks (id, source_id, source_type, content, embedding, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            data
        )
        conn.commit()
        conn.close()

    def run_benchmark(self):
        target_sqlite = services.indexing_service.sqlite3
        original_connect = target_sqlite.connect

        def side_effect_connect(db_path, **kwargs):
            real_conn = original_connect(db_path, **kwargs)
            return MockConnection(real_conn, self.num_docs)

        # Patch TextEmbedding during search too
        with patch('services.indexing_service.TextEmbedding', MockEmbeddingModel):
            with patch.object(target_sqlite, 'connect', side_effect=side_effect_connect):
                start_time = time.time()
                self.service.search("query", top_k=self.num_docs)
                end_time = time.time()

                return end_time - start_time

if __name__ == "__main__":
    db_file = "benchmark_test.db"
    try:
        bench = BenchmarkIndexingSearch(db_file, num_docs=5000)
        bench.setup()

        duration = bench.run_benchmark()
        print(f"Time taken for search with {bench.num_docs} results: {duration:.4f} seconds")

    finally:
        if os.path.exists(db_file):
            os.remove(db_file)
