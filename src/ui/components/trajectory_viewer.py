"""
推理轨迹查看器组件
===================
显示 Agent 的思考过程和决策轨迹 (Trajectory Viewer)
参考 Agentic Design Patterns 中的评估与监控最佳实践
"""

import streamlit as st
import json
from typing import Dict, Any, List, Optional
from datetime import datetime


def render_trajectory_viewer(
    trajectory: List[Dict[str, Any]],
    title: str = "🧠 Agent 推理轨迹"
) -> None:
    """
    渲染推理轨迹查看器
    
    Args:
        trajectory: 轨迹数据列表，每项包含 {node, action, thought, result, timestamp}
        title: 标题
    """
    st.subheader(title)
    
    if not trajectory:
        st.info("暂无推理轨迹数据")
        return
    
    # 时间线视图
    for i, step in enumerate(trajectory):
        node_name = step.get("node", f"Step {i+1}")
        action = step.get("action", "执行")
        thought = step.get("thought", "")
        result = step.get("result", {})
        timestamp = step.get("timestamp", "")
        status = step.get("status", "completed")
        
        # 状态图标
        status_icons = {
            "completed": "✅",
            "running": "🔄",
            "failed": "❌",
            "skipped": "⏭️"
        }
        icon = status_icons.get(status, "📌")
        
        # 节点卡片
        with st.expander(f"{icon} **{node_name}**: {action}", expanded=(i == len(trajectory) - 1)):
            # 时间戳
            if timestamp:
                st.caption(f"🕐 {timestamp}")
            
            # 思考过程
            if thought:
                st.markdown("**思考过程:**")
                st.markdown(f"> {thought}")
            
            # 结果
            if result:
                st.markdown("**输出结果:**")
                if isinstance(result, dict):
                    # 特殊处理常见字段
                    if "draft_content" in result:
                        with st.container():
                            st.markdown(result["draft_content"][:500] + "..." 
                                       if len(result.get("draft_content", "")) > 500 
                                       else result.get("draft_content", ""))
                    elif "lock_scores" in result:
                        col1, col2, col3, col4 = st.columns(4)
                        scores = result["lock_scores"]
                        with col1:
                            st.metric("L", scores.get("L", 0))
                        with col2:
                            st.metric("O", scores.get("O", 0))
                        with col3:
                            st.metric("C", scores.get("C", 0))
                        with col4:
                            st.metric("K", scores.get("K", 0))
                    else:
                        st.json(result)
                else:
                    st.code(str(result))
            
            # 分隔线
            if i < len(trajectory) - 1:
                st.markdown("---")


def render_workflow_progress(
    current_node: str,
    nodes: List[str],
    completed_nodes: List[str]
) -> None:
    """
    渲染工作流进度条
    
    Args:
        current_node: 当前节点
        nodes: 所有节点列表
        completed_nodes: 已完成节点列表
    """
    st.subheader("📊 工作流进度")
    
    # 计算进度
    progress = len(completed_nodes) / len(nodes) if nodes else 0
    st.progress(progress)
    
    # 节点状态
    cols = st.columns(len(nodes))
    for i, (col, node) in enumerate(zip(cols, nodes)):
        with col:
            if node in completed_nodes:
                st.success(f"✅ {node}")
            elif node == current_node:
                st.info(f"🔄 {node}")
            else:
                st.caption(f"⏳ {node}")


def render_agent_timeline(
    events: List[Dict[str, Any]],
    max_events: int = 10
) -> None:
    """
    渲染 Agent 事件时间线
    
    Args:
        events: 事件列表
        max_events: 最大显示事件数
    """
    st.subheader("📅 Agent 事件时间线")
    
    # 限制显示数量
    display_events = events[-max_events:] if len(events) > max_events else events
    
    for event in reversed(display_events):
        agent = event.get("agent", "Unknown")
        action = event.get("action", "")
        time = event.get("time", "")
        details = event.get("details", "")
        
        # Agent 颜色映射
        agent_colors = {
            "Architect": "🔵",
            "Writer": "🟢",
            "Critic": "🔴",
            "Commander": "🟣",
            "Human": "🟡"
        }
        color = agent_colors.get(agent, "⚪")
        
        st.markdown(f"{color} **{agent}** - {action}")
        if details:
            st.caption(details)
        if time:
            st.caption(f"🕐 {time}")
        st.markdown("---")


def render_decision_tree(
    decision: Dict[str, Any]
) -> None:
    """
    渲染决策树视图
    
    Args:
        decision: 决策数据，包含 question, options, selected, reason
    """
    st.subheader("🌳 决策点")
    
    question = decision.get("question", "决策问题")
    options = decision.get("options", [])
    selected = decision.get("selected", "")
    reason = decision.get("reason", "")
    
    st.markdown(f"**❓ {question}**")
    
    for opt in options:
        if opt == selected:
            st.success(f"✅ {opt} (已选择)")
        else:
            st.caption(f"⚪ {opt}")
    
    if reason:
        st.info(f"💡 **决策理由**: {reason}")


def announce_workflow_step(node_name: str, status_container: Any = None) -> None:
    """
    Announces the completion of a workflow step via Toast and updates the Status container.
    Also renders a visual log entry in the current context.
    
    Args:
        node_name: The name of the completed node/step.
        status_container: The st.status container object (optional).
    """
    # 1. Visual log (Markdown) inside the container (caller context)
    st.markdown(f"✅ **{node_name}** 完成")
    
    # 2. Toast notification (ARIA-live region in newer Streamlit)
    st.toast(f"Step completed: {node_name}", icon="✅")
    
    # 3. Update Status Container Label
    if status_container:
        status_container.update(label=f"🔄 正在执行... (刚刚完成: {node_name})", state="running")


def render_execution_summary(completed_steps: List[str], final_status: str = "complete", error_message: str = None) -> None:
    """
    Renders a summary of the workflow execution.
    
    Args:
        completed_steps: List of completed node names.
        final_status: 'complete' or 'error'.
        error_message: Optional error message if failed.
    """
    with st.expander("📊 执行摘要 / Status Summary", expanded=True):
        if final_status == "complete":
            st.success("✅ 工作流执行成功 / Workflow completed successfully!")
        else:
            st.error(f"❌ 工作流执行失败 / Workflow failed: {error_message}")

        st.write(f"**共完成步骤 / Completed steps:** {len(completed_steps)}")
        if completed_steps:
            path_str = " → ".join([f"`{s}`" for s in completed_steps])
            st.markdown(f"**执行路径 / Execution Path:** {path_str}")
