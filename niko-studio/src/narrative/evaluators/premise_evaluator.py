# -*- coding: utf-8 -*-
"""
预设评估器

评估故事预设的清晰度和一致性。
仅负责评估，具体技巧参见 skills/premise-magic/SKILL.md
"""

from typing import Dict, Any, Optional
from .base import BaseEvaluator, EvaluationResult, Issue, Severity


class PremiseEvaluator(BaseEvaluator):
    """预设评估器"""
    
    @property
    def name(self) -> str:
        return "预设评估器"
    
    @property
    def description(self) -> str:
        return "评估故事预设的清晰度、因果关系和戏剧性"
    
    @property
    def related_skill(self) -> str:
        return "premise-magic"
    
    # 因果关系标记
    CAUSALITY_MARKERS = [
        "因为", "所以", "导致", "因此", "于是",
        "结果", "最终", "终于", "从而",
    ]
    
    # 讽刺/反转标记
    IRONY_MARKERS = [
        "却", "反而", "没想到", "意外", "讽刺的是",
        "恰恰相反", "竟然", "偏偏",
    ]
    
    async def evaluate(
        self,
        content: str,
        context: Optional[Dict[str, Any]] = None
    ) -> EvaluationResult:
        """执行完整评估"""
        
        # 从上下文获取预设信息
        premise = context.get("premise", "") if context else ""
        
        causality = self._evaluate_causality(content)
        irony = self._evaluate_irony(content)
        consistency = self._evaluate_consistency(content, premise)
        
        total_score = (causality * 0.4 + irony * 0.3 + consistency * 0.3)
        
        issues = []
        
        if causality < 60:
            issues.append(Issue(
                code="PREMISE_CAUSALITY_WEAK",
                message="因果关系不清晰",
                severity=Severity.MAJOR,
                suggestion="强化事件之间的因果链条",
                related_skill="premise-magic"
            ))
        
        if irony < 50:
            issues.append(Issue(
                code="PREMISE_NO_IRONY",
                message="缺乏讽刺性或意外性",
                severity=Severity.MINOR,
                suggestion="考虑使用预设魔杖增加戏剧性",
                related_skill="premise-magic"
            ))
        
        return EvaluationResult(
            evaluator_name=self.name,
            score=total_score,
            level=self._score_to_level(total_score),
            issues=issues,
            metrics={
                "causality": causality,
                "irony": irony,
                "consistency": consistency,
            },
            summary=f"预设强度：{self._score_to_level(total_score).value}"
        )
    
    def _evaluate_causality(self, content: str) -> float:
        score = 40
        for m in self.CAUSALITY_MARKERS:
            if m in content:
                score += 8
        return min(100, score)
    
    def _evaluate_irony(self, content: str) -> float:
        score = 30
        for m in self.IRONY_MARKERS:
            if m in content:
                score += 12
        return min(100, score)
    
    def _evaluate_consistency(self, content: str, premise: str) -> float:
        if not premise:
            return 60  # 无预设时返回中等分
        # 简化检查：预设关键词是否出现在内容中
        keywords = premise.replace("导致", " ").replace("最终", " ").split()
        matches = sum(1 for k in keywords if k in content)
        return min(100, 40 + matches * 15)
