"""
小說創作領域適配器 (Novel Adapter)

實現小說創作專用的工作流狀態和圖構建。
繼承 BaseDomainAdapter，實現 LOCK 評分系統。

保持向後兼容，現有的 state.py 和 graph.py 可繼續使用。
"""

from typing import TypedDict, List, Optional, Dict, Any, Literal, Type
from dataclasses import dataclass
from datetime import datetime
import uuid

from langgraph.graph import StateGraph, END

from ..base_state import BaseState, create_base_state
from ..base_adapter import (
    BaseDomainAdapter, 
    BaseEvaluationResult, 
    AdapterRegistry,
    BaseWorkflowConfig
)


# ============================================================
# 小說專用類型定義
# ============================================================

class LOCKScores(TypedDict):
    """LOCK 評分"""
    L: int  # Lead (主角)
    O: int  # Objective (目標)
    C: int  # Confrontation (冲突)
    K: int  # Knockout (結尾)
    total: float  # 加權總分 (C 權重 40%)


class SceneCard(TypedDict, total=False):
    """場景卡片"""
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
    """Critic 評估結果"""
    decision: Literal["APPROVED", "HUMAN_REVIEW", "REVISE", "REWRITE"]
    decision_reason: str
    total_score: float
    lock_score: float
    style_score: float
    logic_score: float
    lock_analysis: Dict[str, Any]
    actionable_feedback: str
    revision_instructions: List[Dict[str, str]]


# ============================================================
# 小說工作流狀態
# ============================================================

class WritingState(BaseState, total=False):
    """
    小說寫作工作流狀態
    
    繼承 BaseState 通用字段，添加小說專用字段。
    
    狀態流轉:
    1. user_idea → Architect → story_blueprint, scene_cards
    2. current_scene → Writer → draft_content
    3. draft_content → Critic → critique_result
    4. If REVISE: 回到步驟 2
    """
    
    # ========================================
    # 小說輸入
    # ========================================
    user_idea: str                          # 用戶的故事靈感
    genre: str                              # 類型: 玄幻/懸疑/科幻等
    target_chapters: int                    # 目標章節數
    target_wordcount: int                   # 目標總字數
    
    # ========================================
    # 會話追蹤
    # ========================================
    current_chapter: int                    # 當前章節
    current_scene_index: int                # 當前場景索引
    
    # ========================================
    # Architect 產物
    # ========================================
    story_blueprint: Dict[str, Any]         # 完整故事藍圖
    lock_analysis: Dict[str, Any]           # LOCK 系統分析
    scene_cards: List[SceneCard]            # 場景卡片序列
    current_scene: SceneCard                # 當前正在寫作的場景
    
    # ========================================
    # 上下文 (來自 Context Agents)
    # ========================================
    character_profiles: List[Dict[str, Any]]  # 角色檔案
    world_settings: Dict[str, Any]            # 世界觀設定
    foreshadow_tracker: Dict[str, Any]        # 伏筆追蹤器
    
    # ========================================
    # Writer 產物
    # ========================================
    draft_version: int                      # 草稿版本號
    draft_wordcount: int                    # 草稿字數
    writer_self_check: Dict[str, Any]       # Writer 自檢結果
    
    # ========================================
    # Critic 產物 (Reflection)
    # ========================================
    critique_result: CritiqueResult         # Critic 評估結果
    revision_history: List[Dict[str, Any]]  # 修改歷史記錄
    
    # ========================================
    # 反饋上下文
    # ========================================
    feedback_context: str                   # Critic 的可執行反饋
    
    # ========================================
    # 最終輸出
    # ========================================
    final_content: str                      # 最終通過的內容
    final_score: float                      # 最終評分


# ============================================================
# 小說工作流配置
# ============================================================

class NovelWorkflowConfig(BaseWorkflowConfig, total=False):
    """小說工作流配置"""
    
    # LOCK 專用閾值
    min_c_score: int                        # C(冲突)維度最低分 (默認 7)
    
    # 小說專用
    chapter_wordcount: int                  # 每章目標字數
    genre_style: str                        # 類型風格指導


DEFAULT_NOVEL_CONFIG: NovelWorkflowConfig = {
    "pass_score": 80,
    "human_review_score": 70,
    "max_revisions": 3,
    "auto_approve_timeout": 300,
    "verbose": True,
    "save_intermediate": True,
    "domain": "novel",
    "domain_config": {},
    "min_c_score": 7,
    "chapter_wordcount": 3000,
    "genre_style": "",
}


# ============================================================
# 小說評估結果
# ============================================================

@dataclass
class NovelEvaluationResult(BaseEvaluationResult):
    """小說評估結果，繼承基類並添加 LOCK 專用字段"""
    lock_scores: LOCKScores = None
    style_score: float = 0.0
    logic_score: float = 0.0


# ============================================================
# 小說適配器
# ============================================================

