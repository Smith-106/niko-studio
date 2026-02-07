"""
L3 標準模式 (Standard)

完整會話、驗證步驟。
適用於: 多章節開發、角色塑造、功能開發。
"""

from typing import Dict, List, Optional
from dataclasses import dataclass
from .base_level import BaseLevel, LevelRegistry
from ..base_state import BaseState


@dataclass
class PlanPhase:
    """計劃階段"""
    phase: int
    name: str
    description: str
    status: str = "pending"  # pending | in_progress | completed
    output: Optional[str] = None


@LevelRegistry.register(3)
class Level3Standard(BaseLevel):
    """
    L3 標準模式
    
    特點:
    - 完整 5 階段計劃
    - Architect → Writer → Critic 循環
    - 會話持久化
    - 驗證步驟
    
    命令鏈:
    plan → plan-verify → execute → verify
    """
    
    level = 3
    name = "standard"
    description = "標準模式 - 完整會話、驗證步驟"
    
    PLAN_PHASES = [
        PlanPhase(1, "需求理解", "理解用戶需求，澄清模糊點"),
        PlanPhase(2, "內容分析", "分析已有章節、角色、世界觀"),
        PlanPhase(3, "變更範圍", "定義修改範圍，識別影響點"),
        PlanPhase(4, "實施計劃", "生成詳細執行步驟"),
        PlanPhase(5, "驗證定義", "定義驗收標準和測試用例"),
    ]
    
    def execute(self, state: BaseState, **kwargs) -> BaseState:
        """
        執行標準工作流
        
        流程:
        1. Plan: 生成 5 階段計劃
        2. Plan-Verify: 驗證計劃完整性
        3. Execute: 調用 Writer 執行
        4. Critic: 評估質量
        5. 循環直到通過或達到 max_revisions
        """
        config = self.get_default_config()
        config.update(self.config or {})
        
        max_revisions = config.get("max_revisions", 3)
        pass_score = config.get("pass_score", 80)
        
        # Phase 1: 計劃
        state = self._plan_phase(state)
        
        # Phase 2: 計劃驗證
        if not self._verify_plan(state):
            state["errors"] = state.get("errors", []) + ["計劃驗證失敗"]
            state["decision"] = "HUMAN_REVIEW"
            return state
        
        # Phase 3-5: 執行循環
        revision_count = 0
        while revision_count < max_revisions:
            # 執行
            state = self._execute_phase(state)
            
            # 評估
            state = self._critic_phase(state)
            
            score = state.get("score", 0)
            decision = state.get("decision", "REVISE")
            
            if decision == "APPROVED" or score >= pass_score:
                state["decision"] = "APPROVED"
                break
            
            if decision == "HUMAN_REVIEW":
                break
            
            revision_count += 1
            state["revision_count"] = revision_count
        
        if revision_count >= max_revisions and state.get("decision") != "APPROVED":
            state["decision"] = "HUMAN_REVIEW"
            state["requires_human_intervention"] = True
        
        return state
    
    def get_required_agents(self) -> List[str]:
        return ["architect", "writer", "critic"]
    
    def plan(self, state: BaseState) -> List[PlanPhase]:
        """生成計劃 (5 階段)"""
        return self._plan_phase(state).get("plan_phases", self.PLAN_PHASES)
    
    def plan_verify(self, state: BaseState) -> Dict:
        """驗證計劃完整性"""
        return {
            "valid": self._verify_plan(state),
            "missing": [],
            "warnings": [],
        }
    
    def _plan_phase(self, state: BaseState) -> BaseState:
        """計劃階段"""
        from ...agents.architect import ArchitectAgent
        
        try:
            architect = ArchitectAgent(name="standard_architect")
            result = architect.run({
                "user_request": state.get("user_request", ""),
                "context": state.get("context", ""),
                "mode": "planning",
            })
            
            state["plan_phases"] = result.get("phases", self.PLAN_PHASES)
            state["implementation_plan"] = result.get("plan", {})
            
        except Exception as e:
            state["errors"] = state.get("errors", []) + [f"計劃失敗: {e}"]
            state["plan_phases"] = self.PLAN_PHASES
        
        return state
    
    def _verify_plan(self, state: BaseState) -> bool:
        """驗證計劃"""
        plan = state.get("implementation_plan", {})
        phases = state.get("plan_phases", [])
        
        # 基本檢查
        if not plan or not phases:
            return False
        
        # 檢查所有階段是否有輸出
        for phase in phases:
            if isinstance(phase, dict) and not phase.get("output"):
                return False
        
        return True
    
    def _execute_phase(self, state: BaseState) -> BaseState:
        """執行階段"""
        from ...agents.writer import WriterAgent
        
        try:
            writer = WriterAgent(name="standard_writer")
            result = writer.run({
                "plan": state.get("implementation_plan", {}),
                "context": state.get("context", ""),
                "feedback": state.get("feedback_context", ""),
                "mode": "execute",
            })
            
            state["draft_content"] = result.get("content", "")
            state["draft_version"] = state.get("draft_version", 0) + 1
            
        except Exception as e:
            state["errors"] = state.get("errors", []) + [f"執行失敗: {e}"]
        
        return state
    
    def _critic_phase(self, state: BaseState) -> BaseState:
        """評估階段"""
        from ...agents.critic import CriticAgent
        
        try:
            critic = CriticAgent(name="standard_critic")
            result = critic.run({
                "content": state.get("draft_content", ""),
                "plan": state.get("implementation_plan", {}),
                "mode": "evaluate",
            })
            
            state["score"] = result.get("score", 0)
            state["decision"] = result.get("decision", "REVISE")
            state["feedback_context"] = result.get("feedback", "")
            
        except Exception as e:
            state["errors"] = state.get("errors", []) + [f"評估失敗: {e}"]
            state["decision"] = "HUMAN_REVIEW"
        
        return state
