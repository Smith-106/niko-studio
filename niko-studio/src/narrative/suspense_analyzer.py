"""
悬念分析器 (Suspense Analyzer)

基于弗雷《让劲爆小说飞起来》的悬念三大支柱:
1. 故事问题 (Story Questions) - 激发好奇心
2. 威胁情境 (Threat Situations) - 制造担忧
3. 点燃导火索 (Lit Fuses) - 时限压力
"""

from enum import Enum
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any, Tuple
import json


class SuspensePillar(Enum):
    """悬念支柱枚举"""
    STORY_QUESTION = "story_question"      # 故事问题 - 激发好奇
    THREAT_SITUATION = "threat_situation"  # 威胁情境 - 制造担忧
    LIT_FUSE = "lit_fuse"                  # 点燃导火索 - 时限压力


@dataclass
class StoryQuestion:
    """故事问题"""
    question: str           # 问题内容
    location: str          # 位置 (开篇/中间/结尾)
    intensity: float       # 强度 0-10
    is_answered: bool = False  # 是否已回答
    answer_location: Optional[str] = None


@dataclass
class ThreatSituation:
    """威胁情境"""
    threat_type: str       # 威胁类型 (physical/psychological/social)
    description: str       # 威胁描述
    target_character: str  # 受威胁角色
    intensity: float       # 强度 0-10
    is_resolved: bool = False


@dataclass 
class LitFuse:
    """点燃的导火索 (时限危机)"""
    crisis: str            # 危机描述
    deadline: str          # 时限描述
    consequence: str       # 后果描述
    intensity: float       # 强度 0-10
    is_defused: bool = False  # 是否已解除


@dataclass
class SuspenseScore:
    """悬念评分"""
    pillar: SuspensePillar
    score: float  # 0-10
    elements: List[Any] = field(default_factory=list)  # 发现的元素
    issues: List[str] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)


@dataclass
class SuspenseAnalysisResult:
    """悬念分析综合结果"""
    story_questions: SuspenseScore
    threat_situations: SuspenseScore
    lit_fuses: SuspenseScore
    
    overall_score: float = 0.0  # 0-100
    suspense_level: str = ""    # LOW/MODERATE/HIGH/GRIPPING
    suspense_curve: List[Tuple[str, float]] = field(default_factory=list)  # 悬念曲线
    
    def __post_init__(self):
        # 权重: 故事问题30%, 威胁情境40%, 导火索30%
        self.overall_score = (
            self.story_questions.score * 0.30 +
            self.threat_situations.score * 0.40 +
            self.lit_fuses.score * 0.30
        ) * 10
        
        if self.overall_score >= 85:
            self.suspense_level = "GRIPPING"  # 扣人心弦
        elif self.overall_score >= 70:
            self.suspense_level = "HIGH"      # 高悬念
        elif self.overall_score >= 50:
            self.suspense_level = "MODERATE"  # 中等
        else:
            self.suspense_level = "LOW"       # 低悬念


# ============================================================
# LLM Prompts
# ============================================================

STORY_QUESTION_PROMPT = """
## 故事问题检测 (Story Question Detection)

分析以下内容，找出所有能激发读者好奇心的"故事问题"。

**什么是好的故事问题**:
- 在开篇就能抓住读者的问题
- 让读者想要知道答案的问题
- 暗示灾难或转折的问题

**经典案例**:
- 《悲惨世界》: "一个步行的人走进了小小的迪涅城" → 这个人是谁？来做什么？
- 《大白鲨》: "大白鲨在水里慢慢盘旋推进" → 谁将成为它的盘中餐？
- 《审判》: "他没有做任何错事，却被捕了" → 谁诬陷了他？为什么？

**反面案例**:
- "金格的卧室布局是..." → 纯粹描述，没有问题
- "晚上没什么好玩的，所以早点上床" → 消极的问题

**待分析内容**:
{content}

请输出JSON格式:
```json
{
    "questions": [
        {
            "question": "隐含的问题是什么",
            "location": "开篇/中间/结尾",
            "intensity": 0-10,
            "trigger_text": "触发问题的原文"
        }
    ],
    "score": 0-10,
    "issues": ["问题不足之处..."],
    "suggestions": ["如何增加故事问题..."]
}
```
"""

