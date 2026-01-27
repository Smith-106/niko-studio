import os
import sys
import tempfile
from io import BytesIO

# Add project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.services.document_loader import DocumentLoader
from src.services.knowledge_layer import AgentKnowledgeLayer

def test_rag_ingestion_and_retrieval():
    # Create a temporary directory for the database
    with tempfile.TemporaryDirectory() as temp_dir:
        db_path = os.path.join(temp_dir, "test_memory.db")

        # Initialize AgentKnowledgeLayer
        knowledge_layer = AgentKnowledgeLayer(db_path)

        # Initialize DocumentLoader
        loader = DocumentLoader(chunk_size=50, chunk_overlap=10)

        # Create a mock text file content
        content = "This is a test document. " * 10
        file_obj = BytesIO(content.encode('utf-8'))
        filename = "test_doc.txt"

        # Load and chunk
        text = loader.load_file(file_obj, filename)
        chunks = loader.chunk_text(text)

        print(f"Generated {len(chunks)} chunks.")

        # Ingest chunks
        for i, chunk in enumerate(chunks):
            chunk_id = f"{filename}_part_{i}"
            knowledge_layer.add_document(chunk_id, chunk, source_type="test")

        # Verify retrieval
        query = "test document"
        results = knowledge_layer.query_hybrid(query, top_k=5)

        print("Search results:", results)

        assert len(results["chunks"]) > 0
        assert "content" in results["chunks"][0]
        assert "test document" in results["chunks"][0]["content"]

if __name__ == "__main__":
    test_rag_ingestion_and_retrieval()
    print("Test passed!")
