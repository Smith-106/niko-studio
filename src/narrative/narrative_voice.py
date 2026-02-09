"""
叙事语气管理 (Narrative Voice Manager)

基于弗雷《让劲爆小说飞起来》的叙事语气理论:
1. 叙述者作为"伪装" - 精心构建的理想化投射
2. 强势语气的关键 - 对语气和细节的支配
3. 打破"作者隐身"的伪定律 - 强大的作者在场感
"""

from enum import Enum
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
import json


class VoiceStrength(Enum):
    """语气强度"""
    WEAK = "weak"              # 薄弱 - 空泛乏味
    MODERATE = "moderate"      # 中等 - 有些细节
    STRONG = "strong"          # 强劲 - 细节丰富
    AUTHORITATIVE = "authoritative"  # 权威 - 无可置疑


@dataclass
class VoiceMetrics:
    """语气指标"""
    detail_specificity: float  # 细节具体度 0-10
    sensory_richness: float    # 感官丰富度 0-10
    voice_confidence: float    # 语气自信度 0-10
    author_presence: float     # 作者在场感 0-10
    
    @property
    def overall_strength(self) -> float:
        return (
            self.detail_specificity * 0.30 +
            self.sensory_richness * 0.25 +
            self.voice_confidence * 0.25 +
            self.author_presence * 0.20
        )
    
    @property
    def strength_level(self) -> VoiceStrength:
        score = self.overall_strength
        if score >= 8.5:
            return VoiceStrength.AUTHORITATIVE
        elif score >= 7.0:
            return VoiceStrength.STRONG
        elif score >= 5.0:
            return VoiceStrength.MODERATE
        else:
            return VoiceStrength.WEAK


@dataclass
class WeakPassage:
    """薄弱段落"""
    location: str        # 位置描述
    original_text: str   # 原文
    issue: str           # 问题描述
    suggestion: str      # 改进建议
    improved_example: Optional[str] = None  # 改进示例


@dataclass
class NarrativeVoiceResult:
    """叙事语气分析结果"""
    metrics: VoiceMetrics
    weak_passages: List[WeakPassage]
    strong_passages: List[str]  # 语气强劲的段落
    
    overall_assessment: str = ""
    improvement_priority: List[str] = field(default_factory=list)
    
    def __post_init__(self):
        strength = self.metrics.strength_level
        if strength == VoiceStrength.AUTHORITATIVE:
            self.overall_assessment = "叙事语气权威有力，读者会完全信服"
        elif strength == VoiceStrength.STRONG:
            self.overall_assessment = "叙事语气较强，有改进空间"
        elif strength == VoiceStrength.MODERATE:
            self.overall_assessment = "叙事语气中等，需要增强细节和自信"
        else:
            self.overall_assessment = "叙事语气薄弱，需要全面加强"


# ============================================================
# LLM Prompts
# ============================================================

VOICE_ANALYSIS_PROMPT = """
## 叙事语气分析 (Narrative Voice Analysis)

分析以下内容的叙事语气强度。

**评估维度**:

1. **细节具体度** (Detail Specificity)
   - 是否使用具体而非泛泛的词语？
   - 平淡: "哈罗德是个好工人"
   - 生动: "哈罗德一周在金斯顿五金店工作六天，每天弓着腰给订制的浴室装钻孔"

2. **感官丰富度** (Sensory Richness)
   - 是否调动多种感官？
   - 视觉、听觉、触觉、嗅觉、味觉

3. **语气自信度** (Voice Confidence)
   - 叙述者是否对所讲述的世界了如指掌？
   - 是否有犹豫或模糊的表达？

4. **作者在场感** (Author Presence)
   - 叙述者是否有鲜明的个性和观点？
   - 经典案例:
     - 陀思妥耶夫斯基在《罪与罚》中对主角充满同情的评价
     - 简·奥斯汀在《傲慢与偏见》中的直接见解
     - 汤姆·沃尔夫在《虚榮的篝火》中的讽刺语气

**待分析内容**:
{content}

请输出JSON格式:
```json
{
    "detail_specificity": 0-10,
    "sensory_richness": 0-10,
    "voice_confidence": 0-10,
    "author_presence": 0-10,
    "analysis": {
        "detail_examples": ["具体细节示例..."],
        "sensory_examples": ["感官描写示例..."],
        "confidence_evidence": ["自信证据..."],
        "presence_evidence": ["作者在场证据..."]
    }
}
```
"""