THREAT_SITUATION_PROMPT = """
## 威胁情境分析 (Threat Situation Analysis)

分析以下内容，找出所有让读者为角色担忧的威胁情境。

**威胁类型**:
1. 身体威胁 (physical): 生命危险、受伤风险
2. 心理威胁 (psychological): 精神压力、恐惧
3. 社会威胁 (social): 地位丧失、关系破裂、名誉受损

**评估要点**:
- 威胁是否明确具体？
- 读者是否会为角色揪心？
- 威胁是否有升级趋势？

**经典案例**:
- 《大白鲨》: 食人鲨对游客的身体威胁
- 《飞越疯人院》: 护士长对病人的心理威胁

**待分析内容**:
{content}

**角色信息**:
{character_info}

请输出JSON格式:
```json
{
    "threats": [
        {
            "threat_type": "physical/psychological/social",
            "description": "威胁描述",
            "target_character": "受威胁角色",
            "intensity": 0-10,
            "evidence_text": "原文证据"
        }
    ],
    "score": 0-10,
    "escalation_detected": true/false,
    "issues": ["威胁不足之处..."],
    "suggestions": ["如何增强威胁感..."]
}
```
"""

LIT_FUSE_PROMPT = """
## 导火索检测 (Lit Fuse Detection)

分析以下内容，找出所有"点燃的导火索"——有明确时限的危机。

**导火索定义**:
在特定时间内必须解决的可怕事件，否则灾难就将发生。

**经典案例**:
- 《宝林历险记》: 宝林被绑在轨道上，火车12点10分到达
- 《豺狼虎豹》: 必须在刺客动手前阻止他
- 《飘》: 必须在北方佬烧毁亚特兰大前逃离
- 《魔女嘉莉》: 舞会皇后加冕礼上被泼猪血，复仇导火索点燃

**待分析内容**:
{content}

请输出JSON格式:
```json
{
    "fuses": [
        {
            "crisis": "危机描述",
            "deadline": "时限描述",
            "consequence": "如果不解决会怎样",
            "intensity": 0-10,
            "evidence_text": "原文证据"
        }
    ],
    "score": 0-10,
    "urgency_level": "low/medium/high/critical",
    "issues": ["导火索不足之处..."],
    "suggestions": ["如何增加时限压力..."]
}
```
"""


