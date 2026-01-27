import sys
import os
import unittest
from unittest.mock import MagicMock

# Add src to path
sys.path.append(os.path.abspath("src"))

# Mock modules
mock_st = MagicMock()
# Configure st.columns to return a list of mocks
mock_st.columns.side_effect = lambda n: [MagicMock() for _ in range(n)]

sys.modules["streamlit"] = mock_st
sys.modules["plotly"] = MagicMock()
sys.modules["plotly.graph_objects"] = MagicMock()
sys.modules["graphviz"] = MagicMock()
sys.modules["pandas"] = MagicMock()

# Now import the components
try:
    from ui.components.lock_radar import render_lock_radar
    from ui.components.scene_dashboard import render_dependency_graph_builtin
except ImportError as e:
    print(f"Import failed: {e}")
    sys.exit(1)

class TestAccessibility(unittest.TestCase):
    def test_lock_radar_accessibility(self):
        print("Testing LOCK Radar Accessibility...")
        # Reset mocks
        mock_st.reset_mock()
        # Mock expander context manager
        mock_st.expander.return_value.__enter__.return_value = MagicMock()

        scores = {"L": 8, "O": 7, "C": 9, "K": 8}
        render_lock_radar(scores)

        # Verify .sr-only markdown
        markdown_calls = [args[0] for args, _ in mock_st.markdown.call_args_list]
        found_sr_only = any("sr-only" in str(call) for call in markdown_calls)
        if not found_sr_only:
            print("Markdown calls:", markdown_calls)
        self.assertTrue(found_sr_only, "Expected .sr-only class in markdown calls for LOCK Radar")

        # Verify expander and dataframe
        mock_st.expander.assert_called_with("View as Table (Accessible)")
        mock_st.dataframe.assert_called()
        print("PASS: LOCK Radar has .sr-only summary and data table.")

    def test_scene_dashboard_accessibility(self):
        print("Testing Scene Dashboard Accessibility...")
        # Reset mocks
        mock_st.reset_mock()
        mock_st.expander.return_value.__enter__.return_value = MagicMock()

        scenes = [{"id": "1", "title": "Scene 1", "status": "DONE", "dependencies": []}]
        render_dependency_graph_builtin(scenes)

        # Verify .sr-only markdown
        markdown_calls = [args[0] for args, _ in mock_st.markdown.call_args_list]
        found_sr_only = any("sr-only" in str(call) for call in markdown_calls)
        if not found_sr_only:
            print("Markdown calls:", markdown_calls)
        self.assertTrue(found_sr_only, "Expected .sr-only class in markdown calls for Scene Dashboard")

        # Verify expander and dataframe
        mock_st.expander.assert_called_with("View as Table (Accessible)")
        mock_st.dataframe.assert_called()
        print("PASS: Scene Dashboard has .sr-only summary and data table.")

if __name__ == "__main__":
    unittest.main()
