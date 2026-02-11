# -*- coding: utf-8 -*-
"""
Streamlit UI Components Tests

Tests for lock_radar.py, trajectory_viewer.py, scene_dashboard.py.
All Streamlit calls are mocked to test pure logic.
"""

import pytest
from unittest.mock import MagicMock, patch, call
import json
import os


# ============================================================
# Mock streamlit before importing modules
# ============================================================

_mock_st = MagicMock()
_mock_go = MagicMock()


@pytest.fixture(autouse=True)
def mock_streamlit(monkeypatch):
    """Mock streamlit and plotly for all tests in this module."""
    import sys
    monkeypatch.setitem(sys.modules, "streamlit", _mock_st)
    monkeypatch.setitem(sys.modules, "plotly", MagicMock())
    monkeypatch.setitem(sys.modules, "plotly.graph_objects", _mock_go)
    _mock_st.reset_mock()
    _mock_go.reset_mock()
    _mock_go.Figure.return_value = MagicMock()
    _mock_go.Scatterpolar.return_value = MagicMock()
    _mock_st.columns.side_effect = lambda n, **kw: [MagicMock() for _ in range(n if isinstance(n, int) else len(n) if isinstance(n, list) else 4)]
    _mock_st.tabs.return_value = [MagicMock(), MagicMock(), MagicMock()]
    _mock_st.expander.return_value.__enter__ = MagicMock()
    _mock_st.expander.return_value.__exit__ = MagicMock()
    _mock_st.container.return_value.__enter__ = MagicMock()
    _mock_st.container.return_value.__exit__ = MagicMock()
    yield


# ============================================================
# lock_radar - render_lock_radar
# ============================================================

class TestRenderLockRadar:

    def test_basic_scores(self):
        from src.ui.components.lock_radar import render_lock_radar
        scores = {"L": 7, "O": 8, "C": 6, "K": 7}
        render_lock_radar(scores)
        _mock_st.plotly_chart.assert_called_once()

    def test_custom_threshold(self):
        from src.ui.components.lock_radar import render_lock_radar
        scores = {"L": 9, "O": 9, "C": 9, "K": 9}
        render_lock_radar(scores, threshold=36)
        _mock_st.plotly_chart.assert_called()

    def test_custom_title(self):
        from src.ui.components.lock_radar import render_lock_radar
        scores = {"L": 5, "O": 5, "C": 5, "K": 5}
        render_lock_radar(scores, title="My Title")
        _mock_st.plotly_chart.assert_called()

    def test_partial_key_format(self):
        from src.ui.components.lock_radar import render_lock_radar
        scores = {"L (Lead)": 7, "O (Objective)": 8, "C": 6, "K": 7}
        render_lock_radar(scores)
        _mock_st.plotly_chart.assert_called()

    def test_missing_keys(self):
        from src.ui.components.lock_radar import render_lock_radar
        scores = {"X": 5}
        render_lock_radar(scores)
        _mock_st.plotly_chart.assert_called()

    def test_prefix_match_keys(self):
        from src.ui.components.lock_radar import render_lock_radar
        scores = {"Lead": 7, "Objective": 8, "Confrontation": 6, "Knockout": 7}
        render_lock_radar(scores)
        _mock_st.plotly_chart.assert_called()


# ============================================================
# lock_radar - render_lock_breakdown
# ============================================================

class TestRenderLockBreakdown:

    def test_basic(self):
        from src.ui.components.lock_radar import render_lock_breakdown
        scores = {"L": 7, "O": 8, "C": 6, "K": 7}
        render_lock_breakdown(scores)

    def test_with_analysis(self):
        from src.ui.components.lock_radar import render_lock_breakdown
        scores = {"L": 7, "O": 8, "C": 6, "K": 7}
        analysis = {"L": "Good lead", "C": "Needs more conflict"}
        render_lock_breakdown(scores, analysis)

    def test_no_analysis(self):
        from src.ui.components.lock_radar import render_lock_breakdown
        scores = {"L": 5}
        render_lock_breakdown(scores, None)