class SuspenseAnalyzer:
    """
    悬念分析器
    
    分析内容的悬念设置是否有效
    """
    
    def __init__(self, llm=None):
        self.llm = llm
    
    async def detect_story_questions(self, content: str) -> SuspenseScore:
        """
        检测故事问题
        
        分析内容中能激发读者好奇心的问题
        """
        if self.llm is None:
            return self._mock_story_questions()
        
        prompt = STORY_QUESTION_PROMPT.format(content=content)
        response = await self.llm.ainvoke(prompt)
        result = json.loads(response.content)
        
        questions = [
            StoryQuestion(
                question=q["question"],
                location=q["location"],
                intensity=q["intensity"]
            )
            for q in result.get("questions", [])
        ]
        
        return SuspenseScore(
            pillar=SuspensePillar.STORY_QUESTION,
            score=result["score"],
            elements=questions,
            issues=result.get("issues", []),
            suggestions=result.get("suggestions", [])
        )
    
    async def analyze_threat_situations(
        self, 
        content: str,
        character_info: Dict[str, Any]
    ) -> SuspenseScore:
        """
        分析威胁情境
        
        检测让读者为角色担忧的威胁
        """
        if self.llm is None:
            return self._mock_threat_situations()
        
        prompt = THREAT_SITUATION_PROMPT.format(
            content=content,
            character_info=json.dumps(character_info, ensure_ascii=False)
        )
        response = await self.llm.ainvoke(prompt)
        result = json.loads(response.content)
        
        threats = [
            ThreatSituation(
                threat_type=t["threat_type"],
                description=t["description"],
                target_character=t["target_character"],
                intensity=t["intensity"]
            )
            for t in result.get("threats", [])
        ]
        
        return SuspenseScore(
            pillar=SuspensePillar.THREAT_SITUATION,
            score=result["score"],
            elements=threats,
            issues=result.get("issues", []),
            suggestions=result.get("suggestions", [])
        )
    
    async def find_lit_fuses(self, content: str) -> SuspenseScore:
        """
        查找导火索
        
        检测有时限压力的危机
        """
        if self.llm is None:
            return self._mock_lit_fuses()
        
        prompt = LIT_FUSE_PROMPT.format(content=content)
        response = await self.llm.ainvoke(prompt)
        result = json.loads(response.content)
        
        fuses = [
            LitFuse(
                crisis=f["crisis"],
                deadline=f["deadline"],
                consequence=f["consequence"],
                intensity=f["intensity"]
            )
            for f in result.get("fuses", [])
        ]
        
        return SuspenseScore(
            pillar=SuspensePillar.LIT_FUSE,
            score=result["score"],
            elements=fuses,
            issues=result.get("issues", []),
            suggestions=result.get("suggestions", [])
        )
    
    async def analyze_full(
        self,
        content: str,
        character_info: Dict[str, Any]
    ) -> SuspenseAnalysisResult:
        """
        完整悬念分析
        """
        story_questions = await self.detect_story_questions(content)
        threat_situations = await self.analyze_threat_situations(content, character_info)
        lit_fuses = await self.find_lit_fuses(content)
        
        return SuspenseAnalysisResult(
            story_questions=story_questions,
            threat_situations=threat_situations,
            lit_fuses=lit_fuses
        )
    
    def calculate_suspense_curve(
        self, 
        scenes: List[Dict[str, Any]]
    ) -> List[Tuple[str, float]]:
        """
        计算悬念曲线
        
        分析多个场景的悬念变化趋势
        """
        curve = []
        for scene in scenes:
            scene_id = scene.get("scene_id", "unknown")
            # 简化计算：取各元素平均强度
            intensity = scene.get("suspense_intensity", 5.0)
            curve.append((scene_id, intensity))
        return curve
    
    def suggest_suspense_enhancement(
        self, 
        result: SuspenseAnalysisResult
    ) -> List[str]:
        """
        生成悬念增强建议
        """
        suggestions = []
        
        if result.story_questions.score < 6:
            suggestions.append("📌 开篇需要更强的故事问题来抓住读者")
            suggestions.extend(result.story_questions.suggestions)
        
        if result.threat_situations.score < 6:
            suggestions.append("⚠️ 威胁情境不够明确，读者难以为角色担忧")
            suggestions.extend(result.threat_situations.suggestions)
        
        if result.lit_fuses.score < 6:
            suggestions.append("⏰ 缺少时限压力，考虑增加'导火索'元素")
            suggestions.extend(result.lit_fuses.suggestions)
        
        return suggestions
    
    # ============================================================
    # Mock methods
    # ============================================================
    
    def _mock_story_questions(self) -> SuspenseScore:
        return SuspenseScore(
            pillar=SuspensePillar.STORY_QUESTION,
            score=7.0,
            elements=[
                StoryQuestion(
                    question="主角接下来会怎么做？",
                    location="开篇",
                    intensity=7.0
                )
            ],
            issues=[],
            suggestions=["可以在开篇增加更直接的问题"]
        )
    
    def _mock_threat_situations(self) -> SuspenseScore:
        return SuspenseScore(
            pillar=SuspensePillar.THREAT_SITUATION,
            score=6.0,
            elements=[],
            issues=["威胁不够具体"],
            suggestions=["增加更明确的威胁描写"]
        )
    
    def _mock_lit_fuses(self) -> SuspenseScore:
        return SuspenseScore(
            pillar=SuspensePillar.LIT_FUSE,
            score=5.0,
            elements=[],
            issues=["缺少时限压力"],
            suggestions=["考虑增加deadline元素"]
        )
