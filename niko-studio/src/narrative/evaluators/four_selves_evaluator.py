# -*- coding: utf-8 -*-
"""
四个自我评估器 (Four Selves Evaluator)

评估角色四个自我层次的揭示深度：社会自我、个人自我、私密自我、隐藏自我。
技能参考: skills/four-selves/SKILL.md
"""

import re
from typing import Dict, Any, Optional, List
from .base import BaseEvaluator, EvaluationResult, Issue, Severity


class FourSelvesEvaluator(BaseEvaluator):
    """四个自我评估器"""
    
    @property
    def name(self) -> str:
        return "四个自我评估器"
    
    @property
    def description(self) -> str:
        return "评估角色四个自我层次的揭示：社会/个人/私密/隐藏自我"
    
    @property
    def related_skill(self) -> str:
        return "four-selves"
    
    # 社会自我标记（公众场合、职业身份）
    SOCIAL_SELF_MARKERS = [
        "同事", "客户", "公众", "媒体", "会议", "演讲",
        "职业", "身份", "形象", "表现", "装作", "假装",
        "西装", "制服", "名片", "头衔",
    ]
    
    # 个人自我标记（家庭、亲密关系）
    PERSONAL_SELF_MARKERS = [
        "家人", "朋友", "爱人", "孩子", "父母",
        "回家", "放松", "卸下", "私下", "其实",
        "真实的", "平时",
    ]
    
    # 私密自我标记（独处、内心）
    PRIVATE_SELF_MARKERS = [
        "独自", "一个人", "深夜", "凌晨", "镜子",
        "内心", "不愿让人知道", "秘密", "日记",
        "没人的时候", "关上门",
    ]
    
    # 隐藏自我标记（潜意识、压抑）
    HIDDEN_SELF_MARKERS = [
        "压抑", "埋藏", "从未告诉", "不敢面对",
        "噩梦", "闪回", "创伤", "多年前",
        "真相是", "其实一直", "从来没有承认",
    ]
    
    async def evaluate(
        self,
        content: str,
        context: Optional[Dict[str, Any]] = None
    ) -> EvaluationResult:
        """执行四个自我评估"""
        
        # 评估各层次
        social_score = self._evaluate_layer(content, self.SOCIAL_SELF_MARKERS)
        personal_score = self._evaluate_layer(content, self.PERSONAL_SELF_MARKERS)
        private_score = self._evaluate_layer(content, self.PRIVATE_SELF_MARKERS)
        hidden_score = self._evaluate_layer(content, self.HIDDEN_SELF_MARKERS)
        
        # 计算层次深度（出现多少层）
        layers_present = sum([
            social_score > 30,
            personal_score > 30,
            private_score > 30,
            hidden_score > 30,
        ])
        
        # 综合评分
        layer_average = (social_score + personal_score + private_score + hidden_score) / 4
        depth_bonus = layers_present * 10  # 每增加一层加10分
        
        total_score = min(100, layer_average * 0.6 + depth_bonus)
        
        issues = []
        
        # 生成问题报告
        if layers_present < 2:
            issues.append(Issue(
                code="CHARACTER_SHALLOW",
                message="角色层次单一，缺乏深度",
                severity=Severity.MAJOR,
                suggestion="揭示角色在不同场合的不同面貌",
                related_skill="four-selves"
            ))
        
        if private_score < 30 and hidden_score < 30:
            issues.append(Issue(
                code="CHARACTER_NO_INNER_WORLD",
                message="角色缺乏私密自我和隐藏自我的揭示",
                severity=Severity.MAJOR,
                suggestion="添加角色独处时的真实状态或压抑的秘密",
                related_skill="four-selves"
            ))
        
        if social_score > 70 and personal_score < 30:
            issues.append(Issue(
                code="CHARACTER_ALL_MASK",
                message="角色只展示社会面具，缺乏真实的个人层面",
                severity=Severity.MINOR,
                suggestion="展示角色在亲密关系中的不同表现",
                related_skill="four-selves"
            ))
        
        return EvaluationResult(
            evaluator_name=self.name,
            score=total_score,
            level=self._score_to_level(total_score),
            issues=issues,
            metrics={
                "social_self": social_score,
                "personal_self": personal_score,
                "private_self": private_score,
                "hidden_self": hidden_score,
                "layers_present": layers_present,
            },
            summary=f"角色深度：{layers_present}/4层，{self._score_to_level(total_score).value}"
        )
    
    def _evaluate_layer(self, content: str, markers: List[str]) -> float:
        """评估单个层次的呈现程度"""
        score = 20  # 基础分
        
        for marker in markers:
            if marker in content:
                score += 15
        
        return min(100, score)
