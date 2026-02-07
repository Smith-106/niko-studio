# -*- coding: utf-8 -*-
"""
叙事语气评估器

评估叙述语气的强度和一致性。
仅负责评估，具体技巧参见 skills/voice-workshop/SKILL.md
"""

import re
from typing import Dict, Any, Optional
from .base import BaseEvaluator, EvaluationResult, Issue, Severity


class VoiceEvaluator(BaseEvaluator):
    """叙事语气评估器"""
    
    @property
    def name(self) -> str:
        return "叙事语气评估器"
    
    @property
    def description(self) -> str:
        return "评估叙述语气的强度、具体性和一致性"
    
    @property
    def related_skill(self) -> str:
        return "voice-workshop"
    
    # 空泛词汇（应避免）
    VAGUE_WORDS = [
        "很", "非常", "特别", "十分", "极其",
        "好", "坏", "大", "小", "多", "少",
        "美丽", "漂亮", "英俊", "丑陋",
        "好人", "坏人", "好事", "坏事",
    ]
    
    # 具体细节标记（应增加）
    SPECIFIC_MARKERS = [
        # 品牌/专有名词模式
        r"[A-Z][a-z]+",  # 英文品牌
        # 数字细节
        r"\d+(?:米|厘米|公斤|块钱|岁|年|月|日|点|分)",
        # 颜色细节
        r"(?:深|浅|暗|亮)?(?:红|橙|黄|绿|蓝|紫|黑|白|灰|棕)色?",
    ]
    
    # 叙述者态度标记
    NARRATOR_ATTITUDE_MARKERS = [
        "显然", "毫无疑问", "不得不说", "说实话",
        "讽刺的是", "有趣的是", "可笑的是",
        "令人惊讶的是", "不幸的是", "幸运的是",
    ]
    
    async def evaluate(
        self,
        content: str,
        context: Optional[Dict[str, Any]] = None
    ) -> EvaluationResult:
        """执行完整评估"""
        
        specificity = self._evaluate_specificity(content)
        vagueness_penalty = self._evaluate_vagueness(content)
        narrator_presence = self._evaluate_narrator_presence(content)
        
        # 综合计算（空泛词扣分）
        total_score = (
            specificity * 0.4 +
            (100 - vagueness_penalty) * 0.3 +
            narrator_presence * 0.3
        )
        
        issues = []
        
        if specificity < 60:
            issues.append(Issue(
                code="VOICE_LACKS_DETAIL",
                message="具体细节不足，语气显得虚弱",
                severity=Severity.MAJOR,
                suggestion="用具体细节替换空泛描述",
                related_skill="voice-workshop"
            ))
        
        if vagueness_penalty > 40:
            issues.append(Issue(
                code="VOICE_TOO_VAGUE",
                message="空泛词汇过多",
                severity=Severity.MAJOR,
                suggestion="减少'很/非常/特别'等空泛修饰词",
                related_skill="voice-workshop"
            ))
        
        if narrator_presence < 40:
            issues.append(Issue(
                code="VOICE_INVISIBLE",
                message="叙述者过于隐身，缺乏个性",
                severity=Severity.MINOR,
                suggestion="允许叙述者表达观点和态度",
                related_skill="voice-workshop"
            ))
        
        return EvaluationResult(
            evaluator_name=self.name,
            score=total_score,
            level=self._score_to_level(total_score),
            issues=issues,
            metrics={
                "specificity": specificity,
                "vagueness_penalty": vagueness_penalty,
                "narrator_presence": narrator_presence,
            },
            summary=f"语气强度：{self._score_to_level(total_score).value}"
        )
    
    def _evaluate_specificity(self, content: str) -> float:
        """评估具体性"""
        score = 50
        for pattern in self.SPECIFIC_MARKERS:
            matches = len(re.findall(pattern, content))
            score += matches * 3
        return min(100, score)
    
    def _evaluate_vagueness(self, content: str) -> float:
        """评估空泛度（返回扣分值）"""
        vague_count = 0
        for word in self.VAGUE_WORDS:
            vague_count += content.count(word)
        
        # 根据文本长度计算密度
        if len(content) == 0:
            return 0
        density = (vague_count / len(content)) * 1000
        return min(100, density * 10)
    
    def _evaluate_narrator_presence(self, content: str) -> float:
        """评估叙述者存在感"""
        score = 30
        for marker in self.NARRATOR_ATTITUDE_MARKERS:
            if marker in content:
                score += 12
        return min(100, score)
