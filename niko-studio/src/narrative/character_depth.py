"""
角色深度系统 (Character Depth System)

基于弗雷《让劲爆小说飞起来》的角色塑造理论:
1. 有趣且知识渊博 (Interesting & Knowledgeable)
2. 高效与古怪 (Competent & Eccentric)
3. 人物与环境对比 (Contrast with Setting)
4. 主导情感 (Dominant Emotion)
5. 双重人格 (Dual Personality)
"""

from enum import Enum
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
import json


class CharacterTrait(Enum):
    """角色特质枚举"""
    INTERESTING = "interesting"      # 有趣
    KNOWLEDGEABLE = "knowledgeable"  # 知识渊博
    COMPETENT = "competent"          # 高效/能干
    ECCENTRIC = "eccentric"          # 古怪
    DUAL_PERSONALITY = "dual_personality"  # 双重人格


@dataclass
class DominantEmotion:
    """主导情感"""
    static_emotion: str      # 静态主导情感 (定义角色基本特质)
    dynamic_emotion: str     # 动态主导情感 (当前驱动情节的情感)
    evolution: List[str] = field(default_factory=list)  # 情感演变轨迹
    
    def add_evolution_point(self, new_emotion: str):
        self.evolution.append(new_emotion)
        self.dynamic_emotion = new_emotion


@dataclass
class Persona:
    """人格"""
    name: str                # 人格名称
    traits: List[str]        # 特质列表
    trigger_conditions: List[str]  # 触发条件
    behavior_patterns: List[str]   # 行为模式


@dataclass
class DualPersonality:
    """双重人格"""
    primary_persona: Persona      # 主要人格
    shadow_persona: Persona       # 隐藏人格
    internal_conflict: str        # 内心冲突描述
    switch_triggers: List[str] = field(default_factory=list)  # 切换触发器
    
    def get_conflict_potential(self) -> str:
        """获取冲突潜力描述"""
        return f"当{self.primary_persona.name}必须面对{self.shadow_persona.name}的需求时，内心冲突将达到顶峰"


@dataclass
class CharacterDepthScore:
    """角色深度评分"""
    trait: CharacterTrait
    score: float  # 0-10
    evidence: List[str] = field(default_factory=list)
    issues: List[str] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)


@dataclass
class CharacterDepthResult:
    """角色深度综合评估结果"""
    character_name: str
    
    interest_score: CharacterDepthScore
    competence_score: CharacterDepthScore
    eccentricity_score: CharacterDepthScore
    environment_contrast_score: CharacterDepthScore
    dual_personality_score: CharacterDepthScore
    
    dominant_emotion: Optional[DominantEmotion] = None
    dual_personality: Optional[DualPersonality] = None
    
    overall_score: float = 0.0
    depth_level: str = ""  # FLAT/MODERATE/DEEP/UNFORGETTABLE
    
    def __post_init__(self):
        # 权重: 有趣20%, 能干15%, 古怪15%, 环境对比20%, 双重人格30%
        self.overall_score = (
            self.interest_score.score * 0.20 +
            self.competence_score.score * 0.15 +
            self.eccentricity_score.score * 0.15 +
            self.environment_contrast_score.score * 0.20 +
            self.dual_personality_score.score * 0.30
        ) * 10
        
        if self.overall_score >= 85:
            self.depth_level = "UNFORGETTABLE"  # 令人难忘
        elif self.overall_score >= 70:
            self.depth_level = "DEEP"           # 深刻
        elif self.overall_score >= 50:
            self.depth_level = "MODERATE"       # 中等
        else:
            self.depth_level = "FLAT"           # 扁平


# ============================================================
# LLM Prompts  
# ============================================================

CHARACTER_INTEREST_PROMPT = """
## 角色趣味性评估 (Character Interest Assessment)

分析以下角色是否足够有趣和知识渊博。

**评估要点**:
1. 角色是否有独特的经历？(去过南极、在印度做过志愿者)
2. 角色是否有坚定的想法或信念？
3. 角色是否有精神追求或特殊爱好？
4. 读者是否想更多地了解这个角色？

**角色信息**:
{character_info}

**内容展示**:
{content}

请输出JSON格式:
```json
{
    "score": 0-10,
    "unique_experiences": ["独特经历..."],
    "beliefs_and_views": ["信念和观点..."],
    "interests": ["兴趣爱好..."],
    "evidence": ["趣味性证据..."],
    "issues": ["趣味性不足之处..."],
    "suggestions": ["如何增加趣味性..."]
}
```
"""