WEAK_PASSAGE_DETECTION_PROMPT = """
## 薄弱段落检测 (Weak Passage Detection)

识别以下内容中语气薄弱的段落，并提供改进建议。

**什么是语气薄弱**:
1. 空泛的描述，缺乏具体细节
2. 过度使用模糊词语 (好像、似乎、大概)
3. 告诉而非展示 (他很害怕 vs 他的手在颤抖)
4. 缺乏感官细节

**对比示例**:
- 薄弱: "他穿戴整洁，周末爱去远足"
- 强劲: "鯊皮套裝、鱷魚皮鞋、絲質襯衣"

**待分析内容**:
{content}

请输出JSON格式:
```json
{
    "weak_passages": [
        {
            "location": "段落位置描述",
            "original_text": "原文",
            "issue": "问题描述",
            "suggestion": "改进建议",
            "improved_example": "改进后的示例"
        }
    ],
    "strong_passages": [
        "语气强劲的段落示例..."
    ]
}
```
"""

VOICE_STRENGTHENING_PROMPT = """
## 语气强化建议 (Voice Strengthening Suggestions)

为以下内容提供语气强化的具体建议。

**强化技巧**:
1. 用具体细节替换泛泛描述
2. 增加感官细节 (不仅仅是视觉)
3. 让叙述者展现独特的观点和个性
4. 用展示替代告诉

**待强化内容**:
{content}

**当前语气指标**:
{metrics}

请输出JSON格式:
```json
{
    "priority_improvements": [
        {
            "aspect": "需要改进的方面",
            "current_state": "当前状态",
            "target_state": "目标状态",
            "specific_actions": ["具体行动..."]
        }
    ],
    "quick_wins": ["可以快速改进的点..."],
    "examples": [
        {
            "before": "改进前",
            "after": "改进后",
            "technique_used": "使用的技巧"
        }
    ]
}
```
"""


