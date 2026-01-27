"""
代碼開發領域適配器 (Code Adapter)

實現代碼開發專用的工作流狀態和圖構建。
繼承 BaseDomainAdapter，實現測試/Lint/構建評估系統。

設計目標:
- 與小說適配器結構對齊
- 支持多文件變更追蹤
- 集成測試和代碼檢查
"""

from typing import TypedDict, List, Optional, Dict, Any, Literal, Type
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
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
# 代碼專用類型定義
# ============================================================

class FileChangeType(Enum):
    """文件變更類型"""
    CREATE = "create"
    MODIFY = "modify"
    DELETE = "delete"
    RENAME = "rename"


class FileChange(TypedDict, total=False):
    """文件變更記錄"""
    path: str                       # 文件路徑
    change_type: str                # create | modify | delete | rename
    old_path: Optional[str]         # 重命名時的舊路徑
    content: Optional[str]          # 新內容
    diff: Optional[str]             # 差異
    language: str                   # 編程語言


class TestResult(TypedDict, total=False):
    """測試結果"""
    passed: int
    failed: int
    skipped: int
    total: int
    coverage: float                 # 覆蓋率 0-100
    failed_tests: List[str]
    duration_ms: int


class LintResult(TypedDict, total=False):
    """代碼檢查結果"""
    errors: int
    warnings: int
    info: int
    issues: List[Dict[str, Any]]    # [{file, line, message, severity}]


class BuildResult(TypedDict, total=False):
    """構建結果"""
    success: bool
    output: str
    errors: List[str]
    duration_ms: int


class CodeReviewComment(TypedDict, total=False):
    """代碼審查評論"""
    file: str
    line: int
    severity: str                   # error | warning | suggestion
    message: str
    suggested_fix: Optional[str]


# ============================================================
# 代碼工作流狀態
# ============================================================

class CodingState(BaseState, total=False):
    """
    代碼開發工作流狀態
    
    繼承 BaseState 通用字段，添加代碼開發專用字段。
    
    狀態流轉:
    1. task_description → Planner → implementation_plan
    2. implementation_plan → Coder → file_changes
    3. file_changes → Reviewer → review_result
    4. If REVISE: 回到步驟 2
    """
    
    # ========================================
    # 代碼輸入
    # ========================================
    task_description: str               # 任務描述
    target_files: List[str]             # 目標文件列表
    repository_path: str                # 倉庫路徑
    branch: str                         # 分支名
    
    # ========================================
    # 上下文
    # ========================================
    existing_code: Dict[str, str]       # 現有代碼 {path: content}
    dependencies: List[str]             # 依賴列表
    project_structure: Dict[str, Any]   # 項目結構
    
    # ========================================
    # Planner 產物
    # ========================================
    implementation_plan: Dict[str, Any]  # 實施計劃
    affected_files: List[str]            # 影響的文件
    estimated_changes: int               # 預估變更數
    
    # ========================================
    # Coder 產物
    # ========================================
    file_changes: List[FileChange]      # 文件變更列表
    code_version: int                   # 代碼版本號
    
    # ========================================
    # 質量檢查
    # ========================================
    test_result: TestResult             # 測試結果
    lint_result: LintResult             # Lint 結果
    build_result: BuildResult           # 構建結果
    
    # ========================================
    # Reviewer 產物
    # ========================================
    review_comments: List[CodeReviewComment]  # 審查評論
    review_summary: str                       # 審查摘要
    
    # ========================================
    # 執行日誌
    # ========================================
    execution_log: List[str]            # 執行日誌
    commands_run: List[str]             # 已運行的命令


# ============================================================
# 代碼工作流配置
# ============================================================

class CodeWorkflowConfig(BaseWorkflowConfig, total=False):
    """代碼工作流配置"""
    
    # 質量閾值
    min_coverage: float                 # 最低覆蓋率 (默認 80%)
    max_lint_errors: int                # 最大 Lint 錯誤數 (默認 0)
    max_lint_warnings: int              # 最大 Lint 警告數 (默認 10)
    
    # 執行選項
    run_tests: bool                     # 是否運行測試
    run_lint: bool                      # 是否運行 Lint
    run_build: bool                     # 是否運行構建
    auto_fix_lint: bool                 # 是否自動修復 Lint


