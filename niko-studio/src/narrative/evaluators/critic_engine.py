# -*- coding: utf-8 -*-
"""
综合评估引擎 (Critic Engine)

整合所有评估器，提供统一的评估接口。
基于弗雷五大模块理论进行全面评估。
"""

from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field

from .base import EvaluationResult, Issue, Severity, ScoreLevel
from .dream_evaluator import DreamEvaluator
from .suspense_evaluator import SuspenseEvaluator
from .character_evaluator import CharacterEvaluator
from .premise_evaluator import PremiseEvaluator
from .voice_evaluator import VoiceEvaluator


@dataclass
class ComprehensiveReport:
    """综合评估报告"""
    overall_score: float
    overall_level: ScoreLevel
    module_scores: Dict[str, float]
    all_issues: List[Issue]
    critical_issues: List[Issue]
    top_3_issues: List[Issue]
    module_results: Dict[str, EvaluationResult]
    summary: str
    recommended_skills: List[str]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "overall_score": self.overall_score,
            "overall_level": self.overall_level.value,
            "module_scores": self.module_scores,
            "issues_count": len(self.all_issues),
            "critical_count": len(self.critical_issues),
            "top_3_issues": [
                {"code": i.code, "message": i.message, "severity": i.severity.value}
                for i in self.top_3_issues
            ],
            "summary": self.summary,
            "recommended_skills": self.recommended_skills,
        }
    
    def to_markdown(self) -> str:
        """生成Markdown格式报告"""
        lines = [
            f"# 📊 综合评估报告",
            f"",
            f"**总分**: {self.overall_score:.1f}/100 ({self.overall_level.value})",
            f"",
            f"## 模块得分",
            f"| 模块 | 得分 | 状态 |",
            f"|------|------|------|",
        ]
        
        for module, score in self.module_scores.items():
            status = "✅" if score >= 70 else "⚠️" if score >= 50 else "❌"
            lines.append(f"| {module} | {score:.1f} | {status} |")
        
        lines.extend([
            f"",
            f"## 🔴 需要优先解决的问题",
        ])
        
        for i, issue in enumerate(self.top_3_issues, 1):
            lines.append(f"{i}. **{issue.code}**: {issue.message}")
            if issue.suggestion:
                lines.append(f"   - 建议: {issue.suggestion}")
        
        if self.recommended_skills:
            lines.extend([
                f"",
                f"## 📚 推荐技能包",
            ])
            for skill in self.recommended_skills:
                lines.append(f"- `skills/{skill}/SKILL.md`")
        
        return "\n".join(lines)


