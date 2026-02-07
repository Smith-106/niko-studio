
import time
import random
import string
import sys

def generate_scenes(num_scenes, deps_per_scene=5):
    """Generate a list of scene dictionaries."""
    scenes = []
    ids = [f"scene_{i}" for i in range(num_scenes)]

    for i in range(num_scenes):
        # Pick random dependencies from other scenes
        deps = []
        if num_scenes > 1:
            # Randomly select dependencies, some might not exist in the list (to test the check)
            for _ in range(deps_per_scene):
                if random.random() > 0.8:
                    # Non-existent dependency
                    deps.append(f"missing_{random.randint(0, 1000)}")
                else:
                    # Existing dependency
                    deps.append(ids[random.randint(0, num_scenes-1)])

        scenes.append({
            "id": ids[i],
            "title": f"Scene {i}",
            "dependencies": deps
        })
    return scenes

class MockGraph:
    def __init__(self):
        self.edges = 0
    def edge(self, u, v):
        self.edges += 1

def run_unoptimized(scenes):
    """O(N^2) implementation from src/src/ui/components/scene_dashboard.py"""
    graph = MockGraph()
    start_time = time.perf_counter()

    for s in scenes:
        deps = s.get("dependencies", [])
        for d in deps:
            # The inefficient lookup
            if any(sc['id'] == d for sc in scenes):
                graph.edge(d, s['id'])

    end_time = time.perf_counter()
    return end_time - start_time

def run_optimized(scenes):
    """O(N) implementation from src/ui/components/scene_dashboard.py"""
    graph = MockGraph()
    start_time = time.perf_counter()

    # Pre-compute set
    scene_ids = {s['id'] for s in scenes}
    for s in scenes:
        deps = s.get("dependencies", [])
        for d in deps:
            if d in scene_ids:
                graph.edge(d, s['id'])

    end_time = time.perf_counter()
    return end_time - start_time

def main():
    print(f"{'Scenes':<10} {'Deps/Scene':<12} {'Unoptimized(s)':<15} {'Optimized(s)':<15} {'Speedup':<10}")
    print("-" * 70)

    test_cases = [
        (100, 5),
        (500, 5),
        (1000, 10),
        (2000, 10),
    ]

    for n_scenes, n_deps in test_cases:
        scenes = generate_scenes(n_scenes, n_deps)

        t_unopt = run_unoptimized(scenes)
        t_opt = run_optimized(scenes)

        speedup = t_unopt / t_opt if t_opt > 0 else 0.0

        print(f"{n_scenes:<10} {n_deps:<12} {t_unopt:<15.6f} {t_opt:<15.6f} {speedup:<10.1f}x")

if __name__ == "__main__":
    main()
