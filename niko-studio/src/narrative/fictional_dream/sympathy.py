# -*- coding: utf-8 -*-
"""
第一层：同情系统 (Sympathy System)

同情是读者踏入故事世界的第一道门槛。
要让读者关心一个角色，首先要让他们对角色的处境产生怜悯之心。

关键: 展示角色所遭遇的"普遍性困境"
"""

from enum import Enum
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any


class SympathyTrigger(Enum):
    """
    同情触发器类型
    
    这些普遍性困境能有效激发读者的同情心，
    即使角色本身并不完美或存在道德瑕疵。
    """
    
    # 危险困境
    # 示例: 《大白鲨》中的警长布洛迪即将面对未知的海上威胁
    DANGER = "danger"
    
    # 贫穷与羞辱
    # 示例: 《罪与罚》中的拉斯柯尔尼科夫因欠租而备受煎熬
    # 示例: 《傲慢与偏见》中的伊丽莎白在舞会上受到达西的公开羞辱
    POVERTY_HUMILIATION = "poverty_humiliation"
    
    # 孤独与排挤
    # 示例: 《魔女嘉莉》中的嘉莉，在校园中如同"天鹅中的丑小鸭"
    LONELINESS_EXCLUSION = "loneliness_exclusion"
    
    # 无助处境
    # 示例: 《悲惨世界》中的冉·阿让，即便身揣钱财，却因其身份而无人接纳
    HELPLESSNESS = "helplessness"
    
    # 不公正对待
    # 示例: 被冤枉、被误解、被背叛
    INJUSTICE = "injustice"
    
    # 失去所爱
    # 示例: 丧亲、失恋、失去朋友
    LOSS = "loss"


@dataclass
class SympathyEvidence:
    """同情证据"""
    trigger_type: SympathyTrigger
    text_excerpt: str              # 相关文本片段
    effectiveness: float           # 有效性 (0-1)
    vulnerability_level: float     # 脆弱性展示程度 (0-1)
    universality: float            # 普遍性程度 (0-1)


@dataclass
class SympathyAnalysisResult:
    """同情分析结果"""
    overall_score: float                      # 总体同情分数 (0-100)
    triggers_detected: List[SympathyEvidence] # 检测到的触发器
    vulnerability_display: float              # 脆弱性展示程度
    universal_predicament: bool               # 是否展示普遍性困境
    suggestions: List[str]                    # 增强建议
    
    @property
    def is_effective(self) -> bool:
        """同情是否有效建立"""
        return self.overall_score >= 60


