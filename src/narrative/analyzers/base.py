# -*- coding: utf-8 -*-
"""
分析器基类

所有叙事分析器的抽象基类，定义统一接口。
分析器负责提取结构化数据，而非评分。
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Generic, TypeVar
from enum import Enum


class AnalysisType(Enum):
    """分析类型"""
    SENSORY = "sensory"           # 感官细节
    CONFLICT = "conflict"         # 冲突元素
    TENSION = "tension"           # 张力曲线
    CHARACTER_STATE = "character_state"  # 角色状态
    DIALOGUE = "dialogue"         # 对话分析
    PACING = "pacing"            # 节奏分析


T = TypeVar('T')


@dataclass
class AnalysisResult(Generic[T]):
    """分析结果"""
    analyzer_name: str                    # 分析器名称
    analysis_type: AnalysisType           # 分析类型
    items: List[T] = field(default_factory=list)  # 提取的项目
    metadata: Dict[str, Any] = field(default_factory=dict)  # 元数据
    summary: str = ""                     # 分析摘要

    @property
    def count(self) -> int:
        """项目数量"""
        return len(self.items)

    @property
    def is_empty(self) -> bool:
        """是否为空"""
        return len(self.items) == 0

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "analyzer": self.analyzer_name,
            "type": self.analysis_type.value,
            "count": self.count,
            "items": [
                item.to_dict() if hasattr(item, 'to_dict') else str(item)
                for item in self.items
            ],
            "metadata": self.metadata,
            "summary": self.summary,
        }


class BaseAnalyzer(ABC):
    """分析器基类"""

    def __init__(self, llm_client=None):
        """
        初始化分析器

        Args:
            llm_client: LLM客户端，用于AI辅助分析（可选）
        """
        self.llm_client = llm_client

    @property
    @abstractmethod
    def name(self) -> str:
        """分析器名称"""
        pass

    @property
    @abstractmethod
    def analysis_type(self) -> AnalysisType:
        """分析类型"""
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        """分析器描述"""
        pass

    @abstractmethod
    async def analyze(
        self,
        content: str,
        context: Optional[Dict[str, Any]] = None
    ) -> AnalysisResult:
        """
        执行分析

        Args:
            content: 待分析的文本内容
            context: 上下文信息

        Returns:
            AnalysisResult: 分析结果
        """
        pass

    def quick_analyze(self, content: str) -> AnalysisResult:
        """
        快速分析（不使用LLM，基于规则）

        Args:
            content: 待分析的文本内容

        Returns:
            AnalysisResult: 快速分析结果
        """
        # 默认实现：返回空结果，子类可覆盖
        return AnalysisResult(
            analyzer_name=self.name,
            analysis_type=self.analysis_type,
            summary="快速分析未实现"
        )
