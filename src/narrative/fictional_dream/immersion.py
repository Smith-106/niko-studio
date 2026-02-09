# -*- coding: utf-8 -*-
"""
第四层：沉浸系统 (Immersion System)

身临其境是虚构梦境的最高阶段，读者完全进入故事，现实世界彻底消失。
实现这一终极目标的钥匙是：内心冲突 (Internal Conflict)

核心技巧: 当角色面临艰难抉择时，读者会不由自主地卷入这场内心风暴
"""

from enum import Enum
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any


class DilemmaType(Enum):
    """两难困境类型"""
    
    # 道德困境
    # 示例: 拉斯柯尔尼科夫——杀死放高利贷的老妇人是否正当？
    MORAL = "moral"
    
    # 责任冲突
    # 示例: 个人幸福 vs 家庭责任
    DUTY_CONFLICT = "duty_conflict"
    
    # 价值抉择
    # 示例: 荣誉 vs 生存
    VALUE_CHOICE = "value_choice"
    
    # 情感困境
    # 示例: 爱与恨的交织
    EMOTIONAL = "emotional"
    
    # 信任危机
    # 示例: 相信还是怀疑？
    TRUST = "trust"


@dataclass
class InternalConflict:
    """内心冲突"""
    dilemma: str                      # 两难困境描述
    option_a: str                     # 选项A
    option_b: str                     # 选项B
    stakes: str                       # 利害关系
    honor_involved: bool              # 是否涉及荣誉/自尊
    dilemma_type: DilemmaType         # 困境类型
    intensity: float                  # 冲突强度 (0-1)


@dataclass
class CarrieWaitingScene:
    """
    嘉莉等待场景分析
    
    《魔女嘉莉》中的沉浸技巧：
    - 嘉莉在等待舞伴时内心充满挣扎
    - "他会来吗？这可能是一个精心策划的笑话……"
    - 她一方面渴望参加舞会，另一方面又觉得待在家里更安全
    - 这种强烈的内心拉扯，迫使读者与她一同悬着心
    """
    is_detected: bool = False
    hope_fear_tension: str = ""       # 希望与恐惧的张力
    reader_participation: float = 0.0  # 读者参与度


@dataclass
class RaskolnikovMoralWar:
    """
    拉斯柯尔尼科夫道德战争分析
    
    《罪与罚》中的沉浸技巧：
    - 考虑是否要杀死放高利贷的老妇人
    - "我难道能做吗？不，这太荒谬、太反常了！"
    - "我怎能容忍如此恶行呢？"
    - 良知与生存需求在内心展开战争
    """
    is_detected: bool = False
    conscience_vs_need: str = ""      # 良知与需求的冲突
    moral_torment: float = 0.0        # 道德煎熬程度


@dataclass
class ImmersionAnalysisResult:
    """沉浸分析结果"""
    overall_score: float                    # 总体沉浸分数 (0-100)
    internal_conflicts: List[InternalConflict]  # 检测到的内心冲突
    carrie_scene: CarrieWaitingScene        # 嘉莉等待场景分析
    raskolnikov_war: RaskolnikovMoralWar    # 拉斯柯尔尼科夫道德战争分析
    reader_participation: float             # 读者参与度
    choice_urgency: float                   # 抉择紧迫感
    suggestions: List[str]                  # 增强建议
    
    @property
    def is_effective(self) -> bool:
        """沉浸是否有效建立"""
        return self.overall_score >= 60


