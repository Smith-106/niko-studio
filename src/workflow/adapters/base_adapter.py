"""
領域適配器基類 (Base Domain Adapter)

定義領域適配器的抽象接口，各領域 (Novel/Code/Knowledge) 
繼承此類實現具體的工作流邏輯。

設計原則:
- 抽象公共接口
- 強制實現必要方法
- 提供默認實現可覆蓋
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Type
from dataclasses import dataclass
from enum import Enum

from src.workflow.base_state import BaseState, BaseWorkflowConfig


# ============================================================
# 領域類型枚舉
# ============================================================

class DomainType(Enum):
    """領域類型"""
    NOVEL = "novel"
    CODE = "code"
    KNOWLEDGE = "knowledge"
    CUSTOM = "custom"


# ============================================================
# 評估結果基類
# ============================================================

@dataclass
class BaseEvaluationResult:
    """評估結果基類"""
    decision: str                   # APPROVED | REVISE | HUMAN_REVIEW | REWRITE
    decision_reason: str
    total_score: float
    dimension_scores: Dict[str, float]  # 各維度分數
    feedback: str                   # 可執行反饋
    revision_instructions: List[Dict[str, str]]  # 修改指令


# ============================================================
# 領域適配器基類
# ============================================================

class BaseDomainAdapter(ABC):
    """
    領域適配器抽象基類
    
    每個領域 (小說/代碼/知識) 需要實現:
    1. 狀態類型 (get_state_class)
    2. 驗證邏輯 (evaluate)
    3. 圖構建 (create_graph)
    4. 節點函數 (create_nodes)
    """
    
    def __init__(self, config: Optional[BaseWorkflowConfig] = None):
        self.config = config or {}
        self.domain = self.get_domain_type()
    
    # ========================================
    # 抽象方法 - 子類必須實現
    # ========================================
    
    @abstractmethod
    def get_domain_type(self) -> str:
        """返回領域類型標識"""
        pass
    
    @abstractmethod
    def get_state_class(self) -> Type[BaseState]:
        """返回該領域的狀態類"""
        pass
    
    @abstractmethod
    def create_initial_state(self, user_request: str, **kwargs) -> BaseState:
        """創建該領域的初始狀態 (允許額外元數據透傳)"""
        pass
    
    @abstractmethod
    def evaluate(self, state: BaseState) -> BaseEvaluationResult:
        """
        評估當前狀態質量
        
        各領域評估維度不同:
        - 小說: LOCK (Lead, Objective, Conflict, Knockout)
        - 代碼: Tests, Lint, Build, Coverage
        - 知識: Accuracy, Completeness, Relevance
        """
        pass
    
    @abstractmethod
    def create_graph(self):
        """
        創建 LangGraph 工作流圖
        
        Returns:
            StateGraph: LangGraph 狀態圖
        """
        pass
    
    # ========================================
    # 可覆蓋方法 - 提供默認實現
    # ========================================
    
    def get_nodes(self) -> Dict[str, callable]:
        """
        獲取工作流節點函數映射
        
        Returns:
            Dict[str, callable]: 節點名 -> 節點函數
        """
        return {}
    
    def get_routing_rules(self) -> Dict[str, callable]:
        """
        獲取路由規則映射
        
        Returns:
            Dict[str, callable]: 邊名 -> 路由函數
        """
        return {}
    
    def should_continue(self, state: BaseState) -> str:
        """
        默認的繼續/終止判斷
        
        可被子類覆蓋以實現領域特定邏輯
        """
        if state.get("revision_count", 0) >= state.get("max_revisions", 3):
            return "human_review"
        
        decision = state.get("decision", "")
        if decision == "APPROVED":
            return "finalize"
        elif decision == "HUMAN_REVIEW":
            return "human_review"
        elif decision in ("REVISE", "REWRITE"):
            return "revise"
        else:
            return "continue"
    
    def get_default_config(self) -> BaseWorkflowConfig:
        """獲取默認配置（基礎層 fallback；具體領域應覆蓋）"""
        return {
            # 僅適用於 base/custom 通用場景
            # novel 請以 src/workflow/state.py 的 domain 常量為準
            "pass_score": 80,
            "human_review_score": 70,
            "max_revisions": 3,
            "auto_approve_timeout": 300,
            "verbose": True,
            "save_intermediate": True,
            "domain": self.domain,
            "domain_config": {},
        }
    
    # ========================================
    # 工具方法
    # ========================================
    
    def merge_config(self, custom_config: Optional[Dict] = None) -> BaseWorkflowConfig:
        """合併配置"""
        default = self.get_default_config()
        if custom_config:
            default.update(custom_config)
        return default


# ============================================================
# 適配器註冊表
# ============================================================

class AdapterRegistry:
    """
    適配器註冊表

    用於動態註冊和查找領域適配器
    """

    _adapters: Dict[str, Type[BaseDomainAdapter]] = {}
    _adapter_capabilities: Dict[str, set[str]] = {}

    @staticmethod
    def _normalize_capabilities(capabilities: Optional[Any]) -> set[str]:
        if capabilities is None:
            return set()
        if isinstance(capabilities, str):
            values = [capabilities]
        else:
            values = list(capabilities)
        return {str(value).strip() for value in values if str(value).strip()}

    @classmethod
    def register(
        cls,
        domain: str,
        capabilities: Optional[Any] = None,
    ):
        """裝飾器: 註冊適配器"""

        def decorator(adapter_class: Type[BaseDomainAdapter]):
            cls.register_adapter(domain, adapter_class, capabilities=capabilities)
            return adapter_class

        return decorator

    @classmethod
    def register_adapter(
        cls,
        domain: str,
        adapter_class: Type[BaseDomainAdapter],
        capabilities: Optional[Any] = None,
    ) -> None:
        """註冊適配器類（支持 capability 元數據）"""
        cls._adapters[domain] = adapter_class
        cls._adapter_capabilities[domain] = cls._normalize_capabilities(capabilities)

    @classmethod
    def get(cls, domain: str) -> Optional[Type[BaseDomainAdapter]]:
        """獲取適配器類"""
        return cls._adapters.get(domain)

    @classmethod
    def get_capabilities(cls, domain: str) -> List[str]:
        """獲取領域能力標籤"""
        capabilities = cls._adapter_capabilities.get(domain, set())
        return sorted(capabilities)

    @classmethod
    def list_domains(cls) -> List[str]:
        """列出所有已註冊領域"""
        return list(cls._adapters.keys())

    @classmethod
    def list_domains_by_capability(cls, capability: str) -> List[str]:
        """按能力標籤列出領域"""
        needle = (capability or "").strip()
        if not needle:
            return []
        return [
            domain
            for domain in cls.list_domains()
            if needle in cls._adapter_capabilities.get(domain, set())
        ]

    @classmethod
    def create_adapter(cls, domain: str, config: Optional[Dict] = None) -> Optional[BaseDomainAdapter]:
        """創建適配器實例"""
        adapter_class = cls.get(domain)
        if adapter_class:
            return adapter_class(config)
        return None
