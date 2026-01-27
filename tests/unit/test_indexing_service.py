import pytest
import shutil
import tempfile
import os
from pathlib import Path
import sys

# Ensure src is in path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../src')))

from services.indexing_service import IndexingService

@pytest.fixture
def test_db_path():
    # Create a temp dir
    temp_dir = tempfile.mkdtemp()
    db_path = Path(temp_dir) / "test_index.db"
    yield db_path
    # Cleanup
    shutil.rmtree(temp_dir)

def test_indexing_and_search(test_db_path):
    service = IndexingService(str(test_db_path))

    docs = [
        ("1", "The quick brown fox jumps over the lazy dog.", "test"),
        ("2", "A fast dark animal leaps over a sleepy canine.", "test"),
        ("3", "Python is a popular programming language.", "code"),
        ("4", "Machine learning involves vector embeddings.", "ai")
    ]

    for doc_id, content, source_type in docs:
        service.add_document(doc_id, content, source_type)

    # Search should return relevant docs
    results = service.search("fox dog", top_k=2)

    assert len(results) == 2
    ids = [r['id'] for r in results]
    assert "1" in ids
    assert "2" in ids

    # Check scores
    assert results[0]['score'] > 0.5