CHARACTER_ECCENTRICITY_PROMPT = """
## 角色古怪特质检测 (Eccentricity Detection)

分析角色是否具有古怪、令人难忘的特质。

**什么是古怪**:
- 言过其实、性情热烈
- 特立独行的行为
- 独特的哲学观或世界观
- 与众不同的习惯

**经典古怪角色**:
- 《白鲸》中的亚哈船长 - 对白鲸的狂热执念
- 《堂吉诃德》 - 与风车决斗
- 福尔摩斯 - 拉小提琴、从小提琴里拉出吗啡

**角色信息**:
{character_info}

**内容展示**:
{content}

请输出JSON格式:
```json
{
    "score": 0-10,
    "eccentric_traits": ["古怪特质..."],
    "memorable_behaviors": ["难忘行为..."],
    "contrast_with_norm": "与常人的对比...",
    "evidence": ["古怪证据..."],
    "issues": ["古怪性不足..."],
    "suggestions": ["如何增加古怪特质..."]
}
```
"""

DUAL_PERSONALITY_PROMPT = """
## 双重人格分析 (Dual Personality Analysis)

分析角色是否具有双重性——一个身体里存在两种截然不同的性格。

**双重人格的戏剧价值**:
当两种人格发生冲突时，会产生强大的内心戏剧张力。

**案例**:
- "狂暴的罗斯顿"少校: 冷酷的坦克指挥官 + 热爱绘画的艺术家
  → 当他必须开坦克撞毁有文艺复兴壁画的教堂墙壁时...
- 希尔达·欧哈拉: 上流社会贵妇 + 爱搞恶作剧的顽童
  → 当她必须在维持贵妇形象和满足恶作剧冲动之间选择时...

**角色信息**:
{character_info}

**内容展示**:
{content}

请输出JSON格式:
```json
{
    "has_dual_personality": true/false,
    "score": 0-10,
    "primary_persona": {
        "name": "主要人格名称",
        "traits": ["特质列表"],
        "behavior_patterns": ["行为模式"]
    },
    "shadow_persona": {
        "name": "隐藏人格名称", 
        "traits": ["特质列表"],
        "behavior_patterns": ["行为模式"]
    },
    "internal_conflict": "两种人格的冲突描述",
    "switch_triggers": ["触发人格切换的条件"],
    "dramatic_potential": "戏剧潜力评估",
    "suggestions": ["如何增强双重人格..."]
}
```
"""

ENVIRONMENT_CONTRAST_PROMPT = """
## 人物与环境对比分析 (Environment Contrast Analysis)

分析角色是否被置于其不适应的环境中（"鱼离开水"技巧）。

**为什么有效**:
将人物置于格格不入的环境中，是产生戏剧性的强大技巧。

**经典案例**:
- 《大白鲨》: 讨厌水、不会游泳的州长，必须出海猎杀巨鲨
- 《飘》: 娇生惯养的南方美人，在战争废墟中为生存而战
- 《审判》: 理性讲逻辑的银行职员，陷入荒诞的法律体系

**角色信息**:
{character_info}

**环境设定**:
{environment_info}

**内容展示**:
{content}

请输出JSON格式:
```json
{
    "score": 0-10,
    "character_comfort_zone": "角色的舒适区描述",
    "current_environment": "当前环境描述",
    "contrast_level": "对比程度 (low/medium/high/extreme)",
    "friction_points": ["摩擦点列表"],
    "growth_potential": "成长潜力评估",
    "evidence": ["对比证据..."],
    "suggestions": ["如何增强环境对比..."]
}
```
"""


