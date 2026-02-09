# -*- coding: utf-8 -*-
"""
人物评估器

评估人物塑造的深度和效果。
仅负责评估，具体技巧参见 skills/character-forge/SKILL.md
"""

import re
from typing import Dict, Any, Optional
from .base import BaseEvaluator, EvaluationResult, Issue, Severity


class CharacterEvaluator(BaseEvaluator):
    """人物评估器"""
    
    @property
    def name(self) -> str:
        return "人物评估器"
    
    @property
    def description(self) -> str:
        return "评估人物塑造深度，检测能力/古怪/对比/主导情感/双重人格等维度"
    
    @property
    def related_skill(self) -> str:
        return "character-forge"
    
    # 能力展示标记
    COMPETENCE_MARKERS = [
        "擅长", "精通", "高超", "娴熟", "专业", "技艺",
        "轻而易举", "游刃有余", "得心应手",
    ]
    
    # 古怪特质标记
    ECCENTRICITY_MARKERS = [
        "奇怪", "古怪", "特别", "与众不同", "怪癖",
        "总是", "从不", "必须", "习惯",
    ]
    
    # 内心冲突标记
    INNER_CONFLICT_MARKERS = [
        "一方面", "另一方面", "既想", "又怕",
        "内心", "挣扎", "矛盾", "两个自己",
    ]
    
    async def evaluate(
        self,
        content: str,
        context: Optional[Dict[str, Any]] = None
    ) -> EvaluationResult:
        """执行完整评估"""
        
        competence = self._evaluate_competence(content)
        eccentricity = self._evaluate_eccentricity(content)
        inner_conflict = self._evaluate_inner_conflict(content)
        
        total_score = (competence + eccentricity + inner_conflict) / 3
        
        issues = []
        
        if competence < 50:
            issues.append(Issue(
                code="CHAR_COMPETENCE_WEAK",
                message="角色能力展示不足",
                severity=Severity.MINOR,
                suggestion="展示角色擅长的技能",
                related_skill="character-forge"
            ))
        
        if eccentricity < 50:
            issues.append(Issue(
                code="CHAR_BLAND",
                message="角色缺乏独特性/古怪特质",
                severity=Severity.MAJOR,
                suggestion="添加让角色难忘的古怪特质",
                related_skill="character-forge"
            ))
        
        if inner_conflict < 50:
            issues.append(Issue(
                code="CHAR_STATIC",
                message="角色缺乏内心冲突",
                severity=Severity.MAJOR,
                suggestion="设计双重人格或内心矛盾",
                related_skill="character-forge"
            ))
        
        return EvaluationResult(
            evaluator_name=self.name,
            score=total_score,
            level=self._score_to_level(total_score),
            issues=issues,
            metrics={
                "competence": competence,
                "eccentricity": eccentricity,
                "inner_conflict": inner_conflict,
            },
            summary=f"人物深度：{self._score_to_level(total_score).value}"
        )
    
    def _evaluate_competence(self, content: str) -> float:
        score = 40
        for m in self.COMPETENCE_MARKERS:
            if m in content:
                score += 10
        return min(100, score)
    
    def _evaluate_eccentricity(self, content: str) -> float:
        score = 40
        for m in self.ECCENTRICITY_MARKERS:
            if m in content:
                score += 10
        return min(100, score)
    
    def _evaluate_inner_conflict(self, content: str) -> float:
        score = 40
        for m in self.INNER_CONFLICT_MARKERS:
            if m in content:
                score += 10
        return min(100, score)
