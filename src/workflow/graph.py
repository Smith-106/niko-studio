"""
写作工作流图 (State Graph)

基于 LangGraph 构建的 Agentic Loop.
目前作为 facade，将逻辑委托给 Domain Adapters (如 NovelAdapter).

Entry Points:
- compile_graph: 编译工作流应用
- run_writing_session: 运行一次性会话
"""

from typing import Dict, Any, Optional
from langgraph.graph import StateGraph
from langgraph.checkpoint.memory import MemorySaver

from src.workflow.state import (
    WritingState, 
    WorkflowConfig, 
    DEFAULT_CONFIG,
    create_initial_state
)


# ============================================================
# 图构建 (Graph Construction)
# ============================================================

def create_writing_graph(config: WorkflowConfig = DEFAULT_CONFIG) -> StateGraph:
    """
    创建写作工作流图
    
    Delegates to NovelAdapter for graph construction.
    """
    from src.workflow.adapters import AdapterRegistry, DomainType
    
    # Create adapter and get graph
    adapter = AdapterRegistry.create_adapter(DomainType.NOVEL.value, config)
    if not adapter:
        raise ValueError("Failed to create NovelAdapter")

    return adapter.create_graph()


def compile_graph(config: WorkflowConfig = DEFAULT_CONFIG, use_memory: bool = True):
    """
    编译工作流图
    
    Args:
        config: 工作流配置
        use_memory: 是否使用内存检查点
        
    Returns:
        编译后的应用
    """
    workflow = create_writing_graph(config)
    
    if use_memory:
        memory = MemorySaver()
        return workflow.compile(checkpointer=memory)
    
    return workflow.compile()


# ============================================================
# 便捷函数
# ============================================================

async def run_writing_session(
    user_idea: str,
    genre: str = "悬疑",
    target_chapters: int = 30,
    config: WorkflowConfig = DEFAULT_CONFIG,
    verbose: bool = True
) -> WritingState:
    """
    运行完整写作会话
    
    Args:
        user_idea: 用户的故事灵感
        genre: 故事类型
        target_chapters: 目标章节数
        config: 工作流配置
        verbose: 是否输出详细日志
        
    Returns:
        最终状态
    """
    
    # 创建初始状态
    initial_state = create_initial_state(
        user_idea=user_idea,
        genre=genre,
        target_chapters=target_chapters
    )
    
    # 编译图
    app = compile_graph(config, use_memory=False)
    
    # 运行
    if verbose:
        print("\n" + "="*60)
        print("🚀 开始写作会话")
        print("="*60)
        print(f"💡 灵感: {user_idea[:100]}...")
        print(f"📚 类型: {genre}")
        print(f"📖 目标章节: {target_chapters}")
    
    # 流式执行
    final_state = None
    async for output in app.astream(initial_state):
        for node_name, node_output in output.items():
            if verbose:
                print(f"\n[Node: {node_name}] 完成")
            final_state = {**initial_state, **node_output} if final_state is None else {**final_state, **node_output}
    
    return final_state


# Default compiled app for import
try:
    app = compile_graph()
except Exception as e:
    # Handle cases where LLM keys are missing during import time
    print(f"Warning: Could not compile default graph on import: {e}")
    app = None
