"""
UI Components Package
=====================
Streamlit 组件库，用于 AI Writing Workbench
"""

from .lock_radar import render_lock_radar, render_lock_breakdown
from .trajectory_viewer import (
    render_trajectory_viewer,
    render_workflow_progress,
    render_agent_timeline,
    render_decision_tree
)
from .scene_dashboard import (
    load_scenes,
    render_scene_dashboard,
    render_dependency_graph_builtin,
    render_dependency_graph_graphviz,
    render_parallelization_analysis,
    analyze_parallelization
)

# Aliases for backward compatibility
load_scene_cards = load_scenes
render_dependency_graph = render_dependency_graph_builtin
render_parallel_analysis = render_parallelization_analysis

__all__ = [
    "render_lock_radar",
    "render_lock_breakdown",
    "render_trajectory_viewer",
    "render_workflow_progress",
    "render_agent_timeline",
    "render_decision_tree",
    "load_scenes",
    "load_scene_cards",
    "render_scene_dashboard",
    "render_dependency_graph_builtin",
    "render_dependency_graph_graphviz",
    "render_dependency_graph",
    "render_parallelization_analysis",
    "render_parallel_analysis",
    "analyze_parallelization"
]
