from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from .base_state import BaseState

class BaseWorkflow(ABC):
    """
    工作流基类 (Base Workflow)

    定义工作流的生命周期和执行接口。
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}

    @abstractmethod
    def run(self, input_data: Any) -> Any:
        """执行工作流"""
        pass

    @abstractmethod
    def get_state(self) -> BaseState:
        """获取当前状态"""
        pass
