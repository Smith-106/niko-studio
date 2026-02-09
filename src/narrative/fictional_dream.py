"""
虚构梦境引擎 (Fictional Dream Engine)

基于弗雷《让劲爆小说飞起来》的四阶段沉浸理论:
1. 同情 (Sympathy) - 角色困境展示
2. 认同 (Identification) - 目标支持建立
3. 移情 (Empathy) - 感官细节沉浸
4. 身临其境 (Immersion) - 内心冲突参与
"""

from enum import Enum
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
import json


class ImmersionStage(Enum):
    """沉浸阶段枚举"""
    SYMPATHY = "sympathy"           # 同情 - 情感介入的起点
    IDENTIFICATION = "identification"  # 认同 - 支持角色的目标
    EMPATHY = "empathy"             # 移情 - 感同身受的体验
    IMMERSION = "immersion"         # 身临其境 - 完全沉浸状态


@dataclass
class ImmersionScore:
    """单阶段沉浸评分"""
    stage: ImmersionStage
    score: float  # 0-10
    evidence: List[str] = field(default_factory=list)  # 支持证据
    issues: List[str] = field(default_factory=list)    # 发现的问题
    suggestions: List[str] = field(default_factory=list)  # 改进建议


@dataclass
class FictionalDreamResult:
    """虚构梦境综合评估结果"""
    sympathy_score: ImmersionScore
    identification_score: ImmersionScore
    empathy_score: ImmersionScore
    immersion_score: ImmersionScore
    
    overall_score: float = 0.0  # 0-100
    dream_strength: str = ""    # WEAK/MODERATE/STRONG/HYPNOTIC
    critical_gaps: List[str] = field(default_factory=list)
    
    def __post_init__(self):
        """计算综合分数"""
        # 权重: 同情20%, 认同20%, 移情30%, 身临其境30%
        self.overall_score = (
            self.sympathy_score.score * 0.20 +
            self.identification_score.score * 0.20 +
            self.empathy_score.score * 0.30 +
            self.immersion_score.score * 0.30
        ) * 10
        
        # 确定梦境强度
        if self.overall_score >= 85:
            self.dream_strength = "HYPNOTIC"  # 催眠级
        elif self.overall_score >= 70:
            self.dream_strength = "STRONG"    # 强烈
        elif self.overall_score >= 50:
            self.dream_strength = "MODERATE"  # 中等
        else:
            self.dream_strength = "WEAK"      # 薄弱


# ============================================================
# LLM Prompts
# ============================================================

SYMPATHY_EVALUATION_PROMPT = """
## 同情评估 (Sympathy Evaluation)

分析以下内容，评估是否成功激发了读者对角色的同情。

**评估要点**:
1. 角色是否被置于困境中？(贫穷、羞辱、孤单、危险)
2. 困境是否具体可感？
3. 读者是否会对角色产生怜悯？

**经典案例参考**:
- 《悲惨世界》: 冉·阿让有钱却无人接待，忍饥挨饿
- 《魔女嘉莉》: 嘉莉因相貌丑陋而遭人排挤
- 《傲慢与偏见》: 伊丽莎白在舞会上被达西公开羞辱

**待评估内容**:
{content}

**角色信息**:
{character_info}

请输出JSON格式:
```json
{
    "score": 0-10,
    "evidence": ["找到的同情触发点..."],
    "issues": ["缺失的同情元素..."],
    "suggestions": ["如何增强同情感..."]
}
```
"""

IDENTIFICATION_EVALUATION_PROMPT = """
## 认同评估 (Identification Evaluation)

分析以下内容，评估读者是否会认同并支持角色的目标。

**评估要点**:
1. 角色的目标是否清晰？
2. 目标是否值得支持？(正义、合理、可理解)
3. 角色是否展现了追求目标的勇气？

**经典案例参考**:
- 《教父》: 读者认同柯里昂为受害者伸张正义的目标
- 《飘》: 读者支持斯嘉丽在战争废墟中求生的目标

**待评估内容**:
{content}

**角色目标**:
{character_goal}

请输出JSON格式:
```json
{
    "score": 0-10,
    "evidence": ["目标认同点..."],
    "issues": ["目标不清晰或不值得支持的地方..."],
    "suggestions": ["如何增强目标认同..."]
}
```
"""

