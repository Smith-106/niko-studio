# -*- coding: utf-8 -*-
"""
评估器基类

所有叙事评估器的抽象基类，定义统一接口。
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from enum import Enum


class Severity(Enum):
    """问题严重程度"""
    CRITICAL = "critical"    # 严重问题，必须修复
    MAJOR = "major"          # 主要问题，建议修复
    MINOR = "minor"          # 次要问题，可选修复
    INFO = "info"            # 信息提示


class ScoreLevel(Enum):
    """评分等级"""
    EXCELLENT = "excellent"  # 90-100: 卓越
    GOOD = "good"            # 75-89: 良好
    FAIR = "fair"            # 60-74: 一般
    POOR = "poor"            # 40-59: 较差
    CRITICAL = "critical"    # 0-39: 严重不足


@dataclass
class Issue:
    """评估发现的问题"""
    code: str                          # 问题代码，如 "DREAM_SYMPATHY_WEAK"
    message: str                       # 问题描述
    severity: Severity                 # 严重程度
    location: Optional[str] = None     # 问题位置（段落/句子）
    suggestion: Optional[str] = None   # 改进方向（非具体技巧）
    related_skill: Optional[str] = None  # 关联的技能包ID


@dataclass
class EvaluationResult:
    """评估结果"""
    evaluator_name: str                # 评估器名称
    score: float                       # 总分 0-100
    level: ScoreLevel                  # 评分等级
    issues: List[Issue] = field(default_factory=list)  # 发现的问题
    metrics: Dict[str, float] = field(default_factory=dict)  # 细分指标
    summary: str = ""                  # 评估摘要
    raw_analysis: Optional[Dict[str, Any]] = None  # 原始分析数据
    
    @property
    def critical_issues(self) -> List[Issue]:
        """获取严重问题"""
        return [i for i in self.issues if i.severity == Severity.CRITICAL]
    
    @property
    def major_issues(self) -> List[Issue]:
        """获取主要问题"""
        return [i for i in self.issues if i.severity == Severity.MAJOR]
    
    @property
    def has_critical_issues(self) -> bool:
        """是否存在严重问题"""
        return len(self.critical_issues) > 0
    
    @property
    def top_issues(self, n: int = 3) -> List[Issue]:
        """获取最重要的N个问题"""
        sorted_issues = sorted(
            self.issues,
            key=lambda x: (
                0 if x.severity == Severity.CRITICAL else
                1 if x.severity == Severity.MAJOR else
                2 if x.severity == Severity.MINOR else 3
            )
        )
        return sorted_issues[:n]
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "evaluator": self.evaluator_name,
            "score": self.score,
            "level": self.level.value,
            "issues": [
                {
                    "code": i.code,
                    "message": i.message,
                    "severity": i.severity.value,
                    "location": i.location,
                    "suggestion": i.suggestion,
                    "related_skill": i.related_skill,
                }
                for i in self.issues
            ],
            "metrics": self.metrics,
            "summary": self.summary,
        }


class BaseEvaluator(ABC):
    """评估器基类"""
    
    def __init__(self, llm_client=None):
        """
        初始化评估器
        
        Args:
            llm_client: LLM客户端，用于AI辅助评估（可选）
        """
        self.llm_client = llm_client
    
    @property
    @abstractmethod
    def name(self) -> str:
        """评估器名称"""
        pass
    
    @property
    @abstractmethod
    def description(self) -> str:
        """评估器描述"""
        pass
    
    @property
    def related_skill(self) -> Optional[str]:
        """关联的技能包ID"""
        return None
    
    @abstractmethod
    async def evaluate(
        self,
        content: str,
        context: Optional[Dict[str, Any]] = None
    ) -> EvaluationResult:
        """
        执行评估
        
        Args:
            content: 待评估的文本内容
            context: 上下文信息（如角色信息、故事背景等）
            
        Returns:
            EvaluationResult: 评估结果
        """
        pass
    
    def quick_scan(self, content: str) -> EvaluationResult:
        """
        快速扫描（不使用LLM）
        
        Args:
            content: 待评估的文本内容
            
        Returns:
            EvaluationResult: 快速评估结果
        """
        # 默认实现：返回空结果，子类可覆盖
        return EvaluationResult(
            evaluator_name=self.name,
            score=0,
            level=ScoreLevel.FAIR,
            summary="快速扫描未实现"
        )
    
    def _score_to_level(self, score: float) -> ScoreLevel:
        """将分数转换为等级"""
        if score >= 90:
            return ScoreLevel.EXCELLENT
        elif score >= 75:
            return ScoreLevel.GOOD
        elif score >= 60:
            return ScoreLevel.FAIR
        elif score >= 40:
            return ScoreLevel.POOR
        else:
            return ScoreLevel.CRITICAL
