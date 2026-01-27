"""
Scene Card Dashboard Component (v1.3)
=====================================
基于 AionUi 视觉化交互 + Claude-Code 文件状态管理
支持 LOCK 评分可视化、Graphviz 依赖图、并行分析
"""

import streamlit as st
import json
import glob
import os
from typing import List, Dict, Any

# 尝试导入 graphviz (可选依赖)
try:
    import graphviz
    HAS_GRAPHVIZ = True
except ImportError:
    HAS_GRAPHVIZ = False


# --- Configuration ---
STATUS_DISPLAY = {
    "DONE": {"icon": "✅", "text": "Completed", "color": "green", "graph_color": "palegreen"},
    "WRITING": {"icon": "✏️", "text": "In Progress", "color": "orange", "graph_color": "lightyellow"},
    "PENDING": {"icon": "⏳", "text": "Pending", "color": "gray", "graph_color": "lightgrey"},
    "REVIEWING": {"icon": "👀", "text": "Under Review", "color": "blue", "graph_color": "lightblue"},
    "FAILED": {"icon": "❌", "text": "Failed", "color": "red", "graph_color": "lightcoral"},
    "UNKNOWN": {"icon": "❓", "text": "Unknown", "color": "gray", "graph_color": "lightgrey"}
}

def get_status_display(status: str) -> Dict[str, str]:
    """获取状态显示信息，带容错处理"""
    status = status.upper() if status else "UNKNOWN"
    return STATUS_DISPLAY.get(status, STATUS_DISPLAY["UNKNOWN"])


# --- 1. 数据加载层 (Data Layer) ---
def load_scenes(task_dir: str = ".task") -> List[Dict[str, Any]]:
    """
    读取所有场景卡片 JSON
    
    Args:
        task_dir: .task 目录路径 (相对于项目根目录)
        
    Returns:
        场景卡片列表，按 ID 排序
    """
    # 获取项目根目录
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    task_path = os.path.join(project_root, task_dir)
    
    if not os.path.exists(task_path):
        os.makedirs(task_path, exist_ok=True)
        return []
    
    files = glob.glob(os.path.join(task_path, "SCENE-*.json"))
    scenes = []
    
    for f in sorted(files):
        try:
            with open(f, "r", encoding="utf-8") as file:
                data = json.load(file)
                # 确保有关键字段
                if "id" not in data:
                    data["id"] = os.path.basename(f).replace(".json", "")
                data["_filepath"] = f
                scenes.append(data)
        except Exception as e:
            st.error(f"无法读取 {f}: {e}")
    
    return scenes


# --- 2. 视觉化组件 (Visual Components) ---
def render_lock_metrics(lock_scores: Dict[str, Any]) -> None:
    """
    渲染 LOCK 评分的小指标
    
    Args:
        lock_scores: LOCK 分数字典
    """
    cols = st.columns(4)
    metrics = [
        ("L", "主角", "Lead - 主角的吸引力"),
        ("O", "目标", "Objective - 目标的清晰度"),
        ("C", "冲突", "Confrontation - 冲突的强度 (权重最高)"),
        ("K", "结尾", "Knockout - 结尾的冲击力")
    ]
    
    for idx, (key, label, tooltip) in enumerate(metrics):
        score = lock_scores.get(key, 0)
        delta = score - 5  # 假设 5 分是及格线
        cols[idx].metric(label, f"{score}/10", delta=delta, help=tooltip)
    
    # 计算总分
    total = sum(lock_scores.get(k, 0) for k in ["L", "O", "C", "K"])
    st.progress(total / 40, text=f"LOCK 总分: {total}/40")


def render_dependency_graph_graphviz(scenes: List[Dict[str, Any]]) -> None:
    """
    使用 graphviz 库生成依赖图 (更灵活的样式)
    
    Args:
        scenes: 场景列表
    """
    if not HAS_GRAPHVIZ:
        st.warning("graphviz 库未安装，使用内置图表")
        render_dependency_graph_builtin(scenes)
        return
    
    graph = graphviz.Digraph()
    graph.attr(rankdir='LR')  # 左到右布局
    graph.attr('node', shape='box', style='filled')
    
    # 创建节点
    for s in scenes:
        status = s.get("status", "PENDING")
        status_info = get_status_display(status)
        
        # 节点标签 (包含状态图标和文本)
        lock_scores = s.get("lock_scores", {})
        total_lock = sum(lock_scores.get(k, 0) for k in ["L", "O", "C", "K"])
        title = s.get("title", "")[:15]
        
        # WCAG 1.4.1 compliance: Include icon and status text
        label = f"{status_info['icon']} {s['id']}\\n{title}\\n{status_info['text']}\\n(LOCK: {total_lock})"

        graph.node(s['id'], label=label, fillcolor=status_info['graph_color'])
    
    # 创建边 (依赖关系)
    scene_ids = {s['id'] for s in scenes}
    for s in scenes:
        deps = s.get("dependencies", [])
        for d in deps:
            if d in scene_ids:
                graph.edge(d, s['id'])
    
    st.graphviz_chart(graph)
    st.caption("🟢 完成 | 🟡 进行中 | 🔵 审查中 | ⚪ 待处理 | 🔴 失败")


