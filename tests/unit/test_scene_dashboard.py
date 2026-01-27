import pytest
from src.ui.components.scene_dashboard import analyze_parallelization

def test_analyze_parallelization_linear():
    scenes = [
        {"id": "1", "dependencies": []},
        {"id": "2", "dependencies": ["1"]},
        {"id": "3", "dependencies": ["2"]},
    ]
    levels = analyze_parallelization(scenes)
    assert levels == {1: ["1"], 2: ["2"], 3: ["3"]}

def test_analyze_parallelization_branching():
    scenes = [
        {"id": "1", "dependencies": []},
        {"id": "2", "dependencies": ["1"]},
        {"id": "3", "dependencies": ["1"]},
    ]
    levels = analyze_parallelization(scenes)
    # Result should be {1: ["1"], 2: ["2", "3"]} (order in list doesn't strictly matter but usually sorted by ID if implementation does, or just checking set equality)
    assert levels[1] == ["1"]
    assert set(levels[2]) == {"2", "3"}

def test_analyze_parallelization_merging():
    scenes = [
        {"id": "1", "dependencies": []},
        {"id": "2", "dependencies": []},
        {"id": "3", "dependencies": ["1", "2"]},
    ]
    levels = analyze_parallelization(scenes)
    assert set(levels[1]) == {"1", "2"}
    assert levels[2] == ["3"]

def test_analyze_parallelization_diamond():
    scenes = [
        {"id": "1", "dependencies": []},
        {"id": "2", "dependencies": ["1"]},
        {"id": "3", "dependencies": ["1"]},
        {"id": "4", "dependencies": ["2", "3"]},
    ]
    levels = analyze_parallelization(scenes)
    assert levels[1] == ["1"]
    assert set(levels[2]) == {"2", "3"}
    assert levels[3] == ["4"]

def test_analyze_parallelization_cycle():
    # 1 -> 2 -> 1
    scenes = [
        {"id": "1", "dependencies": ["2"]},
        {"id": "2", "dependencies": ["1"]},
    ]
    # Just ensure it doesn't crash (InfiniteRecursion)
    levels = analyze_parallelization(scenes)
    # The exact levels might vary depending on implementation details of cycle breaking,
    # but it should return something.
    assert len(levels) > 0

def test_analyze_parallelization_disconnected():
    scenes = [
        {"id": "1", "dependencies": []},
        {"id": "2", "dependencies": []},
    ]
    levels = analyze_parallelization(scenes)
    assert set(levels[1]) == {"1", "2"}
