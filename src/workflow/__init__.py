# Workflow Engine
"""
工作流引擎 - L1-L5 五级模式

级别说明:
- L1: 简单问答 (单轮)
- L2: 段落生成 (多轮)
- L3: 章节创作 (Plan-Act)
- L4: 多章连续 (状态管理)
- L5: 全书规划 (完整工作流)
"""

from .workflow_engine import WorkflowEngine

__all__ = ["WorkflowEngine"]
