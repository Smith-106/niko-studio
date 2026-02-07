# Graph Module
"""
知识图谱模块

组件:
- GraphEngine: 底层图谱引擎（基于 SQLite）
- GraphManager: 高级图谱管理器（实现 IGraphService 接口）

实体类型:
- Character: 角色
- Location: 地点
- Event: 事件
- Item: 物品
- Foreshadow: 伏笔
- Concept: 概念
- Timeline: 时间线
"""

from .graph_engine import GraphEngine
from .graph_manager import GraphManager

__all__ = ["GraphEngine", "GraphManager"]
