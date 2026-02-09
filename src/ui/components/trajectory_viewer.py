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
from src.ui.translations import t


def render_trajectory_viewer(
    trajectory: List[Dict[str, Any]],
    title: str = None
) -> None:
    """
    渲染推理轨迹查看器
    
    Args:
        trajectory: 轨迹数据列表，每项包含 {node, action, thought, result, timestamp}
        title: 标题
    """
    if title is None:
        title = t("trajectory_title")
    st.subheader(title)
    
    if not trajectory:
        st.info(t("no_trajectory_data"))
        return
    
    # 时间线视图
    for i, step in enumerate(trajectory):
        node_name = step.get("node", f"Step {i+1}")
        default_action = "执行" if st.session_state.get("language") == "中文" else "Execute"
        action = step.get("action", default_action)
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
                st.markdown(f"**{t('thought_process')}:**")
                st.markdown(f"> {thought}")
            
            # 结果
            if result:
                st.markdown(f"**{t('output_result')}:**")
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
    st.subheader(t("workflow_progress"))
    
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
    st.subheader(t("agent_timeline"))
    
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
    st.subheader(t("decision_point"))
    
    question = decision.get("question", t("decision_question_default"))
    options = decision.get("options", [])
    selected = decision.get("selected", "")
    reason = decision.get("reason", "")
    
    st.markdown(f"**❓ {question}**")
    
    for opt in options:
        if opt == selected:
            st.success(f"✅ {opt} {t('selected_opt')}")
        else:
            st.caption(f"⚪ {opt}")
    
    if reason:
        st.info(f"💡 **{t('decision_reason')}**: {reason}")


# 测试代码
if __name__ == "__main__":
    st.set_page_config(page_title="Trajectory Viewer Test", layout="wide")
    st.title("推理轨迹查看器测试")
    
    # 测试数据
    test_trajectory = [
        {
            "node": "Architect",
            "action": "分析场景结构",
            "thought": "用户要求写一个悬疑开场，需要设计足够的冲突...",
            "result": {"scene_type": "opening", "conflict_level": "high"},
            "timestamp": "2024-01-25 22:00:01",
            "status": "completed"
        },
        {
            "node": "Writer",
            "action": "生成初稿",
            "thought": "基于 Architect 的场景卡片，开始按五感描写...",
            "result": {"draft_content": "夜幕低垂，雨点敲打着窗户..."},
            "timestamp": "2024-01-25 22:00:15",
            "status": "completed"
        },
        {
            "node": "Critic",
            "action": "评估质量",
            "thought": "检查 LOCK 系统和 8 维度...",
            "result": {
                "lock_scores": {"L": 7, "O": 8, "C": 6, "K": 7},
                "decision": "建议修改"
            },
            "timestamp": "2024-01-25 22:00:30",
            "status": "completed"
        }
    ]
    
    render_trajectory_viewer(test_trajectory)
    
    st.divider()
    
    render_workflow_progress(
        current_node="Critic",
        nodes=["Architect", "Writer", "Critic", "Human"],
        completed_nodes=["Architect", "Writer", "Critic"]
    )
