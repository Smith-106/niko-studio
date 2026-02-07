"""
写作工作流状态定义 (State Schema)

定义 LangGraph 状态机中所有 Agent 共享的「短期记忆」。
遵循 TypedDict 规范，确保类型安全。
"""

from typing import TypedDict, List, Optional, Dict, Any, Literal
from datetime import datetime

from src.workflow.base_state import BaseState, BaseWorkflowConfig


class LOCKScores(TypedDict):
    """LOCK评分"""
    L: int  # Lead (主角)
    O: int  # Objective (目标)
    C: int  # Confrontation (冲突)
    K: int  # Knockout (结尾)
    total: float  # 加权总分 (C权重40%)


class SceneCard(TypedDict, total=False):
    """场景卡片"""
    scene_id: str
    chapter_num: int
    scene_num: int
    pov_character: str
    objective: str
    conflict: str
    outcome: str
    plot_beat: str
    emotional_arc: str
    sensory_guidance: Dict[str, str]
    structural_function: str
    hook: Optional[str]
    foreshadows_to_plant: List[str]
    foreshadows_to_harvest: List[str]


class CritiqueResult(TypedDict, total=False):
    """Critic评估结果"""
    decision: Literal["APPROVED", "HUMAN_REVIEW", "REVISE", "REWRITE"]
    decision_reason: str
    total_score: float
    lock_score: float
    style_score: float
    logic_score: float
    lock_analysis: Dict[str, Any]
    actionable_feedback: str
    revision_instructions: List[Dict[str, str]]


class DistillationResult(TypedDict, total=False):
    """知识蒸馏结果"""
    entities_count: int                    # 实体数量
    relations_count: int                   # 关系数量
    events_count: int                      # 事件数量
    entities: List[Dict[str, Any]]         # 提取的实体列表
    relations: List[Dict[str, Any]]        # 提取的关系列表
    events: List[Dict[str, Any]]           # 提取的事件列表
    template: str                          # 使用的蒸馏模板
    scene_id: str                          # 关联的场景ID
    summary: Optional[str]                 # 摘要 (如果使用 summary 模板)
    character_arcs: List[Dict[str, Any]]   # 角色弧线 (如果使用 character_arc 模板)
    plot_points: List[Dict[str, Any]]      # 情节点 (如果使用 plot_structure 模板)


class WritingState(BaseState, total=False):
    """
    写作工作流状态 - 所有Agent共享的记忆
    
    状态流转:
    1. user_idea → Architect → story_blueprint, scene_cards
    2. current_scene → Writer → draft_content
    3. draft_content → Critic → critique_result
    4. If critique_result.decision == "REVISE":
       - revision_count += 1
       - 回到步骤2 (携带 actionable_feedback)
    """
    
    # ========================================
    # 输入 (来自用户)
    # ========================================
    user_idea: str                          # 用户的故事灵感
    genre: str                              # 类型: 玄幻/悬疑/科幻等
    target_chapters: int                    # 目标章节数
    target_wordcount: int                   # 目标总字数
    
    # ========================================
    # 会话元数据
    # ========================================
    session_id: str                         # 会话ID
    created_at: str                         # 创建时间 (ISO8601)
    current_chapter: int                    # 当前章节
    current_scene_index: int                # 当前场景索引
    
    # ========================================
    # Architect 产物
    # ========================================
    story_blueprint: Dict[str, Any]         # 完整故事蓝图
    lock_analysis: Dict[str, Any]           # LOCK系统分析
    scene_cards: List[SceneCard]            # 场景卡片序列
    current_scene: SceneCard                # 当前正在写作的场景
    
    # ========================================
    # 上下文 (来自Context Agents)
    # ========================================
    character_profiles: List[Dict[str, Any]]  # 角色档案
    world_settings: Dict[str, Any]            # 世界观设定
    foreshadow_tracker: Dict[str, Any]        # 伏笔追踪器
    
    # ========================================
    # Writer 产物
    # ========================================
    draft_content: str                      # 当前草稿内容
    draft_version: int                      # 草稿版本号
    draft_wordcount: int                    # 草稿字数
    writer_self_check: Dict[str, Any]       # Writer自检结果
    
    # ========================================
    # Critic 产物 (Reflection)
    # ========================================
    critique_result: CritiqueResult         # Critic评估结果
    revision_count: int                     # 修改次数 (防止死循环)
    revision_history: List[Dict[str, Any]]  # 修改历史记录

    # ========================================
    # Distillation 产物 (知识蒸馏)
    # ========================================
    distillation_result: DistillationResult  # 蒸馏结果
    distillation_state: Dict[str, Any]       # 蒸馏状态详情
    
    # ========================================
    # 反馈上下文 (Writer重写时使用)
    # ========================================
    feedback_context: str                   # Critic的可执行反馈
    revision_instructions: List[Dict[str, str]]  # 具体修改指令
    
    # ========================================
    # 最终输出
    # ========================================
    final_content: str                      # 最终通过的内容
    final_score: float                      # 最终评分
    
    # ========================================
    # 错误处理
    # ========================================
    errors: List[str]                       # 错误信息
    requires_human_intervention: bool       # 是否需要人工介入


class WorkflowConfig(BaseWorkflowConfig):
    """工作流配置"""
    
    # 质量阈值
    # pass_score: int                         # (Base) 通过分数阈值 (默认80)
    min_c_score: int                        # C(冲突)维度最低分 (默认7)
    
    # 循环控制
    # max_revisions: int                      # (Base) 最大修改次数 (默认3)
    
    # 人工介入
    # human_review_score: int                 # (Base) 触发人工审阅的分数 (默认70)
    # auto_approve_timeout: int               # (Base) 自动通过超时时间(秒)
    
    # 调试
    # verbose: bool                           # (Base) 是否输出详细日志
    # save_intermediate: bool                 # (Base) 是否保存中间产物


# 默认配置
DEFAULT_CONFIG: WorkflowConfig = {
    "pass_score": 80,
    "min_c_score": 7,
    "max_revisions": 3,
    "human_review_score": 70,
    "auto_approve_timeout": 300,
    "verbose": True,
    "save_intermediate": True
}


def create_initial_state(
    user_idea: str,
    genre: str = "悬疑",
    target_chapters: int = 30,
    target_wordcount: int = 600000
) -> WritingState:
    """创建初始状态"""
    import uuid
    
    return WritingState(
        # 输入
        user_idea=user_idea,
        genre=genre,
        target_chapters=target_chapters,
        target_wordcount=target_wordcount,
        
        # 元数据
        session_id=str(uuid.uuid4()),
        created_at=datetime.now().isoformat(),
        current_chapter=1,
        current_scene_index=0,
        
        # 初始化空值
        story_blueprint={},
        lock_analysis={},
        scene_cards=[],
        current_scene={},
        character_profiles=[],
        world_settings={},
        foreshadow_tracker={},
        draft_content="",
        draft_version=0,
        draft_wordcount=0,
        writer_self_check={},
        critique_result={},
        revision_count=0,
        revision_history=[],
        feedback_context="",
        revision_instructions=[],
        final_content="",
        final_score=0.0,
        errors=[],
        requires_human_intervention=False
    )
