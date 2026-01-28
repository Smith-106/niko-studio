import pytest
from unittest.mock import MagicMock
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../src')))

from search.vector_search import VectorSearch

class MockEmbeddingDynamic:
    def __init__(self, model_name="custom", **kwargs):
        self.model_name = model_name
        self.embedding_size = 768

    def embed(self, documents):
        yield [0.0] * 768

def test_vector_search_dynamic_dimension(mocker):
    # Mock dependencies
    mocker.patch("search.vector_search.TextEmbedding", MockEmbeddingDynamic)
    mocker.patch("search.vector_search.sqlite_vec", MagicMock())

    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_conn.cursor.return_value = mock_cursor

    # Patch sqlite3 in the module namespace to handle pysqlite3 aliasing
    mocker.patch("search.vector_search.sqlite3.connect", return_value=mock_conn)

    # Initialize VectorSearch
    service = VectorSearch("test_vec.db", model_name="custom")

    # Access embedder to trigger lazy loading (which we will modify to handle dynamic dim)
    _ = service.embedder

    found_768 = False
    found_384 = False

    # Check all execute calls
    for call in mock_cursor.execute.call_args_list:
        args, _ = call
        sql = args[0]
        # We are looking for "CREATE VIRTUAL TABLE ... vec_items ..."
        if "CREATE VIRTUAL TABLE" in sql and "vec_items" in sql:
            if "float[768]" in sql:
                found_768 = True
            if "float[384]" in sql:
                found_384 = True

    # Assertions
    # We expect 768 to be used.
    assert found_768, f"Expected float[768] in SQL, but found_384={found_384}, found_768={found_768}"
    assert not found_384, "Should not create table with hardcoded 384 dimension"
