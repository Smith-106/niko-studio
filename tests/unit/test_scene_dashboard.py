import sys
import unittest
from unittest.mock import MagicMock
import os

# Mock dependencies BEFORE importing the module under test
sys.modules["streamlit"] = MagicMock()
sys.modules["graphviz"] = MagicMock()
sys.modules["plotly"] = MagicMock()
sys.modules["plotly.express"] = MagicMock()
sys.modules["plotly.graph_objects"] = MagicMock()

# Ensure src is in path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../src"))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from ui.components.scene_dashboard import analyze_parallelization

class TestAnalyzeParallelization(unittest.TestCase):

    def test_empty_list(self):
        result = analyze_parallelization([])
        self.assertEqual(result, {})

    def test_single_node(self):
        scenes = [{"id": "A", "dependencies": []}]
        result = analyze_parallelization(scenes)
        self.assertEqual(result, {1: ["A"]})

    def test_linear_dependency(self):
        # A -> B -> C (C depends on B, B depends on A)
        scenes = [
            {"id": "A", "dependencies": []},
            {"id": "B", "dependencies": ["A"]},
            {"id": "C", "dependencies": ["B"]},
        ]
        result = analyze_parallelization(scenes)
        # A: 1
        # B: 2
        # C: 3
        self.assertEqual(result.get(1), ["A"])
        self.assertEqual(result.get(2), ["B"])
        self.assertEqual(result.get(3), ["C"])

    def test_branching_dependency(self):
        # A -> B
        # A -> C
        scenes = [
            {"id": "A", "dependencies": []},
            {"id": "B", "dependencies": ["A"]},
            {"id": "C", "dependencies": ["A"]},
        ]
        result = analyze_parallelization(scenes)
        self.assertEqual(result.get(1), ["A"])
        self.assertEqual(set(result.get(2, [])), {"B", "C"})

    def test_merge_dependency(self):
        # A -> C
        # B -> C
        scenes = [
            {"id": "A", "dependencies": []},
            {"id": "B", "dependencies": []},
            {"id": "C", "dependencies": ["A", "B"]},
        ]
        result = analyze_parallelization(scenes)
        self.assertEqual(set(result.get(1, [])), {"A", "B"})
        self.assertEqual(result.get(2), ["C"])

    def test_cycle_direct(self):
        # A <-> B
        # The behavior depends on the implementation details for cycles,
        # but it should return *something* valid and consistent.
        scenes = [
            {"id": "A", "dependencies": ["B"]},
            {"id": "B", "dependencies": ["A"]},
        ]
        result = analyze_parallelization(scenes)

        # Verify both are present
        all_scenes = []
        for v in result.values():
            all_scenes.extend(v)
        self.assertEqual(set(all_scenes), {"A", "B"})

    def test_cycle_self(self):
        # A -> A
        scenes = [
            {"id": "A", "dependencies": ["A"]},
        ]
        result = analyze_parallelization(scenes)
        # Should break cycle and count as 1
        self.assertEqual(result, {1: ["A"]})

    def test_complex_dag(self):
        # A->B->D
        # A->C->D
        scenes = [
            {"id": "A", "dependencies": []},
            {"id": "B", "dependencies": ["A"]},
            {"id": "C", "dependencies": ["A"]},
            {"id": "D", "dependencies": ["B", "C"]},
        ]
        result = analyze_parallelization(scenes)
        self.assertEqual(result.get(1), ["A"])
        self.assertEqual(set(result.get(2, [])), {"B", "C"})
        self.assertEqual(result.get(3), ["D"])

    def test_disconnected_components(self):
        scenes = [
            {"id": "A", "dependencies": []},
            {"id": "B", "dependencies": []},
        ]
        result = analyze_parallelization(scenes)
        self.assertEqual(set(result.get(1, [])), {"A", "B"})

if __name__ == "__main__":
    unittest.main()