# ============================================================
# trajectory_viewer - render_trajectory_viewer
# ============================================================

class TestRenderTrajectoryViewer:

    def test_empty(self):
        from src.ui.components.trajectory_viewer import render_trajectory_viewer
        render_trajectory_viewer([])
        _mock_st.info.assert_called()

    def test_with_data(self):
        from src.ui.components.trajectory_viewer import render_trajectory_viewer
        trajectory = [
            {
                "node": "Writer",
                "action": "write",
                "thought": "thinking...",
                "result": {"draft_content": "text"},
                "timestamp": "2024-01-01",
                "status": "completed",
            }
        ]
        render_trajectory_viewer(trajectory)

    def test_custom_title(self):
        from src.ui.components.trajectory_viewer import render_trajectory_viewer
        render_trajectory_viewer([], title="Custom")
        _mock_st.subheader.assert_called()

    def test_lock_scores_result(self):
        from src.ui.components.trajectory_viewer import render_trajectory_viewer
        trajectory = [
            {
                "node": "Critic",
                "result": {"lock_scores": {"L": 7, "O": 8, "C": 6, "K": 7}},
                "status": "completed",
            }
        ]
        render_trajectory_viewer(trajectory)

    def test_non_dict_result(self):
        from src.ui.components.trajectory_viewer import render_trajectory_viewer
        trajectory = [
            {"node": "Step", "result": "plain string", "status": "completed"}
        ]
        render_trajectory_viewer(trajectory)

    def test_status_icons(self):
        from src.ui.components.trajectory_viewer import render_trajectory_viewer
        for status in ["completed", "running", "failed", "skipped", "unknown"]:
            trajectory = [{"node": "N", "status": status}]
            render_trajectory_viewer(trajectory)

    def test_long_draft_content(self):
        from src.ui.components.trajectory_viewer import render_trajectory_viewer
        trajectory = [
            {
                "node": "Writer",
                "result": {"draft_content": "x" * 1000},
                "status": "completed",
            }
        ]
        render_trajectory_viewer(trajectory)


# ============================================================
# trajectory_viewer - render_workflow_progress
# ============================================================

class TestRenderWorkflowProgress:

    def test_basic(self):
        from src.ui.components.trajectory_viewer import render_workflow_progress
        nodes = ["A", "B", "C"]
        _mock_st.columns.return_value = [MagicMock(), MagicMock(), MagicMock()]
        render_workflow_progress("B", nodes, ["A"])

    def test_all_completed(self):
        from src.ui.components.trajectory_viewer import render_workflow_progress
        nodes = ["A", "B"]
        _mock_st.columns.return_value = [MagicMock(), MagicMock()]
        render_workflow_progress("B", nodes, ["A", "B"])

    def test_empty_nodes(self):
        from src.ui.components.trajectory_viewer import render_workflow_progress
        _mock_st.columns.return_value = []
        render_workflow_progress("", [], [])


# ============================================================
# trajectory_viewer - render_agent_timeline
# ============================================================

class TestRenderAgentTimeline:

    def test_basic(self):
        from src.ui.components.trajectory_viewer import render_agent_timeline
        events = [
            {"agent": "Writer", "action": "write", "time": "12:00", "details": "d"},
            {"agent": "Critic", "action": "review", "time": "12:01", "details": ""},
        ]
        render_agent_timeline(events)

    def test_max_events(self):
        from src.ui.components.trajectory_viewer import render_agent_timeline
        events = [{"agent": f"A{i}", "action": "act"} for i in range(20)]
        render_agent_timeline(events, max_events=5)

    def test_agent_colors(self):
        from src.ui.components.trajectory_viewer import render_agent_timeline
        for agent in ["Architect", "Writer", "Critic", "Commander", "Human", "Other"]:
            render_agent_timeline([{"agent": agent, "action": "test"}])


# ============================================================
# trajectory_viewer - render_decision_tree
# ============================================================

