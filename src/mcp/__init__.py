# MCP Gateway Layer
"""
MCP Gateway - 支持多模型并行调用

服务端点:
- /memory  - 统一记忆服务
- /graph   - 知识图谱服务
- /skills  - 技能包服务
- /search  - 搜索服务
- /workflow - 工作流服务
- /critic  - 评估服务
"""

from .gateway import app, create_gateway

__all__ = ["app", "create_gateway"]
