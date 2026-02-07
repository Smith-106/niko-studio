# -*- coding: utf-8 -*-
"""
第二层：认同系统 (Identification System)

认同是比同情更深一层的情感联结。
它意味着读者不仅同情角色的困境，更支持他的目标、认可他的勇气，
并强烈希望他能成功。

关键技巧: 教父技巧 - 将道德瑕疵的角色与崇高目标绑定
"""

from enum import Enum
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any


class IdentificationElement(Enum):
    """认同构建元素"""
    
    # 目标支持
    # 读者认可并希望角色达成其目标
    GOAL_SUPPORT = "goal_support"
    
    # 勇气认可
    # 读者认可角色面对困难的勇气
    COURAGE_RECOGNITION = "courage_recognition"
    
    # 崇高价值绑定
    # 角色的目标触及读者心中的崇高价值
    NOBLE_VALUE_BINDING = "noble_value_binding"
    
    # 正义代言
    # 角色成为正义的化身（如教父技巧）
    JUSTICE_EMBODIMENT = "justice_embodiment"


@dataclass
class GodfatherTechnique:
    """
    教父技巧分析
    
    《教父》的核心技巧：
    - 主人公唐·柯里昂是冷酷的黑帮大佬（道德瑕疵）
    - 但故事从寻求正义却被法律愚弄的伯纳塞拉切入
    - 当司法系统无法为他女儿伸张正义时，柯里昂成为了正义的化身
    - 读者将对伯纳塞拉的同情，自然转移到柯里昂身上
    """
    is_detected: bool = False
    moral_flaw: Optional[str] = None          # 角色的道德瑕疵
    noble_goal: Optional[str] = None          # 崇高目标
    sympathy_transfer_path: Optional[str] = None  # 同情转移路径
    effectiveness: float = 0.0


@dataclass
class IdentificationEvidence:
    """认同证据"""
    element_type: IdentificationElement
    text_excerpt: str
    goal_worthiness: float        # 目标值得性 (0-1)
    reader_support_level: float   # 读者支持程度 (0-1)
    noble_value: Optional[str] = None  # 触及的崇高价值


@dataclass
class IdentificationAnalysisResult:
    """认同分析结果"""
    overall_score: float                         # 总体认同分数 (0-100)
    elements_detected: List[IdentificationEvidence]  # 检测到的认同元素
    godfather_technique: GodfatherTechnique      # 教父技巧分析
    goal_clarity: float                          # 目标清晰度
    goal_worthiness: float                       # 目标值得性
    suggestions: List[str]                       # 增强建议
    
    @property
    def is_effective(self) -> bool:
        """认同是否有效建立"""
        return self.overall_score >= 60


