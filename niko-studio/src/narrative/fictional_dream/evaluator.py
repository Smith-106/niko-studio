# -*- coding: utf-8 -*-
"""
梦境强度评估器 (Dream Evaluator)

提供快速评估和详细报告功能
"""

from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from enum import Enum

from .engine import FictionalDreamEngine, DreamStrength, FictionalDreamResult


@dataclass
class QuickDreamReport:
    """快速梦境报告"""
    strength: DreamStrength
    score: float
    weakest_layer: str
    top_3_issues: List[str]
    quick_wins: List[str]


class DreamEvaluator:
    """
    梦境强度评估器
    
    提供多种评估模式：
    1. 快速扫描 - 关键词分析，无需LLM
    2. 标准评估 - 四层完整分析
    3. 深度诊断 - 包含修改建议和案例参考
    """
    
    def __init__(self, llm_client: Any = None):
        self.engine = FictionalDreamEngine(llm_client)
    
    async def quick_scan(self, content: str) -> QuickDreamReport:
        """
        快速扫描模式
        
        不使用LLM，纯关键词分析，适合大批量初筛
        """
        scores = await self.engine.quick_evaluate(content)
        
        # 计算总分
        overall = (
            scores["sympathy"] * 0.2 +
            scores["identification"] * 0.25 +
            scores["empathy"] * 0.25 +
            scores["immersion"] * 0.30
        )
        
        # 确定强度
        strength = self._determine_strength(overall)
        
        # 找最弱层
        weakest = min(scores.items(), key=lambda x: x[1])[0]
        
        # 快速问题诊断
        issues = []
        if scores["sympathy"] < 40:
            issues.append("缺少同情触发器（危险/贫穷/孤独/无助）")
        if scores["empathy"] < 40:
            issues.append("感官细节不足，读者无法'感受'角色")
        if scores["immersion"] < 40:
            issues.append("缺少内心冲突，读者无法'成为'角色")
        
        # 快速胜利
        quick_wins = []
        if scores["sympathy"] < 60:
            quick_wins.append("在开篇添加一个普遍性困境")
        if scores["empathy"] < 60:
            quick_wins.append("添加3个以上的感官细节描写")
        if scores["immersion"] < 60:
            quick_wins.append("让角色面临一个两难抉择")
        
        return QuickDreamReport(
            strength=strength,
            score=overall,
            weakest_layer=weakest,
            top_3_issues=issues[:3],
            quick_wins=quick_wins[:3]
        )
    
    async def standard_evaluate(
        self,
        content: str,
        character_info: Optional[Dict] = None
    ) -> FictionalDreamResult:
        """
        标准评估模式
        
        完整的四层分析，使用LLM进行深度评估
        """
        return await self.engine.evaluate(content, character_info)
    
    async def deep_diagnosis(
        self,
        content: str,
        character_info: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        深度诊断模式
        
        包含：
        1. 完整四层分析
        2. 大师案例对比
        3. 具体修改建议
        4. 优先级排序的改进计划
        """
        result = await self.engine.evaluate(content, character_info)
        
        # 生成诊断报告
        diagnosis = {
            "result": result,
            "diagnosis": {
                "overall_health": self._assess_health(result),
                "layer_diagnosis": self._diagnose_layers(result),
                "master_comparisons": self._get_master_comparisons(result),
                "improvement_plan": self._create_improvement_plan(result)
            }
        }
        
        return diagnosis
    
    def _determine_strength(self, score: float) -> DreamStrength:
        """确定梦境强度"""
        if score >= 90:
            return DreamStrength.HYPNOTIC
        elif score >= 75:
            return DreamStrength.STRONG
        elif score >= 60:
            return DreamStrength.MODERATE
        elif score >= 40:
            return DreamStrength.WEAK
        else:
            return DreamStrength.BROKEN
    
    def _assess_health(self, result: FictionalDreamResult) -> str:
        """评估整体健康状况"""
        if result.dream_strength == DreamStrength.HYPNOTIC:
            return "🟢 优秀 - 虚构梦境完美建立"
        elif result.dream_strength == DreamStrength.STRONG:
            return "🟡 良好 - 略有不足但整体有效"
        elif result.dream_strength == DreamStrength.MODERATE:
            return "🟠 一般 - 需要针对性改进"
        elif result.dream_strength == DreamStrength.WEAK:
            return "🔴 较差 - 需要大幅改进"
        else:
            return "⚫ 严重 - 需要全面重构"
    
    def _diagnose_layers(self, result: FictionalDreamResult) -> List[Dict]:
        """诊断各层级"""
        diagnoses = []
        
        for layer in result.layer_scores:
            status = "✅" if layer.is_effective else "❌"
            diagnoses.append({
                "layer": layer.layer_name,
                "status": status,
                "score": layer.score,
                "key_findings": layer.key_findings,
                "priority": "HIGH" if layer.score < 50 else "MEDIUM" if layer.score < 70 else "LOW"
            })
        
        return diagnoses
    
    def _get_master_comparisons(self, result: FictionalDreamResult) -> List[Dict]:
        """获取大师案例对比"""
        comparisons = []
        
        # 同情层案例
        if result.sympathy.overall_score < 60:
            comparisons.append({
                "layer": "同情",
                "master_work": "《悲惨世界》",
                "technique": "冉·阿让虽有钱却无人接纳——展示社会偏见造成的无助",
                "your_gap": "缺少普遍性困境的展示"
            })
        
        # 移情层案例
        if result.empathy.overall_score < 60:
            comparisons.append({
                "layer": "移情",
                "master_work": "《魔女嘉莉》",
                "technique": "'她的背部不知不觉挺直了'——通过身体姿态展示内心转变",
                "your_gap": "缺少将情感身体化的描写"
            })
        
        # 沉浸层案例
        if result.immersion.overall_score < 60:
            comparisons.append({
                "layer": "沉浸",
                "master_work": "《罪与罚》",
                "technique": "'我难道能做吗？这太荒谬了！'——道德困境引发读者参与",
                "your_gap": "缺少让读者参与权衡的内心冲突"
            })
        
        return comparisons
    
    def _create_improvement_plan(self, result: FictionalDreamResult) -> List[Dict]:
        """创建改进计划"""
        plan = []
        
        # 按优先级排序
        for layer in sorted(result.layer_scores, key=lambda x: x.score):
            if layer.score < 80:
                plan.append({
                    "priority": 1 if layer.score < 50 else 2 if layer.score < 70 else 3,
                    "layer": layer.layer_name,
                    "current_score": layer.score,
                    "target_score": 80,
                    "actions": layer.suggestions[:2],
                    "estimated_effort": "HIGH" if layer.score < 50 else "MEDIUM"
                })
        
        return sorted(plan, key=lambda x: x["priority"])
