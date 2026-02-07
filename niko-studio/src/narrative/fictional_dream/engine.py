# -*- coding: utf-8 -*-
"""
虚构梦境引擎 (Fictional Dream Engine)

小说创作的终极目标，是创造一个"虚构梦境"——
一个能将读者从现实世界完全抽离，使其身临其境地"活在"故事之中的强大结界。

四层情感递进：同情 → 认同 → 移情 → 沉浸
"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from enum import Enum

from .sympathy import SympathyAnalyzer, SympathyAnalysisResult
from .identification import IdentificationBuilder, IdentificationAnalysisResult
from .empathy import EmpathyDeepener, EmpathyAnalysisResult
from .immersion import ImmersionCatalyst, ImmersionAnalysisResult


class DreamStrength(Enum):
    """梦境强度等级"""
    
    # 催眠级 - 读者完全忘记现实
    HYPNOTIC = "hypnotic"       # 90-100分
    
    # 强力级 - 读者深度沉浸
    STRONG = "strong"           # 75-89分
    
    # 中等级 - 读者基本投入
    MODERATE = "moderate"       # 60-74分
    
    # 薄弱级 - 读者偶尔出戏
    WEAK = "weak"               # 40-59分
    
    # 破碎级 - 读者无法进入
    BROKEN = "broken"           # 0-39分


@dataclass
class DreamLayerScore:
    """单层梦境分数"""
    layer_name: str
    score: float
    is_effective: bool
    key_findings: List[str]
    suggestions: List[str]


@dataclass
class FictionalDreamResult:
    """虚构梦境综合结果"""
    
    # 总体评估
    overall_score: float
    dream_strength: DreamStrength
    
    # 四层分析结果
    sympathy: SympathyAnalysisResult
    identification: IdentificationAnalysisResult
    empathy: EmpathyAnalysisResult
    immersion: ImmersionAnalysisResult
    
    # 层级得分
    layer_scores: List[DreamLayerScore]
    
    # 综合建议
    master_suggestions: List[str]
    
    # 梦境破坏者
    dream_breakers: List[str]
    
    @property
    def is_dream_effective(self) -> bool:
        """虚构梦境是否有效"""
        return self.overall_score >= 60
    
    @property
    def weakest_layer(self) -> str:
        """最薄弱的层级"""
        if not self.layer_scores:
            return "unknown"
        return min(self.layer_scores, key=lambda x: x.score).layer_name


class FictionalDreamEngine:
    """
    虚构梦境引擎
    
    像一位技艺高超的催眠师，通过精准的情感引导，
    将读者带入四个层层递进的情感层次。
    
    使用方法:
        engine = FictionalDreamEngine(llm_client)
        result = await engine.evaluate(content, character_info)
        print(f"梦境强度: {result.dream_strength}")
        print(f"最薄弱层级: {result.weakest_layer}")
    """
    
    def __init__(self, llm_client: Any = None):
        self.llm = llm_client
        
        # 初始化四层分析器
        self.sympathy_analyzer = SympathyAnalyzer(llm_client)
        self.identification_builder = IdentificationBuilder(llm_client)
        self.empathy_deepener = EmpathyDeepener(llm_client)
        self.immersion_catalyst = ImmersionCatalyst(llm_client)
    
    async def evaluate(
        self,
        content: str,
        character_info: Optional[Dict] = None,
        character_goal: Optional[str] = None
    ) -> FictionalDreamResult:
        """
        评估文本的虚构梦境效果
        
        四层递进分析：
        1. 同情 - 读者是否对角色的困境产生怜悯？
        2. 认同 - 读者是否支持角色的目标？
        3. 移情 - 读者是否能感受到角色的感受？
        4. 沉浸 - 读者是否成为了角色？
        
        Args:
            content: 要分析的文本内容
            character_info: 角色信息
            character_goal: 角色目标
            
        Returns:
            FictionalDreamResult: 虚构梦境综合结果
        """
        layer_scores = []
        
        # === 第一层：同情 ===
        sympathy_result = await self.sympathy_analyzer.analyze(
            content, character_info
        )
        layer_scores.append(DreamLayerScore(
            layer_name="同情 (Sympathy)",
            score=sympathy_result.overall_score,
            is_effective=sympathy_result.is_effective,
            key_findings=[
                f"检测到 {len(sympathy_result.triggers_detected)} 个同情触发器",
                f"脆弱性展示: {sympathy_result.vulnerability_display:.1%}",
                f"普遍性困境: {'是' if sympathy_result.universal_predicament else '否'}"
            ],
            suggestions=sympathy_result.suggestions[:3]
        ))
        
        # === 第二层：认同 ===
        identification_result = await self.identification_builder.analyze(
            content, character_info, sympathy_result.overall_score
        )
        layer_scores.append(DreamLayerScore(
            layer_name="认同 (Identification)",
            score=identification_result.overall_score,
            is_effective=identification_result.is_effective,
            key_findings=[
                f"目标清晰度: {identification_result.goal_clarity:.1%}",
                f"目标值得性: {identification_result.goal_worthiness:.1%}",
                f"教父技巧: {'已检测' if identification_result.godfather_technique.is_detected else '未检测'}"
            ],
            suggestions=identification_result.suggestions[:3]
        ))
        
        # === 第三层：移情 ===
        empathy_result = await self.empathy_deepener.analyze(
            content, character_info, identification_result.overall_score
        )
        layer_scores.append(DreamLayerScore(
            layer_name="移情 (Empathy)",
            score=empathy_result.overall_score,
            is_effective=empathy_result.is_effective,
            key_findings=[
                f"感官细节数: {len(empathy_result.sensory_details)}",
                f"身体植入分: {empathy_result.body_plant_score:.1f}",
                f"嘉莉技巧: {'已检测' if empathy_result.carrie_technique.is_detected else '未检测'}"
            ],
            suggestions=empathy_result.suggestions[:3]
        ))
        
        # === 第四层：沉浸 ===
        immersion_result = await self.immersion_catalyst.analyze(
            content, character_info, empathy_result.overall_score
        )
        layer_scores.append(DreamLayerScore(
            layer_name="沉浸 (Immersion)",
            score=immersion_result.overall_score,
            is_effective=immersion_result.is_effective,
            key_findings=[
                f"内心冲突数: {len(immersion_result.internal_conflicts)}",
                f"读者参与度: {immersion_result.reader_participation:.1%}",
                f"抉择紧迫感: {immersion_result.choice_urgency:.1%}"
            ],
            suggestions=immersion_result.suggestions[:3]
        ))
        
        # === 计算总分 ===
        overall_score = self._calculate_overall_score(layer_scores)
        dream_strength = self._determine_strength(overall_score)
        
        # === 检测梦境破坏者 ===
        dream_breakers = await self._detect_dream_breakers(content)
        
        # === 生成大师级建议 ===
        master_suggestions = self._generate_master_suggestions(
            layer_scores, dream_strength, dream_breakers
        )
        
        return FictionalDreamResult(
            overall_score=overall_score,
            dream_strength=dream_strength,
            sympathy=sympathy_result,
            identification=identification_result,
            empathy=empathy_result,
            immersion=immersion_result,
            layer_scores=layer_scores,
            master_suggestions=master_suggestions,
            dream_breakers=dream_breakers
        )
    
    def _calculate_overall_score(self, layer_scores: List[DreamLayerScore]) -> float:
        """
        计算总体分数
        
        权重分配：
        - 同情 20%：门槛层
        - 认同 25%：关键层
        - 移情 25%：体验层
        - 沉浸 30%：巅峰层
        """
        weights = [0.20, 0.25, 0.25, 0.30]
        
        if len(layer_scores) != 4:
            return 0.0
        
        weighted_sum = sum(
            score.score * weight 
            for score, weight in zip(layer_scores, weights)
        )
        
        return weighted_sum
    
    def _determine_strength(self, score: float) -> DreamStrength:
        """确定梦境强度等级"""
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
    
    async def _detect_dream_breakers(self, content: str) -> List[str]:
        """检测可能打破梦境的元素"""
        breakers = []
        
        # 过于直白的解释
        if "读者会" in content or "观众会" in content:
            breakers.append("⚠️ 检测到作者跳出叙事的解释性语言")
        
        # 不一致的语气
        # (需要更复杂的分析)
        
        # 信息dump
        info_dump_keywords = ["首先", "其次", "第一", "第二", "总之"]
        if sum(1 for kw in info_dump_keywords if kw in content) >= 3:
            breakers.append("⚠️ 可能存在信息堆砌，建议通过场景展示")
        
        return breakers
    
    def _generate_master_suggestions(
        self,
        layer_scores: List[DreamLayerScore],
        strength: DreamStrength,
        breakers: List[str]
    ) -> List[str]:
        """生成大师级综合建议"""
        suggestions = []
        
        # 整体状态
        if strength == DreamStrength.HYPNOTIC:
            suggestions.append("🎯 虚构梦境效果极佳！读者将完全沉浸其中")
        elif strength == DreamStrength.STRONG:
            suggestions.append("✅ 虚构梦境效果良好，有几处可以优化")
        elif strength == DreamStrength.MODERATE:
            suggestions.append("⚡ 虚构梦境基本建立，但需要加强")
        elif strength == DreamStrength.WEAK:
            suggestions.append("⚠️ 虚构梦境较弱，读者可能频繁出戏")
        else:
            suggestions.append("❌ 虚构梦境未能建立，需要全面重构")
        
        # 最薄弱层级
        weakest = min(layer_scores, key=lambda x: x.score)
        suggestions.append(f"\n🔧 最需要加强的层级: {weakest.layer_name}")
        suggestions.extend(weakest.suggestions)
        
        # 层级衔接
        for i in range(len(layer_scores) - 1):
            current = layer_scores[i]
            next_layer = layer_scores[i + 1]
            if current.score < 50 and next_layer.score > 60:
                suggestions.append(
                    f"\n⚠️ 层级断裂警告: {current.layer_name} 未能有效支撑 {next_layer.layer_name}"
                )
        
        # 梦境破坏者
        if breakers:
            suggestions.append("\n🚫 梦境破坏者:")
            suggestions.extend(breakers)
        
        return suggestions
    
    async def quick_evaluate(self, content: str) -> Dict[str, float]:
        """快速评估（无需LLM）"""
        # 简单的关键词计数评估
        sympathy_score = self.sympathy_analyzer.detect_universal_predicament(content)
        empathy_score = self.empathy_deepener.evaluate_body_plant(content)
        immersion_score = 50 if self.immersion_catalyst.detect_moral_dilemma(content) else 20
        
        return {
            "sympathy": len(sympathy_score) * 25,
            "identification": 50,  # 需要更复杂的分析
            "empathy": empathy_score,
            "immersion": immersion_score
        }
