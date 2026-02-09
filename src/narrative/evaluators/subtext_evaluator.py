# -*- coding: utf-8 -*-
"""
潜台词评估器 (Subtext Evaluator)

评估对话的潜台词浓度，检测直白对白问题。
技能参考: skills/subtext-dialogue/SKILL.md, skills/on-the-nose-fix/SKILL.md
"""

import re
from typing import Dict, Any, Optional, List
from .base import BaseEvaluator, EvaluationResult, Issue, Severity


class SubtextEvaluator(BaseEvaluator):
    """潜台词评估器"""
    
    @property
    def name(self) -> str:
        return "潜台词评估器"
    
    @property
    def description(self) -> str:
        return "评估对话的潜台词浓度，检测直白对白(On-The-Nose)问题"
    
    @property
    def related_skill(self) -> str:
        return "subtext-dialogue"
    
    # 直白对白标记词 (On-The-Nose Markers)
    ON_THE_NOSE_MARKERS = [
        # 情感直述
        "我很生气", "我很难过", "我很开心", "我很害怕",
        "我感到", "我觉得你", "我现在非常",
        
        # 动机解释
        "因为我爱你", "因为我在乎", "这是因为",
        "我这么做是为了", "我之所以",
        
        # 关系陈述
        "你是我的", "我们是", "作为你的朋友",
        "作为你的", "我们之间",
        
        # 过度解释
        "你明白吗", "我的意思是", "让我解释",
        "换句话说", "也就是说",
        
        # 心理分析
        "你这是在", "你内心其实", "你潜意识里",
        "你不愿意承认",
    ]
    
    # 潜台词正向标记
    SUBTEXT_POSITIVE_MARKERS = [
        # 间接表达
        "不过", "话说回来", "对了",
        
        # 行为描写配合对话
        "他看着", "她转过头", "停顿了一下",
        "沉默", "没有回答", "岔开话题",
        
        # 物品/环境转移
        "窗外", "杯子", "手机", "看向别处",
    ]
    
    # 对话过长警告阈值
    DIALOGUE_LENGTH_THRESHOLD = 100  # 单句对话超过100字警告
    
    async def evaluate(
        self,
        content: str,
        context: Optional[Dict[str, Any]] = None
    ) -> EvaluationResult:
        """执行潜台词评估"""
        
        # 提取对话
        dialogues = self._extract_dialogues(content)
        
        if not dialogues:
            return EvaluationResult(
                evaluator_name=self.name,
                score=50,
                level=self._score_to_level(50),
                issues=[],
                metrics={"dialogue_count": 0},
                summary="未检测到对话内容"
            )
        
        # 评估各维度
        on_the_nose_score = self._evaluate_on_the_nose(dialogues)
        subtext_density = self._evaluate_subtext_density(content, dialogues)
        dialogue_length_score = self._evaluate_dialogue_length(dialogues)
        
        # 综合评分
        total_score = (
            on_the_nose_score * 0.4 +
            subtext_density * 0.4 +
            dialogue_length_score * 0.2
        )
        
        issues = []
        
        # 生成问题报告
        if on_the_nose_score < 60:
            issues.append(Issue(
                code="DIALOGUE_ON_THE_NOSE",
                message="检测到直白对白，角色直接陈述情感或意图",
                severity=Severity.MAJOR,
                suggestion="使用行动、物品或间接表达替代直接陈述",
                related_skill="on-the-nose-fix"
            ))
        
        if subtext_density < 50:
            issues.append(Issue(
                code="DIALOGUE_LACKS_SUBTEXT",
                message="对话缺乏潜台词，表面与深层含义一致",
                severity=Severity.MAJOR,
                suggestion="设计角色'想说的'与'说出的'之间的裂痕",
                related_skill="subtext-dialogue"
            ))
        
        if dialogue_length_score < 60:
            issues.append(Issue(
                code="DIALOGUE_TOO_LONG",
                message="存在过长的对话段落",
                severity=Severity.MINOR,
                suggestion="拆分长对话，穿插动作和反应描写",
                related_skill="subtext-dialogue"
            ))
        
        return EvaluationResult(
            evaluator_name=self.name,
            score=total_score,
            level=self._score_to_level(total_score),
            issues=issues,
            metrics={
                "dialogue_count": len(dialogues),
                "on_the_nose_score": on_the_nose_score,
                "subtext_density": subtext_density,
                "dialogue_length_score": dialogue_length_score,
            },
            summary=f"潜台词浓度：{self._score_to_level(total_score).value}"
        )
    
    def _extract_dialogues(self, content: str) -> List[str]:
        """提取对话内容"""
        # 匹配中文引号和英文引号内的内容
        patterns = [
            r'「([^」]+)」',
            r'"([^"]+)"',
            r'"([^"]+)"',
            r'『([^』]+)』',
        ]
        
        dialogues = []
        for pattern in patterns:
            matches = re.findall(pattern, content)
            dialogues.extend(matches)
        
        return dialogues
    
    def _evaluate_on_the_nose(self, dialogues: List[str]) -> float:
        """评估直白对白程度（分数越高越好）"""
        if not dialogues:
            return 100
        
        violations = 0
        for dialogue in dialogues:
            for marker in self.ON_THE_NOSE_MARKERS:
                if marker in dialogue:
                    violations += 1
                    break  # 每句对话只计一次
        
        violation_rate = violations / len(dialogues)
        # 转换为正向分数
        return max(0, 100 - violation_rate * 150)
    
    def _evaluate_subtext_density(self, content: str, dialogues: List[str]) -> float:
        """评估潜台词密度"""
        if not dialogues:
            return 50
        
        # 检查对话周围是否有行为/环境描写
        positive_count = 0
        for marker in self.SUBTEXT_POSITIVE_MARKERS:
            positive_count += content.count(marker)
        
        # 理想比例：每3句对话有1个正向标记
        ideal_ratio = len(dialogues) / 3
        actual_ratio = positive_count
        
        if ideal_ratio == 0:
            return 50
        
        density_score = min(100, (actual_ratio / max(1, ideal_ratio)) * 70 + 30)
        return density_score
    
    def _evaluate_dialogue_length(self, dialogues: List[str]) -> float:
        """评估对话长度适度性"""
        if not dialogues:
            return 100
        
        long_dialogues = sum(1 for d in dialogues if len(d) > self.DIALOGUE_LENGTH_THRESHOLD)
        long_ratio = long_dialogues / len(dialogues)
        
        return max(0, 100 - long_ratio * 100)
