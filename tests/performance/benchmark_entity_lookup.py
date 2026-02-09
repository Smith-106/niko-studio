import time
import sqlite3
import random
import string
import sys
from pathlib import Path
from unittest.mock import MagicMock

# Add src to path
sys.path.append(str(Path(__file__).parents[2] / "src"))

# We need to mock IndexingService BEFORE importing knowledge_layer
# because knowledge_layer imports it at module level (or inside __init__ logic)
import services.knowledge_layer
services.knowledge_layer.IndexingService = MagicMock()
services.knowledge_layer.IndexingService.return_value.search.return_value = []

from services.knowledge_layer import AgentKnowledgeLayer

def generate_random_string(length=10):
    letters = string.ascii_letters
    return ''.join(random.choice(letters) for i in range(length))

def setup_db(db_path, num_entities=10000):
    # Ensure fresh start
    if Path(db_path).exists():
        Path(db_path).unlink()

    kl = AgentKnowledgeLayer(db_path)

    # Direct insertion for speed
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    entities = []
    print(f"Generating {num_entities} entities...")
    for i in range(num_entities):
        name = f"Entity_{i}_{generate_random_string(5)}"
        entities.append((f"id_{i}", name, "type", "desc", "{}", time.time()))

    # Add a specific known entity
    entities.append(("id_target", "Sherlock Holmes", "Character", "Detective", "{}", time.time()))
    entities.append(("id_target2", "Dr. Watson", "Character", "Doctor", "{}", time.time()))

    cursor.executemany(
        "INSERT INTO entities (id, name, type, description, properties, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        entities
    )
    conn.commit()
    conn.close()
    return kl

def benchmark():
    db_path = "benchmark_entities.db"

    try:
        kl = setup_db(db_path, num_entities=100000)

        queries = [
            "Tell me about Sherlock Holmes",
            "What is the capital of France?", # likely no match
            "Entity_0", # partial match (should not match if we strictly look for name substring)
            # wait, current logic is "name in query". So "Entity_0" is in "Entity_0_abcde" -> FALSE.
            # "Entity_0_abcde" is in "Entity_0" -> FALSE.
            # "Entity_0_abcde" is in "I saw Entity_0_abcde today" -> TRUE.
            "I saw Entity_5000_xxxxx today", # need to know exact name
            "Sherlock Holmes and Dr. Watson went for a walk."
        ]

        # To make a valid hit for random entity, I need to fetch one name
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM entities WHERE id='id_5000'")
        row = cursor.fetchone()
        if row:
            queries.append(f"I saw {row[0]} today")
        conn.close()

        print("Running benchmark...")
        start_time = time.time()
        iterations = 10

        for i in range(iterations):
            for q in queries:
                kl.query_hybrid(q, top_k=5)

        end_time = time.time()
        total_queries = iterations * len(queries)
        avg_time = (end_time - start_time) / total_queries

        print(f"Total time for {total_queries} queries: {end_time - start_time:.4f}s")
        print(f"Average time per query: {avg_time:.6f}s")

    finally:
        if Path(db_path).exists():
            Path(db_path).unlink()

if __name__ == "__main__":
    benchmark()