class ImmersionCatalyst:
    """
    沉浸催化器
    
    通过内心冲突分析，评估文本让读者"成为"角色的效果，
    特别关注道德困境和荣誉抉择。
    """
    
    def __init__(self, llm_client: Any = None):
        self.llm = llm_client
        
        # 内心冲突关键词
        self.conflict_keywords = [
            # 犹豫和挣扎
            "犹豫", "挣扎", "矛盾", "两难", "左右为难", "进退两难",
            # 疑问和自问
            "难道", "是否", "应该", "能吗", "行吗", "对吗",
            # 对立选择
            "一方面", "另一方面", "或者", "还是", "但是", "然而",
            # 内心战争
            "内心", "心里", "灵魂", "良知", "本能", "理智"
        ]
        
        # 荣誉/自尊关键词
        self.honor_keywords = [
            "荣誉", "尊严", "自尊", "面子", "声誉", "名誉",
            "羞耻", "耻辱", "丢脸", "抬不起头"
        ]
        
        # 道德关键词
        self.moral_keywords = [
            "对", "错", "善", "恶", "正义", "邪恶",
            "应该", "不应该", "道德", "良心", "罪恶"
        ]
    
    async def analyze(
        self,
        content: str,
        character_info: Optional[Dict] = None,
        empathy_score: float = 0.0
    ) -> ImmersionAnalysisResult:
        """
        分析文本中的沉浸元素
        
        Args:
            content: 要分析的文本内容
            character_info: 角色信息
            empathy_score: 之前的移情分数
            
        Returns:
            ImmersionAnalysisResult: 沉浸分析结果
        """
        # 1. 检测内心冲突
        conflicts = await self._detect_conflicts(content)
        
        # 2. 分析嘉莉等待场景技巧
        carrie = await self._analyze_carrie_technique(content)
        
        # 3. 分析拉斯柯尔尼科夫道德战争技巧
        raskolnikov = await self._analyze_raskolnikov_technique(content)
        
        # 4. 评估读者参与度
        participation = self._evaluate_reader_participation(conflicts, carrie, raskolnikov)
        
        # 5. 评估抉择紧迫感
        urgency = self._evaluate_choice_urgency(content, conflicts)
        
        # 6. 计算总分
        overall_score = self._calculate_score(
            conflicts, participation, urgency, empathy_score
        )
        
        # 7. 生成建议
        suggestions = await self._generate_suggestions(
            content, conflicts, overall_score
        )
        
        return ImmersionAnalysisResult(
            overall_score=overall_score,
            internal_conflicts=conflicts,
            carrie_scene=carrie,
            raskolnikov_war=raskolnikov,
            reader_participation=participation,
            choice_urgency=urgency,
            suggestions=suggestions
        )
    
    async def _detect_conflicts(self, content: str) -> List[InternalConflict]:
        """检测内心冲突"""
        conflicts = []
        sentences = content.split("。")
        
        for sentence in sentences:
            # 检测冲突关键词
            conflict_score = sum(1 for kw in self.conflict_keywords if kw in sentence)
            
            if conflict_score >= 2:  # 至少两个冲突关键词
                # 检测是否涉及荣誉
                honor_involved = any(kw in sentence for kw in self.honor_keywords)
                
                # 检测困境类型
                dilemma_type = DilemmaType.EMOTIONAL
                if any(kw in sentence for kw in self.moral_keywords):
                    dilemma_type = DilemmaType.MORAL
                
                conflicts.append(InternalConflict(
                    dilemma=sentence.strip(),
                    option_a="待分析",
                    option_b="待分析",
                    stakes="待分析",
                    honor_involved=honor_involved,
                    dilemma_type=dilemma_type,
                    intensity=min(conflict_score * 0.2, 1.0)
                ))
        
        return conflicts
    
    async def _analyze_carrie_technique(self, content: str) -> CarrieWaitingScene:
        """分析嘉莉等待场景技巧"""
        technique = CarrieWaitingScene()
        
        # 检测希望与恐惧的张力
        hope_keywords = ["希望", "期待", "渴望", "盼望", "想要"]
        fear_keywords = ["害怕", "担心", "恐惧", "不安", "忧虑"]
        
        has_hope = any(kw in content for kw in hope_keywords)
        has_fear = any(kw in content for kw in fear_keywords)
        
        if has_hope and has_fear:
            technique.is_detected = True
            technique.hope_fear_tension = "希望与恐惧共存"
            technique.reader_participation = 0.7
        
        return technique
    
    async def _analyze_raskolnikov_technique(self, content: str) -> RaskolnikovMoralWar:
        """分析拉斯柯尔尼科夫道德战争技巧"""
        technique = RaskolnikovMoralWar()
        
        # 检测道德战争
        has_moral = any(kw in content for kw in self.moral_keywords)
        has_conflict = any(kw in content for kw in ["难道", "能吗", "应该"])
        
        if has_moral and has_conflict:
            technique.is_detected = True
            technique.conscience_vs_need = "良知与需求的冲突"
            technique.moral_torment = 0.8
        
        return technique
    
    def _evaluate_reader_participation(
        self,
        conflicts: List[InternalConflict],
        carrie: CarrieWaitingScene,
        raskolnikov: RaskolnikovMoralWar
    ) -> float:
        """评估读者参与度"""
        if not conflicts:
            return 0.0
        
        # 基础分
        base = len(conflicts) * 15
        
        # 技巧加分
        if carrie.is_detected:
            base += carrie.reader_participation * 20
        if raskolnikov.is_detected:
            base += raskolnikov.moral_torment * 25
        
        return min(base, 100)
    
    def _evaluate_choice_urgency(
        self,
        content: str,
        conflicts: List[InternalConflict]
    ) -> float:
        """评估抉择紧迫感"""
        urgency_keywords = [
            "必须", "立刻", "马上", "现在", "不能等", "来不及",
            "最后", "唯一", "只有", "否则"
        ]
        
        urgency_count = sum(1 for kw in urgency_keywords if kw in content)
        return min(urgency_count * 0.15, 1.0)
    
    def _calculate_score(
        self,
        conflicts: List[InternalConflict],
        participation: float,
        urgency: float,
        empathy_score: float
    ) -> float:
        """计算总体沉浸分数"""
        # 移情作为基础
        empathy_base = min(empathy_score / 100 * 15, 15)
        
        # 内心冲突分
        conflict_score = min(len(conflicts) * 12, 30)
        
        # 冲突强度
        if conflicts:
            intensity_score = sum(c.intensity for c in conflicts) / len(conflicts) * 20
        else:
            intensity_score = 0
        
        # 荣誉/道德加分
        honor_moral_bonus = 0
        for c in conflicts:
            if c.honor_involved:
                honor_moral_bonus += 5
            if c.dilemma_type == DilemmaType.MORAL:
                honor_moral_bonus += 5
        honor_moral_bonus = min(honor_moral_bonus, 15)
        
        # 参与度分
        participation_score = participation * 0.1
        
        # 紧迫感分
        urgency_score = urgency * 10
        
        return min(
            empathy_base + conflict_score + intensity_score + 
            honor_moral_bonus + participation_score + urgency_score,
            100
        )
    
    async def _generate_suggestions(
        self,
        content: str,
        conflicts: List[InternalConflict],
        score: float
    ) -> List[str]:
        """生成沉浸增强建议"""
        suggestions = []
        
        if score < 40:
            suggestions.append("⚠️ 沉浸元素严重不足！读者无法'成为'角色")
        
        if not conflicts:
            suggestions.append("未检测到内心冲突，这是沉浸的关键！")
            suggestions.append("建议添加：")
            suggestions.append("- 让角色面临两难抉择")
            suggestions.append("- 展示角色的内心挣扎和自我质疑")
        
        if conflicts and not any(c.honor_involved for c in conflicts):
            suggestions.append("\n💡 荣誉/自尊建议：")
            suggestions.append("- 关乎荣誉和自尊的道德抉择最能让读者沉浸")
            suggestions.append("- 考虑让角色的选择涉及个人尊严")
        
        if conflicts and not any(c.dilemma_type == DilemmaType.MORAL for c in conflicts):
            suggestions.append("\n💡 道德困境建议：")
            suggestions.append("- 道德困境迫使读者与角色一同权衡")
            suggestions.append("- 参考《罪与罚》：'我难道能做吗？这太荒谬了！'")
        
        # 大师案例
        if score < 60:
            suggestions.append("\n📚 大师案例参考：")
            suggestions.append("- 《魔女嘉莉》：'他会来吗？这可能是个笑话……'——希望与恐惧的拉扯")
            suggestions.append("- 《罪与罚》：'我怎能容忍如此恶行？'——良知与需求的战争")
        
        return suggestions
    
    def detect_moral_dilemma(self, content: str) -> bool:
        """快速检测是否存在道德困境"""
        has_moral = any(kw in content for kw in self.moral_keywords)
        has_conflict = any(kw in content for kw in self.conflict_keywords)
        return has_moral and has_conflict
