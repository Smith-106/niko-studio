"""
预设验证器 (Premise Validator)

基于弗雷《让劲爆小说飞起来》的预设理论:
- 预设 = 角色特质 + 冲突 → 结局
- 预设是故事的蓝图和验证工具
"""

from enum import Enum
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
import json


class PremiseType(Enum):
    """预设类型"""
    CHAIN_REACTION = "chain_reaction"  # 连锁反应式: 初始事件引发一连串后果
    REVERSAL = "reversal"              # 反向式: 两种力量竞争，一方胜出
    SITUATIONAL = "situational"        # 情景式: 特定环境对所有角色的影响


@dataclass
class Premise:
    """预设"""
    character_trait: str     # 角色特质 (如: 偏执的爱、勇敢与理想主义)
    conflict: str           # 冲突 (如: 经济困难、正义与邪恶)
    conclusion: str         # 结局 (如: 走向死亡、战胜邪恶)
    premise_type: PremiseType
    full_statement: str     # 完整预设陈述 (如: "偏执的爱使人走向死亡")
    
    @classmethod
    def from_statement(cls, statement: str, premise_type: PremiseType = PremiseType.REVERSAL) -> "Premise":
        """从陈述创建预设 (简化解析)"""
        # 实际使用时应由 LLM 解析
        return cls(
            character_trait="",
            conflict="",
            conclusion="",
            premise_type=premise_type,
            full_statement=statement
        )


@dataclass
class PremiseAlignment:
    """场景与预设的对齐情况"""
    scene_id: str
    alignment_score: float  # 0-10
    contribution: str       # 该场景如何证明预设
    evidence: List[str] = field(default_factory=list)
    drift_detected: bool = False
    drift_description: Optional[str] = None


@dataclass
class PremiseValidationResult:
    """预设验证结果"""
    premise: Premise
    scene_alignments: List[PremiseAlignment]
    
    overall_alignment: float = 0.0  # 0-100
    proof_progress: float = 0.0     # 预设证明进度 0-100%
    drift_count: int = 0
    
    critical_issues: List[str] = field(default_factory=list)
    realignment_suggestions: List[str] = field(default_factory=list)
    
    def __post_init__(self):
        if self.scene_alignments:
            self.overall_alignment = sum(a.alignment_score for a in self.scene_alignments) / len(self.scene_alignments) * 10
            self.drift_count = sum(1 for a in self.scene_alignments if a.drift_detected)


# ============================================================
# LLM Prompts
# ============================================================

PREMISE_PARSING_PROMPT = """
## 预设解析 (Premise Parsing)

将以下故事预设解析为结构化格式。

**预设定义**:
预设 = 角色特质 + 冲突 → 结局
公式: "X 导致 Y" 或 "X vs Y = Z"

**预设类型**:
1. 连锁反应式 (chain_reaction): 初始事件引发一连串后果
   例: "一个普通人意外获得巨款后...一夜成名...失去家庭...回归平凡才找到幸福"

2. 反向式 (reversal): 两种力量竞争，一方胜出
   例: "酗酒会击垮爱情" (酗酒 vs 爱情 = 爱情失败)

3. 情景式 (situational): 特定环境对所有角色的影响
   例: 战争如何将温和的人逼疯，将严厉的人变得残暴

**待解析预设**:
{premise_statement}

请输出JSON格式:
```json
{
    "character_trait": "角色特质",
    "conflict": "冲突",
    "conclusion": "结局",
    "premise_type": "chain_reaction/reversal/situational",
    "interpretation": "预设解读"
}
```
"""

SCENE_ALIGNMENT_PROMPT = """
## 场景-预设对齐验证 (Scene-Premise Alignment)

验证以下场景是否在证明故事预设。

**核心问题**: 这个场景的发生，是否有助于证明预设？

**故事预设**:
{premise}

**场景内容**:
{scene_content}

**场景信息**:
- 场景ID: {scene_id}
- 场景目标: {scene_objective}

请输出JSON格式:
```json
{
    "alignment_score": 0-10,
    "contribution": "该场景如何证明预设",
    "evidence": ["具体证据..."],
    "drift_detected": true/false,
    "drift_description": "如果偏离，描述偏离情况",
    "suggestions": ["如何加强对齐..."]
}
```
"""

PREMISE_PROGRESS_PROMPT = """
## 预设证明进度追踪 (Premise Proof Progress)

根据已完成的场景，评估预设的证明进度。

**故事预设**:
{premise}

**已完成场景摘要**:
{scenes_summary}

请输出JSON格式:
```json
{
    "proof_progress": 0-100,
    "current_stage": "当前证明阶段描述",
    "remaining_elements": ["还需要证明的元素"],
    "trajectory": "如果继续，预设能否被充分证明？",
    "critical_issues": ["关键问题..."],
    "suggestions": ["建议..."]
}
```
"""


