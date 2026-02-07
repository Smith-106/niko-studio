# -*- coding: utf-8 -*-
"""
陈词滥调检测器 (Cliche Detector)

扫描文本中的陈词滥调，包括开场、角色、情节、对话等维度。
技能参考: skills/script-doctor/SKILL.md
"""

import re
from typing import Dict, Any, Optional, List, Tuple
from .base import BaseEvaluator, EvaluationResult, Issue, Severity


class ClicheDetector(BaseEvaluator):
    """陈词滥调检测器"""
    
    @property
    def name(self) -> str:
        return "陈词滥调检测器"
    
    @property
    def description(self) -> str:
        return "检测文本中的陈词滥调：开场、角色、情节、对话"
    
    @property
    def related_skill(self) -> str:
        return "script-doctor"
    
    # 开场陈词滥调
    OPENING_CLICHES = [
        ("闹钟响", "开场-闹钟响起"),
        ("从梦中醒来", "开场-从梦中醒来"),
        ("睁开眼", "开场-睁开眼睛"),
        ("又是新的一天", "开场-新的一天"),
        ("阳光透过窗帘", "开场-阳光描写"),
        ("照镜子", "开场-对镜描写外貌"),
    ]
    
    # 角色陈词滥调
    CHARACTER_CLICHES = [
        ("失忆", "角色-失忆设定"),
        ("被选中", "角色-被选中的人"),
        ("孤儿", "角色-孤儿设定"),
        ("冷酷霸总", "角色-霸总"),
        ("高冷", "角色-高冷人设"),
        ("腹黑", "角色-腹黑"),
        ("傲娇", "角色-傲娇"),
        ("白月光", "角色-白月光"),
        ("天才", "角色-天才设定"),
    ]
    
    # 情节陈词滥调
    PLOT_CLICHES = [
        ("误会分手", "情节-误会导致分手"),
        ("车祸", "情节-车祸"),
        ("绝症", "情节-绝症"),
        ("失血过多", "情节-失血过多"),
        ("堕胎", "情节-堕胎"),
        ("第三者", "情节-第三者"),
        ("狗血", "情节-狗血"),
        ("巧合", "情节-巧合"),
        ("正好", "情节-正好"),
    ]
    
    # 对话陈词滥调
    DIALOGUE_CLICHES = [
        ("我们需要谈谈", "对话-我们需要谈谈"),
        ("你根本不了解我", "对话-你不了解我"),
        ("相信我", "对话-相信我"),
        ("我有个计划", "对话-我有个计划"),
        ("这不是你的错", "对话-这不是你的错"),
        ("从今以后", "对话-从今以后"),
        ("一切都会不同", "对话-一切都会不同"),
        ("你变了", "对话-你变了"),
    ]
    
    # 描写陈词滥调
    DESCRIPTION_CLICHES = [
        ("不禁", "描写-不禁"),
        ("忍不住", "描写-忍不住"),
        ("突然", "描写-突然"),
        ("竟然", "描写-竟然"),
        ("居然", "描写-居然"),
        ("瞬间", "描写-瞬间"),
        ("眼眶湿润", "描写-眼眶湿润"),
        ("泪如雨下", "描写-泪如雨下"),
        ("心如刀割", "描写-心如刀割"),
    ]
    
    async def evaluate(
        self,
        content: str,
        context: Optional[Dict[str, Any]] = None
    ) -> EvaluationResult:
        """执行陈词滥调检测"""
        
        all_cliches = (
            self.OPENING_CLICHES +
            self.CHARACTER_CLICHES +
            self.PLOT_CLICHES +
            self.DIALOGUE_CLICHES +
            self.DESCRIPTION_CLICHES
        )
        
        found_cliches: List[Tuple[str, str, int]] = []
        
        for pattern, cliche_type in all_cliches:
            count = content.count(pattern)
            if count > 0:
                found_cliches.append((pattern, cliche_type, count))
        
        # 评分：每个陈词滥调扣分
        base_score = 100
        deduction_per_cliche = 8
        total_deduction = sum(count * deduction_per_cliche for _, _, count in found_cliches)
        
        final_score = max(0, base_score - total_deduction)
        
        issues = []
        
        if found_cliches:
            # 按类型分组
            cliche_summary = ", ".join([f"「{p}」({c}次)" for p, _, c in found_cliches[:5]])
            
            severity = Severity.MAJOR if len(found_cliches) > 3 else Severity.MINOR
            
            issues.append(Issue(
                code="CLICHE_DETECTED",
                message=f"检测到{len(found_cliches)}处陈词滥调：{cliche_summary}",
                severity=severity,
                suggestion="考虑使用更独特的表达方式替代这些老套桥段",
                related_skill="script-doctor"
            ))
        
        # 特别检查开场问题
        is_opening = context.get("is_opening", False) if context else False
        if is_opening:
            opening_issues = [c for c in found_cliches if "开场" in c[1]]
            if opening_issues:
                issues.append(Issue(
                    code="OPENING_CLICHE",
                    message="开场使用了陈词滥调的方式",
                    severity=Severity.MAJOR,
                    suggestion="尝试从冲突或悬念开始，而非日常描写",
                    related_skill="script-doctor"
                ))
        
        return EvaluationResult(
            evaluator_name=self.name,
            score=final_score,
            level=self._score_to_level(final_score),
            issues=issues,
            metrics={
                "cliche_count": len(found_cliches),
                "cliche_details": [(p, t, c) for p, t, c in found_cliches],
            },
            summary=f"陈词滥调检测：发现{len(found_cliches)}处"
        )
