"""
AI Writing Workbench - Streamlit Prototype (AionUi Enhanced)
============================================================
基于 AionUi 多代理协作 + Cherry Studio 交互体验 + Claude-Code-Workflow 状态管理
Legacy note: Desktop client + MCP Gateway is the primary delivery path; this Streamlit entry is retained for compatibility and prototyping only.
"""

import streamlit as st
import sqlite3
import json
import os
import glob
from datetime import datetime
from typing import Optional, Dict, Any, List


def list_draft_versions(conn: sqlite3.Connection, session_id: str, limit: int = 20) -> List[Dict[str, Any]]:
    c = conn.cursor()
    c.execute(
        """
        SELECT version, created_at
        FROM draft_versions
        WHERE session_id = ?
        ORDER BY version DESC
        LIMIT ?
        """,
        (session_id, limit),
    )
    return [{"version": row[0], "created_at": row[1]} for row in c.fetchall()]


def load_draft_version(conn: sqlite3.Connection, session_id: str, version: int) -> Optional[Dict[str, Any]]:
    c = conn.cursor()
    c.execute(
        """
        SELECT content, lock_scores, quality_scores, created_at
        FROM draft_versions
        WHERE session_id = ? AND version = ?
        LIMIT 1
        """,
        (session_id, version),
    )
    row = c.fetchone()
    if not row:
        return None

    content, lock_scores, quality_scores, created_at = row
    return {
        "version": version,
        "created_at": created_at,
        "content": content or "",
        "lock_scores": json.loads(lock_scores) if lock_scores else None,
        "quality_scores": json.loads(quality_scores) if quality_scores else None,
    }


from src.ui.translations import t, normalize_language_code
from src.services.indexing_service import IndexingService
from src.ui.file_utils import process_uploaded_file
from src.ui.components.lock_radar import render_lock_radar
from src.ui.components.trajectory_viewer import render_trajectory_viewer
from src.ui.components.scene_dashboard import render_scene_dashboard

# === 配置 ===
st.set_page_config(
    layout="wide", 
    page_title="AI Writing Workbench",
    page_icon="✍️",
    initial_sidebar_state="expanded"
)

# === AionUi 参考: SQLite 本地存储 ===
_DB_PATH_OVERRIDE = os.environ.get("NIKO_STUDIO_STREAMLIT_DB_PATH")
DB_PATH = _DB_PATH_OVERRIDE or os.path.join(os.path.dirname(__file__), "local_memory.db")


def get_directory_state(task_dir: str) -> tuple:
    """Get a signature of the directory state (filenames and mtimes)."""
    if not os.path.exists(task_dir):
        return ()
    # Only check SCENE-*.json as per logic
    files = sorted(glob.glob(os.path.join(task_dir, "SCENE-*.json")))
    state = []
    for f in files:
        try:
            state.append((f, os.path.getmtime(f)))
        except OSError:
            pass
    return tuple(state)


@st.cache_data
def _load_scenes_cached(task_dir: str, state_token: tuple) -> List[Dict[str, Any]]:
    """从 .task 目录加载场景文件 (Cached)"""
    scenes = []
    # Use state_token to iterate files, avoiding redundant glob
    for filepath, _ in state_token:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                scene = json.load(f)
                scenes.append(scene)
        except:
            pass
    return scenes


def load_scenes(task_dir: str) -> List[Dict[str, Any]]:
    state_token = get_directory_state(task_dir)
    return _load_scenes_cached(task_dir, state_token)


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


# Cache the service instance to avoid reloading models
@st.cache_resource
def get_indexing_service():
    return IndexingService(DB_PATH)


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

if "workflow_engine" not in st.session_state:
    st.session_state.workflow_engine = None
if "current_plan_id" not in st.session_state:
    st.session_state.current_plan_id = ""
if "blocked_status" not in st.session_state:
    st.session_state.blocked_status = ""
if "blocked_last_step" not in st.session_state:
    st.session_state.blocked_last_step = None
if "confirm_token" not in st.session_state:
    st.session_state.confirm_token = ""