def render_dependency_graph_builtin(scenes: List[Dict[str, Any]]) -> None:
    """
    使用 Streamlit 内置 graphviz_chart (DOT 语法)
    
    Args:
        scenes: 场景列表
    """
    dot_lines = ["digraph SceneDependency {"]
    dot_lines.append("  rankdir=LR;")
    dot_lines.append('  node [shape=box, style=filled];')
    
    for s in scenes:
        sid = s.get("id", "???")
        title = s.get("title", "")[:12]
        status = s.get("status", "PENDING")
        status_info = get_status_display(status)
        
        lock_scores = s.get("lock_scores", {})
        total = sum(lock_scores.get(k, 0) for k in ["L", "O", "C", "K"])
        
        # WCAG 1.4.1 compliance: Include icon and status text
        label = f"{status_info['icon']} {sid}\\n{title}\\n{status_info['text']}\\n(LOCK:{total})"

        # 使用 graph_color 作为填充色 (需要映射到 hex 或直接使用颜色名，Graphviz 支持常见颜色名)
        style = f'fillcolor="{status_info["graph_color"]}"'

        dot_lines.append(f'  "{sid}" [label="{label}", {style}];')
    
    for s in scenes:
        sid = s.get("id", "")
        for dep in s.get("dependencies", []):
            dot_lines.append(f'  "{dep}" -> "{sid}";')
    
    dot_lines.append("}")
    
    st.graphviz_chart("\n".join(dot_lines))
    st.caption("🟢 完成 | 🟡 进行中 | 🔵 审查中 | ⚪ 待处理 | 🔴 失败")


def analyze_parallelization(scenes: List[Dict[str, Any]]) -> Dict[int, List[str]]:
    """
    分析并行执行潜力 (Agentic Pattern: Parallelization)
    
    Args:
        scenes: 场景列表
        
    Returns:
        层级字典 {level: [scene_ids]}
    """
    # 构建依赖图
    scene_map = {s.get("id"): s for s in scenes}
    
    def get_level(scene_id: str, visited: set = None) -> int:
        """递归计算场景层级"""
        if visited is None:
            visited = set()
        
        if scene_id in visited:
            return 0  # 避免循环依赖
        visited.add(scene_id)
        
        scene = scene_map.get(scene_id)
        if not scene:
            return 0
        
        deps = scene.get("dependencies", [])
        if not deps:
            return 1
        
        max_dep_level = 0
        for dep in deps:
            dep_level = get_level(dep, visited.copy())
            max_dep_level = max(max_dep_level, dep_level)
        
        return max_dep_level + 1
    
    # 计算每个场景的层级
    levels: Dict[int, List[str]] = {}
    for s in scenes:
        sid = s.get("id")
        level = get_level(sid)
        if level not in levels:
            levels[level] = []
        levels[level].append(sid)
    
    return dict(sorted(levels.items()))


def render_parallelization_analysis(scenes: List[Dict[str, Any]]) -> None:
    """
    渲染并行分析结果
    
    Args:
        scenes: 场景列表
    """
    levels = analyze_parallelization(scenes)
    
    if not levels:
        st.info("暂无可分析的场景")
        return
    
    # 统计
    l1_count = len(levels.get(1, []))
    st.info(f"🚀 发现 **{l1_count}** 个场景可以立即并行启动 (L1 层级)")
    
    # 可执行分析
    done_ids = {s.get("id") for s in scenes if s.get("status") == "DONE"}
    
    parallel_ready = []
    for s in scenes:
        if s.get("status") in ["PENDING", "WRITING"]:
            deps = s.get("dependencies", [])
            if not deps or all(d in done_ids for d in deps):
                parallel_ready.append(s.get("id"))
    
    if parallel_ready:
        st.success(f"✅ **可立即执行的场景**: {', '.join(parallel_ready)}")
    
    # 层级图
    st.subheader("📊 执行层级图")
    for level, sids in levels.items():
        with st.container(border=True):
            st.markdown(f"**Level {level}** ({len(sids)} 个场景)")
            cols = st.columns(len(sids)) if len(sids) <= 4 else st.columns(4)
            for i, sid in enumerate(sids):
                scene = next((s for s in scenes if s.get("id") == sid), None)
                if scene:
                    status = scene.get("status", "PENDING")
                    status_info = get_status_display(status)
                    # WCAG 1.4.1 compliance: Include status text
                    cols[i % len(cols)].markdown(f"{status_info['icon']} `{sid}` ({status_info['text']})")
    
    # JSON 详情
    with st.expander("📋 查看完整层级数据"):
        st.json(levels)