class TestRenderDecisionTree:

    def test_basic(self):
        from src.ui.components.trajectory_viewer import render_decision_tree
        decision = {
            "question": "What to do?",
            "options": ["A", "B", "C"],
            "selected": "B",
            "reason": "Best option",
        }
        render_decision_tree(decision)

    def test_empty_decision(self):
        from src.ui.components.trajectory_viewer import render_decision_tree
        render_decision_tree({})

    def test_no_reason(self):
        from src.ui.components.trajectory_viewer import render_decision_tree
        render_decision_tree({"options": ["X"], "selected": "X"})


# ============================================================
# scene_dashboard - analyze_parallelization (pure logic)
# ============================================================

class TestAnalyzeParallelization:

    def test_no_dependencies(self):
        from src.ui.components.scene_dashboard import analyze_parallelization
        scenes = [
            {"id": "S1", "dependencies": []},
            {"id": "S2", "dependencies": []},
        ]
        levels = analyze_parallelization(scenes)
        assert levels[1] == ["S1", "S2"]

    def test_chain_dependencies(self):
        from src.ui.components.scene_dashboard import analyze_parallelization
        scenes = [
            {"id": "S1", "dependencies": []},
            {"id": "S2", "dependencies": ["S1"]},
            {"id": "S3", "dependencies": ["S2"]},
        ]
        levels = analyze_parallelization(scenes)
        assert 1 in levels
        assert 2 in levels
        assert 3 in levels

    def test_parallel_branches(self):
        from src.ui.components.scene_dashboard import analyze_parallelization
        scenes = [
            {"id": "S1", "dependencies": []},
            {"id": "S2", "dependencies": ["S1"]},
            {"id": "S3", "dependencies": ["S1"]},
        ]
        levels = analyze_parallelization(scenes)
        assert "S2" in levels[2]
        assert "S3" in levels[2]

    def test_empty(self):
        from src.ui.components.scene_dashboard import analyze_parallelization
        levels = analyze_parallelization([])
        assert levels == {}

    def test_circular_dependency(self):
        from src.ui.components.scene_dashboard import analyze_parallelization
        scenes = [
            {"id": "S1", "dependencies": ["S2"]},
            {"id": "S2", "dependencies": ["S1"]},
        ]
        # Should not hang (circular dependency handled)
        levels = analyze_parallelization(scenes)
        assert len(levels) > 0

    def test_missing_dependency(self):
        from src.ui.components.scene_dashboard import analyze_parallelization
        scenes = [
            {"id": "S1", "dependencies": ["nonexistent"]},
        ]
        levels = analyze_parallelization(scenes)
        assert len(levels) > 0


# ============================================================
# scene_dashboard - load_scenes
# ============================================================

class TestLoadScenes:

    def test_nonexistent_dir(self, tmp_path):
        from src.ui.components.scene_dashboard import load_scenes
        result = load_scenes(str(tmp_path / "nonexistent_dir"))
        assert result == []

    def test_empty_dir(self, tmp_path):
        from src.ui.components.scene_dashboard import load_scenes
        task_dir = tmp_path / "task"
        task_dir.mkdir()
        result = load_scenes(str(task_dir))
        assert result == []

    def test_valid_scenes(self, tmp_path):
        from src.ui.components.scene_dashboard import load_scenes
        task_dir = tmp_path / "task"
        task_dir.mkdir()
        scene = {"id": "SCENE-001", "title": "Opening", "status": "DONE"}
        (task_dir / "SCENE-001.json").write_text(json.dumps(scene), encoding="utf-8")

        result = load_scenes(str(task_dir))
        assert len(result) == 1
        assert result[0]["id"] == "SCENE-001"

    def test_invalid_json_skipped(self, tmp_path):
        from src.ui.components.scene_dashboard import load_scenes
        task_dir = tmp_path / "task"
        task_dir.mkdir()
        (task_dir / "SCENE-001.json").write_text("not json", encoding="utf-8")

        result = load_scenes(str(task_dir))
        assert result == []

    def test_auto_id_from_filename(self, tmp_path):
        from src.ui.components.scene_dashboard import load_scenes
        task_dir = tmp_path / "task"
        task_dir.mkdir()
        scene = {"title": "No ID"}
        (task_dir / "SCENE-002.json").write_text(json.dumps(scene), encoding="utf-8")

        result = load_scenes(str(task_dir))
        assert result[0]["id"] == "SCENE-002"