class SympathyAnalyzer:
    """
    同情分析器
    
    检测和评估文本中同情元素的有效性，
    提供增强建议以确保读者能对角色产生怜悯之心。
    """
    
    def __init__(self, llm_client: Any = None):
        self.llm = llm_client
        
        # 普遍性困境关键词库
        self.predicament_keywords = {
            SympathyTrigger.DANGER: [
                "威胁", "危险", "恐惧", "害怕", "逃离", "追杀", "生命", "死亡"
            ],
            SympathyTrigger.POVERTY_HUMILIATION: [
                "贫穷", "穷困", "羞辱", "嘲笑", "轻蔑", "鄙视", "欠债", "卑微"
            ],
            SympathyTrigger.LONELINESS_EXCLUSION: [
                "孤独", "排挤", "孤立", "独自", "无人", "被遗弃", "格格不入"
            ],
            SympathyTrigger.HELPLESSNESS: [
                "无助", "无力", "绝望", "无奈", "束手无策", "走投无路"
            ],
            SympathyTrigger.INJUSTICE: [
                "冤枉", "不公", "误解", "背叛", "陷害", "诬陷"
            ],
            SympathyTrigger.LOSS: [
                "失去", "丧失", "离别", "死亡", "分离", "告别"
            ]
        }
    
    async def analyze(
        self,
        content: str,
        character_info: Optional[Dict] = None
    ) -> SympathyAnalysisResult:
        """
        分析文本中的同情元素
        
        Args:
            content: 要分析的文本内容
            character_info: 角色信息（可选）
            
        Returns:
            SympathyAnalysisResult: 同情分析结果
        """
        # 1. 检测普遍性困境
        triggers = await self._detect_triggers(content, character_info)
        
        # 2. 评估脆弱性展示
        vulnerability = await self._evaluate_vulnerability(content, triggers)
        
        # 3. 判断普遍性
        universality = self._check_universality(triggers)
        
        # 4. 计算总分
        overall_score = self._calculate_score(triggers, vulnerability, universality)
        
        # 5. 生成建议
        suggestions = await self._generate_suggestions(
            content, triggers, vulnerability, overall_score
        )
        
        return SympathyAnalysisResult(
            overall_score=overall_score,
            triggers_detected=triggers,
            vulnerability_display=vulnerability,
            universal_predicament=universality,
            suggestions=suggestions
        )
    
    async def _detect_triggers(
        self,
        content: str,
        character_info: Optional[Dict]
    ) -> List[SympathyEvidence]:
        """检测同情触发器"""
        triggers = []
        
        # 关键词初筛
        for trigger_type, keywords in self.predicament_keywords.items():
            for keyword in keywords:
                if keyword in content:
                    # 找到包含关键词的句子
                    sentences = content.split("。")
                    for sentence in sentences:
                        if keyword in sentence:
                            triggers.append(SympathyEvidence(
                                trigger_type=trigger_type,
                                text_excerpt=sentence.strip(),
                                effectiveness=0.5,  # 初始值，后续LLM细化
                                vulnerability_level=0.5,
                                universality=0.5
                            ))
                            break
                    break
        
        # LLM 深度分析（如果可用）
        if self.llm and triggers:
            triggers = await self._llm_refine_triggers(content, triggers)
        
        return triggers
    
    async def _llm_refine_triggers(
        self,
        content: str,
        triggers: List[SympathyEvidence]
    ) -> List[SympathyEvidence]:
        """使用LLM细化触发器评估"""
        prompt = f"""
分析以下文本中的同情触发元素，评估其有效性。

文本内容：
{content[:2000]}

已检测到的触发器：
{[f"- {t.trigger_type.value}: {t.text_excerpt}" for t in triggers]}

请为每个触发器评分（0-1）：
1. effectiveness（有效性）：该困境是否能有效激发读者同情？
2. vulnerability_level（脆弱性）：角色的脆弱性展示得是否充分？
3. universality（普遍性）：这是否是读者能共情的普遍困境？

返回JSON格式。
"""
        # 实际调用LLM...
        return triggers
    
    async def _evaluate_vulnerability(
        self,
        content: str,
        triggers: List[SympathyEvidence]
    ) -> float:
        """评估脆弱性展示程度"""
        if not triggers:
            return 0.0
        
        # 计算平均脆弱性
        avg_vulnerability = sum(t.vulnerability_level for t in triggers) / len(triggers)
        return avg_vulnerability
    
    def _check_universality(self, triggers: List[SympathyEvidence]) -> bool:
        """检查是否展示普遍性困境"""
        if not triggers:
            return False
        
        # 至少有一个触发器的普遍性超过0.6
        return any(t.universality >= 0.6 for t in triggers)
    
    def _calculate_score(
        self,
        triggers: List[SympathyEvidence],
        vulnerability: float,
        universality: bool
    ) -> float:
        """计算总体同情分数"""
        if not triggers:
            return 0.0
        
        # 基础分：触发器数量和有效性
        trigger_score = min(len(triggers) * 15, 40)  # 最多40分
        effectiveness_score = sum(t.effectiveness for t in triggers) / len(triggers) * 30
        
        # 脆弱性分
        vulnerability_score = vulnerability * 20
        
        # 普遍性加分
        universality_bonus = 10 if universality else 0
        
        return min(trigger_score + effectiveness_score + vulnerability_score + universality_bonus, 100)
    
    async def _generate_suggestions(
        self,
        content: str,
        triggers: List[SympathyEvidence],
        vulnerability: float,
        score: float
    ) -> List[str]:
        """生成同情增强建议"""
        suggestions = []
        
        if score < 30:
            suggestions.append("⚠️ 同情元素严重不足！建议在开篇展示角色的普遍性困境")
            suggestions.append("参考技巧：让角色陷入危险/贫穷/孤独/无助等处境")
        
        if not triggers:
            suggestions.append("未检测到明显的同情触发器，考虑添加：")
            suggestions.append("- 危险困境：让角色面临生命威胁")
            suggestions.append("- 羞辱处境：让角色在公开场合受辱")
            suggestions.append("- 孤独排挤：让角色成为'天鹅中的丑小鸭'")
        
        if vulnerability < 0.5:
            suggestions.append("脆弱性展示不足，建议：")
            suggestions.append("- 展示角色的内心恐惧和不安")
            suggestions.append("- 描写角色在困境中的无力感")
        
        if not any(t.universality >= 0.6 for t in triggers):
            suggestions.append("困境的普遍性不够，读者可能难以共情")
            suggestions.append("建议使用更普遍的困境类型（如被误解、失去所爱）")
        
        # 成功案例参考
        if score < 60:
            suggestions.append("\n📚 大师案例参考：")
            suggestions.append("- 《悲惨世界》：冉·阿让虽有钱却无人接纳，展示社会偏见的无助")
            suggestions.append("- 《魔女嘉莉》：嘉莉因相貌和出身被孤立，引发读者对校园霸凌的共情")
            suggestions.append("- 《傲慢与偏见》：伊丽莎白在舞会上被公开羞辱，激发读者的愤怒和同情")
        
        return suggestions
    
    def detect_universal_predicament(self, content: str) -> List[SympathyTrigger]:
        """快速检测普遍性困境类型"""
        detected = []
        for trigger_type, keywords in self.predicament_keywords.items():
            if any(kw in content for kw in keywords):
                detected.append(trigger_type)
        return detected