DEFAULT_CODE_CONFIG: CodeWorkflowConfig = {
    "pass_score": 80,
    "human_review_score": 70,
    "max_revisions": 3,
    "auto_approve_timeout": 300,
    "verbose": True,
    "save_intermediate": True,
    "domain": "code",
    "domain_config": {},
    "min_coverage": 80.0,
    "max_lint_errors": 0,
    "max_lint_warnings": 10,
    "run_tests": True,
    "run_lint": True,
    "run_build": True,
    "auto_fix_lint": False,
}


# ============================================================
# 代碼評估結果
# ============================================================

@dataclass
class CodeEvaluationResult(BaseEvaluationResult):
    """代碼評估結果"""
    test_result: TestResult = None
    lint_result: LintResult = None
    build_result: BuildResult = None
    coverage: float = 0.0


# ============================================================
# 代碼適配器
# ============================================================

@AdapterRegistry.register("code")
class CodeAdapter(BaseDomainAdapter):
    """
    代碼開發領域適配器
    
    實現:
    - 測試/Lint/構建評估系統
    - Planner → Coder → Reviewer 工作流
    - 多文件變更追蹤
    """
    
    def get_domain_type(self) -> str:
        return "code"
    
    def get_state_class(self) -> Type[CodingState]:
        return CodingState
    
    def create_initial_state(
        self,
        user_request: str,
        target_files: List[str] = None,
        repository_path: str = ".",
        branch: str = "main",
        **kwargs
    ) -> CodingState:
        """創建代碼工作流初始狀態"""
        
        base = create_base_state(
            user_request=user_request,
            domain="code",
            workflow_level=kwargs.get("workflow_level", 3),
        )
        
        return CodingState(
            **base,
            
            # 代碼輸入
            task_description=user_request,
            target_files=target_files or [],
            repository_path=repository_path,
            branch=branch,
            
            # 上下文
            existing_code={},
            dependencies=[],
            project_structure={},
            
            # 初始化空值
            implementation_plan={},
            affected_files=[],
            estimated_changes=0,
            file_changes=[],
            code_version=0,
            test_result={},
            lint_result={},
            build_result={},
            review_comments=[],
            review_summary="",
            execution_log=[],
            commands_run=[],
        )
    
    def evaluate(self, state: CodingState) -> CodeEvaluationResult:
        """
        評估代碼質量
        
        評估維度:
        - Tests: 測試通過率和覆蓋率
        - Lint: 代碼風格和潛在問題
        - Build: 構建成功與否
        - Review: 代碼審查結果
        """
        config = self.merge_config(self.config)
        
        test_result = state.get("test_result", {})
        lint_result = state.get("lint_result", {})
        build_result = state.get("build_result", {})
        
        # 計算總分
        scores = {}
        total_score = 0
        
        # 測試分數 (40%)
        if test_result:
            test_pass_rate = (
                test_result.get("passed", 0) / 
                max(test_result.get("total", 1), 1) * 100
            )
            coverage = test_result.get("coverage", 0)
            scores["tests"] = (test_pass_rate + coverage) / 2
            total_score += scores["tests"] * 0.4
        
        # Lint 分數 (30%)
        if lint_result:
            lint_errors = lint_result.get("errors", 0)
            lint_warnings = lint_result.get("warnings", 0)
            if lint_errors == 0 and lint_warnings <= config.get("max_lint_warnings", 10):
                scores["lint"] = 100
            elif lint_errors == 0:
                scores["lint"] = 80
            else:
                scores["lint"] = max(0, 100 - lint_errors * 10)
            total_score += scores["lint"] * 0.3
        
        # 構建分數 (30%)
        if build_result:
            scores["build"] = 100 if build_result.get("success", False) else 0
            total_score += scores["build"] * 0.3
        
        # 決策
        if total_score >= config.get("pass_score", 80):
            decision = "APPROVED"
        elif total_score >= config.get("human_review_score", 70):
            decision = "HUMAN_REVIEW"
        else:
            decision = "REVISE"
        
        return CodeEvaluationResult(
            decision=decision,
            decision_reason=f"總分 {total_score:.1f}",
            total_score=total_score,
            dimension_scores=scores,
            feedback=state.get("review_summary", ""),
            revision_instructions=[
                {"file": c.get("file", ""), "message": c.get("message", "")}
                for c in state.get("review_comments", [])
            ],
            test_result=test_result,
            lint_result=lint_result,
            build_result=build_result,
            coverage=test_result.get("coverage", 0),
        )
    
    def create_graph(self):
        """
        創建代碼開發工作流圖
        
        結構:
        [Planner] → [Coder] → [Tester] → [Reviewer] → {條件路由}
                       ↑                                  │
                       ├──────────────────────────────────┘ (Loop if REVISE)
                       │
        [Finalize] ← [Human Review] ← (if HUMAN_REVIEW)
             ↑
             └─ (if APPROVED)
        """
        # 創建圖
        graph = StateGraph(CodingState)
        
        # 添加節點 (使用佔位函數，後續實現)
        graph.add_node("planner", self._planner_node)
        graph.add_node("coder", self._coder_node)
        graph.add_node("tester", self._tester_node)
        graph.add_node("reviewer", self._reviewer_node)
        graph.add_node("human_review", self._human_review_node)
        graph.add_node("finalize", self._finalize_node)
        
        # 設置入口
        graph.set_entry_point("planner")
        
        # 添加邊
        graph.add_edge("planner", "coder")
        graph.add_edge("coder", "tester")
        graph.add_edge("tester", "reviewer")
        
        # 條件路由
        graph.add_conditional_edges(
            "reviewer",
            self._route_after_review,
            {
                "revise": "coder",
                "human_review": "human_review",
                "finalize": "finalize",
            }
        )
        
        graph.add_edge("human_review", "finalize")
        graph.add_edge("finalize", END)
        
        return graph.compile()
    
    # ========================================
    # 節點函數 (佔位實現)
    # ========================================
    
    def _planner_node(self, state: CodingState) -> CodingState:
        """規劃節點: 生成實施計劃"""
        state["current_step"] = "planner"
        state["implementation_plan"] = {
            "description": state.get("task_description", ""),
            "steps": [],
            "estimated_time": "TBD",
        }
        return state
    
    def _coder_node(self, state: CodingState) -> CodingState:
        """編碼節點: 生成代碼變更"""
        state["current_step"] = "coder"
        state["code_version"] = state.get("code_version", 0) + 1
        return state
    
    def _tester_node(self, state: CodingState) -> CodingState:
        """測試節點: 運行測試和 Lint"""
        state["current_step"] = "tester"
        # 佔位測試結果
        state["test_result"] = {
            "passed": 0,
            "failed": 0,
            "total": 0,
            "coverage": 0,
        }
        state["lint_result"] = {
            "errors": 0,
            "warnings": 0,
            "issues": [],
        }
        state["build_result"] = {
            "success": True,
            "output": "",
        }
        return state
    
    def _reviewer_node(self, state: CodingState) -> CodingState:
        """審查節點: 代碼審查"""
        state["current_step"] = "reviewer"
        
        # 使用 evaluate 計算決策
        result = self.evaluate(state)
        state["decision"] = result.decision
        state["decision_reason"] = result.decision_reason
        state["score"] = result.total_score
        state["review_summary"] = result.feedback
        
        return state
    
    def _human_review_node(self, state: CodingState) -> CodingState:
        """人工審查節點"""
        state["current_step"] = "human_review"
        state["requires_human_intervention"] = True
        return state
    
    def _finalize_node(self, state: CodingState) -> CodingState:
        """終結節點"""
        state["current_step"] = "finalize"
        state["final_output"] = f"完成 {len(state.get('file_changes', []))} 個文件變更"
        return state
    
    def _route_after_review(self, state: CodingState) -> str:
        """審查後的路由決策"""
        return self.should_continue(state)
    
    def should_continue(self, state: CodingState) -> str:
        """代碼專用的繼續判斷邏輯"""
        config = self.merge_config(self.config)
        
        revision_count = state.get("revision_count", 0)
        max_revisions = config.get("max_revisions", 3)
        
        decision = state.get("decision", "REVISE")
        
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
        return "revise"
    
    def get_default_config(self) -> CodeWorkflowConfig:
        return DEFAULT_CODE_CONFIG.copy()
