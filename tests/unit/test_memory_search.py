import unittest
import shutil
import tempfile
import os
from pathlib import Path
from src.search.vector_search import VectorSearch
from src.search.smart_search import SmartSearch
from src.memory.core_memory_store import CoreMemoryStore

class TestMemorySearch(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.db_path = os.path.join(self.test_dir, "test_memory.db")
        # Initialize services
        # Note: VectorSearch will try to load FastEmbed. If it fails, we might need to mock.
        self.vector_search = VectorSearch(self.db_path)
        self.smart_search = SmartSearch(self.vector_search)
        self.memory_store = CoreMemoryStore(self.vector_search)

    def tearDown(self):
        shutil.rmtree(self.test_dir)

    def test_memory_upsert_and_search(self):
        # 1. Upsert Memory
        content1 = "The user loves sci-fi novels with complex world-building."
        self.memory_store.upsert_memory(content1, memory_id="mem1")

        content2 = "The user prefers Python for coding tasks."
        self.memory_store.upsert_memory(content2, memory_id="mem2")

        # 2. Search Memories (Vector)
        # Assuming embedding works, "sci-fi" should match content1
        results = self.memory_store.search_memories("science fiction", top_k=1)
        self.assertTrue(len(results) > 0)
        self.assertEqual(results[0].id, "mem1")

        # 3. Smart Search
        # Keyword match "Python"
        results_smart = self.smart_search.search("Python", type_filter="memory")
        self.assertTrue(len(results_smart) > 0)
        # Check if mem2 is in results
        found = any(r["id"] == "mem2" for r in results_smart)
        self.assertTrue(found)

    def test_keyword_fallback(self):
        # Insert a memory with specific unique word
        self.memory_store.upsert_memory("Zylophant is a mythical creature.", memory_id="mem3")

        # Search for exact keyword
        results = self.smart_search.search("Zylophant")
        self.assertTrue(len(results) > 0)
        self.assertEqual(results[0]["id"], "mem3")

    def test_delete_memory(self):
        # Insert
        self.memory_store.upsert_memory("To be deleted.", memory_id="del1")
        self.assertIsNotNone(self.memory_store.get_memory("del1"))

        # Delete
        self.memory_store.delete_memory("del1")

        # Verify
        self.assertIsNone(self.memory_store.get_memory("del1"))
        # Verify vector deletion (via search returning nothing for this specific query if unique)
        results = self.memory_store.search_memories("deleted")
        self.assertFalse(any(r.id == "del1" for r in results))

if __name__ == "__main__":
    unittest.main()