class CriticEngine:
    """
    综合评估引擎
    
    整合五大模块评估器，提供统一评估接口。
    
    五大模块:
    1. 虚构梦境 (Fictional Dream) - 情感沉浸
    2. 悬念构建 (Suspense) - 读者驱动
    3. 人物塑造 (Character) - 故事灵魂
    4. 故事预设 (Premise) - 结构蓝图
    5. 叙事语气 (Voice) - 表达力量
    """
    
    def __init__(self, llm_client=None):
        """
        初始化综合评估引擎
        
        Args:
            llm_client: LLM客户端（可选，用于AI增强评估）
        """
        self.llm_client = llm_client
        
        # 初始化五大评估器
        self.evaluators = {
            "fictional_dream": DreamEvaluator(llm_client),
            "suspense": SuspenseEvaluator(llm_client),
            "character": CharacterEvaluator(llm_client),
            "premise": PremiseEvaluator(llm_client),
            "voice": VoiceEvaluator(llm_client),
        }
        
        # 模块权重
        self.weights = {
            "fictional_dream": 0.25,  # 情感沉浸最重要
            "suspense": 0.20,
            "character": 0.20,
            "premise": 0.15,
            "voice": 0.20,
        }
    
    async def evaluate(
        self,
        content: str,
        context: Optional[Dict[str, Any]] = None,
        modules: Optional[List[str]] = None
    ) -> ComprehensiveReport:
        """
        执行综合评估
        
        Args:
            content: 待评估的文本内容
            context: 上下文信息
            modules: 要评估的模块列表（默认全部）
            
        Returns:
            ComprehensiveReport: 综合评估报告
        """
        if modules is None:
            modules = list(self.evaluators.keys())
        
        # 执行各模块评估
        module_results: Dict[str, EvaluationResult] = {}
        all_issues: List[Issue] = []
        
        for module_name in modules:
            if module_name in self.evaluators:
                evaluator = self.evaluators[module_name]
                result = await evaluator.evaluate(content, context)
                module_results[module_name] = result
                all_issues.extend(result.issues)
        
        # 计算总分
        total_score = 0
        weight_sum = 0
        module_scores = {}
        
        for module_name, result in module_results.items():
            weight = self.weights.get(module_name, 0.2)
            total_score += result.score * weight
            weight_sum += weight
            module_scores[module_name] = result.score
        
        if weight_sum > 0:
            total_score = total_score / weight_sum * (weight_sum / sum(
                self.weights[m] for m in modules if m in self.weights
            ))
        
        # 整理问题
        critical_issues = [i for i in all_issues if i.severity == Severity.CRITICAL]
        sorted_issues = sorted(
            all_issues,
            key=lambda x: (
                0 if x.severity == Severity.CRITICAL else
                1 if x.severity == Severity.MAJOR else
                2 if x.severity == Severity.MINOR else 3
            )
        )
        top_3 = sorted_issues[:3]
        
        # 推荐技能包
        recommended_skills = list(set(
            i.related_skill for i in top_3 if i.related_skill
        ))
        
        # 生成摘要
        level = self._score_to_level(total_score)
        summary = self._generate_summary(total_score, level, module_scores, top_3)
        
        return ComprehensiveReport(
            overall_score=total_score,
            overall_level=level,
            module_scores=module_scores,
            all_issues=all_issues,
            critical_issues=critical_issues,
            top_3_issues=top_3,
            module_results=module_results,
            summary=summary,
            recommended_skills=recommended_skills,
        )
    
    async def quick_scan(self, content: str) -> ComprehensiveReport:
        """快速扫描（不使用LLM）"""
        module_results = {}
        all_issues = []
        
        for name, evaluator in self.evaluators.items():
            result = evaluator.quick_scan(content)
            module_results[name] = result
            all_issues.extend(result.issues)
        
        module_scores = {n: r.score for n, r in module_results.items()}
        total_score = sum(
            s * self.weights.get(n, 0.2)
            for n, s in module_scores.items()
        )
        
        level = self._score_to_level(total_score)
        
        return ComprehensiveReport(
            overall_score=total_score,
            overall_level=level,
            module_scores=module_scores,
            all_issues=all_issues,
            critical_issues=[i for i in all_issues if i.severity == Severity.CRITICAL],
            top_3_issues=all_issues[:3],
            module_results=module_results,
            summary=f"快速扫描完成，总分：{total_score:.1f}",
            recommended_skills=[],
        )
    
    def _score_to_level(self, score: float) -> ScoreLevel:
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
    
    def _generate_summary(
        self,
        score: float,
        level: ScoreLevel,
        module_scores: Dict[str, float],
        top_issues: List[Issue]
    ) -> str:
        """生成评估摘要"""
        # 找出最弱模块
        if module_scores:
            weakest = min(module_scores, key=module_scores.get)
            strongest = max(module_scores, key=module_scores.get)
        else:
            weakest = strongest = "N/A"
        
        level_desc = {
            ScoreLevel.EXCELLENT: "卓越",
            ScoreLevel.GOOD: "良好",
            ScoreLevel.FAIR: "一般",
            ScoreLevel.POOR: "较差",
            ScoreLevel.CRITICAL: "需要大幅改进",
        }
        
        summary = f"总体评价：{level_desc.get(level, '未知')}（{score:.1f}分）。"
        summary += f"最强模块：{strongest}，最弱模块：{weakest}。"
        
        if top_issues:
            summary += f"首要问题：{top_issues[0].message}"
        
        return summary
