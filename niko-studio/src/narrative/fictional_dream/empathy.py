# -*- coding: utf-8 -*-
"""
第三层：移情系统 (Empathy System)

如果说同情是"我理解你的感受"，那么移情就是"我感受到你的感受"。
这是一种更为强烈、更为直接的情感体验。

核心技巧: 激发情感的感官细节 - 将读者"植入"角色的身体之中
"""

from enum import Enum
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any


class SenseType(Enum):
    """感官类型"""
    VISUAL = "visual"       # 视觉
    AUDITORY = "auditory"   # 听觉
    TACTILE = "tactile"     # 触觉
    OLFACTORY = "olfactory" # 嗅觉
    GUSTATORY = "gustatory" # 味觉
    KINESTHETIC = "kinesthetic"  # 动觉/本体感觉


@dataclass
class SensoryDetail:
    """感官细节"""
    sense_type: SenseType
    content: str                    # 具体描写内容
    emotion_evoked: str             # 激发的情感
    body_plant_effect: float        # "身体植入"效果 (0-1)
    text_location: str              # 在文本中的位置


@dataclass
class CarrieTechnique:
    """
    嘉莉技巧分析
    
    《魔女嘉莉》中的技巧：
    - 斯蒂芬·金没有简单地说"嘉莉很紧张"
    - 而是通过细节描写让读者感受她穿新衣服时的状态
    - "她产生了一种奇怪的梦幻般的感觉，一半是羞愧，一半是挑衅的兴奋"
    - "不知不觉中她感觉自己的背部挺直了"
    """
    is_detected: bool = False
    physical_state_descriptions: List[str] = field(default_factory=list)
    emotion_through_body: List[str] = field(default_factory=list)
    effectiveness: float = 0.0


@dataclass
class RedBadgeTechnique:
    """
    红色英勇勋章技巧分析
    
    斯蒂芬·克莱恩的技巧：
    - 通过一连串感官细节描绘新兵亨利的战前体验
    - "餐具盒富有节奏地撞击着他的大腿"
    - "粗帆布背包在他背上轻轻地上下跳动"
    - "每跑一步，步枪就在他肩上蹦一下"
    """
    is_detected: bool = False
    sensory_chain: List[str] = field(default_factory=list)
    immersive_effect: float = 0.0


@dataclass
class EmpathyAnalysisResult:
    """移情分析结果"""
    overall_score: float                    # 总体移情分数 (0-100)
    sensory_details: List[SensoryDetail]    # 检测到的感官细节
    sensory_coverage: Dict[SenseType, int]  # 各感官类型的覆盖度
    carrie_technique: CarrieTechnique       # 嘉莉技巧分析
    red_badge_technique: RedBadgeTechnique  # 红色英勇勋章技巧分析
    body_plant_score: float                 # "身体植入"总分
    suggestions: List[str]                  # 增强建议
    
    @property
    def is_effective(self) -> bool:
        """移情是否有效建立"""
        return self.overall_score >= 60


