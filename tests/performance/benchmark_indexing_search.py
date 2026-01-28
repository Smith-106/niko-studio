import time
import os
import shutil
import numpy as np
from unittest.mock import MagicMock, patch
import sys
import logging

# Configure logging to suppress info logs during benchmark
logging.basicConfig(level=logging.WARNING)

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

# Import IndexingService
try:
    from src.services.indexing_service import IndexingService
except ImportError as e:
    print(f"ImportError: {e}")
    sys.exit(1)

# Mock Embedder
class MockEmbedder:
    def __init__(self, model_name="test"):
        self.embedding_size = 384

    def embed(self, texts):
        # Return generator of random vectors
        for _ in texts:
            yield np.random.rand(384).astype(np.float32)

def benchmark():
    db_path = ".benchmark_temp/indexing.db"
    if os.path.exists(".benchmark_temp"):
        shutil.rmtree(".benchmark_temp")
    os.makedirs(".benchmark_temp", exist_ok=True)

    # Patch TextEmbedding to use MockEmbedder
    # We patch it where it is imported in indexing_service
    with patch("src.services.indexing_service.TextEmbedding", MockEmbedder):
        try:
            service = IndexingService(db_path)

            # Seed data
            print("Seeding data...")
            num_docs = 5000
            start_seed = time.time()
            for i in range(num_docs):
                service.add_document(
                    doc_id=f"doc_{i}",
                    content=f"This is document number {i} with some random content to search for.",
                    source_type="benchmark"
                )
            print(f"Seeded {num_docs} documents in {time.time() - start_seed:.2f}s.")

            # Benchmark search
            print("Benchmarking search...")
            start_time = time.time()
            num_searches = 200
            for i in range(num_searches):
                service.search(f"query {i}", top_k=20)

            end_time = time.time()
            total_time = end_time - start_time
            avg_time = total_time / num_searches

            print(f"Total time for {num_searches} searches: {total_time:.4f}s")
            print(f"Average time per search: {avg_time:.6f}s")

        except Exception as e:
            print(f"An error occurred: {e}")
            import traceback
            traceback.print_exc()

    # Cleanup
    if os.path.exists(".benchmark_temp"):
        shutil.rmtree(".benchmark_temp")

if __name__ == "__main__":
    benchmark()