EMPATHY_EVALUATION_PROMPT = """
## 移情评估 (Empathy Evaluation)

分析以下内容，评估是否通过感官细节让读者真正体会角色所感。

**评估要点**:
1. 是否有丰富的感官描写？(视觉、听觉、触觉、嗅觉、味觉)
2. 感官细节是否与角色情感相连？
3. 读者能否通过细节"进入"角色的身体？

**经典案例参考**:
- 《魔女嘉莉》: 通过胸罩和连衣裙的细节，让读者体会嘉莉的羞愧与兴奋
- 《红色英勇勋章》: 通过餐具盒撞击大腿、清晨湿雾等细节，让读者进入战场

**待评估内容**:
{content}

请输出JSON格式:
```json
{
    "score": 0-10,
    "sensory_breakdown": {
        "visual": "视觉描写分析...",
        "auditory": "听觉描写分析...",
        "tactile": "触觉描写分析...",
        "olfactory": "嗅觉描写分析...",
        "gustatory": "味觉描写分析..."
    },
    "evidence": ["成功的移情细节..."],
    "issues": ["感官描写缺失或薄弱处..."],
    "suggestions": ["如何增强感官沉浸..."]
}
```
"""

IMMERSION_EVALUATION_PROMPT = """
## 身临其境评估 (Immersion Evaluation)

分析以下内容，评估是否通过内心冲突让读者完全沉浸。

**评估要点**:
1. 角色是否面临艰难的内心抉择？
2. 冲突双方力量是否相当？(让读者真正纠结)
3. 读者是否被迫参与到角色的决策中？

**经典案例参考**:
- 《魔女嘉莉》: "他会来吗？这可能是一个精心策划的笑话..."
- 《罪与罚》: "我难道能做吗？不，这太荒谬、太反常了！"

**待评估内容**:
{content}

请输出JSON格式:
```json
{
    "score": 0-10,
    "internal_conflicts": ["发现的内心冲突..."],
    "conflict_intensity": "冲突强度评估...",
    "reader_participation": "读者参与度评估...",
    "evidence": ["成功的沉浸元素..."],
    "issues": ["内心冲突缺失或薄弱处..."],
    "suggestions": ["如何增强内心冲突..."]
}
```
"""


