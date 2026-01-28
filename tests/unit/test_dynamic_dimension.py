import pytest
from unittest.mock import MagicMock
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../src')))

from services.indexing_service import IndexingService

class MockEmbeddingDynamic:
    def __init__(self, model_name="custom", **kwargs):
        self.model_name = model_name
        self.embedding_size = 768

    def embed(self, documents):
        yield [0.0] * 768

def test_dynamic_dimension_creation(mocker):
    mocker.patch("services.indexing_service.TextEmbedding", MockEmbeddingDynamic)
    mocker.patch("services.indexing_service.sqlite_vec", MagicMock())

    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_conn.cursor.return_value = mock_cursor
    # Patch the sqlite3.connect used inside the service (which might be pysqlite3)
    mocker.patch("services.indexing_service.sqlite3.connect", return_value=mock_conn)

    service = IndexingService("test.db", model_name="custom")

    # Access embedder to trigger logic (in future implementation)
    _ = service.embedder

    found_768 = False
    found_384 = False

    # Check all execute calls
    for call in mock_cursor.execute.call_args_list:
        args, _ = call
        sql = args[0]
        if "CREATE VIRTUAL TABLE" in sql:
            if "float[768]" in sql:
                found_768 = True
            if "float[384]" in sql:
                found_384 = True

    # We want 768 to be used.
    assert found_768, f"Expected float[768] in SQL, but found_384={found_384}, found_768={found_768}"
    assert not found_384, "Should not create table with hardcoded 384 dimension"