@AdapterRegistry.register("novel")
class NovelAdapter(BaseDomainAdapter):
    """
    小說創作領域適配器
    
    實現:
    - LOCK 評分系統
    - Architect → Writer → Critic 工作流
    - 場景卡片驅動的創作流程
    """
    
    def get_domain_type(self) -> str:
        return "novel"
    
    def get_state_class(self) -> Type[WritingState]:
        return WritingState
    
    def create_initial_state(
        self, 
        user_request: str,
        genre: str = "懸疑",
        target_chapters: int = 30,
        target_wordcount: int = 600000,
        **kwargs
    ) -> WritingState:
        """創建小說工作流初始狀態"""
        
        base = create_base_state(
            user_request=user_request,
            domain="novel",
            workflow_level=kwargs.get("workflow_level", 3),
        )
        
        return WritingState(
            **base,
            
            # 小說輸入
            user_idea=user_request,
            genre=genre,
            target_chapters=target_chapters,
            target_wordcount=target_wordcount,
            
            # 會話追蹤
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
            draft_version=0,
            draft_wordcount=0,
            writer_self_check={},
            critique_result={},
            revision_history=[],
            feedback_context="",
            final_content="",
            final_score=0.0,
        )
    
    def evaluate(self, state: WritingState) -> NovelEvaluationResult:
        """
        評估小說草稿質量
        
        使用 LOCK 評分系統:
        - L (Lead): 主角塑造
        - O (Objective): 目標清晰
        - C (Conflict): 冲突張力 (權重 40%)
        - K (Knockout): 結尾吸引力
        """
        critique = state.get("critique_result", {})
        
        lock_scores = critique.get("lock_analysis", {})
        total_score = critique.get("total_score", 0)
        decision = critique.get("decision", "REVISE")
        
        return NovelEvaluationResult(
            decision=decision,
            decision_reason=critique.get("decision_reason", ""),
            total_score=total_score,
            dimension_scores={
                "L": lock_scores.get("L", 0),
                "O": lock_scores.get("O", 0),
                "C": lock_scores.get("C", 0),
                "K": lock_scores.get("K", 0),
            },
            feedback=critique.get("actionable_feedback", ""),
            revision_instructions=critique.get("revision_instructions", []),
            lock_scores=lock_scores,
            style_score=critique.get("style_score", 0),
            logic_score=critique.get("logic_score", 0),
        )
    
    def create_graph(self):
        """
        創建小說寫作工作流圖
        
        結構:
        [Architect] → [Writer] → [Critic] → {條件路由}
                         ↑                      │
                         ├──────────────────────┘ (Loop if REVISE)
                         │
        [Finalize] ← [Human Review] ← (if HUMAN_REVIEW)
             ↑
             └─ (if APPROVED)
        """
        from ..graph import (
            architect_node,
            writer_node,
            critic_node,
            human_review_node,
            finalize_node,
        )
        
        # 創建圖
        graph = StateGraph(WritingState)
        
        # 添加節點
        graph.add_node("architect", architect_node)
        graph.add_node("writer", writer_node)
        graph.add_node("critic", critic_node)
        graph.add_node("human_review", human_review_node)
        graph.add_node("finalize", finalize_node)
        
        # 設置入口
        graph.set_entry_point("architect")
        
        # 添加邊
        graph.add_edge("architect", "writer")
        graph.add_edge("writer", "critic")
        
        # 條件路由
        def route_after_critic(state: WritingState) -> str:
            return self.should_continue(state)
        
        graph.add_conditional_edges(
            "critic",
            route_after_critic,
            {
                "revise": "writer",
                "human_review": "human_review",
                "finalize": "finalize",
            }
        )
        
        graph.add_edge("human_review", "finalize")
        graph.add_edge("finalize", END)
        
        return graph.compile()
    
    def should_continue(self, state: WritingState) -> str:
        """小說專用的繼續判斷邏輯"""
        config = self.merge_config(self.config)
        
        revision_count = state.get("revision_count", 0)
        max_revisions = config.get("max_revisions", 3)
        
        critique = state.get("critique_result", {})
        decision = critique.get("decision", "REVISE")
        total_score = critique.get("total_score", 0)
        
        # 達到最大修改次數
        if revision_count >= max_revisions:
            return "human_review"
        
        # 通過
        if decision == "APPROVED":
            return "finalize"
        
        # 人工審閱
        if decision == "HUMAN_REVIEW":
            return "human_review"
        
        # 需要修改
        if decision in ("REVISE", "REWRITE"):
            return "revise"
        
        # 默認繼續
        return "revise"
    
    def get_default_config(self) -> NovelWorkflowConfig:
        return DEFAULT_NOVEL_CONFIG.copy()


# ============================================================
# 向後兼容：導出舊接口
# ============================================================

# 為了保持向後兼容，導出創建函數
def create_initial_state(
    user_idea: str,
    genre: str = "懸疑",
    target_chapters: int = 30,
    target_wordcount: int = 600000
) -> WritingState:
    """向後兼容的創建函數"""
    adapter = NovelAdapter()
    return adapter.create_initial_state(
        user_request=user_idea,
        genre=genre,
        target_chapters=target_chapters,
        target_wordcount=target_wordcount,
    )
