"""
领域适配器基类

定义所有领域适配器的通用接口和行为。
"""

from abc import ABC, abstractmethod
from typing import Any, Dict
from ..base_state import BaseState, WorkflowConfig


class BaseAdapter(ABC):
    """
    领域适配器抽象基类
    
    每个领域适配器负责:
    1. 定义领域特定的状态扩展
    2. 实现领域特定的节点函数
    3. 提供领域特定的路由逻辑
    4. 定义领域特定的验证规则
    """
    
    def __init__(self, config: WorkflowConfig = None):
        """
        初始化适配器
        
        Args:
            config: 工作流配置
        """
        self.config = config or {}
        self.domain = self.get_domain()
    
    @abstractmethod
    def get_domain(self) -> str:
        """
        获取领域名称
        
        Returns:
            领域标识符 (例如: "novel", "code", "knowledge")
        """
        pass
    
    @abstractmethod
    def create_initial_state(self, user_request: str, **kwargs) -> BaseState:
        """
        创建初始状态
        
        Args:
            user_request: 用户请求
            **kwargs: 领域特定参数
        
        Returns:
            初始化的领域状态
        """
        pass
    
    @abstractmethod
    def get_node_functions(self) -> Dict[str, callable]:
        """
        获取节点函数映射
        
        Returns:
            节点名称到节点函数的映射 {"node_name": node_function}
        """
        pass
    
    @abstractmethod
    def get_routing_functions(self) -> Dict[str, callable]:
        """
        获取路由函数映射
        
        Returns:
            路由点到路由函数的映射
        """
        pass
    
    @abstractmethod
    def validate_state(self, state: BaseState) -> tuple[bool, list[str]]:
        """
        验证状态完整性
        
        Args:
            state: 待验证的状态
        
        Returns:
            (is_valid, errors) 元组
        """
        pass
    
    def should_continue(self, state: BaseState) -> str:
        """
        决策路由 (可被子类覆盖)
        
        Args:
            state: 当前状态
        
        Returns:
            下一个节点名称或 "END"
        """
        if state.get("requires_human_intervention"):
            return "human_review"
        
        if state.get("decision") == "APPROVED":
            return "END"
        elif state.get("decision") == "REVISE":
            if state.get("revision_count", 0) >= state.get("max_revisions", 3):
                return "human_review"
            return "revise"
        elif state.get("decision") == "HUMAN_REVIEW":
            return "human_review"
        else:
            return "END"
    
    def log(self, message: str, level: str = "INFO"):
        """
        日志输出
        
        Args:
            message: 日志消息
            level: 日志级别
        """
        if self.config.get("verbose", True):
            print(f"[{self.domain.upper()}] {level}: {message}")