class EmpathyDeepener:
    """
    移情深化器
    
    通过感官细节分析，评估文本将读者"植入"角色身体的效果，
    提供增强建议以实现真正的情感共鸣。
    """
    
    def __init__(self, llm_client: Any = None):
        self.llm = llm_client
        
        # 感官关键词库
        self.sensory_keywords = {
            SenseType.VISUAL: [
                "看见", "望着", "眼前", "光线", "颜色", "影子", "闪烁",
                "目光", "视野", "明亮", "黑暗", "模糊", "清晰"
            ],
            SenseType.AUDITORY: [
                "听见", "声音", "回响", "沙沙", "嗡嗡", "尖叫", "低语",
                "轰鸣", "寂静", "嘈杂", "节奏", "旋律"
            ],
            SenseType.TACTILE: [
                "触摸", "感觉", "冰冷", "温暖", "粗糙", "光滑", "刺痛",
                "颤抖", "紧握", "抚摸", "压迫", "柔软"
            ],
            SenseType.OLFACTORY: [
                "气味", "香气", "臭味", "芬芳", "刺鼻", "清新", "腐烂",
                "闻到", "嗅觉", "弥漫"
            ],
            SenseType.GUSTATORY: [
                "味道", "甜", "苦", "酸", "咸", "辣", "品尝",
                "舌尖", "口感", "滋味"
            ],
            SenseType.KINESTHETIC: [
                "身体", "肌肉", "紧绷", "放松", "跳动", "颤抖", "僵硬",
                "背部挺直", "手心出汗", "心跳加速", "呼吸急促"
            ]
        }
        
        # 身体状态词库（嘉莉技巧）
        self.body_state_keywords = [
            "心跳", "呼吸", "颤抖", "出汗", "发抖", "紧绷",
            "放松", "僵硬", "软弱", "无力", "挺直", "弯曲",
            "手心", "额头", "脊背", "胸口", "喉咙", "胃部"
        ]
    
    async def analyze(
        self,
        content: str,
        character_info: Optional[Dict] = None,
        identification_score: float = 0.0
    ) -> EmpathyAnalysisResult:
        """
        分析文本中的移情元素
        
        Args:
            content: 要分析的文本内容
            character_info: 角色信息
            identification_score: 之前的认同分数
            
        Returns:
            EmpathyAnalysisResult: 移情分析结果
        """
        # 1. 提取感官细节
        sensory_details = await self._extract_sensory_details(content)
        
        # 2. 计算感官覆盖度
        sensory_coverage = self._calculate_coverage(sensory_details)
        
        # 3. 分析嘉莉技巧
        carrie = await self._analyze_carrie_technique(content)
        
        # 4. 分析红色英勇勋章技巧
        red_badge = await self._analyze_red_badge_technique(content)
        
        # 5. 计算身体植入分数
        body_plant_score = self._calculate_body_plant_score(
            sensory_details, carrie, red_badge
        )
        
        # 6. 计算总分
        overall_score = self._calculate_score(
            sensory_details, sensory_coverage, body_plant_score, identification_score
        )
        
        # 7. 生成建议
        suggestions = await self._generate_suggestions(
            content, sensory_details, sensory_coverage, overall_score
        )
        
        return EmpathyAnalysisResult(
            overall_score=overall_score,
            sensory_details=sensory_details,
            sensory_coverage=sensory_coverage,
            carrie_technique=carrie,
            red_badge_technique=red_badge,
            body_plant_score=body_plant_score,
            suggestions=suggestions
        )
    
    async def _extract_sensory_details(self, content: str) -> List[SensoryDetail]:
        """提取感官细节"""
        details = []
        sentences = content.split("。")
        
        for sentence in sentences:
            for sense_type, keywords in self.sensory_keywords.items():
                for keyword in keywords:
                    if keyword in sentence:
                        details.append(SensoryDetail(
                            sense_type=sense_type,
                            content=sentence.strip(),
                            emotion_evoked="待分析",
                            body_plant_effect=0.5,
                            text_location=sentence[:20]
                        ))
                        break
        
        return details
    
    def _calculate_coverage(
        self,
        details: List[SensoryDetail]
    ) -> Dict[SenseType, int]:
        """计算各感官类型的覆盖度"""
        coverage = {sense: 0 for sense in SenseType}
        for detail in details:
            coverage[detail.sense_type] += 1
        return coverage
    
    async def _analyze_carrie_technique(self, content: str) -> CarrieTechnique:
        """分析嘉莉技巧的运用"""
        technique = CarrieTechnique()
        
        # 检测身体状态描写
        for keyword in self.body_state_keywords:
            if keyword in content:
                sentences = content.split("。")
                for sentence in sentences:
                    if keyword in sentence:
                        technique.physical_state_descriptions.append(sentence.strip())
                        break
        
        if technique.physical_state_descriptions:
            technique.is_detected = True
            technique.effectiveness = min(
                len(technique.physical_state_descriptions) * 0.2, 1.0
            )
        
        return technique
    
    async def _analyze_red_badge_technique(self, content: str) -> RedBadgeTechnique:
        """分析红色英勇勋章技巧"""
        technique = RedBadgeTechnique()
        
        # 检测连续的感官细节链
        sentences = content.split("。")
        consecutive_sensory = 0
        max_chain = 0
        
        for sentence in sentences:
            has_sensory = False
            for keywords in self.sensory_keywords.values():
                if any(kw in sentence for kw in keywords):
                    has_sensory = True
                    break
            
            if has_sensory:
                consecutive_sensory += 1
                technique.sensory_chain.append(sentence.strip())
            else:
                max_chain = max(max_chain, consecutive_sensory)
                consecutive_sensory = 0
        
        max_chain = max(max_chain, consecutive_sensory)
        
        if max_chain >= 3:  # 至少3个连续感官描写
            technique.is_detected = True
            technique.immersive_effect = min(max_chain * 0.15, 1.0)
        
        return technique
    
    def _calculate_body_plant_score(
        self,
        details: List[SensoryDetail],
        carrie: CarrieTechnique,
        red_badge: RedBadgeTechnique
    ) -> float:
        """计算身体植入分数"""
        # 基础分：感官细节数量
        base = min(len(details) * 5, 40)
        
        # 嘉莉技巧加分
        carrie_bonus = carrie.effectiveness * 30 if carrie.is_detected else 0
        
        # 红色英勇勋章技巧加分
        red_badge_bonus = red_badge.immersive_effect * 30 if red_badge.is_detected else 0
        
        return min(base + carrie_bonus + red_badge_bonus, 100)
    
    def _calculate_score(
        self,
        details: List[SensoryDetail],
        coverage: Dict[SenseType, int],
        body_plant: float,
        identification_score: float
    ) -> float:
        """计算总体移情分数"""
        # 认同作为基础
        id_base = min(identification_score / 100 * 15, 15)
        
        # 感官细节数量
        detail_score = min(len(details) * 5, 25)
        
        # 感官多样性
        diversity = sum(1 for count in coverage.values() if count > 0)
        diversity_score = diversity / len(SenseType) * 20
        
        # 身体植入分数
        body_plant_score = body_plant * 0.4
        
        return min(id_base + detail_score + diversity_score + body_plant_score, 100)
    
    async def _generate_suggestions(
        self,
        content: str,
        details: List[SensoryDetail],
        coverage: Dict[SenseType, int],
        score: float
    ) -> List[str]:
        """生成移情增强建议"""
        suggestions = []
        
        if score < 40:
            suggestions.append("⚠️ 移情元素严重不足！读者无法真正'感受'角色的体验")
        
        # 检查感官覆盖
        missing_senses = [s for s, count in coverage.items() if count == 0]
        if missing_senses:
            suggestions.append(f"缺少以下感官描写: {[s.value for s in missing_senses]}")
            suggestions.append("建议添加更多感官细节，让读者'身临其境'")
        
        if coverage.get(SenseType.KINESTHETIC, 0) == 0:
            suggestions.append("\n💡 嘉莉技巧建议：")
            suggestions.append("- 不要只说'角色很紧张'，而要描写身体状态")
            suggestions.append("- 例如：'她的背部不知不觉挺直了'")
            suggestions.append("- 例如：'他感到手心开始出汗，心跳加速'")
        
        if len(details) < 5:
            suggestions.append("\n💡 红色英勇勋章技巧建议：")
            suggestions.append("- 使用连续的感官细节链创造沉浸感")
            suggestions.append("- 例如：描写物品撞击身体的节奏、背包的重量、武器的触感")
        
        # 大师案例
        if score < 60:
            suggestions.append("\n📚 大师案例参考：")
            suggestions.append("- 《魔女嘉莉》：'一半是羞愧，一半是挑衅的兴奋'——通过复杂情感的身体化表达")
            suggestions.append("- 《红色英勇勋章》：餐具盒、背包、步枪——三重感官细节链")
        
        return suggestions
    
    def evaluate_body_plant(self, content: str) -> float:
        """快速评估身体植入效果"""
        score = 0
        for keyword in self.body_state_keywords:
            if keyword in content:
                score += 1
        return min(score / len(self.body_state_keywords) * 100, 100)
