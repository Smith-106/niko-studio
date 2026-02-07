import time
import os
import json
import glob
import shutil

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# Use a temporary directory for benchmarking to avoid deleting user data
TASK_DIR = os.path.join(PROJECT_ROOT, ".task_benchmark_temp")

def setup_dummy_files(n=100):
    if os.path.exists(TASK_DIR):
        shutil.rmtree(TASK_DIR)
    os.makedirs(TASK_DIR)

    for i in range(n):
        filepath = os.path.join(TASK_DIR, f"SCENE-{i:03d}.json")
        data = {
            "id": f"SCENE-{i:03d}",
            "title": f"Scene {i}",
            "status": "DRAFT",
            "content": "Some dummy content " * 10
        }
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f)

def cleanup_dummy_files():
    if os.path.exists(TASK_DIR):
        shutil.rmtree(TASK_DIR)

def load_scenes_uncached():
    scenes = []
    if os.path.exists(TASK_DIR):
        for filepath in sorted(glob.glob(os.path.join(TASK_DIR, "SCENE-*.json"))):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    scene = json.load(f)
                    scenes.append(scene)
            except:
                pass
    return scenes

# Simulating st.cache_data behavior
_cache = {}
def load_scenes_cached():
    key = TASK_DIR
    if key in _cache:
        return _cache[key]
    scenes = load_scenes_uncached()
    _cache[key] = scenes
    return scenes

def benchmark():
    print(f"Setting up dummy files in {TASK_DIR}...")
    setup_dummy_files(100)

    iterations = 20

    # Uncached Benchmark
    print(f"\nRunning {iterations} iterations of UNCACHED loading...")
    start_time = time.time()
    for _ in range(iterations):
        _ = load_scenes_uncached()
    end_time = time.time()

    total_time_uncached = end_time - start_time
    avg_time_uncached = total_time_uncached / iterations
    print(f"Total time (Uncached): {total_time_uncached:.4f}s")
    print(f"Average time per load (Uncached): {avg_time_uncached:.4f}s")

    # Cached Benchmark
    print(f"\nRunning {iterations} iterations of CACHED loading...")
    # First load (cold cache)
    _ = load_scenes_cached()

    start_time = time.time()
    for _ in range(iterations):
        _ = load_scenes_cached()
    end_time = time.time()

    total_time_cached = end_time - start_time
    avg_time_cached = total_time_cached / iterations
    print(f"Total time (Cached): {total_time_cached:.4f}s")
    print(f"Average time per load (Cached): {avg_time_cached:.6f}s")

    # Improvement
    if avg_time_cached > 0:
        speedup = avg_time_uncached / avg_time_cached
        print(f"\nSpeedup: {speedup:.2f}x")
    else:
        print("\nSpeedup: Infinite (Cached time ~0s)")

    print("\nCleaning up...")
    cleanup_dummy_files()

if __name__ == "__main__":
    benchmark()
