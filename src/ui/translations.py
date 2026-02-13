import streamlit as st

TRANSLATIONS = {
    # === Generic ===
    "page_title": {
        "en": "AI Writing Workbench",
        "zh": "AI 写作工作台"
    },
    "sidebar_title": {
        "en": "Agent Orchestrator",
        "zh": "Agent 编排器"
    },
    "session_mgmt": {
        "en": "Session Management",
        "zh": "📂 会话管理"
    },
    "current_session": {
        "en": "Current Session",
        "zh": "当前会话"
    },
    "new_session": {
        "en": "New Session",
        "zh": "🆕 新建会话"
    },
    "collab_mode": {
        "en": "Collaboration Mode",
        "zh": "⚙️ 协作模式"
    },
    "workflow_level": {
        "en": "Workflow Level",
        "zh": "工作流级别"
    },
    "workflow_level_help": {
        "en": "Reference Claude-Code-Workflow 5-level workflow system",
        "zh": "参考 Claude-Code-Workflow 的 5 级工作流系统"
    },
    "base_model": {
        "en": "Base Model",
        "zh": "底层模型"
    },
    "select_model": {
        "en": "Select LLM Model",
        "zh": "选择 LLM 模型"
    },
    "gen_params": {
        "en": "Generation Parameters",
        "zh": "🎛️ 生成参数"
    },
    "max_loops": {
        "en": "Max Loops",
        "zh": "最大修改循环"
    },
    "quality_thresholds": {
        "en": "Quality Thresholds",
        "zh": "📊 质量阈值"
    },
    "lock_threshold": {
        "en": "LOCK Threshold",
        "zh": "LOCK 通过阈值"
    },
    "dim8_threshold": {
        "en": "8-Dim Threshold",
        "zh": "8维度通过阈值"
    },
    "debug_info": {
        "en": "Debug Info",
        "zh": "🔧 调试信息"
    },
    "collab_chat_stream": {
        "en": "Collaboration Chat Stream",
        "zh": "💬 协作对话流"
    },
    "agent_thought_process": {
        "en": "🧠 {agent_name} Thought Process",
        "zh": "🧠 {agent_name} 思考过程"
    },
    "chat_input_placeholder": {
        "en": "Enter command (supports @ syntax to route to specific Agent)...",
        "zh": "输入指令 (支持 @ 语法路由到特定 Agent)..."
    },
    "workflow_running": {
        "en": "🔄 Agent Workflow Running...",
        "zh": "🔄 Agent 工作流执行中..."
    },
    "parsing_command": {
        "en": "📥 Parsing user command...",
        "zh": "📥 解析用户指令..."
    },
    "starting_langgraph": {
        "en": "🚀 Starting LangGraph State Machine...",
        "zh": "🚀 启动 LangGraph 状态机..."
    },
    "node_completed": {
        "en": "✅ **{node_name}** Completed",
        "zh": "✅ **{node_name}** 完成"
    },
    "workflow_completed": {
        "en": "✅ Workflow Completed",
        "zh": "✅ 工作流完成"
    },
    "task_completed_msg": {
        "en": "✅ Task completed. Please check the preview panel on the right.",
        "zh": "✅ 任务完成。请查看右侧预览面板。"
    },
    "workflow_dependency_missing": {
        "en": "❌ Workflow dependency missing: {error}. Please install required dependencies and retry.",
        "zh": "❌ 工作流依赖缺失：{error}。请安装所需依赖后重试。"
    },
    "langgraph_not_found": {
        "en": "⚠️ LangGraph module not found: {error}",
        "zh": "⚠️ LangGraph 模块未找到: {error}"
    },
    "sim_mode": {
        "en": "📝 Entering Simulation Mode...",
        "zh": "📝 进入模拟模式..."
    },
    "sim_mode_completed": {
        "en": "⚠️ Simulation Mode Completed",
        "zh": "⚠️ 模拟模式完成"
    },
    "workflow_failed": {
        "en": "❌ Error: {error}",
        "zh": "❌ 错误: {error}"
    },
    "files_preview": {
        "en": "Files & Draft Preview",
        "zh": "📂 文件与草稿预览"
    },
    "upload_material": {
        "en": "Upload Reference Material",
        "zh": "📎 上传参考资料"
    },
    "upload_help": {
        "en": "Support PDF/MD/TXT/DOCX",
        "zh": "支持 PDF/MD/TXT/DOCX"
    },
    "context_injection_help": {
        "en": "Uploaded files will be indexed for RAG context injection",
        "zh": "上传的文件将被索引用于 RAG 上下文注入"
    },
    "file_loaded": {
        "en": "✅ Loaded: {filename}",
        "zh": "✅ 已加载: {filename}"
    },

    # === Tabs ===
    "tab_draft": {
        "en": "Draft",
        "zh": "📝 草稿"
    },
    "tab_lock": {
        "en": "LOCK",
        "zh": "📊 LOCK"
    },
    "tab_8dim": {
        "en": "8-Dimensions",
        "zh": "🎯 8维度"
    },
    "tab_scene_cards": {
        "en": "Scene Cards",
        "zh": "📇 场景卡片"
    },
    "tab_dependency": {
        "en": "Dependency Graph",
        "zh": "🕸️ 依赖图"
    },

    # === Draft Tab ===
    "no_content_placeholder": {
        "en": "*No content, please enter commands on the left to start creating...*",
        "zh": "*尚无内容，请在左侧输入指令开始创作...*"
    },
    "hitl_title": {
        "en": "Human-in-the-Loop",
        "zh": "🛠️ Human-in-the-Loop"
    },
    "feedback_label": {
        "en": "Feedback",
        "zh": "修改意见"
    },
    "feedback_placeholder": {
        "en": "Enter your feedback...",
        "zh": "输入您的修改建议..."
    },
    "submit_feedback": {
        "en": "Submit Feedback",
        "zh": "📤 提交反馈"
    },
    "approve": {
        "en": "Approve",
        "zh": "✅ 批准通过"
    },
    "feedback_submitted_msg": {
        "en": "Feedback submitted, will be applied in next iteration",
        "zh": "反馈已提交，将在下次迭代中应用"
    },
    "draft_saved_msg": {
        "en": "✅ Draft approved and saved as version {version}",
        "zh": "✅ 草稿已批准并保存为版本 v{version}"
    },
    "no_draft_warning": {
        "en": "No draft to save",
        "zh": "当前没有草稿可保存"
    },

    # === LOCK Tab ===
    "lock_system_score": {
        "en": "LOCK System Score",
        "zh": "LOCK 系统评分"
    },
    "lock_total": {
        "en": "Total LOCK Score",
        "zh": "LOCK 总分"
    },
    "detailed_analysis": {
        "en": "Detailed Analysis",
        "zh": "📋 详细分析"
    },

    # === 8-Dim Tab ===
    "quality_8dim": {
        "en": "8-Dimension Writing Quality",
        "zh": "8维度写作质量"
    },
    "avg_quality": {
        "en": "Average Quality Score",
        "zh": "平均质量分"
    },

    # === Scene Cards Tab ===
    "scene_card_status": {
        "en": "Scene Card Status",
        "zh": "📇 场景卡片状态"
    },
    "total": {
        "en": "Total",
        "zh": "总计"
    },
    "done": {
        "en": "Done",
        "zh": "已完成"
    },
    "writing": {
        "en": "Writing",
        "zh": "进行中"
    },
    "no_scene_cards": {
        "en": "No scene cards. Scenes will be saved in .task/SCENE-*.json",
        "zh": "📭 尚无场景卡片。场景将保存在 `.task/SCENE-*.json`"
    },

    # === Dependency Tab ===
    "scene_dependency_graph": {
        "en": "Scene Dependency Graph",
        "zh": "🕸️ 场景依赖关系图"
    },
    "parallel_ready": {
        "en": "🚀 Parallelizable: {ids}",
        "zh": "🚀 可并行执行: {ids}"
    },
    "no_scene_data": {
        "en": "No scene data",
        "zh": "📭 尚无场景数据"
    },

    # === Footer ===
    "footer_msg": {
        "en": "AI Writing Workbench v0.1 | Session: {session_id} | Messages: {msg_count}",
        "zh": "AI Writing Workbench v0.1 | Session: {session_id} | Messages: {msg_count}"
    },

    # === Components / Lock Radar ===
    "lock_L": {
        "en": "Lead",
        "zh": "主角魅力"
    },
    "lock_O": {
        "en": "Objective",
        "zh": "目标明确"
    },
    "lock_C": {
        "en": "Confrontation",
        "zh": "冲突设计"
    },
    "lock_K": {
        "en": "Knockout",
        "zh": "结尾冲击"
    },
    "current_score": {
        "en": "Current Score",
        "zh": "当前评分"
    },
    "threshold_label": {
        "en": "Pass Threshold ({threshold})",
        "zh": "通过阈值 ({threshold})"
    },
    "threshold": {
        "en": "Threshold",
        "zh": "阈值"
    },
    "total_score": {
        "en": "Total Score",
        "zh": "总分"
    },
    "status": {
        "en": "Status",
        "zh": "状态"
    },
    "passed": {
        "en": "✅ Passed",
        "zh": "✅ 通过"
    },
    "needs_improvement": {
        "en": "❌ Needs Improvement",
        "zh": "❌ 待改进"
    },
    "passed_delta": {
        "en": "Passed",
        "zh": "通过"
    },
    "failed_delta": {
        "en": "Failed",
        "zh": "未通过"
    },
    "lock_L_desc": {
        "en": "Lead (Charisma)",
        "zh": "Lead (主角魅力)"
    },
    "lock_O_desc": {
        "en": "Objective (Clear Goal)",
        "zh": "Objective (目标明确)"
    },
    "lock_C_desc": {
        "en": "Confrontation (Conflict)",
        "zh": "Confrontation (冲突设计)"
    },
    "lock_K_desc": {
        "en": "Knockout (Ending)",
        "zh": "Knockout (结尾冲击)"
    },
    "lock_L_tooltip": {
        "en": "Does the protagonist have enough appeal to make the reader want to follow?",
        "zh": "主角是否有足够的吸引力让读者想要跟随"
    },
    "lock_O_tooltip": {
        "en": "Is the protagonist's goal clear and compelling?",
        "zh": "主角的目标是否清晰、有吸引力"
    },
    "lock_C_tooltip": {
        "en": "Are the obstacles and conflicts challenging enough? (Highest weight: 40%)",
        "zh": "障碍和冲突是否足够有挑战性 (权重最高: 40%)"
    },
    "lock_K_tooltip": {
        "en": "Does the ending have enough impact and satisfaction?",
        "zh": "结尾是否有足够的冲击力和满足感"
    },
    "conflict_core_tip": {
        "en": "💡 **Conflict is the core**: Highest weight (40%), ensure enough tension.",
        "zh": "💡 **冲突是故事的核心**: 拥有最高权重 (40%)，请确保场景有足够的对抗张力"
    },

    # === Scene Dashboard ===
    "scene_dashboard_main_title": {
        "en": "Scene Dashboard",
        "zh": "📇 故事场景控制台 (Scene Dashboard)"
    },
    "no_scenes_warning": {
        "en": "⚠️ No scene cards detected. Scenes will be saved in `.task/SCENE-*.json`",
        "zh": "⚠️ 未检测到场景卡片。场景将保存在 `.task/SCENE-*.json`"
    },
    "total_scenes": {
        "en": "Total Scenes",
        "zh": "总场景数"
    },
    "avg_lock": {
        "en": "Avg LOCK",
        "zh": "平均 LOCK"
    },
    "tab_card_view": {
        "en": "Card View",
        "zh": "📇 卡片视图"
    },
    "tab_parallel_analysis": {
        "en": "Parallel Analysis",
        "zh": "🚀 并行分析"
    },
    "untitled": {
        "en": "Untitled",
        "zh": "未命名"
    },
    "lock_diagnosis": {
        "en": "LOCK Score & Diagnosis",
        "zh": "📊 LOCK 评分与诊断"
    },
    "not_evaluated": {
        "en": "Not evaluated",
        "zh": "尚未评估"
    },
    "critique": {
        "en": "Critique",
        "zh": "批评意见"
    },
    "edit_btn": {
        "en": "Edit",
        "zh": "✏️ 编辑"
    },
    "regen_btn": {
        "en": "Regenerate",
        "zh": "🔄 重新生成"
    },
    "regen_info": {
        "en": "Will regenerate {id}",
        "zh": "将重新生成 {id}"
    },
    "graphviz_caption": {
        "en": "Graphviz-based Scene Dependency Topology",
        "zh": "基于 Graphviz 的场景依赖拓扑图"
    },
    "graphviz_legend": {
        "en": "🟢 Done | 🟡 In Progress | 🔵 Reviewing | ⚪ Pending | 🔴 Failed",
        "zh": "🟢 完成 | 🟡 进行中 | 🔵 审查中 | ⚪ 待处理 | 🔴 失败"
    },
    "graphviz_missing": {
        "en": "Graphviz library not installed, using built-in chart",
        "zh": "graphviz 库未安装，使用内置图表"
    },
    "parallel_found": {
        "en": "🚀 Found **{count}** scenes ready for parallel start (L1 Level)",
        "zh": "🚀 发现 **{count}** 个场景可以立即并行启动 (L1 层级)"
    },
    "parallel_ready_list": {
        "en": "✅ **Ready to execute scenes**: {ids}",
        "zh": "✅ **可立即执行的场景**: {ids}"
    },
    "execution_level_graph": {
        "en": "Execution Level Graph",
        "zh": "📊 执行层级图"
    },
    "view_full_level_data": {
        "en": "View Full Level Data",
        "zh": "📋 查看完整层级数据"
    },
    "no_analyzable_scenes": {
        "en": "No analyzable scenes",
        "zh": "暂无可分析的场景"
    },

    # === Trajectory Viewer ===
    "trajectory_title": {
        "en": "Agent Reasoning Trajectory",
        "zh": "🧠 Agent 推理轨迹"
    },
    "no_trajectory_data": {
        "en": "No trajectory data",
        "zh": "暂无推理轨迹数据"
    },
    "thought_process": {
        "en": "Thought Process",
        "zh": "思考过程"
    },
    "output_result": {
        "en": "Output Result",
        "zh": "输出结果"
    },
    "workflow_progress": {
        "en": "Workflow Progress",
        "zh": "📊 工作流进度"
    },
    "agent_timeline": {
        "en": "Agent Event Timeline",
        "zh": "📅 Agent 事件时间线"
    },
    "decision_point": {
        "en": "Decision Point",
        "zh": "🌳 决策点"
    },
    "decision_reason": {
        "en": "Decision Reason",
        "zh": "决策理由"
    },
    "selected_opt": {
        "en": "(Selected)",
        "zh": "(已选择)"
    },
    "decision_question_default": {
        "en": "Decision Question",
        "zh": "决策问题"
    }
}

def t(key, **kwargs):
    """
    Translate a key to the current language.
    Usage: t("page_title") or t("file_loaded", filename="doc.pdf")
    """
    # Default to Chinese if not set
    lang_label = st.session_state.get("language", "中文")
    lang_code = "en" if lang_label == "English" else "zh"

    entry = TRANSLATIONS.get(key, {})
    # If key not found, return key itself
    if not entry:
        return key

    template = entry.get(lang_code, key)

    if kwargs:
        try:
            return template.format(**kwargs)
        except Exception as e:
            return template
    return template
