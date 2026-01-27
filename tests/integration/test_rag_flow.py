
import os
import shutil
import unittest
from pathlib import Path
from src.services.document_loader import DocumentLoader
from src.services.knowledge_layer import AgentKnowledgeLayer

# Create a temporary test directory
TEST_DIR = Path("tests/manual/test_data")
DB_PATH = TEST_DIR / "test_memory.db"

class TestRAGIntegration(unittest.TestCase):

    def setUp(self):
        if TEST_DIR.exists():
            shutil.rmtree(TEST_DIR)
        TEST_DIR.mkdir(parents=True, exist_ok=True)

        self.loader = DocumentLoader(chunk_size=100, chunk_overlap=10)
        self.knowledge_layer = AgentKnowledgeLayer(str(DB_PATH))

    def tearDown(self):
        if TEST_DIR.exists():
            shutil.rmtree(TEST_DIR)

    def test_txt_ingestion_and_retrieval(self):
        # 1. Create a dummy text file
        content = """
        The quick brown fox jumps over the lazy dog.
        This is a test document for the RAG system.
        It has multiple lines and should be chunked.
        Python is a great programming language.
        Streamlit makes building web apps easy.
        """
        filename = "test_doc.txt"
        file_path = TEST_DIR / filename
        with open(file_path, "w") as f:
            f.write(content)

        # 2. Load and chunk
        with open(file_path, "rb") as f:
            chunks = self.loader.load_and_split(f, filename)

        self.assertTrue(len(chunks) > 0)
        print(f"Generated {len(chunks)} chunks.")

        # 3. Ingest into Knowledge Layer
        for chunk in chunks:
            doc_id = f"{chunk['metadata']['source']}_part_{chunk['metadata']['chunk_index']}"
            self.knowledge_layer.add_document(doc_id, chunk['content'], source_type="test")

        # 4. Search
        query = "fox"
        results = self.knowledge_layer.query_hybrid(query, top_k=2)

        print("Search Results for 'fox':", results)

        # Verify we found the chunk with "fox"
        found = any("fox" in r['content'].lower() for r in results['chunks'])
        self.assertTrue(found, "Could not find 'fox' in search results")

    def test_mock_pdf_ingestion(self):
        # Note: We can't easily generate a real PDF without reportlab,
        # so we will trust the logic. This test just ensures the loader handles bytes properly.
        # But we can simulate passing bytes that are NOT a pdf and check handling.

        dummy_pdf_content = b"%PDF-1.4 ... dummy content"
        # The loader uses pypdf, which will likely fail on this dummy content,
        # but let's verify it doesn't crash the whole app.

        chunks = self.loader.load_and_split(dummy_pdf_content, "fake.pdf")
        self.assertEqual(len(chunks), 0) # Should fail gracefully

if __name__ == "__main__":
    unittest.main()
