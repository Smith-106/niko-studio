import sys
import os
import time
import random
import copy
from typing import List, Dict, Any
from unittest.mock import MagicMock

# --- Mocking UI dependencies ---
sys.modules["streamlit"] = MagicMock()
sys.modules["graphviz"] = MagicMock()
sys.modules["plotly"] = MagicMock()
sys.modules["plotly.express"] = MagicMock()
sys.modules["plotly.graph_objects"] = MagicMock()

# Add src to path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../src"))
sys.path.insert(0, project_root)

# Import target function
try:
    from ui.components.scene_dashboard import analyze_parallelization
except ImportError as e:
    print(f"Error importing analyze_parallelization: {e}")
    sys.exit(1)

def generate_test_scenes(n_scenes: int, max_deps: int = 5, cycle_prob: float = 0.0) -> List[Dict[str, Any]]:
    """Generate synthetic scene data."""
    scenes = []
    for i in range(n_scenes):
        scene_id = f"scene_{i}"
        deps = []

        # Determine dependencies
        # By default, only depend on previous scenes to ensure DAG
        potential_deps = [f"scene_{j}" for j in range(max(0, i-10), i)]

        if potential_deps:
            k = random.randint(0, min(max_deps, len(potential_deps)))
            deps = random.sample(potential_deps, k)

        # Introduce cycles if requested
        if cycle_prob > 0 and i > 5 and random.random() < cycle_prob:
            # Add dependency to a future node (not created yet) or existing node effectively creating back edge?
            # Actually, to create cycle, we need back edge.
            # Current logic: deps are < i. Back edge means depend on > i? No, that's forward edge in creation order but back edge in graph if we consider i->j.
            # Wait, if I depend on j < i, it's a DAG (assuming index order is topological).
            # To make a cycle, I need to depend on something that eventually depends on me.
            # Easiest way: scene_i depends on scene_k (where k > i). But scene_k not created yet.
            # So we add deps to *existing* nodes that are *later* in the list? No, we build list sequentially.
            # We can fix up deps after creation.
            pass

        scenes.append({
            "id": scene_id,
            "title": f"Scene {i}",
            "dependencies": deps,
            "status": "PENDING"
        })

    # Add cycles post-hoc
    if cycle_prob > 0:
        n_cycles = int(n_scenes * cycle_prob)
        for _ in range(n_cycles):
            # Pick a random scene
            s_idx = random.randint(0, n_scenes - 1)
            target_idx = random.randint(0, n_scenes - 1)
            if s_idx != target_idx:
                # Add edge s_idx -> target_idx
                # If target_idx < s_idx, we already have edges like that.
                # If target_idx > s_idx, it creates a back-edge relative to our creation order (which was top sorted).
                # But simply adding random edges might not create a cycle if it respects the order.
                # To guarantee cycle: A -> ... -> B. Add edge B -> A.
                # If we pick A and B where A depends on B (or vice versa), and add the reverse edge.
                scenes[s_idx]["dependencies"].append(scenes[target_idx]["id"])

    return scenes

def run_benchmark():
    print("Running Benchmark for analyze_parallelization...")

    test_cases = [
        ("Nodes 30", 30, 5, 0.0),
        ("Nodes 40", 40, 5, 0.0),
        ("Nodes 50", 50, 5, 0.0),
        ("Nodes 60", 60, 5, 0.0),
    ]

    results = []

    for name, n, max_deps, cycle_prob in test_cases:
        print(f"Generating data for {name} (N={n})...")
        scenes = generate_test_scenes(n, max_deps, cycle_prob)

        # Warmup
        analyze_parallelization(scenes[:10])

        start_time = time.perf_counter()
        analyze_parallelization(scenes)
        end_time = time.perf_counter()

        duration = (end_time - start_time) * 1000 # ms
        results.append((name, duration))
        print(f"  -> Duration: {duration:.2f} ms")

    print("\nSummary:")
    for name, duration in results:
        print(f"{name:<15}: {duration:.2f} ms")

if __name__ == "__main__":
    run_benchmark()
