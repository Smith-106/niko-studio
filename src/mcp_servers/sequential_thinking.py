"""
SequentialThinking MCP Server - 动态推理引擎

兼容 Cherry Studio 的 SequentialThinking MCP 协议，支持：
- 动态思维链 (Chain of Thought)
- 思维分支 (Branch)
- 思维修正 (Revise)
- 思维回溯 (Backtrack)

运行方式:
    # stdio 模式 (Cherry Studio 兼容)
    python -m src.mcp_servers.sequential_thinking

    # SSE 模式
    python -m src.mcp_servers.sequential_thinking --sse --port 8001

MCP Tools:
    - think: 添加思维节点
    - branch: 创建思维分支
    - revise: 修正之前的思维
    - backtrack: 回溯到之前的节点
    - conclude: 添加结论
    - get_chain: 获取思维链
    - get_state: 获取当前状态
    - reset: 重置思维引擎
"""

import logging
from typing import Any, Dict, List, Optional

from mcp.server.fastmcp import FastMCP

# 导入核心推理引擎
from src.agents.sequential_thinking import (
    SequentialThinking,
    ThoughtType,
    ThoughtStatus,
    ThoughtData,
    Branch,
)

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sequential-thinking-mcp")

# ============ 全局状态管理 ============

# 存储多个会话的思维引擎实例
_engines: Dict[str, SequentialThinking] = {}
_default_engine: Optional[SequentialThinking] = None


def get_engine(session_id: Optional[str] = None) -> SequentialThinking:
    """获取或创建思维引擎实例"""
    global _default_engine, _engines

    if session_id:
        if session_id not in _engines:
            _engines[session_id] = SequentialThinking(
                max_depth=15,
                max_branches=10,
                auto_prune=True
            )
            logger.info(f"Created new engine for session: {session_id}")
        return _engines[session_id]

    if _default_engine is None:
        _default_engine = SequentialThinking(
            max_depth=15,
            max_branches=10,
            auto_prune=True
        )
        logger.info("Created default engine")

    return _default_engine


# ============ 创建 MCP Server ============