class NarrativeVoiceManager:
    """
    叙事语气管理器
    
    分析和增强叙事语气的强度
    """
    
    def __init__(self, llm=None):
        self.llm = llm
    
    async def analyze_detail_specificity(self, content: str) -> float:
        """分析细节具体度"""
        # 简化实现: 检测具体名词和形容词的密度
        specific_indicators = [
            "鲨皮", "鳄鱼皮", "丝质", "弓着腰", "金斯顿",
            # 可扩展更多具体词汇
        ]
        
        score = 5.0  # 基础分
        for indicator in specific_indicators:
            if indicator in content:
                score += 0.5
        
        return min(score, 10.0)
    
    async def measure_sensory_richness(self, content: str) -> float:
        """测量感官丰富度"""
        sensory_keywords = {
            "visual": ["看到", "望见", "颜色", "光", "暗", "闪"],
            "auditory": ["听到", "声音", "响", "静", "喊", "低语"],
            "tactile": ["触", "摸", "冷", "热", "粗糙", "光滑"],
            "olfactory": ["闻", "香", "臭", "气味", "芬芳"],
            "gustatory": ["尝", "甜", "苦", "辣", "味道"]
        }
        
        senses_found = 0
        for sense, keywords in sensory_keywords.items():
            if any(kw in content for kw in keywords):
                senses_found += 1
        
        return min(senses_found * 2, 10.0)
    
    async def evaluate_voice_confidence(self, content: str) -> float:
        """评估语气自信度"""
        # 检测削弱语气的词
        weak_words = ["好像", "似乎", "大概", "可能", "也许", "或许", "不知道"]
        
        score = 8.0  # 基础分
        for word in weak_words:
            count = content.count(word)
            score -= count * 0.5
        
        return max(score, 0.0)
    
    async def detect_author_presence(self, content: str) -> float:
        """检测作者在场感"""
        # 检测叙述者观点的标志
        presence_indicators = [
            "显然", "无疑", "毫无疑问", "事实上",
            "不得不说", "值得注意的是"
        ]
        
        score = 5.0
        for indicator in presence_indicators:
            if indicator in content:
                score += 1.0
        
        return min(score, 10.0)
    
    async def analyze_voice(self, content: str) -> VoiceMetrics:
        """分析叙事语气"""
        if self.llm:
            prompt = VOICE_ANALYSIS_PROMPT.format(content=content)
            response = await self.llm.ainvoke(prompt)
            result = json.loads(response.content)
            
            return VoiceMetrics(
                detail_specificity=result["detail_specificity"],
                sensory_richness=result["sensory_richness"],
                voice_confidence=result["voice_confidence"],
                author_presence=result["author_presence"]
            )
        else:
            # 使用简化的本地分析
            return VoiceMetrics(
                detail_specificity=await self.analyze_detail_specificity(content),
                sensory_richness=await self.measure_sensory_richness(content),
                voice_confidence=await self.evaluate_voice_confidence(content),
                author_presence=await self.detect_author_presence(content)
            )
    
    async def identify_weak_passages(self, content: str) -> List[WeakPassage]:
        """识别语气薄弱段落"""
        if self.llm is None:
            return self._mock_weak_passages()

        prompt = WEAK_PASSAGE_DETECTION_PROMPT.format(content=content)
        response = await self.llm.ainvoke(prompt)
        result = json.loads(response.content)

        # 缓存 strong_passages 供后续使用
        self._last_strong_passages = result.get("strong_passages", [])

        return [
            WeakPassage(
                location=p["location"],
                original_text=p["original_text"],
                issue=p["issue"],
                suggestion=p["suggestion"],
                improved_example=p.get("improved_example")
            )
            for p in result.get("weak_passages", [])
        ]

    async def extract_strong_passages(self, content: str) -> List[str]:
        """
        提取语气强劲的段落

        从 LLM 分析响应中提取被标记为优秀/精彩/强劲的段落。
        如果已有缓存结果则直接返回，否则执行新的分析。

        Returns:
            List[str]: 语气强劲的段落列表
        """
        # 如果有缓存的结果，直接返回
        if hasattr(self, '_last_strong_passages') and self._last_strong_passages:
            return self._last_strong_passages

        if self.llm is None:
            return self._mock_strong_passages()

        # 执行新的分析以获取 strong_passages
        prompt = WEAK_PASSAGE_DETECTION_PROMPT.format(content=content)
        response = await self.llm.ainvoke(prompt)
        result = json.loads(response.content)

        strong_passages = result.get("strong_passages", [])
        self._last_strong_passages = strong_passages

        return strong_passages
    
    async def suggest_voice_strengthening(
        self, 
        content: str,
        metrics: VoiceMetrics
    ) -> List[str]:
        """生成语气强化建议"""
        suggestions = []
        
        if metrics.detail_specificity < 7:
            suggestions.append("🔍 增加具体细节: 用'鲨皮套装'替代'穿戴整洁'")
        
        if metrics.sensory_richness < 7:
            suggestions.append("👃 丰富感官描写: 不要只依赖视觉，加入听觉、触觉、嗅觉")
        
        if metrics.voice_confidence < 7:
            suggestions.append("💪 增强语气自信: 减少'好像'、'似乎'等模糊词")
        
        if metrics.author_presence < 7:
            suggestions.append("✍️ 强化作者在场: 让叙述者展现独特观点和评价")
        
        return suggestions
    
    async def analyze_full(self, content: str) -> NarrativeVoiceResult:
        """完整语气分析"""
        metrics = await self.analyze_voice(content)
        weak_passages = await self.identify_weak_passages(content)
        # identify_weak_passages 已缓存 strong_passages，直接提取
        strong_passages = await self.extract_strong_passages(content)
        suggestions = await self.suggest_voice_strengthening(content, metrics)

        return NarrativeVoiceResult(
            metrics=metrics,
            weak_passages=weak_passages,
            strong_passages=strong_passages,
            improvement_priority=suggestions
        )
    
    # ============================================================
    # Mock methods
    # ============================================================
    
    def _mock_weak_passages(self) -> List[WeakPassage]:
        """降级方法: 返回薄弱段落示例"""
        return [
            WeakPassage(
                location="开头段落",
                original_text="他是一个好人",
                issue="过于泛泛，缺乏具体细节",
                suggestion="用具体行为展示而非直接告诉",
                improved_example="他每天早起给邻居老太太送牛奶，从不收钱"
            )
        ]

    def _mock_strong_passages(self) -> List[str]:
        """
        降级方法: 返回语气强劲段落示例

        当 LLM 不可用时，返回示例数据供测试和开发使用。
        """
        return [
            "鲨皮套装、鳄鱼皮鞋、丝质衬衣——他站在那里，像一尊用钱堆砌的雕像。",
            "她弓着腰在金斯顿五金店工作了六天，每天给订制的浴室装钻孔，"
            "手指上的茧子比她的结婚戒指还厚。"
        ]