# --- 3. 主仪表板入口 ---
def render_scene_dashboard() -> None:
    """渲染完整的场景卡片仪表板"""
    st.markdown("### 📇 故事场景控制台 (Scene Dashboard)")
    
    scenes = load_scenes()
    
    if not scenes:
        st.warning("⚠️ 未检测到场景卡片。场景将保存在 `.task/SCENE-*.json`")
        st.info("💡 提示: 运行 Architect Agent 生成大纲，或手动创建场景 JSON 文件")
        return
    
    # 全局指标
    done_count = sum(1 for s in scenes if s.get("status") == "DONE")
    writing_count = sum(1 for s in scenes if s.get("status") == "WRITING")
    
    # 计算平均 LOCK 分数
    lock_totals = []
    for s in scenes:
        lock_scores = s.get("lock_scores", {})
        total = sum(lock_scores.get(k, 0) for k in ["L", "O", "C", "K"])
        if total > 0:
            lock_totals.append(total)
    avg_lock = sum(lock_totals) / len(lock_totals) if lock_totals else 0
    
    # 顶部指标
    k1, k2, k3, k4 = st.columns(4)
    k1.metric("总场景数", len(scenes))
    k2.metric("已完成", f"{done_count}/{len(scenes)}")
    k3.metric("进行中", writing_count)
    k4.metric("平均 LOCK", f"{avg_lock:.1f}/40")
    
    st.divider()
    
    # Tabs
    tab_list, tab_graph, tab_analysis = st.tabs(["📇 卡片视图", "🕸️ 依赖关系图", "🚀 并行分析"])
    
    with tab_list:
        for s in scenes:
            status = s.get("status", "PENDING")
            status_info = get_status_display(status)
            
            with st.container(border=True):
                c1, c2 = st.columns([3, 1])
                with c1:
                    st.subheader(f"{status_info['icon']} {s.get('id')}: {s.get('title', '未命名')}")
                    if "summary" in s:
                        st.caption(f"📝 {s['summary']}")
                with c2:
                    # WCAG 1.4.1 compliance: Icon + Text + Code style for status
                    st.markdown(f"{status_info['icon']} **{status_info['text']}** `{status}`")
                    word_count = s.get("word_count", 0)
                    if word_count:
                        st.caption(f"📊 {word_count:,} 字")
                
                # LOCK 详情折叠
                with st.expander("📊 LOCK 评分与诊断"):
                    lock_scores = s.get("lock_scores", {})
                    if lock_scores:
                        render_lock_metrics(lock_scores)
                    else:
                        st.info("尚未评估")
                    
                    if "critique" in s:
                        st.warning(f"💬 **批评意见**: {s['critique']}")
                    
                    # HITL 按钮
                    col_btn1, col_btn2 = st.columns(2)
                    with col_btn1:
                        if st.button(f"✏️ 编辑", key=f"edit_{s['id']}"):
                            st.session_state["editing_scene"] = s['id']
                    with col_btn2:
                        if st.button(f"🔄 重新生成", key=f"regen_{s['id']}"):
                            st.info(f"将重新生成 {s['id']}")
    
    with tab_graph:
        st.caption("基于 Graphviz 的场景依赖拓扑图")
        if HAS_GRAPHVIZ:
            render_dependency_graph_graphviz(scenes)
        else:
            render_dependency_graph_builtin(scenes)
    
    with tab_analysis:
        render_parallelization_analysis(scenes)


# --- 测试入口 ---
if __name__ == "__main__":
    st.set_page_config(page_title="Scene Dashboard Test", layout="wide")
    st.title("场景卡片仪表板测试")
    render_scene_dashboard()
