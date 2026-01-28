import time
import uuid
import random
import string
import sqlite3
import shutil
from pathlib import Path
from unittest.mock import MagicMock
import sys
import os

# Adjust path to import src
sys.path.append(os.getcwd())

# Mock IndexingService BEFORE importing AgentKnowledgeLayer
import src.services.knowledge_layer
src.services.knowledge_layer.IndexingService = MagicMock()

from src.services.knowledge_layer import AgentKnowledgeLayer

def generate_random_string(length=10):
    return ''.join(random.choices(string.ascii_letters, k=length))

def setup_db(db_path, num_entities=50000):
    if db_path.exists():
        try:
            db_path.unlink()
        except FileNotFoundError:
            pass

    if not db_path.parent.exists():
        db_path.parent.mkdir(parents=True, exist_ok=True)

    # Initialize schema
    kl = AgentKnowledgeLayer(str(db_path))

    # Direct insert for speed
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()

    entities = []
    # Add some known entities
    known_entities = ["Apple", "Microsoft", "Google", "Tesla", "SpaceX", "Harry Potter", "Gandalf"]
    for name in known_entities:
        entities.append((str(uuid.uuid4()), name, "Organization", "Desc", "{}", time.time()))

    # Add random entities
    print(f"Generating {num_entities} random entities...")
    for _ in range(num_entities):
        name = generate_random_string(random.randint(5, 15))
        entities.append((str(uuid.uuid4()), name, "Random", "Desc", "{}", time.time()))

    cursor.executemany(
        "INSERT INTO entities (id, name, type, description, properties, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        entities
    )
    conn.commit()
    conn.close()

    # Re-initialize to trigger FTS migration (since we bypassed add_entity)
    print("Re-initializing to trigger FTS migration...")
    kl = AgentKnowledgeLayer(str(db_path))

    return kl

def benchmark():
    db_path = Path(".task_benchmark_temp/knowledge.db")

    # Use a larger number
    num_entities = 50000

    print(f"Setting up database at {db_path}...")
    kl = setup_db(db_path, num_entities=num_entities)

    # Mock vector store search
    kl.vector_store.search.return_value = []

    query = "I wonder if Apple and Microsoft are planning something with Tesla soon. Maybe even Google."

    print(f"Running benchmark with {num_entities} entities...")

    # Warmup
    kl.query_hybrid(query)

    start_time = time.time()
    iterations = 50
    for _ in range(iterations):
        results = kl.query_hybrid(query)
        # Check correctness roughly
        found = {e['name'] for e in results['entities']}
        expected = {"Apple", "Microsoft", "Tesla", "Google"}
        if not expected.issubset(found):
             print(f"Warning: Missing expected entities. Found: {found}")

    end_time = time.time()
    avg_time = (end_time - start_time) / iterations

    print(f"Total time for {iterations} queries: {end_time - start_time:.4f}s")
    print(f"Average time per query: {avg_time:.6f}s")

    # Cleanup
    if db_path.parent.exists():
        shutil.rmtree(db_path.parent)

if __name__ == "__main__":
    benchmark()
