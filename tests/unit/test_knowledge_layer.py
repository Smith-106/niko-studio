import pytest
from unittest.mock import MagicMock
import sys
from pathlib import Path
import sqlite3

# Need to handle imports
src_path = Path(__file__).parents[2] / "src"
if str(src_path) not in sys.path:
    sys.path.append(str(src_path))

# Mock IndexingService to avoid external dependencies
import services.knowledge_layer
services.knowledge_layer.IndexingService = MagicMock()
services.knowledge_layer.IndexingService.return_value.search.return_value = []

from services.knowledge_layer import AgentKnowledgeLayer

@pytest.fixture
def knowledge_layer(tmp_path):
    db_path = tmp_path / "test_kl.db"
    kl = AgentKnowledgeLayer(str(db_path))
    return kl

def test_entity_lookup_fts(knowledge_layer):
    kl = knowledge_layer
    kl.add_entity("id_1", "Sherlock Holmes", "Character")
    kl.add_entity("id_2", "John Watson", "Character")
    kl.add_entity("id_3", "Sherlock", "Character")
    kl.add_entity("id_4", "Apple", "Thing")

    # Exact match
    res = kl.query_hybrid("Tell me about Sherlock Holmes")
    names = [e['name'] for e in res['entities']]
    assert "Sherlock Holmes" in names
    assert "Sherlock" in names

    # Partial match
    res = kl.query_hybrid("I like Apple")
    names = [e['name'] for e in res['entities']]
    assert "Apple" in names

    # FTS candidate false positive check
    # "Sherlock" matches "Sherlock is cool"
    # "Sherlock Holmes" matches FTS "Sherlock" but not substring check
    res = kl.query_hybrid("Sherlock is cool")
    names = [e['name'] for e in res['entities']]
    assert "Sherlock" in names
    assert "Sherlock Holmes" not in names

    # Case insensitivity
    res = kl.query_hybrid("tell me about sherlock holmes")
    names = [e['name'] for e in res['entities']]
    assert "Sherlock Holmes" in names

def test_fts_sync_triggers(knowledge_layer):
    """Test that FTS table is kept in sync via triggers"""
    kl = knowledge_layer
    kl.add_entity("id_1", "Test Entity", "Type")

    conn = sqlite3.connect(str(kl.db_path))
    cursor = conn.cursor()

    # Check FTS
    cursor.execute("SELECT rowid FROM entities_fts WHERE name MATCH 'Test'")
    assert cursor.fetchone() is not None

    # Update entity via raw SQL (add_entity uses REPLACE which is DELETE+INSERT)
    # But let's test UPDATE explicitly if possible, though code uses INSERT OR REPLACE
    cursor.execute("UPDATE entities SET name='Updated Entity' WHERE id='id_1'")

    cursor.execute("SELECT rowid FROM entities_fts WHERE name MATCH 'Updated'")
    assert cursor.fetchone() is not None

    cursor.execute("SELECT rowid FROM entities_fts WHERE name MATCH 'Test'")
    assert cursor.fetchone() is None

    # Delete
    cursor.execute("DELETE FROM entities WHERE id='id_1'")
    cursor.execute("SELECT rowid FROM entities_fts WHERE name MATCH 'Updated'")
    assert cursor.fetchone() is None

    conn.close()