# ============================================================
# scene_dashboard - render_lock_metrics
# ============================================================

class TestRenderLockMetrics:

    def test_basic(self):
        from src.ui.components.scene_dashboard import render_lock_metrics
        _mock_st.columns.return_value = [MagicMock() for _ in range(4)]
        render_lock_metrics({"L": 7, "O": 8, "C": 6, "K": 7})

    def test_missing_keys(self):
        from src.ui.components.scene_dashboard import render_lock_metrics
        _mock_st.columns.return_value = [MagicMock() for _ in range(4)]
        render_lock_metrics({})


# ============================================================
# scene_dashboard - render_dependency_graph_builtin
# ============================================================

class TestRenderDependencyGraphBuiltin:

    def test_basic(self):
        from src.ui.components.scene_dashboard import render_dependency_graph_builtin
        scenes = [
            {"id": "S1", "title": "First", "status": "DONE", "lock_scores": {"L": 7}, "dependencies": []},
            {"id": "S2", "title": "Second", "status": "PENDING", "lock_scores": {}, "dependencies": ["S1"]},
        ]
        render_dependency_graph_builtin(scenes)
        _mock_st.graphviz_chart.assert_called()

    def test_empty(self):
        from src.ui.components.scene_dashboard import render_dependency_graph_builtin
        render_dependency_graph_builtin([])
        _mock_st.graphviz_chart.assert_called()

    def test_all_statuses(self):
        from src.ui.components.scene_dashboard import render_dependency_graph_builtin
        scenes = [
            {"id": f"S{i}", "title": "T", "status": s, "lock_scores": {}, "dependencies": []}
            for i, s in enumerate(["DONE", "WRITING", "REVIEWING", "PENDING", "FAILED"])
        ]
        render_dependency_graph_builtin(scenes)


# ============================================================
# scene_dashboard - render_parallelization_analysis
# ============================================================

class TestRenderParallelizationAnalysis:

    def test_empty_scenes(self):
        from src.ui.components.scene_dashboard import render_parallelization_analysis
        render_parallelization_analysis([])
        _mock_st.info.assert_called()

    def test_with_scenes(self):
        from src.ui.components.scene_dashboard import render_parallelization_analysis
        scenes = [
            {"id": "S1", "status": "DONE", "dependencies": []},
            {"id": "S2", "status": "PENDING", "dependencies": ["S1"]},
        ]
        _mock_st.container.return_value.__enter__ = MagicMock(return_value=MagicMock())
        _mock_st.container.return_value.__exit__ = MagicMock(return_value=False)
        _mock_st.expander.return_value.__enter__ = MagicMock(return_value=MagicMock())
        _mock_st.expander.return_value.__exit__ = MagicMock(return_value=False)
        render_parallelization_analysis(scenes)

    def test_parallel_ready(self):
        from src.ui.components.scene_dashboard import render_parallelization_analysis
        scenes = [
            {"id": "S1", "status": "DONE", "dependencies": []},
            {"id": "S2", "status": "PENDING", "dependencies": ["S1"]},
            {"id": "S3", "status": "PENDING", "dependencies": []},
        ]
        _mock_st.container.return_value.__enter__ = MagicMock(return_value=MagicMock())
        _mock_st.container.return_value.__exit__ = MagicMock(return_value=False)
        _mock_st.expander.return_value.__enter__ = MagicMock(return_value=MagicMock())
        _mock_st.expander.return_value.__exit__ = MagicMock(return_value=False)
        render_parallelization_analysis(scenes)
        _mock_st.success.assert_called()

    def test_all_done(self):
        from src.ui.components.scene_dashboard import render_parallelization_analysis
        scenes = [
            {"id": "S1", "status": "DONE", "dependencies": []},
            {"id": "S2", "status": "DONE", "dependencies": ["S1"]},
        ]
        _mock_st.container.return_value.__enter__ = MagicMock(return_value=MagicMock())
        _mock_st.container.return_value.__exit__ = MagicMock(return_value=False)
        _mock_st.expander.return_value.__enter__ = MagicMock(return_value=MagicMock())
        _mock_st.expander.return_value.__exit__ = MagicMock(return_value=False)
        render_parallelization_analysis(scenes)


