"""
工作流層級基類 (Base Level)

定義 L1-L5 工作流層級的抽象接口。
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from ..base_state import BaseState


class BaseLevel(ABC):
    """
    工作流層級基類
    
    L1 Rapid:      無狀態、無工件、直接輸出
    L2 Lightweight: 內存計劃、輕量持久化
    L3 Standard:   完整會話、驗證步驟
    L4 Brainstorm: 多角色並行分析
    L5 Coordinator: 智能鏈推薦、狀態持久化
    """
    
    level: int = 0
    name: str = "base"
    description: str = ""
    
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}
    
    @abstractmethod
    def execute(self, state: BaseState, **kwargs) -> BaseState:
        """執行該層級工作流"""
        pass
    
    @abstractmethod
    def get_required_agents(self) -> List[str]:
        """返回該層級需要的 Agent 列表"""
        pass
    
    def supports_resume(self) -> bool:
        """是否支持斷點續傳"""
        return self.level >= 3
    
    def requires_persistence(self) -> bool:
        """是否需要持久化"""
        return self.level >= 2
    
    def get_default_config(self) -> Dict:
        """獲取默認配置"""
        return {
            "max_revisions": 3,
            "pass_score": 80,
            "verbose": True,
        }


class LevelRegistry:
    """層級註冊表"""
    
    _levels: Dict[int, type] = {}
    
    @classmethod
    def register(cls, level_num: int):
        """裝飾器: 註冊層級"""
        def decorator(level_class: type):
            cls._levels[level_num] = level_class
            return level_class
        return decorator
    
    @classmethod
    def get(cls, level_num: int) -> Optional[type]:
        """獲取層級類"""
        return cls._levels.get(level_num)
    
    @classmethod
    def create(cls, level_num: int, config: Optional[Dict] = None) -> Optional[BaseLevel]:
        """創建層級實例"""
        level_class = cls.get(level_num)
        if not level_class:
            return None

        # 优先使用命名参数传递 config，兼容各层级构造函数参数顺序差异
        try:
            return level_class(config=config)
        except TypeError:
            return level_class(config)