class IdentificationBuilder:
    """
    认同构建器
    
    分析和增强读者对角色的认同感，
    特别关注"教父技巧"的运用。
    """
    
    def __init__(self, llm_client: Any = None):
        self.llm = llm_client
        
        # 崇高价值词库
        self.noble_values = [
            "正义", "公平", "保护", "拯救", "牺牲", "勇气", "忠诚",
            "自由", "尊严", "真相", "家庭", "爱", "希望", "守护"
        ]
        
        # 目标价值词库
        self.goal_keywords = [
            "必须", "一定要", "决心", "发誓", "目标", "使命",
            "为了", "不惜", "无论如何", "拯救", "保护", "复仇"
        ]
    
    async def analyze(
        self,
        content: str,
        character_info: Optional[Dict] = None,
        sympathy_score: float = 0.0
    ) -> IdentificationAnalysisResult:
        """
        分析文本中的认同元素
        
        Args:
            content: 要分析的文本内容
            character_info: 角色信息
            sympathy_score: 之前的同情分数（认同建立在同情之上）
            
        Returns:
            IdentificationAnalysisResult: 认同分析结果
        """
        # 1. 检测认同元素
        elements = await self._detect_elements(content, character_info)
        
        # 2. 分析教父技巧
        godfather = await self._analyze_godfather_technique(content, character_info)
        
        # 3. 评估目标清晰度和值得性
        goal_clarity = await self._evaluate_goal_clarity(content)
        goal_worthiness = await self._evaluate_goal_worthiness(content, elements)
        
        # 4. 计算总分（认同需要同情作为基础）
        overall_score = self._calculate_score(
            elements, godfather, goal_clarity, goal_worthiness, sympathy_score
        )
        
        # 5. 生成建议
        suggestions = await self._generate_suggestions(
            content, elements, godfather, goal_clarity, overall_score
        )
        
        return IdentificationAnalysisResult(
            overall_score=overall_score,
            elements_detected=elements,
            godfather_technique=godfather,
            goal_clarity=goal_clarity,
            goal_worthiness=goal_worthiness,
            suggestions=suggestions
        )
    
    async def _detect_elements(
        self,
        content: str,
        character_info: Optional[Dict]
    ) -> List[IdentificationEvidence]:
        """检测认同元素"""
        elements = []
        
        # 检测目标支持
        for keyword in self.goal_keywords:
            if keyword in content:
                sentences = content.split("。")
                for sentence in sentences:
                    if keyword in sentence:
                        elements.append(IdentificationEvidence(
                            element_type=IdentificationElement.GOAL_SUPPORT,
                            text_excerpt=sentence.strip(),
                            goal_worthiness=0.5,
                            reader_support_level=0.5
                        ))
                        break
                break
        
        # 检测崇高价值绑定
        for value in self.noble_values:
            if value in content:
                sentences = content.split("。")
                for sentence in sentences:
                    if value in sentence:
                        elements.append(IdentificationEvidence(
                            element_type=IdentificationElement.NOBLE_VALUE_BINDING,
                            text_excerpt=sentence.strip(),
                            goal_worthiness=0.7,
                            reader_support_level=0.6,
                            noble_value=value
                        ))
                        break
                break
        
        return elements
    
    async def _analyze_godfather_technique(
        self,
        content: str,
        character_info: Optional[Dict]
    ) -> GodfatherTechnique:
        """
        分析教父技巧的运用
        
        教父技巧的核心：
        1. 主角存在道德瑕疵
        2. 但主角的目标触及崇高价值（如正义）
        3. 通过另一个角色的困境引入，转移同情
        """
        if not self.llm:
            return GodfatherTechnique()
        
        prompt = f"""
分析以下文本是否运用了"教父技巧"：

教父技巧定义：
- 主角可能存在道德瑕疵（如反派、罪犯、道德灰色人物）
- 但通过将其与崇高目标（正义、保护弱者）绑定
- 使读者认同并支持这个本不完美的角色

文本内容：
{content[:2000]}

角色信息：
{character_info}

请分析：
1. 主角是否存在道德瑕疵？具体是什么？
2. 主角的目标是否触及崇高价值？
3. 是否存在同情转移路径？（通过另一角色引入）
4. 教父技巧的有效性评分（0-1）

返回JSON格式。
"""
        # 实际LLM调用...
        return GodfatherTechnique()
    
    async def _evaluate_goal_clarity(self, content: str) -> float:
        """评估目标清晰度"""
        # 检查是否有明确的目标陈述
        goal_indicators = ["必须", "一定要", "目标是", "为了", "决心"]
        clarity = sum(1 for ind in goal_indicators if ind in content) / len(goal_indicators)
        return min(clarity * 2, 1.0)  # 放大但不超过1
    
    async def _evaluate_goal_worthiness(
        self,
        content: str,
        elements: List[IdentificationEvidence]
    ) -> float:
        """评估目标值得性"""
        if not elements:
            return 0.0
        
        # 检查是否触及崇高价值
        noble_elements = [e for e in elements 
                         if e.element_type == IdentificationElement.NOBLE_VALUE_BINDING]
        
        if noble_elements:
            return sum(e.goal_worthiness for e in noble_elements) / len(noble_elements)
        
        return sum(e.goal_worthiness for e in elements) / len(elements)
    
    def _calculate_score(
        self,
        elements: List[IdentificationEvidence],
        godfather: GodfatherTechnique,
        goal_clarity: float,
        goal_worthiness: float,
        sympathy_score: float
    ) -> float:
        """计算总体认同分数"""
        # 认同需要同情作为基础
        sympathy_base = min(sympathy_score / 100 * 20, 20)  # 最多20分基础
        
        # 元素分
        element_score = min(len(elements) * 10, 25)
        
        # 目标清晰度
        clarity_score = goal_clarity * 15
        
        # 目标值得性
        worthiness_score = goal_worthiness * 20
        
        # 教父技巧加分
        godfather_bonus = godfather.effectiveness * 20 if godfather.is_detected else 0
        
        return min(sympathy_base + element_score + clarity_score + worthiness_score + godfather_bonus, 100)
    
    async def _generate_suggestions(
        self,
        content: str,
        elements: List[IdentificationEvidence],
        godfather: GodfatherTechnique,
        goal_clarity: float,
        score: float
    ) -> List[str]:
        """生成认同增强建议"""
        suggestions = []
        
        if score < 40:
            suggestions.append("⚠️ 认同元素严重不足！读者可能不会支持角色的目标")
        
        if goal_clarity < 0.5:
            suggestions.append("目标不够清晰，建议：")
            suggestions.append("- 让角色明确表达其核心目标")
            suggestions.append("- 展示角色为目标付出的努力和决心")
        
        if not any(e.element_type == IdentificationElement.NOBLE_VALUE_BINDING for e in elements):
            suggestions.append("未检测到崇高价值绑定，考虑：")
            suggestions.append("- 将角色目标与正义、保护弱者等崇高价值关联")
            suggestions.append("- 展示角色的目标如何帮助他人或社会")
        
        if not godfather.is_detected and score < 60:
            suggestions.append("\n💡 考虑使用'教父技巧'：")
            suggestions.append("- 即使角色有道德瑕疵，也可通过崇高目标赢得认同")
            suggestions.append("- 可通过另一个受害者的视角引入，转移读者的同情")
            suggestions.append("- 参考《教父》开场：通过伯纳塞拉的困境，让柯里昂成为正义化身")
        
        return suggestions
    
    def detect_godfather_potential(
        self,
        character_has_moral_flaw: bool,
        character_goal: str
    ) -> bool:
        """检测是否适合使用教父技巧"""
        if not character_has_moral_flaw:
            return False
        
        # 检查目标是否触及崇高价值
        return any(value in character_goal for value in self.noble_values)
