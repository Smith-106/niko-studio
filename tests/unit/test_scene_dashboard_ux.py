import unittest
from unittest.mock import MagicMock, patch
import sys
import os

# Ensure src is in path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../src"))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Import the module
from ui.components import scene_dashboard

class TestSceneDashboardUX(unittest.TestCase):
    def setUp(self):
        # Sample scenes data
        self.scenes = [
            {
                "id": "SCENE-01",
                "title": "The Beginning",
                "status": "DONE",
                "lock_scores": {"L": 8, "O": 7, "C": 6, "K": 7},
                "dependencies": []
            },
            {
                "id": "SCENE-02",
                "title": "The Middle",
                "status": "WRITING",
                "lock_scores": {"L": 5, "O": 5, "C": 5, "K": 5},
                "dependencies": ["SCENE-01"]
            }
        ]

    def test_graphviz_accessibility_attributes(self):
        """Verify Graphviz nodes have status text in label and tooltip attribute"""

        # Patch graphviz and HAS_GRAPHVIZ in the module
        with patch.object(scene_dashboard, 'graphviz', create=True) as mock_graphviz, \
             patch.object(scene_dashboard, 'HAS_GRAPHVIZ', True):

            mock_graph = MagicMock()
            mock_graphviz.Digraph.return_value = mock_graph

            # Call the function
            scene_dashboard.render_dependency_graph_graphviz(self.scenes)

            # Check node calls
            # Filter calls to .node
            node_calls = [c for c in mock_graph.node.call_args_list]

            found_scene_01 = False
            for args, kwargs in node_calls:
                if args[0] == "SCENE-01":
                    found_scene_01 = True
                    label = kwargs.get("label", "")
                    tooltip = kwargs.get("tooltip", "")

                    # Check 1: Label contains status (e.g., [DONE])
                    self.assertIn("DONE", label, "Label should contain status text")

                    # Check 2: Tooltip exists and contains relevant info
                    self.assertIn("The Beginning", tooltip, "Tooltip should contain title")
                    self.assertIn("DONE", tooltip, "Tooltip should contain status")
                    self.assertIn("LOCK", tooltip, "Tooltip should contain LOCK info")

            self.assertTrue(found_scene_01, "Should have created node for SCENE-01")

    def test_builtin_graph_accessibility_attributes(self):
        """Verify built-in graph DOT string has status text in label and tooltip attribute"""

        # Patch streamlit in the module
        with patch.object(scene_dashboard, 'st') as mock_st:

            # Call the function
            scene_dashboard.render_dependency_graph_builtin(self.scenes)

            # Check st.graphviz_chart call
            self.assertTrue(mock_st.graphviz_chart.called)

            # Get the DOT string
            dot_source = mock_st.graphviz_chart.call_args[0][0]

            # Check content for SCENE-01

            # Note: implementation truncates title to 12 chars
            self.assertIn('label="SCENE-01\\nThe Beginnin', dot_source)
            self.assertIn('DONE', dot_source) # Status in label

            # We want to ensure tooltip is present.
            self.assertIn('tooltip=', dot_source, "DOT source should contain tooltip attributes")

if __name__ == "__main__":
    unittest.main()