def create_server(name: str = "SequentialThinking") -> FastMCP:
    """
    创建 SequentialThinking MCP Server

    Args:
        name: Server 名称

    Returns:
        FastMCP: MCP Server 实例
    """
    mcp = FastMCP(name)

    # ========== 核心工具 ==========

    @mcp.tool()
    async def think(
        content: str,
        thought_type: str = "analysis",
        confidence: float = 1.0,
        session_id: str = None,
        metadata: dict = None
    ) -> dict:
        """
        添加一个思维节点到当前思维链

        这是 SequentialThinking 的核心操作，用于逐步构建推理过程。
        每个思维节点都会记录其类型、置信度和与其他节点的关系。

        Args:
            content: 思维内容 - 当前推理步骤的描述
            thought_type: 思维类型
                - initial: 初始思考，问题定义
                - analysis: 分析，对问题的深入思考
                - hypothesis: 假设，提出可能的解决方案
                - verification: 验证，检验假设
                - conclusion: 结论，最终判断
                - branch: 分支探索
                - revision: 修正之前的思考
                - backtrack: 回溯标记
            confidence: 置信度 (0.0-1.0)，表示对当前思考的确信程度
            session_id: 会话ID (可选)，用于多会话隔离
            metadata: 元数据 (可选)，附加信息

        Returns:
            {
                "id": "thought_xxx",
                "content": "...",
                "thought_type": "analysis",
                "depth": 2,
                "confidence": 0.9,
                "parent_id": "thought_yyy",
                "branch_id": "main"
            }

        Example:
            # 初始分析
            think("用户请求分析代码性能问题", thought_type="initial")

            # 深入分析
            think("检查循环复杂度，发现 O(n^2) 嵌套循环", thought_type="analysis", confidence=0.9)

            # 提出假设
            think("可能是数据库查询导致的 N+1 问题", thought_type="hypothesis", confidence=0.7)
        """
        engine = get_engine(session_id)

        # 解析思维类型
        try:
            tt = ThoughtType(thought_type)
        except ValueError:
            tt = ThoughtType.ANALYSIS

        thought = engine.think(
            content=content,
            thought_type=tt,
            confidence=confidence,
            metadata=metadata
        )

        logger.info(f"Added thought: {thought.id} (type={tt.value})")

        return thought.to_dict()

    @mcp.tool()
    async def branch(
        name: str,
        description: str,
        priority: int = 0,
        session_id: str = None
    ) -> dict:
        """
        创建新的思维分支

        当需要探索多种可能性时，使用分支功能并行探索不同的推理路径。
        分支从当前思维节点分叉，可以独立发展。

        Args:
            name: 分支名称 - 简短描述分支目的
            description: 分支描述 - 详细说明这个分支要探索什么
            priority: 优先级 (0-10)，数值越大优先级越高
            session_id: 会话ID (可选)

        Returns:
            {
                "id": "branch_xxx",
                "name": "...",
                "description": "...",
                "fork_point_id": "thought_yyy",
                "parent_branch_id": "main"
            }

        Example:
            # 探索两种解决方案
            branch("优化方案A", "使用缓存优化数据库查询", priority=8)
            think("添加 Redis 缓存层...")

            # 切换到另一个分支
            branch("优化方案B", "重构算法降低复杂度", priority=5)
            think("将 O(n^2) 改为 O(n log n)...")
        """
        engine = get_engine(session_id)

        new_branch = engine.branch(
            name=name,
            description=description,
            priority=priority
        )

        logger.info(f"Created branch: {new_branch.id}")

        return {
            "id": new_branch.id,
            "name": new_branch.name,
            "description": new_branch.description,
            "fork_point_id": new_branch.fork_point_id,
            "parent_branch_id": new_branch.parent_branch_id,
            "priority": new_branch.priority
        }

    @mcp.tool()
    async def switch_branch(
        branch_id: str,
        session_id: str = None
    ) -> dict:
        """
        切换到指定的思维分支

        切换后，后续的 think 操作将在新分支上进行。

        Args:
            branch_id: 目标分支ID
            session_id: 会话ID (可选)

        Returns:
            {"status": "switched", "branch_id": "..."}
        """
        engine = get_engine(session_id)
        engine.switch_branch(branch_id)

        logger.info(f"Switched to branch: {branch_id}")

        return {
            "status": "switched",
            "branch_id": branch_id,
            "current_thought_id": engine._current_thought_id
        }

    @mcp.tool()
    async def revise(
        target_thought_id: str,
        new_content: str,
        reason: str,
        session_id: str = None
    ) -> dict:
        """
        修正之前的思维

        当发现之前的推理有误或需要更新时，使用此功能修正。
        原思维会被标记为 "revised"，新思维会链接到原思维。

        Args:
            target_thought_id: 要修正的思维节点ID
            new_content: 新的思维内容
            reason: 修正原因 - 解释为什么需要修正
            session_id: 会话ID (可选)

        Returns:
            修正后的新思维节点信息

        Example:
            # 发现之前的分析有误
            revise(
                target_thought_id="thought_001",
                new_content="重新分析后发现问题在于内存泄漏，而非算法复杂度",
                reason="通过 profiler 发现真正的性能瓶颈"
            )
        """
        engine = get_engine(session_id)

        revision = engine.revise(
            target_thought_id=target_thought_id,
            new_content=new_content,
            reason=reason
        )

        logger.info(f"Revised thought {target_thought_id} with {revision.id}")

        return revision.to_dict()

    @mcp.tool()
    async def backtrack(
        to_thought_id: str,
        session_id: str = None
    ) -> dict:
        """
        回溯到之前的思维节点

        放弃当前推理路径，返回到指定的思维节点重新开始。
        回溯点之后的所有思维将被标记为 "abandoned"。

        Args:
            to_thought_id: 目标思维节点ID - 要回溯到的位置
            session_id: 会话ID (可选)

        Returns:
            {"status": "backtracked", "to": "thought_xxx"}

        Example:
            # 发现当前方向走不通，回到较早的分析点
            backtrack(to_thought_id="thought_003")
            # 然后从新的方向继续
            think("尝试另一种方法...")
        """
        engine = get_engine(session_id)
        engine.backtrack(to_thought_id)

        logger.info(f"Backtracked to thought: {to_thought_id}")

        return {
            "status": "backtracked",
            "to": to_thought_id,
            "current_thought_id": engine._current_thought_id,
            "current_branch_id": engine._current_branch_id
        }

    @mcp.tool()
    async def conclude(
        conclusion: str,
        confidence: float = 1.0,
        session_id: str = None
    ) -> dict:
        """
        添加结论思维

        标记推理过程的最终结论。一个推理过程可以有多个结论
        (例如不同分支的结论)。

        Args:
            conclusion: 结论内容
            confidence: 置信度 (0.0-1.0)
            session_id: 会话ID (可选)

        Returns:
            结论思维节点信息

        Example:
            conclude(
                "性能问题的根本原因是 N+1 查询，建议使用 eager loading 解决",
                confidence=0.95
            )
        """
        engine = get_engine(session_id)
        thought = engine.conclude(conclusion, confidence)

        logger.info(f"Added conclusion: {thought.id}")

        return thought.to_dict()

    # ========== 查询工具 ==========

    @mcp.tool()
    async def get_chain(
        branch_id: str = None,
        session_id: str = None
    ) -> list:
        """
        获取思维链

        返回指定分支的完整思维链，按时间顺序排列。

        Args:
            branch_id: 分支ID (可选，默认当前分支)
            session_id: 会话ID (可选)

        Returns:
            思维节点列表
        """
        engine = get_engine(session_id)
        chain = engine.get_thought_chain(branch_id)

        return [t.to_dict() for t in chain]

    @mcp.tool()
    async def get_state(session_id: str = None) -> dict:
        """
        获取当前推理状态

        返回引擎的完整状态，包括所有思维和分支。

        Args:
            session_id: 会话ID (可选)

        Returns:
            完整状态字典
        """
        engine = get_engine(session_id)

        state = engine.to_dict()
        state["summary"] = {
            "total_thoughts": len(engine._thoughts),
            "total_branches": len(engine._branches),
            "active_thoughts": len(engine.get_active_thoughts()),
            "conclusions": len(engine.get_conclusions()),
            "current_branch": engine._current_branch_id,
            "current_thought": engine._current_thought_id
        }

        return state

    @mcp.tool()
    async def get_conclusions(session_id: str = None) -> list:
        """
        获取所有结论

        返回当前推理过程中的所有结论节点。

        Args:
            session_id: 会话ID (可选)

        Returns:
            结论节点列表
        """
        engine = get_engine(session_id)
        conclusions = engine.get_conclusions()

        return [c.to_dict() for c in conclusions]

    @mcp.tool()
    async def get_best_branch(session_id: str = None) -> dict:
        """
        获取最佳分支

        基于优先级和平均置信度计算最佳分支。

        Args:
            session_id: 会话ID (可选)

        Returns:
            最佳分支信息
        """
        engine = get_engine(session_id)
        best = engine.get_best_branch()

        return {
            "id": best.id,
            "name": best.name,
            "description": best.description,
            "priority": best.priority,
            "thought_count": len(best.thoughts)
        }

    @mcp.tool()
    async def export_markdown(session_id: str = None) -> str:
        """
        导出思维链为 Markdown 格式

        生成可读的 Markdown 文档，展示完整的推理过程。

        Args:
            session_id: 会话ID (可选)

        Returns:
            Markdown 格式的思维链
        """
        engine = get_engine(session_id)
        return engine.to_markdown()

    # ========== 管理工具 ==========

    @mcp.tool()
    async def reset(session_id: str = None) -> dict:
        """
        重置思维引擎

        清除所有思维和分支，恢复到初始状态。

        Args:
            session_id: 会话ID (可选)

        Returns:
            {"status": "reset"}
        """
        engine = get_engine(session_id)
        engine.reset()

        logger.info(f"Engine reset (session: {session_id or 'default'})")

        return {"status": "reset"}

    @mcp.tool()
    async def list_sessions() -> list:
        """
        列出所有活跃会话

        Returns:
            会话ID列表及其状态
        """
        sessions = []

        if _default_engine:
            sessions.append({
                "id": "default",
                "thoughts": len(_default_engine._thoughts),
                "branches": len(_default_engine._branches)
            })

        for sid, engine in _engines.items():
            sessions.append({
                "id": sid,
                "thoughts": len(engine._thoughts),
                "branches": len(engine._branches)
            })

        return sessions

    @mcp.tool()
    async def delete_session(session_id: str) -> dict:
        """
        删除指定会话

        Args:
            session_id: 会话ID

        Returns:
            {"status": "deleted", "session_id": "..."}
        """
        if session_id in _engines:
            del _engines[session_id]
            logger.info(f"Deleted session: {session_id}")
            return {"status": "deleted", "session_id": session_id}

        return {"status": "not_found", "session_id": session_id}

    return mcp


# 创建默认 Server 实例
app = create_server()


# ============ 入口点 ============

def main():
    """
    命令行入口点

    支持两种运行模式:
    - stdio: 标准输入输出 (默认，Cherry Studio 兼容)
    - sse: Server-Sent Events (HTTP)
    """
    import argparse
    import asyncio

    parser = argparse.ArgumentParser(description="SequentialThinking MCP Server")
    parser.add_argument("--sse", action="store_true", help="Use SSE transport instead of stdio")
    parser.add_argument("--port", type=int, default=8001, help="Port for SSE transport")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host for SSE transport")

    args = parser.parse_args()

    if args.sse:
        # SSE 模式
        import uvicorn
        from starlette.applications import Starlette
        from starlette.routing import Mount

        app.settings.streamable_http_path = "/"

        sse_app = Starlette(
            routes=[
                Mount("/", app.streamable_http_app()),
            ]
        )

        logger.info(f"Starting SequentialThinking MCP Server (SSE) on {args.host}:{args.port}")
        uvicorn.run(sse_app, host=args.host, port=args.port)
    else:
        # stdio 模式 (Cherry Studio 兼容)
        logger.info("Starting SequentialThinking MCP Server (stdio)")
        app.run()


if __name__ == "__main__":
    main()
