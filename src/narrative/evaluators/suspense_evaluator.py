# -*- coding: utf-8 -*-
"""
悬念评估器

评估文本的悬念构建效果，检测三大悬念支柱的运用。
仅负责评估，具体技巧参见 skills/suspense-craft/SKILL.md
"""

import re
from typing import Dict, Any, Optional, List
from .base import BaseEvaluator, EvaluationResult, Issue, Severity, ScoreLevel


class SuspenseEvaluator(BaseEvaluator):
    """悬念评估器"""
    
    @property
    def name(self) -> str:
        return "悬念评估器"
    
    @property
    def description(self) -> str:
        return "评估悬念构建效果，检测三大支柱（故事问题/威胁情境/导火索）的运用"
    
    @property
    def related_skill(self) -> str:
        return "suspense-craft"
    
    # 疑问标记词
    QUESTION_MARKERS = [
        "谁", "什么", "为什么", "怎么", "如何", "哪里", "何时",
        "是否", "能否", "会不会", "难道", "究竟", "到底",
        "？", "吗", "呢",
    ]
    
    # 威胁标记词
    THREAT_MARKERS = [
        "危险", "威胁", "死亡", "杀", "毁灭", "灾难",
        "如果不", "否则", "必须", "一定要", "来不及",
        "恐惧", "害怕", "担心", "忧虑",
    ]
    
    # 时间压力标记词
    TIME_PRESSURE_MARKERS = [
        "还有", "只剩", "倒计时", "最后", "截止",
        "明天", "今晚", "马上", "立刻", "即将",
        "来不及", "赶不上", "时间不多",
        "小时", "分钟", "秒",
    ]
    
    async def evaluate(
        self,
        content: str,
        context: Optional[Dict[str, Any]] = None
    ) -> EvaluationResult:
        """执行完整评估"""
        
        # 三大支柱评估
        question_score = self._evaluate_story_questions(content)
        threat_score = self._evaluate_threat(content)
        fuse_score = self._evaluate_fuse(content)
        
        # 计算总分
        total_score = (
            question_score * 0.30 +
            threat_score * 0.35 +
            fuse_score * 0.35
        )
        
        issues = []
        
        if question_score < 60:
            issues.append(Issue(
                code="SUSPENSE_QUESTION_WEAK",
                message="故事问题不足：读者缺乏好奇心驱动",
                severity=Severity.MAJOR,
                suggestion="在开篇抛出引人入胜的问题",
                related_skill="suspense-craft"
            ))
        
        if threat_score < 60:
            issues.append(Issue(
                code="SUSPENSE_THREAT_WEAK",
                message="威胁情境不足：角色未处于明确威胁之下",
                severity=Severity.CRITICAL,
                suggestion="让角色陷入'要命的麻烦'之中",
                related_skill="suspense-craft"
            ))
        
        if fuse_score < 60:
            issues.append(Issue(
                code="SUSPENSE_FUSE_WEAK",
                message="导火索效应弱：缺乏时间压力",
                severity=Severity.MAJOR,
                suggestion="增加时间限制，创造紧迫感",
                related_skill="suspense-craft"
            ))
        
        return EvaluationResult(
            evaluator_name=self.name,
            score=total_score,
            level=self._score_to_level(total_score),
            issues=issues,
            metrics={
                "story_questions": question_score,
                "threat_situation": threat_score,
                "fuse_effect": fuse_score,
            },
            summary=f"悬念强度：{self._score_to_level(total_score).value}"
        )
    
    def quick_scan(self, content: str) -> EvaluationResult:
        """快速扫描"""
        threat = self._evaluate_threat(content)
        fuse = self._evaluate_fuse(content)
        avg = (threat + fuse) / 2
        
        return EvaluationResult(
            evaluator_name=self.name,
            score=avg,
            level=self._score_to_level(avg),
            summary=f"悬念快扫：{avg:.1f}分"
        )
    
    def _evaluate_story_questions(self, content: str) -> float:
        """评估故事问题"""
        score = 40
        for marker in self.QUESTION_MARKERS:
            if marker in content:
                score += 5
        return min(100, score)
    
    def _evaluate_threat(self, content: str) -> float:
        """评估威胁情境"""
        score = 30
        for marker in self.THREAT_MARKERS:
            count = len(re.findall(marker, content))
            score += count * 5
        return min(100, score)
    
    def _evaluate_fuse(self, content: str) -> float:
        """评估导火索效应"""
        score = 30
        for marker in self.TIME_PRESSURE_MARKERS:
            if marker in content:
                score += 8
        return min(100, score)