# ============================================================
# scene_dashboard - render_scene_dashboard
# ============================================================

class TestRenderSceneDashboard:

    def test_no_scenes(self):
        from src.ui.components.scene_dashboard import render_scene_dashboard
        with patch("src.ui.components.scene_dashboard.load_scenes", return_value=[]):
            render_scene_dashboard()
            _mock_st.warning.assert_called()

    def test_with_scenes(self):
        from src.ui.components.scene_dashboard import render_scene_dashboard
        scenes = [
            {
                "id": "S1", "title": "First", "status": "DONE",
                "lock_scores": {"L": 7, "O": 8, "C": 6, "K": 7},
                "dependencies": [], "summary": "A summary", "word_count": 1000,
            },
            {
                "id": "S2", "title": "Second", "status": "WRITING",
                "lock_scores": {}, "dependencies": ["S1"],
            },
        ]
        _mock_st.container.return_value.__enter__ = MagicMock(return_value=MagicMock())
        _mock_st.container.return_value.__exit__ = MagicMock(return_value=False)
        _mock_st.expander.return_value.__enter__ = MagicMock(return_value=MagicMock())
        _mock_st.expander.return_value.__exit__ = MagicMock(return_value=False)
        tab_mocks = [MagicMock(), MagicMock(), MagicMock()]
        for tm in tab_mocks:
            tm.__enter__ = MagicMock(return_value=tm)
            tm.__exit__ = MagicMock(return_value=False)
        _mock_st.tabs.return_value = tab_mocks
        _mock_st.button.return_value = False
        _mock_st.session_state = MagicMock()

        with patch("src.ui.components.scene_dashboard.load_scenes", return_value=scenes), \
             patch("src.ui.components.scene_dashboard.HAS_GRAPHVIZ", False), \
             patch("src.ui.components.scene_dashboard.render_dependency_graph_builtin"), \
             patch("src.ui.components.scene_dashboard.render_parallelization_analysis"), \
             patch("src.ui.components.scene_dashboard.render_lock_metrics"):
            render_scene_dashboard()

    def test_with_critique(self):
        from src.ui.components.scene_dashboard import render_scene_dashboard
        scenes = [
            {
                "id": "S1", "title": "First", "status": "REVIEWING",
                "lock_scores": {"L": 5}, "dependencies": [],
                "critique": "Needs work",
            },
        ]
        _mock_st.container.return_value.__enter__ = MagicMock(return_value=MagicMock())
        _mock_st.container.return_value.__exit__ = MagicMock(return_value=False)
        _mock_st.expander.return_value.__enter__ = MagicMock(return_value=MagicMock())
        _mock_st.expander.return_value.__exit__ = MagicMock(return_value=False)
        tab_mocks = [MagicMock(), MagicMock(), MagicMock()]
        for tm in tab_mocks:
            tm.__enter__ = MagicMock(return_value=tm)
            tm.__exit__ = MagicMock(return_value=False)
        _mock_st.tabs.return_value = tab_mocks
        _mock_st.button.return_value = False
        _mock_st.session_state = MagicMock()

        with patch("src.ui.components.scene_dashboard.load_scenes", return_value=scenes), \
             patch("src.ui.components.scene_dashboard.HAS_GRAPHVIZ", False), \
             patch("src.ui.components.scene_dashboard.render_dependency_graph_builtin"), \
             patch("src.ui.components.scene_dashboard.render_parallelization_analysis"), \
             patch("src.ui.components.scene_dashboard.render_lock_metrics"):
            render_scene_dashboard()
