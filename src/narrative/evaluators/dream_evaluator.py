# -*- coding: utf-8 -*-
"""
虚构梦境评估器

评估文本的情感沉浸效果，检测四层情感递进的完成度。
仅负责评估，具体技巧参见 skills/fictional-dream/SKILL.md
"""

import re
from typing import Dict, Any, Optional, List
from .base import BaseEvaluator, EvaluationResult, Issue, Severity, ScoreLevel


class DreamEvaluator(BaseEvaluator):
    """虚构梦境评估器"""
    
    @property
    def name(self) -> str:
        return "虚构梦境评估器"
    
    @property
    def description(self) -> str:
        return "评估文本的情感沉浸效果，检测四层情感递进（同情→认同→移情→沉浸）的完成度"
    
    @property
    def related_skill(self) -> str:
        return "fictional-dream"
    
    # 同情触发词库
    SYMPATHY_TRIGGERS = {
        "danger": ["危险", "威胁", "死亡", "杀", "伤害", "恐惧", "害怕"],
        "poverty": ["贫穷", "贫困", "饥饿", "破旧", "穷", "欠债", "落魄"],
        "humiliation": ["羞辱", "嘲笑", "讽刺", "蔑视", "轻视", "歧视", "排挤"],
        "loneliness": ["孤独", "孤单", "寂寞", "独自", "无人", "遗弃", "抛弃"],
        "helplessness": ["无助", "绝望", "无力", "无奈", "束手无策", "走投无路"],
    }
    
    # 感官细节词库（用于移情检测）
    SENSORY_PATTERNS = {
        "visual": ["看到", "望见", "瞥见", "眼前", "映入", "目光", "颜色", "光"],
        "auditory": ["听到", "声音", "响起", "回荡", "嗡嗡", "沙沙", "嘈杂"],
        "tactile": ["触摸", "感觉", "冰冷", "温热", "粗糙", "光滑", "刺痛"],
        "olfactory": ["闻到", "气味", "芳香", "恶臭", "弥漫", "扑鼻"],
        "gustatory": ["尝到", "味道", "苦涩", "甘甜", "酸", "辣"],
        "kinesthetic": ["心跳", "颤抖", "僵硬", "放松", "紧绷", "呼吸"],
    }
    
    # 内心冲突标记词（用于沉浸检测）
    CONFLICT_MARKERS = [
        "但是", "然而", "可是", "却", "虽然", "尽管",
        "一方面", "另一方面", "既想", "又怕",
        "犹豫", "挣扎", "纠结", "矛盾", "两难",
        "应该", "不应该", "能", "不能",
        "想要", "不敢", "渴望", "恐惧",
    ]
    
    async def evaluate(
        self,
        content: str,
        context: Optional[Dict[str, Any]] = None
    ) -> EvaluationResult:
        """执行完整评估"""
        
        # 四层评估
        sympathy_score = self._evaluate_sympathy(content)
        identification_score = self._evaluate_identification(content, context)
        empathy_score = self._evaluate_empathy(content)
        immersion_score = self._evaluate_immersion(content)
        
        # 计算总分（层级递进权重）
        total_score = (
            sympathy_score * 0.20 +
            identification_score * 0.25 +
            empathy_score * 0.30 +
            immersion_score * 0.25
        )
        
        # 收集问题
        issues = []
        
        if sympathy_score < 60:
            issues.append(Issue(
                code="DREAM_SYMPATHY_WEAK",
                message="同情层薄弱：读者难以对角色产生怜悯之心",
                severity=Severity.MAJOR,
                suggestion="展示角色的普遍性困境（危险/贫穷/孤独/无助）",
                related_skill="fictional-dream"
            ))
        
        if identification_score < 60:
            issues.append(Issue(
                code="DREAM_IDENTIFICATION_WEAK",
                message="认同层薄弱：读者不支持角色的目标",
                severity=Severity.MAJOR,
                suggestion="明确角色目标并与崇高价值绑定",
                related_skill="fictional-dream"
            ))
        
        if empathy_score < 60:
            issues.append(Issue(
                code="DREAM_EMPATHY_WEAK",
                message="移情层薄弱：读者无法感受角色的感受",
                severity=Severity.CRITICAL,
                suggestion="增加激发情感的感官细节描写",
                related_skill="fictional-dream"
            ))
        
        if immersion_score < 60:
            issues.append(Issue(
                code="DREAM_IMMERSION_WEAK",
                message="沉浸层薄弱：读者无法完全进入故事",
                severity=Severity.MAJOR,
                suggestion="增加角色的内心冲突和道德抉择",
                related_skill="fictional-dream"
            ))
        
        # 确定最薄弱层级
        layer_scores = {
            "sympathy": sympathy_score,
            "identification": identification_score,
            "empathy": empathy_score,
            "immersion": immersion_score,
        }
        weakest_layer = min(layer_scores, key=layer_scores.get)
        
        return EvaluationResult(
            evaluator_name=self.name,
            score=total_score,
            level=self._score_to_level(total_score),
            issues=issues,
            metrics=layer_scores,
            summary=f"梦境强度：{self._score_to_level(total_score).value}，最薄弱层级：{weakest_layer}",
            raw_analysis={
                "weakest_layer": weakest_layer,
                "layer_scores": layer_scores,
            }
        )
    
    def quick_scan(self, content: str) -> EvaluationResult:
        """快速扫描（不使用LLM）"""
        # 简化版评估
        sympathy = self._evaluate_sympathy(content)
        empathy = self._evaluate_empathy(content)
        immersion = self._evaluate_immersion(content)
        
        avg_score = (sympathy + empathy + immersion) / 3
        
        issues = []
        if empathy < 50:
            issues.append(Issue(
                code="DREAM_SENSORY_LACKING",
                message="感官细节不足",
                severity=Severity.MAJOR,
                related_skill="fictional-dream"
            ))
        
        return EvaluationResult(
            evaluator_name=self.name,
            score=avg_score,
            level=self._score_to_level(avg_score),
            issues=issues,
            summary=f"快速扫描完成，得分：{avg_score:.1f}"
        )
    
    def _evaluate_sympathy(self, content: str) -> float:
        """评估同情层"""
        score = 50  # 基础分
        
        for category, keywords in self.SYMPATHY_TRIGGERS.items():
            for keyword in keywords:
                if keyword in content:
                    score += 5
                    break  # 每类最多加一次
        
        return min(100, score)
    
    def _evaluate_identification(
        self,
        content: str,
        context: Optional[Dict[str, Any]] = None
    ) -> float:
        """评估认同层"""
        score = 50
        
        # 检查目标相关词
        goal_words = ["目标", "梦想", "使命", "责任", "保护", "拯救", "追求"]
        for word in goal_words:
            if word in content:
                score += 8
        
        # 如果有上下文中的角色目标信息
        if context and context.get("character_goal"):
            score += 10
        
        return min(100, score)
    
    def _evaluate_empathy(self, content: str) -> float:
        """评估移情层（感官细节密度）"""
        total_sensory = 0
        
        for sense_type, patterns in self.SENSORY_PATTERNS.items():
            for pattern in patterns:
                total_sensory += len(re.findall(pattern, content))
        
        # 根据文本长度计算密度
        text_length = len(content)
        if text_length == 0:
            return 0
        
        density = (total_sensory / text_length) * 1000  # 每千字感官词数量
        
        # 转换为分数
        if density >= 10:
            return 100
        elif density >= 5:
            return 80
        elif density >= 2:
            return 60
        else:
            return 40
    
    def _evaluate_immersion(self, content: str) -> float:
        """评估沉浸层（内心冲突密度）"""
        conflict_count = 0
        
        for marker in self.CONFLICT_MARKERS:
            conflict_count += len(re.findall(marker, content))
        
        # 根据文本长度计算密度
        text_length = len(content)
        if text_length == 0:
            return 0
        
        density = (conflict_count / text_length) * 1000
        
        if density >= 8:
            return 100
        elif density >= 4:
            return 80
        elif density >= 2:
            return 60
        else:
            return 40
