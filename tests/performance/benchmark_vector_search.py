import time
import os
import shutil
import tempfile
import numpy as np
import logging
from src.search.vector_search import VectorSearch

# Disable logging to avoid clutter
logging.getLogger("src.search.vector_search").setLevel(logging.ERROR)

class MockEmbedder:
    """Mock embedder that returns random vectors."""
    def embed(self, texts):
        for _ in texts:
            # BAAI/bge-small-en-v1.5 has 384 dimensions
            yield np.random.rand(384).tolist()

def benchmark():
    # Setup
    test_dir = tempfile.mkdtemp()
    db_path = os.path.join(test_dir, "bench_vector.db")

    print(f"Setting up benchmark DB at {db_path}...")

    vs = VectorSearch(db_path)
    # Inject mock embedder
    vs._embedder = MockEmbedder()

    # Populate DB
    num_items = 2000
    print(f"Inserting {num_items} items...")
    start_time = time.time()
    for i in range(num_items):
        vs.upsert_vector(
            id=f"item_{i}",
            content=f"Content for item {i}",
            metadata={"index": i, "some_data": "x" * 100},
            type="chunk"
        )
    print(f"Insertion took {time.time() - start_time:.2f}s")

    # Benchmark Search
    num_searches = 50
    top_k = 100
    print(f"Running {num_searches} searches with top_k={top_k}...")

    latencies = []
    for i in range(num_searches):
        start = time.perf_counter()
        # Query doesn't matter much as vectors are random, but we want to trigger the search
        results = vs.search(f"query_{i}", top_k=top_k)
        latencies.append(time.perf_counter() - start)

    avg_latency = sum(latencies) / len(latencies)
    p95_latency = np.percentile(latencies, 95)

    print(f"Average Latency: {avg_latency*1000:.2f} ms")
    print(f"P95 Latency: {p95_latency*1000:.2f} ms")

    # Cleanup
    shutil.rmtree(test_dir)

    return avg_latency

if __name__ == "__main__":
    benchmark()