class PremiseValidator:
    """
    预设验证器
    
    确保故事情节始终在证明预设
    """
    
    def __init__(self, llm=None):
        self.llm = llm
        self.current_premise: Optional[Premise] = None
        self.scene_alignments: List[PremiseAlignment] = []
    
    async def parse_premise(self, premise_statement: str) -> Premise:
        """
        解析预设陈述
        
        将自然语言的预设转换为结构化格式
        """
        if self.llm is None:
            return Premise.from_statement(premise_statement)
        
        prompt = PREMISE_PARSING_PROMPT.format(premise_statement=premise_statement)
        response = await self.llm.ainvoke(prompt)
        result = json.loads(response.content)
        
        premise = Premise(
            character_trait=result["character_trait"],
            conflict=result["conflict"],
            conclusion=result["conclusion"],
            premise_type=PremiseType(result["premise_type"]),
            full_statement=premise_statement
        )
        
        self.current_premise = premise
        return premise
    
    async def validate_scene(
        self,
        scene_id: str,
        scene_content: str,
        scene_objective: str = ""
    ) -> PremiseAlignment:
        """
        验证场景是否证明预设
        """
        if self.current_premise is None:
            raise ValueError("请先使用 parse_premise() 设置预设")
        
        if self.llm is None:
            return self._mock_alignment(scene_id)
        
        prompt = SCENE_ALIGNMENT_PROMPT.format(
            premise=self.current_premise.full_statement,
            scene_content=scene_content,
            scene_id=scene_id,
            scene_objective=scene_objective
        )
        response = await self.llm.ainvoke(prompt)
        result = json.loads(response.content)
        
        alignment = PremiseAlignment(
            scene_id=scene_id,
            alignment_score=result["alignment_score"],
            contribution=result["contribution"],
            evidence=result.get("evidence", []),
            drift_detected=result.get("drift_detected", False),
            drift_description=result.get("drift_description")
        )
        
        self.scene_alignments.append(alignment)
        return alignment
    
    async def track_premise_progress(
        self,
        scenes_summary: str
    ) -> Dict[str, Any]:
        """
        追踪预设证明进度
        """
        if self.current_premise is None:
            raise ValueError("请先使用 parse_premise() 设置预设")
        
        if self.llm is None:
            return {
                "proof_progress": 50.0,
                "current_stage": "发展中",
                "remaining_elements": ["需要更多冲突升级"],
                "trajectory": "正在正确轨道上"
            }
        
        prompt = PREMISE_PROGRESS_PROMPT.format(
            premise=self.current_premise.full_statement,
            scenes_summary=scenes_summary
        )
        response = await self.llm.ainvoke(prompt)
        return json.loads(response.content)
    
    def detect_premise_drift(self) -> List[PremiseAlignment]:
        """
        检测预设偏离
        
        返回所有偏离预设的场景
        """
        return [a for a in self.scene_alignments if a.drift_detected]
    
    def get_validation_result(self) -> PremiseValidationResult:
        """获取完整验证结果"""
        if self.current_premise is None:
            raise ValueError("请先使用 parse_premise() 设置预设")
        
        result = PremiseValidationResult(
            premise=self.current_premise,
            scene_alignments=self.scene_alignments
        )
        
        # 生成关键问题
        drifts = self.detect_premise_drift()
        if drifts:
            result.critical_issues.append(f"发现 {len(drifts)} 个场景偏离预设")
            for drift in drifts:
                if drift.drift_description:
                    result.realignment_suggestions.append(
                        f"场景 {drift.scene_id}: {drift.drift_description}"
                    )
        
        return result
    
    def suggest_realignment(self, scene_id: str) -> List[str]:
        """
        建议重新对齐
        
        为偏离预设的场景提供修改建议
        """
        alignment = next(
            (a for a in self.scene_alignments if a.scene_id == scene_id), 
            None
        )
        
        if alignment is None:
            return ["场景未找到"]
        
        if not alignment.drift_detected:
            return ["场景与预设对齐良好，无需修改"]
        
        suggestions = [
            f"当前贡献: {alignment.contribution}",
            f"偏离描述: {alignment.drift_description}",
            "建议修改方向:",
            f"- 确保场景推进预设: {self.current_premise.full_statement if self.current_premise else ''}",
            "- 检查角色行为是否符合预设中的角色特质",
            "- 确保冲突指向预设中的结局"
        ]
        
        return suggestions
    
    def reset(self):
        """重置验证器"""
        self.current_premise = None
        self.scene_alignments = []
    
    # ============================================================
    # Mock methods
    # ============================================================
    
    def _mock_alignment(self, scene_id: str) -> PremiseAlignment:
        return PremiseAlignment(
            scene_id=scene_id,
            alignment_score=7.0,
            contribution="场景推进了主要冲突",
            evidence=["冲突升级", "角色面临选择"],
            drift_detected=False
        )
