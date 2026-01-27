"""
AI Writing Workbench - Streamlit Prototype (AionUi Enhanced)
============================================================
基于 AionUi 多代理协作 + Cherry Studio 交互体验 + Claude-Code-Workflow 状态管理
"""

import streamlit as st
import sqlite3
import json
import os
import glob
from datetime import datetime
from typing import Optional, Dict, Any, List
from src.ui.translations import t

# === 配置 ===
st.set_page_config(
    layout="wide", 
    page_title="AI Writing Workbench",
    page_icon="✍️",
    initial_sidebar_state="expanded"
)

# === AionUi 参考: SQLite 本地存储 ===
DB_PATH = os.path.join(os.path.dirname(__file__), "local_memory.db")


def init_db() -> sqlite3.Connection:
    """初始化 SQLite 数据库"""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    c = conn.cursor()
    
    # 会话历史表
    c.execute('''CREATE TABLE IF NOT EXISTS chat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        role TEXT,
        content TEXT,
        agent_name TEXT,
        thought_process TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    # 草稿版本表
    c.execute('''CREATE TABLE IF NOT EXISTS draft_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        version INTEGER,
        content TEXT,
        lock_scores TEXT,
        quality_scores TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    # 会话配置表
    c.execute('''CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        name TEXT,
        work_mode TEXT,
        model_name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    conn.commit()
    return conn


def save_message(conn: sqlite3.Connection, session_id: str, role: str, 
                 content: str, agent_name: str = None, thought_process: dict = None):
    """保存消息到数据库"""
    c = conn.cursor()
    c.execute('''INSERT INTO chat_history 
                 (session_id, role, content, agent_name, thought_process)
                 VALUES (?, ?, ?, ?, ?)''',
              (session_id, role, content, agent_name, 
               json.dumps(thought_process) if thought_process else None))
    conn.commit()


def load_messages(conn: sqlite3.Connection, session_id: str) -> list:
    """从数据库加载消息"""
    c = conn.cursor()
    c.execute('''SELECT role, content, agent_name, thought_process 
                 FROM chat_history WHERE session_id = ? ORDER BY id''',
              (session_id,))
    messages = []
    for row in c.fetchall():
        msg = {"role": row[0], "content": row[1]}
        if row[2]:
            msg["agent_name"] = row[2]
        if row[3]:
            msg["thought_process"] = json.loads(row[3])
        messages.append(msg)
    return messages


def save_draft(conn: sqlite3.Connection, session_id: str, content: str,
               lock_scores: dict = None, quality_scores: dict = None) -> int:
    """保存草稿版本"""
    c = conn.cursor()
    # 获取当前最大版本号
    c.execute("SELECT MAX(version) FROM draft_versions WHERE session_id = ?", (session_id,))
    result = c.fetchone()
    current_version = result[0] if result[0] is not None else 0
    new_version = current_version + 1

    c.execute('''INSERT INTO draft_versions
                 (session_id, version, content, lock_scores, quality_scores)
                 VALUES (?, ?, ?, ?, ?)''',
              (session_id, new_version, content,
               json.dumps(lock_scores) if lock_scores else None,
               json.dumps(quality_scores) if quality_scores else None))
    conn.commit()
    return new_version


# === 初始化 ===
conn = init_db()

# Session State 初始化
if "session_id" not in st.session_state:
    st.session_state.session_id = f"sess_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
if "messages" not in st.session_state:
    st.session_state.messages = load_messages(conn, st.session_state.session_id)
if "current_draft" not in st.session_state:
    st.session_state.current_draft = ""
if "critique_result" not in st.session_state:
    st.session_state.critique_result = {}
if "workflow_running" not in st.session_state:
    st.session_state.workflow_running = False


# === 1. Sidebar: AionUi 多代理协作设置 ===
with st.sidebar:
    st.title(t("sidebar_title"))

    # Language Toggle
    if "language" not in st.session_state:
        st.session_state.language = "中文"

    lang_idx = 0 if st.session_state.language == "中文" else 1
    selected_lang = st.selectbox(
        "Language / 语言",
        ["中文", "English"],
        index=lang_idx,
        key="language_select"
    )
    if selected_lang != st.session_state.language:
        st.session_state.language = selected_lang
        st.rerun()
    
    # 会话管理
    st.subheader(t("session_mgmt"))
    st.text_input(t("current_session"), value=st.session_state.session_id, disabled=True)
    
    if st.button(t("new_session")):
        st.session_state.session_id = f"sess_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        st.session_state.messages = []
        st.session_state.current_draft = ""
        st.session_state.critique_result = {}
        st.rerun()
    
    st.divider()
    
    # 模式选择 (参考 AionUi 预设 Assistants / CCW 5级工作流)
    st.subheader(t("collab_mode"))

    # Workflow options
    workflow_options = [
        "L1: 快速修改 (lite-lite-lite)",
        "L2: 场景规划 (lite-plan)",
        "L3: 章节开发 (plan + execute)",
        "L4: 故事探索 (brainstorm)",
        "L5: 全流程编排 (coordinator)"
    ]
    if st.session_state.language == "English":
        workflow_options = [
            "L1: Quick Edit (lite-lite-lite)",
            "L2: Scene Planning (lite-plan)",
            "L3: Chapter Dev (plan + execute)",
            "L4: Story Explore (brainstorm)",
            "L5: Full Orchestration (coordinator)"
        ]

    work_mode = st.selectbox(
        t("workflow_level"),
        workflow_options,
        help=t("workflow_level_help")
    )
    
    # 模型路由 (参考 OpenRouter/AionUi 多模型)
    model_name = st.selectbox(
        t("base_model"),
        ["gemini-2.0-flash", "gpt-4o", "claude-3-5-sonnet", "deepseek-chat"],
        help=t("select_model")
    )
    
    st.divider()
    
    # 参数设置 (参考 Cherry Studio)
    st.subheader(t("gen_params"))
    temperature = st.slider("Temperature", 0.0, 1.0, 0.7, 0.1)
    max_loops = st.number_input(t("max_loops"), min_value=1, max_value=10, value=3)
    
    # LOCK 评分阈值
    st.subheader(t("quality_thresholds"))
    lock_threshold = st.slider(t("lock_threshold"), 20, 40, 28)
    quality_threshold = st.slider(t("dim8_threshold"), 50, 100, 70)
    
    st.divider()
    
    # 调试信息
    with st.expander(t("debug_info")):
        st.json({
            "session_id": st.session_state.session_id,
            "work_mode": work_mode,
            "model": model_name,
            "messages_count": len(st.session_state.messages)
        })


# === 2. Main Interface ===
col_chat, col_artifacts = st.columns([1, 1])

# --- 左栏: 对话与指令 (Chat Stream) ---
with col_chat:
    st.subheader(t("collab_chat_stream"))
    
    # 渲染历史消息
    chat_container = st.container(height=500)
    with chat_container:
        for msg in st.session_state.messages:
            with st.chat_message(msg["role"]):
                st.markdown(msg["content"])
                
                # 显示 Agent 的思考过程 (Trajectory)
                if "thought_process" in msg and msg["thought_process"]:
                    with st.expander(t("agent_thought_process", agent_name=msg.get('agent_name', 'Agent'))):
                        st.json(msg["thought_process"])

    # 输入区
    user_input = st.chat_input(t("chat_input_placeholder"))
    
    if user_input and not st.session_state.workflow_running:
        # 添加用户消息
        user_msg = {"role": "user", "content": user_input}
        st.session_state.messages.append(user_msg)
        save_message(conn, st.session_state.session_id, "user", user_input)
        
        # 标记工作流运行中
        st.session_state.workflow_running = True
        
        # 显示处理状态
        with st.status(t("workflow_running"), expanded=True) as status:
            st.write(t("parsing_command"))
            
            # 尝试导入并执行 LangGraph 工作流
            try:
                from src.workflow.graph import compile_graph
                from src.workflow.state import WritingState, DEFAULT_CONFIG
                
                st.write(t("starting_langgraph"))
                
                # Parse work_mode string to int level (e.g. "L1: ..." -> 1)
                try:
                    level_int = int(work_mode.split(":")[0].replace("L", ""))
                except:
                    level_int = 3

                # Update config with UI params
                config = DEFAULT_CONFIG.copy()
                config["max_revisions"] = int(max_loops)

                # Compile graph
                langgraph_app = compile_graph(config=config, use_memory=True)

                # 构造初始状态
                initial_state = {
                    "user_idea": user_input,
                    "revision_count": 0,
                    "workflow_level": level_int,
                    "model_name": model_name,
                    "max_revisions": int(max_loops)
                }
                
                # 流式执行
                for output in langgraph_app.stream(initial_state):
                    for node_name, node_content in output.items():
                        st.write(t("node_completed", node_name=node_name))
                        
                        # 捕获草稿内容
                        if "draft_content" in node_content:
                            st.session_state.current_draft = node_content["draft_content"]
                        
                        # 捕获评估结果
                        if "critique_result" in node_content:
                            st.session_state.critique_result = node_content["critique_result"]
                
                status.update(label=t("workflow_completed"), state="complete")
                
                # 添加助手消息
                assistant_msg = {
                    "role": "assistant",
                    "content": t("task_completed_msg"),
                    "agent_name": "Coordinator"
                }
                st.session_state.messages.append(assistant_msg)
                save_message(conn, st.session_state.session_id, "assistant", 
                           assistant_msg["content"], "Coordinator")
                
            except ImportError as e:
                st.write(t("langgraph_not_found", error=str(e)))
                st.write(t("sim_mode"))
                
                # 模拟响应
                mock_response = f"""
**Command Received**: {user_input}

**Workflow**: {work_mode}
**Model**: {model_name}

---

*Simulation Mode / 模拟模式*
"""
                
                st.session_state.current_draft = mock_response
                status.update(label=t("sim_mode_completed"), state="complete")
                
                assistant_msg = {
                    "role": "assistant",
                    "content": mock_response,
                    "agent_name": "Simulator"
                }
                st.session_state.messages.append(assistant_msg)
                save_message(conn, st.session_state.session_id, "assistant",
                           mock_response, "Simulator")
            
            except Exception as e:
                status.update(label=t("workflow_failed", error=str(e)), state="error")
                st.error(t("workflow_failed", error=str(e)))
        
        st.session_state.workflow_running = False
        st.rerun()


# --- 右栏: 文件预览与管理 (AionUi Files & Preview) ---
with col_artifacts:
    st.subheader(t("files_preview"))
    
    # 1. 智能文件管理 (AionUi 拖拽上传)
    with st.expander(t("upload_material"), expanded=False):
        uploaded_file = st.file_uploader(
            t("upload_help"),
            type=['txt', 'md', 'pdf', 'docx'],
            help=t("context_injection_help")
        )
        if uploaded_file:
            st.success(t("file_loaded", filename=uploaded_file.name))
            # TODO: 对接 RAG / Knowledge Memory

    # 2. 多格式预览 Tabs
    tab1, tab2, tab3, tab4, tab5 = st.tabs([
        t("tab_draft"), t("tab_lock"), t("tab_8dim"), t("tab_scene_cards"), t("tab_dependency")
    ])
    
    with tab1:
        # 当前草稿预览
        draft = st.session_state.get("current_draft", t("no_content_placeholder"))
        
        # Markdown 渲染
        preview_container = st.container(height=350)
        with preview_container:
            st.markdown(draft)
        
        # HITL 人工介入
        st.divider()
        st.subheader(t("hitl_title"))
        feedback = st.text_area(t("feedback_label"), placeholder=t("feedback_placeholder"))
        
        col_btn1, col_btn2 = st.columns(2)
        with col_btn1:
            if st.button(t("submit_feedback"), use_container_width=True):
                if feedback:
                    # 将反馈作为新消息
                    feedback_msg = f"[HITL] {feedback}"
                    st.session_state.messages.append({"role": "user", "content": feedback_msg})
                    save_message(conn, st.session_state.session_id, "user", feedback_msg)
                    st.success(t("feedback_submitted_msg"))
                    st.rerun()
        with col_btn2:
            if st.button(t("approve"), use_container_width=True, type="primary"):
                # 获取当前评分
                critique = st.session_state.get("critique_result", {})
                lock_scores = critique.get("lock_scores", {})
                quality_scores = critique.get("quality_scores", {})

                draft_content = st.session_state.get("current_draft", "")

                if draft_content:
                    version = save_draft(conn, st.session_state.session_id, draft_content, lock_scores, quality_scores)
                    st.success(t("draft_saved_msg", version=version))

                    # Add system message
                    sys_msg = f"Draft approved and saved as version v{version}"
                    st.session_state.messages.append({"role": "assistant", "content": sys_msg})
                    save_message(conn, st.session_state.session_id, "assistant", sys_msg)

                else:
                    st.warning(t("no_draft_warning"))

    with tab2:
        # LOCK 评分雷达图
        st.subheader(t("lock_system_score"))
        
        critique = st.session_state.get("critique_result", {})
        lock_scores = critique.get("lock_scores", {
            "L (Lead)": 7,
            "O (Objective)": 8,
            "C (Confrontation)": 6,
            "K (Knockout)": 7
        })
        
        # 使用 Streamlit 内置图表
        import pandas as pd
        
        df_lock = pd.DataFrame({
            "维度": list(lock_scores.keys()),
            "分数": list(lock_scores.values())
        })
        
        st.bar_chart(df_lock.set_index("维度"))
        
        total_lock = sum(lock_scores.values())
        st.metric(t("lock_total"), f"{total_lock}/40",
                  delta=f"{total_lock - lock_threshold}" if total_lock >= lock_threshold else f"{total_lock - lock_threshold}",
                  delta_color="normal" if total_lock >= lock_threshold else "inverse")
        
        # 显示详细分析
        if "lock_analysis" in critique:
            with st.expander(t("detailed_analysis")):
                st.markdown(critique["lock_analysis"])

    with tab3:
        # 8维度质量评分
        st.subheader(t("quality_8dim"))
        
        critique = st.session_state.get("critique_result", {})
        quality_scores = critique.get("quality_scores", {
            "五感描写平衡": 75,
            "视觉质量(万物有灵)": 80,
            "对话质量(潜台词)": 70,
            "角色一致性": 85,
            "节奏控制": 72,
            "情感张力": 78,
            "叙事逻辑": 82,
            "语言风格": 76
        })
        
        df_quality = pd.DataFrame({
            "维度": list(quality_scores.keys()),
            "分数": list(quality_scores.values())
        })
        
        st.bar_chart(df_quality.set_index("维度"))
        
        avg_quality = sum(quality_scores.values()) / len(quality_scores)
        st.metric(t("avg_quality"), f"{avg_quality:.1f}/100",
                  delta=f"{avg_quality - quality_threshold:.1f}" if avg_quality >= quality_threshold else f"{avg_quality - quality_threshold:.1f}",
                  delta_color="normal" if avg_quality >= quality_threshold else "inverse")

    with tab4:
        # 场景卡片仪表板
        st.subheader(t("scene_card_status"))
        
        # 加载 .task/ 目录下的场景文件
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        task_dir = os.path.join(project_root, ".task")
        
        scenes = []
        if os.path.exists(task_dir):
            for filepath in sorted(glob.glob(os.path.join(task_dir, "SCENE-*.json"))):
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        scene = json.load(f)
                        scenes.append(scene)
                except:
                    pass
        
        if scenes:
            # 统计摘要
            total = len(scenes)
            done = sum(1 for s in scenes if s.get("status") == "DONE")
            writing = sum(1 for s in scenes if s.get("status") == "WRITING")
            
            col1, col2, col3 = st.columns(3)
            col1.metric(t("total"), total)
            col2.metric(t("done"), done)
            col3.metric(t("writing"), writing)
            
            st.divider()
            
            # 渲染场景卡片
            for scene in scenes:
                status = scene.get("status", "PENDING")
                status_colors = {"DONE": "green", "WRITING": "orange", "PENDING": "gray"}
                status_icons = {"DONE": "✅", "WRITING": "✍️", "PENDING": "⏳"}
                color = status_colors.get(status, "gray")
                icon = status_icons.get(status, "❓")
                
                with st.container(border=True):
                    c1, c2 = st.columns([3, 1])
                    c1.markdown(f"**{icon} {scene.get('title', '未命名')}** (`{scene.get('id')}`")
                    c2.markdown(f":{color}[{status}]")
                    
                    lock_scores = scene.get("lock_scores", {})
                    if lock_scores and any(lock_scores.values()):
                        total_lock = sum(lock_scores.values())
                        st.progress(total_lock / 40, text=f"LOCK: {total_lock}/40")
                    else:
                        st.progress(0, text=f"LOCK: {t('not_evaluated')}")
        else:
            st.info(t("no_scene_cards"))
    
    with tab5:
        # 依赖关系图 (Graphviz)
        st.subheader(t("scene_dependency_graph"))
        
        if scenes:
            # 构建 Graphviz DOT
            dot_lines = ["digraph SceneDependency {"]
            dot_lines.append("  rankdir=LR;")
            dot_lines.append('  node [shape=box, style=filled];')
            
            status_styles = {
                "DONE": 'fillcolor="#c8e6c9"',
                "WRITING": 'fillcolor="#fff9c4"',
                "PENDING": 'fillcolor="#e0e0e0"'
            }
            
            for scene in scenes:
                sid = scene.get("id", "???")
                title = scene.get("title", "")[:12]
                status = scene.get("status", "PENDING")
                style = status_styles.get(status, 'fillcolor="#e0e0e0"')
                dot_lines.append(f'  "{sid}" [label="{sid}\\n{title}", {style}];')
            
            for scene in scenes:
                sid = scene.get("id", "")
                for dep in scene.get("dependencies", []):
                    dot_lines.append(f'  "{dep}" -> "{sid}";')
            
            dot_lines.append("}")
            
            st.graphviz_chart("\n".join(dot_lines))
            st.caption(t("graphviz_legend"))
            
            # 并行分析
            done_ids = {s.get("id") for s in scenes if s.get("status") == "DONE"}
            parallel_ready = []
            for s in scenes:
                if s.get("status") in ["PENDING", "WRITING"]:
                    deps = s.get("dependencies", [])
                    if not deps or all(d in done_ids for d in deps):
                        parallel_ready.append(s.get("id"))
            
            if parallel_ready:
                st.success(t("parallel_ready", ids=', '.join(parallel_ready)))
        else:
            st.info(t("no_scene_data"))


# === Footer ===
st.divider()
st.caption(t("footer_msg", session_id=st.session_state.session_id, msg_count=len(st.session_state.messages)))