class FictionalDreamEngine:
    """
    虚构梦境引擎
    
    评估内容是否成功构建了让读者沉浸的"虚构梦境"
    """
    
    def __init__(self, llm=None):
        self.llm = llm
    
    async def evaluate_sympathy(
        self, 
        content: str, 
        character_info: Dict[str, Any]
    ) -> ImmersionScore:
        """
        评估同情阶段
        
        检查是否成功通过展示角色困境激发读者同情
        """
        if self.llm is None:
            return self._mock_sympathy_score()
        
        prompt = SYMPATHY_EVALUATION_PROMPT.format(
            content=content,
            character_info=json.dumps(character_info, ensure_ascii=False)
        )
        
        response = await self.llm.ainvoke(prompt)
        result = json.loads(response.content)
        
        return ImmersionScore(
            stage=ImmersionStage.SYMPATHY,
            score=result["score"],
            evidence=result.get("evidence", []),
            issues=result.get("issues", []),
            suggestions=result.get("suggestions", [])
        )
    
    async def evaluate_identification(
        self, 
        content: str, 
        character_goal: str
    ) -> ImmersionScore:
        """
        评估认同阶段
        
        检查读者是否会支持角色的目标
        """
        if self.llm is None:
            return self._mock_identification_score()
        
        prompt = IDENTIFICATION_EVALUATION_PROMPT.format(
            content=content,
            character_goal=character_goal
        )
        
        response = await self.llm.ainvoke(prompt)
        result = json.loads(response.content)
        
        return ImmersionScore(
            stage=ImmersionStage.IDENTIFICATION,
            score=result["score"],
            evidence=result.get("evidence", []),
            issues=result.get("issues", []),
            suggestions=result.get("suggestions", [])
        )
    
    async def evaluate_empathy(self, content: str) -> ImmersionScore:
        """
        评估移情阶段
        
        检查感官细节是否足够让读者感同身受
        """
        if self.llm is None:
            return self._mock_empathy_score()
        
        prompt = EMPATHY_EVALUATION_PROMPT.format(content=content)
        
        response = await self.llm.ainvoke(prompt)
        result = json.loads(response.content)
        
        return ImmersionScore(
            stage=ImmersionStage.EMPATHY,
            score=result["score"],
            evidence=result.get("evidence", []),
            issues=result.get("issues", []),
            suggestions=result.get("suggestions", [])
        )
    
    async def evaluate_immersion(self, content: str) -> ImmersionScore:
        """
        评估身临其境阶段
        
        检查内心冲突是否足够让读者完全沉浸
        """
        if self.llm is None:
            return self._mock_immersion_score()
        
        prompt = IMMERSION_EVALUATION_PROMPT.format(content=content)
        
        response = await self.llm.ainvoke(prompt)
        result = json.loads(response.content)
        
        return ImmersionScore(
            stage=ImmersionStage.IMMERSION,
            score=result["score"],
            evidence=result.get("evidence", []),
            issues=result.get("issues", []),
            suggestions=result.get("suggestions", [])
        )
    
    async def evaluate_full(
        self,
        content: str,
        character_info: Dict[str, Any],
        character_goal: str
    ) -> FictionalDreamResult:
        """
        完整评估虚构梦境四阶段
        """
        sympathy = await self.evaluate_sympathy(content, character_info)
        identification = await self.evaluate_identification(content, character_goal)
        empathy = await self.evaluate_empathy(content)
        immersion = await self.evaluate_immersion(content)
        
        result = FictionalDreamResult(
            sympathy_score=sympathy,
            identification_score=identification,
            empathy_score=empathy,
            immersion_score=immersion
        )
        
        # 识别关键差距
        for score in [sympathy, identification, empathy, immersion]:
            if score.score < 5:
                result.critical_gaps.append(
                    f"{score.stage.value}: 分数过低 ({score.score}/10)"
                )
        
        return result
    
    # ============================================================
    # Mock methods for testing
    # ============================================================
    
    def _mock_sympathy_score(self) -> ImmersionScore:
        return ImmersionScore(
            stage=ImmersionStage.SYMPATHY,
            score=7.0,
            evidence=["角色面临困境"],
            issues=[],
            suggestions=["可以增加更多困境细节"]
        )
    
    def _mock_identification_score(self) -> ImmersionScore:
        return ImmersionScore(
            stage=ImmersionStage.IDENTIFICATION,
            score=7.0,
            evidence=["目标清晰"],
            issues=[],
            suggestions=["可以强化目标的正义性"]
        )
    
    def _mock_empathy_score(self) -> ImmersionScore:
        return ImmersionScore(
            stage=ImmersionStage.EMPATHY,
            score=6.0,
            evidence=["有视觉描写"],
            issues=["触觉描写不足"],
            suggestions=["增加更多感官细节"]
        )
    
    def _mock_immersion_score(self) -> ImmersionScore:
        return ImmersionScore(
            stage=ImmersionStage.IMMERSION,
            score=6.0,
            evidence=["存在内心冲突"],
            issues=["冲突不够激烈"],
            suggestions=["增强内心挣扎的描写"]
        )