class CharacterDepthSystem:
    """
    角色深度系统
    
    评估角色是否足够深刻、有趣、令人难忘
    """
    
    def __init__(self, llm=None):
        self.llm = llm
    
    async def assess_interest_level(
        self,
        character_info: Dict[str, Any],
        content: str
    ) -> CharacterDepthScore:
        """评估角色趣味性"""
        if self.llm is None:
            return self._mock_interest_score()
        
        prompt = CHARACTER_INTEREST_PROMPT.format(
            character_info=json.dumps(character_info, ensure_ascii=False),
            content=content
        )
        response = await self.llm.ainvoke(prompt)
        result = json.loads(response.content)
        
        return CharacterDepthScore(
            trait=CharacterTrait.INTERESTING,
            score=result["score"],
            evidence=result.get("evidence", []),
            issues=result.get("issues", []),
            suggestions=result.get("suggestions", [])
        )
    
    async def detect_eccentricity(
        self,
        character_info: Dict[str, Any],
        content: str
    ) -> CharacterDepthScore:
        """检测古怪特质"""
        if self.llm is None:
            return self._mock_eccentricity_score()
        
        prompt = CHARACTER_ECCENTRICITY_PROMPT.format(
            character_info=json.dumps(character_info, ensure_ascii=False),
            content=content
        )
        response = await self.llm.ainvoke(prompt)
        result = json.loads(response.content)
        
        return CharacterDepthScore(
            trait=CharacterTrait.ECCENTRIC,
            score=result["score"],
            evidence=result.get("evidence", []),
            issues=result.get("issues", []),
            suggestions=result.get("suggestions", [])
        )
    
    async def map_dual_personality(
        self,
        character_info: Dict[str, Any],
        content: str
    ) -> tuple[CharacterDepthScore, Optional[DualPersonality]]:
        """映射双重人格"""
        if self.llm is None:
            return self._mock_dual_personality_score(), None
        
        prompt = DUAL_PERSONALITY_PROMPT.format(
            character_info=json.dumps(character_info, ensure_ascii=False),
            content=content
        )
        response = await self.llm.ainvoke(prompt)
        result = json.loads(response.content)
        
        dual_personality = None
        if result.get("has_dual_personality"):
            primary = result.get("primary_persona", {})
            shadow = result.get("shadow_persona", {})
            dual_personality = DualPersonality(
                primary_persona=Persona(
                    name=primary.get("name", ""),
                    traits=primary.get("traits", []),
                    trigger_conditions=[],
                    behavior_patterns=primary.get("behavior_patterns", [])
                ),
                shadow_persona=Persona(
                    name=shadow.get("name", ""),
                    traits=shadow.get("traits", []),
                    trigger_conditions=[],
                    behavior_patterns=shadow.get("behavior_patterns", [])
                ),
                internal_conflict=result.get("internal_conflict", ""),
                switch_triggers=result.get("switch_triggers", [])
            )
        
        return CharacterDepthScore(
            trait=CharacterTrait.DUAL_PERSONALITY,
            score=result["score"],
            evidence=[result.get("dramatic_potential", "")],
            issues=[],
            suggestions=result.get("suggestions", [])
        ), dual_personality
    
    async def check_environment_contrast(
        self,
        character_info: Dict[str, Any],
        environment_info: Dict[str, Any],
        content: str
    ) -> CharacterDepthScore:
        """检查环境对比 (鱼离开水)"""
        if self.llm is None:
            return self._mock_environment_contrast_score()
        
        prompt = ENVIRONMENT_CONTRAST_PROMPT.format(
            character_info=json.dumps(character_info, ensure_ascii=False),
            environment_info=json.dumps(environment_info, ensure_ascii=False),
            content=content
        )
        response = await self.llm.ainvoke(prompt)
        result = json.loads(response.content)
        
        return CharacterDepthScore(
            trait=CharacterTrait.INTERESTING,  # 使用 INTERESTING 作为代理
            score=result["score"],
            evidence=result.get("evidence", []),
            issues=[],
            suggestions=result.get("suggestions", [])
        )
    
    def track_dominant_emotion(
        self,
        character_name: str,
        static_emotion: str,
        dynamic_emotion: str
    ) -> DominantEmotion:
        """追踪主导情感"""
        return DominantEmotion(
            static_emotion=static_emotion,
            dynamic_emotion=dynamic_emotion,
            evolution=[static_emotion, dynamic_emotion] if static_emotion != dynamic_emotion else [static_emotion]
        )
    
    async def evaluate_full(
        self,
        character_info: Dict[str, Any],
        environment_info: Dict[str, Any],
        content: str
    ) -> CharacterDepthResult:
        """完整角色深度评估"""
        interest = await self.assess_interest_level(character_info, content)
        eccentricity = await self.detect_eccentricity(character_info, content)
        dual_score, dual_personality = await self.map_dual_personality(character_info, content)
        environment = await self.check_environment_contrast(character_info, environment_info, content)
        
        # 能干程度暂用 mock
        competence = self._mock_competence_score()
        
        return CharacterDepthResult(
            character_name=character_info.get("name", "Unknown"),
            interest_score=interest,
            competence_score=competence,
            eccentricity_score=eccentricity,
            environment_contrast_score=environment,
            dual_personality_score=dual_score,
            dual_personality=dual_personality
        )
    
    # ============================================================
    # Mock methods
    # ============================================================
    
    def _mock_interest_score(self) -> CharacterDepthScore:
        return CharacterDepthScore(
            trait=CharacterTrait.INTERESTING,
            score=6.0,
            evidence=["角色有一些独特背景"],
            issues=["可以增加更多独特经历"],
            suggestions=["考虑增加角色的特殊技能或知识"]
        )
    
    def _mock_eccentricity_score(self) -> CharacterDepthScore:
        return CharacterDepthScore(
            trait=CharacterTrait.ECCENTRIC,
            score=5.0,
            evidence=[],
            issues=["角色较为普通"],
            suggestions=["增加一些古怪的习惯或观点"]
        )
    
    def _mock_competence_score(self) -> CharacterDepthScore:
        return CharacterDepthScore(
            trait=CharacterTrait.COMPETENT,
            score=7.0,
            evidence=["角色在其领域表现出能力"],
            issues=[],
            suggestions=[]
        )
    
    def _mock_dual_personality_score(self) -> CharacterDepthScore:
        return CharacterDepthScore(
            trait=CharacterTrait.DUAL_PERSONALITY,
            score=4.0,
            evidence=[],
            issues=["未发现明显的双重人格"],
            suggestions=["考虑为角色设计内在矛盾的两面"]
        )
    
    def _mock_environment_contrast_score(self) -> CharacterDepthScore:
        return CharacterDepthScore(
            trait=CharacterTrait.INTERESTING,
            score=5.0,
            evidence=[],
            issues=["角色与环境较为适应"],
            suggestions=["考虑将角色置于更不适应的环境中"]
        )