# === 1. Sidebar: AionUi 多代理协作设置 ===
with st.sidebar:
    st.title(t("sidebar_title"))

    # Language Toggle
    if "language" not in st.session_state:
        st.session_state.language = "zh"

    current_language_code = normalize_language_code(st.session_state.language)
    selected_lang_label = st.selectbox(
        t("language_selector"),
        [t("lang_option_zh"), t("lang_option_en")],
        index=0 if current_language_code == "zh" else 1,
        key="language_select"
    )
    selected_lang_code = "zh" if selected_lang_label == t("lang_option_zh") else "en"
    if selected_lang_code != current_language_code:
        st.session_state.language = selected_lang_code
        st.rerun()
    
    # 会话管理
    st.subheader(t("session_mgmt"))
    st.text_input(t("current_session"), value=st.session_state.session_id, disabled=True)
    
    if st.button(t("new_session")):
        st.session_state.session_id = f"sess_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        st.session_state.messages = []
        st.session_state.current_draft = ""
        st.session_state.critique_result = {}
        st.session_state.workflow_engine = None
        st.session_state.current_plan_id = ""
        st.session_state.blocked_status = ""
        st.session_state.blocked_last_step = None
        st.session_state.confirm_token = ""
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
    if current_language_code == "en":
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
    temperature = st.slider(t("temperature"), 0.0, 1.0, 0.7, 0.1)
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

            # 使用 WorkflowEngine.run_stream (权威入口点)
            try:
                import asyncio
                from src.workflow.workflow_engine import WorkflowEngine

                st.write(t("starting_langgraph"))

                # Parse work_mode string to int level (e.g. "L1: ..." -> 1)
                try:
                    level_str = work_mode.split(":")[0].replace("L", "").strip()
                    level = f"L{level_str}" if level_str.isdigit() else "L3"
                except:
                    level = "L3"

        # Run workflow using WorkflowEngine
                if st.session_state.workflow_engine is None:
                    st.session_state.workflow_engine = WorkflowEngine()
                engine = st.session_state.workflow_engine

                async def run_workflow():
                    results = []
                    async for event in engine.run_stream(task=user_input, level=level):
                        results.append(event)
                        event_type = event.get("type", "unknown")

                        if event_type == "plan_created":
                            st.session_state.current_plan_id = event.get("plan_id", "")

                        elif event_type == "step_start":
                            step_name = event.get("step_name", "unknown")
                            st.write(t("node_started", node_name=step_name))

                        elif event_type == "step_complete":
                            step_name = event.get("step_name", "unknown")
                            st.write(t("node_completed", node_name=step_name))

                            # Capture draft content
                            result = event.get("result", {})
                            if isinstance(result, dict):
                                if "draft_content" in result:
                                    st.session_state.current_draft = result["draft_content"]

                                if "critique_result" in result:
                                    st.session_state.critique_result = result["critique_result"]

                        elif event_type == "plan_blocked":
                            st.session_state.current_plan_id = event.get("plan_id", "")
                            st.session_state.blocked_status = event.get("status", "")
                            st.session_state.blocked_last_step = event.get("last_step")
                            status.update(label=t("workflow_blocked"), state="error")

                        elif event_type == "plan_complete":
                            status.update(label=t("workflow_completed"), state="complete")

                        elif event_type in ("plan_error", "error"):
                            raise Exception(event.get("error", "Unknown error"))

                    return results

                # Run async workflow
                asyncio.run(run_workflow())

                # If blocked, don't append generic "task completed" message.
                if st.session_state.blocked_status:
                    status.update(label=t("workflow_blocked"), state="error")
                else:
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
                error_msg = t("workflow_dependency_missing", error=str(e))
                status.update(label=error_msg, state="error")
                st.error(error_msg)

                assistant_msg = {
                    "role": "assistant",
                    "content": error_msg,
                    "agent_name": "System"
                }
                st.session_state.messages.append(assistant_msg)
                save_message(conn, st.session_state.session_id, "assistant",
                           error_msg, "System")

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

        if "processed_files" not in st.session_state:
            st.session_state.processed_files = set()

        if uploaded_file:
            file_key = f"{uploaded_file.name}_{uploaded_file.size}"
            if file_key not in st.session_state.processed_files:
                try:
                    with st.spinner(t("processing_file", filename=uploaded_file.name)):
                        service = get_indexing_service()
                        progress_bar = st.progress(0, text=t("indexing_chunks"))

                        process_uploaded_file(
                            uploaded_file,
                            st.session_state.session_id,
                            service,
                            progress_callback=progress_bar.progress
                        )

                        progress_bar.empty()
                        st.session_state.processed_files.add(file_key)
                        st.success(t("file_loaded", filename=uploaded_file.name))

                except Exception as e:
                    st.error(t("file_process_error", error=str(e)))
            else:
                st.success(t("file_loaded", filename=uploaded_file.name))

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

        # Version history
        with st.expander(t("version_history_title"), expanded=False):
            versions = list_draft_versions(conn, st.session_state.session_id, limit=20)
            if not versions:
                st.caption(t("version_history_empty"))
            else:
                options = [f"v{v['version']} • {v['created_at']}" for v in versions]
                selected = st.selectbox(t("version_history_select"), options, index=0)
                selected_version = int(str(selected).split(" ")[0].lstrip("v"))
                loaded = load_draft_version(conn, st.session_state.session_id, selected_version)
                if loaded:
                    st.caption(t("version_history_meta", version=loaded["version"], created_at=loaded["created_at"]))
                    if st.button(t("version_history_load"), use_container_width=True):
                        st.session_state.current_draft = loaded["content"]
                        if loaded.get("lock_scores") is not None or loaded.get("quality_scores") is not None:
                            critique = dict(st.session_state.get("critique_result") or {})
                            if loaded.get("lock_scores") is not None:
                                critique["lock_scores"] = loaded["lock_scores"]
                            if loaded.get("quality_scores") is not None:
                                critique["quality_scores"] = loaded["quality_scores"]
                            st.session_state.critique_result = critique
                        st.success(t("version_history_loaded_msg", version=loaded["version"]))
                        st.rerun()

        # HITL 人工介入
        st.divider()
        st.subheader(t("hitl_title"))

        # Unblock flow for waiting_confirmation
        if st.session_state.get("blocked_status") == "waiting_confirmation":
            last_step = st.session_state.get("blocked_last_step") or {}
            gate = last_step.get("gate") if isinstance(last_step, dict) else {}
            reason = gate.get("reason") if isinstance(gate, dict) else None

            st.warning(t("workflow_waiting_confirmation"))
            if reason:
                st.caption(t("workflow_gate_reason", reason=reason))

            token_value = st.text_input(
                t("confirm_token_label"),
                value=st.session_state.get("confirm_token", ""),
                type="password",
            )
            st.session_state.confirm_token = token_value

            col_unblock_1, col_unblock_2 = st.columns(2)
            with col_unblock_1:
                if st.button(t("confirm_and_resume"), use_container_width=True, type="primary"):
                    plan_id = st.session_state.get("current_plan_id")
                    step_id = last_step.get("step_id") if isinstance(last_step, dict) else None
                    token = (st.session_state.get("confirm_token") or "").strip()

                    if not plan_id:
                        st.error(t("confirm_missing_plan_id"))
                    elif not token:
                        st.error(t("confirm_missing_token"))
                    else:
                        try:
                            engine = st.session_state.workflow_engine
                            if engine is None:
                                from src.workflow.workflow_engine import WorkflowEngine

                                engine = WorkflowEngine()
                                st.session_state.workflow_engine = engine

                            import asyncio

                            async def _resume():
                                await engine.execute(plan_id, step_id=step_id, confirm_token=token)
                                max_iters = 50
                                for _ in range(max_iters):
                                    result = await engine.execute(plan_id)
                                    if isinstance(result, dict):
                                        if "result" in result and isinstance(result.get("result"), dict):
                                            inner = result.get("result")
                                            if "draft_content" in inner:
                                                st.session_state.current_draft = inner["draft_content"]
                                            if "critique_result" in inner:
                                                st.session_state.critique_result = inner["critique_result"]
                                        if result.get("status") in {"waiting_confirmation", "preflight_blocked", "gate_blocked"}:
                                            st.session_state.blocked_status = result.get("status") or ""
                                            st.session_state.blocked_last_step = result
                                            return
                                        if result.get("plan_status") == "completed" or result.get("status") == "completed":
                                            st.session_state.blocked_status = ""
                                            st.session_state.blocked_last_step = None
                                            st.session_state.confirm_token = ""
                                            return
                                raise RuntimeError("resume iteration budget exceeded")

                            asyncio.run(_resume())
                            st.rerun()
                        except Exception as e:
                            st.error(t("workflow_failed", error=str(e)))

            with col_unblock_2:
                if st.button(t("cancel_blocked"), use_container_width=True):
                    st.session_state.blocked_status = ""
                    st.session_state.blocked_last_step = None
                    st.session_state.confirm_token = ""
                    st.rerun()

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
                    sys_msg = t("draft_saved_system_msg", version=version)
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

        render_lock_radar(lock_scores, threshold=lock_threshold)

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

        import pandas as pd
        import plotly.graph_objects as go

        df_quality = pd.DataFrame({
            "维度": list(quality_scores.keys()),
            "分数": list(quality_scores.values())
        })

        fig = go.Figure(
            data=[
                go.Bar(
                    x=list(df_quality["维度"]),
                    y=list(df_quality["分数"]),
                    marker_color="rgba(99, 102, 241, 0.8)",
                )
            ]
        )
        fig.update_layout(
            xaxis_title=None,
            yaxis_title=None,
            yaxis=dict(range=[0, 100]),
            margin=dict(l=20, r=20, t=10, b=20),
        )
        st.plotly_chart(fig, use_container_width=True)

        avg_quality = sum(quality_scores.values()) / len(quality_scores)
        st.metric(t("avg_quality"), f"{avg_quality:.1f}/100",
                  delta=f"{avg_quality - quality_threshold:.1f}" if avg_quality >= quality_threshold else f"{avg_quality - quality_threshold:.1f}",
                  delta_color="normal" if avg_quality >= quality_threshold else "inverse")

        trajectory_data = []
        for msg in st.session_state.messages:
            if msg.get("thought_process"):
                trajectory_data.append({
                    "node": msg.get("agent_name", "Agent"),
                    "action": "workflow",
                    "thought": msg.get("content", ""),
                    "result": msg.get("thought_process", {}),
                    "timestamp": "",
                    "status": "completed"
                })
        if trajectory_data:
            with st.expander(t("agent_thought_process", agent_name="Trajectory"), expanded=False):
                render_trajectory_viewer(trajectory_data)

    with tab4:
        st.subheader(t("scene_card_status"))
        render_scene_dashboard()

    with tab5:
        st.subheader(t("scene_dependency_graph"))
        render_scene_dashboard()


# === Footer ===
st.divider()
st.caption(t("footer_msg", session_id=st.session_state.session_id, msg_count=len(st.session_state.messages)))
