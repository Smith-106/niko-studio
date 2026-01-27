"""
Critic Agent - 批评家

负责内容质量评估，整合8个编辑维度 + LOCK系统 + 网文爽点机制。
采用 Reflection Pattern + LLM-as-a-Judge。
"""

from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field
import json


# ============================================================
# Interface Layer (接口层) - Pydantic 数据模型
# ============================================================

class DimensionScore(BaseModel):
    """单维度评分"""
    dimension: str = Field(..., description="评估维度名称")
    score: float = Field(..., ge=0, le=10, description="分数 0-10")
    weight: float = Field(..., ge=0, le=1, description="权重 0-1")
    feedback: str = Field(..., description="反馈说明")
    issues: List[str] = Field(default_factory=list, description="发现的问题")


class LOCKSceneCheck(BaseModel):
    """单场景LOCK检查"""
    L_exhibited: bool = Field(..., description="是否展现了主角魅力")
    O_advanced: bool = Field(..., description="是否推进了主角目标")
    C_present: bool = Field(..., description="是否有充分冲突")
    K_hook: Optional[str] = Field(None, description="章节钩子（仅结尾场景）")


class ShuangDianCheck(BaseModel):
    """爽点机制检查"""
    setup_score: int = Field(..., ge=0, le=3, description="铺垫分")
    setup_feedback: str
    payoff_score: int = Field(..., ge=0, le=4, description="爆发分")
    payoff_feedback: str
    reaction_score: int = Field(..., ge=0, le=3, description="反馈分")
    reaction_feedback: str
    
    @property
    def total_score(self) -> int:
        return self.setup_score + self.payoff_score + self.reaction_score
    
    @property
    def is_effective(self) -> bool:
        return self.total_score >= 7


class RevisionInstruction(BaseModel):
    """修改指令"""
    target: str = Field(..., description="需修改的位置/段落")
    issue: str = Field(..., description="问题描述")
    suggestion: str = Field(..., description="具体修改建议")
    priority: Literal["high", "medium", "low"] = Field(..., description="优先级")


class LOCKDimensionResult(BaseModel):
    """单个LOCK维度的评估结果"""
    score: int = Field(..., ge=0, le=10, description="0-10分")
    reasoning: str = Field(..., description="CoT推理过程")
    improvement: Optional[str] = Field(None, description="改进建议，满分时为null")


class LOCKAnalysisResult(BaseModel):
    """完整LOCK分析 - 按网文权重设计"""
    L: LOCKDimensionResult
    O: LOCKDimensionResult
    C: LOCKDimensionResult
    K: LOCKDimensionResult
    
    @property
    def weighted_score(self) -> float:
        """
        按网文权重计算LOCK总分 (满分40)
        权重: L=20%, O=20%, C=40%, K=20%
        """
        return (
            self.L.score * 0.20 +
            self.O.score * 0.20 +
            self.C.score * 0.40 +  # 冲突是网文生命线!
            self.K.score * 0.20
        ) * 4
    
    @property
    def c_score_sufficient(self) -> bool:
        """冲突分数是否足够 (>=7 才能自动通过)"""
        return self.C.score >= 7
    
    @property
    def has_critical_failure(self) -> bool:
        """是否有任一维度严重不足 (<=2)"""
        return any(getattr(self, dim).score <= 2 for dim in ['L', 'O', 'C', 'K'])


class CriticOutput(BaseModel):
    """Critic Agent 输出"""
    
    # 元数据
    agent_role: str = Field(default="Critic_LOCK_Judge")
    evaluation_timestamp: Optional[str] = None
    
    # LOCK分析 (核心!)
    lock_analysis: Optional[LOCKAnalysisResult] = None
    
    # 决策
    decision: Literal["APPROVED", "HUMAN_REVIEW", "REVISE", "REWRITE"]
    decision_reason: str
    
    # 分数汇总
    total_score: float = Field(..., ge=0, le=100, description="总分 0-100")
    lock_score: float = Field(..., ge=0, le=40, description="LOCK分 0-40")
    style_score: float = Field(..., ge=0, le=35, description="风格分 0-35")
    logic_score: float = Field(..., ge=0, le=25, description="逻辑分 0-25")
    
    # 维度详情
    dimension_details: List[DimensionScore]
    
    # LOCK场景检查 (旧版兼容)
    lock_scene_check: Optional[LOCKSceneCheck] = None
    
    # 爽点检查（仅适用于高潮场景）
    shuangdian_check: Optional[ShuangDianCheck] = None
    
    # 建议
    suggestions_high: List[str] = Field(default_factory=list, description="必须修改")
    suggestions_medium: List[str] = Field(default_factory=list, description="建议修改")
    suggestions_low: List[str] = Field(default_factory=list, description="可选优化")
    
    # 修改指令
    revision_instructions: List[RevisionInstruction] = Field(default_factory=list)
    
    # 给Writer的反馈
    actionable_feedback: str = Field(default="", description="结构化的修改建议")



# ============================================================
# Cognitive Layer (认知层) - 8维度评估 + 业务逻辑
# ============================================================

CRITIC_SYSTEM_PROMPT = """
你是一位资深的网文编辑和质量评估专家，拥有「一票否决权」。
你的任务是对写作内容进行多维度评估，并提供具体的改进建议。

## 评估维度与权重

### LOCK系统评估 (权重40%)

**L - Lead (25%)**
检查本场景是否展现了主角魅力：
- 主角的行为是否符合其核心渴望？
- 是否展现了独特的性格特征？

**O - Objective (25%)**
检查本场景是否推进了主角目标：
- 读者是否清楚主角想要什么？
- 距离目标更近还是更远了？

**C - Confrontation (30%)**
检查本场景的冲突：
- 冲突是否足够强烈？
- 来源是否多样（外部/内部/关系）？
- 是否比上一场景升级？

**K - Knockout (20%)**
检查章节钩子（仅结尾场景）：
- 是否有让读者想继续的驱动力？
- 是否有情感冲击或悬念？

### 风格质量评估 (权重35%)

**感官描写 (20%)**
- 是否涵盖多种感官（视/听/触/嗅/味）？
- 是否避免了纯视觉描写？
- 感官是否自然融入叙事？

**狄更斯风格 (20%)**
- 是否使用了「万物有灵」技法？
- 环境是否映射角色心理？
- 是否避免了直白心理描写？
✅ "煤气灯的火焰畏缩了一下"
❌ "他感到非常害怕"

**对话质量 (25%)**
- 是否自然口语化？
- 是否包含潜台词？
- 是否避免了说明书式对话？
- 是否配合动作和表情？

**人设一致性 (20%)**
- 角色行为是否符合之前设定？
- 说话方式是否一致？

**节奏控制 (15%)**
- 紧张场景是否使用短句？
- 舒缓场景是否有细节铺陈？

### 逻辑与体验评估 (权重25%)

**剧情逻辑 (35%)**
- 因果关系是否清晰？
- 人物行为动机是否合理？

**读者体验 (35%)**
- 是否能让读者沉浸？
- 是否有继续阅读的欲望？

**设定一致性 (30%)**
- 是否与已建立的世界观一致？

## 爽点机制检查 (高潮场景专用)

**Setup 铺垫**
- 是否有足够的压抑或期待感？
- 读者是否"憋了一口气"？

**Payoff 爆发**
- 主角的反击是否出人意料？
- 读者是否感到"爽快"？

**Reaction 反馈**
- 围观者/反派是否给予了震惊反应？
- 是否强化了爽感？

## 决策规则

- **APPROVED**: 总分 >= 85，质量优秀
- **HUMAN_REVIEW**: 70 <= 总分 < 85，建议人工审阅
- **REVISE**: 50 <= 总分 < 70，需要修改
- **REWRITE**: 总分 < 50，需要重写

## 输出要求

1. 对每个维度给出0-10分和具体反馈
2. 计算加权总分
3. 根据分数给出决策
4. 列出所有问题和修改建议
5. 生成结构化的 actionable_feedback
"""


CRITIC_USER_PROMPT_TEMPLATE = """
## 待审核内容

{draft_content}

## 场景信息

- 场景ID: {scene_id}
- 视角人物: {pov_character}
- 场景目标: {scene_objective}
- 核心冲突: {scene_conflict}
- 预期结果: {scene_outcome}
- 是否为高潮场景: {is_climax}

## 角色档案

{character_profiles}

## 世界观设定

{world_settings}

## 禁用词列表

{forbidden_words}

## 请进行多维度评估并输出 CriticOutput JSON

{format_instructions}
"""


# ============================================================
# Implementation (实现)
# ============================================================

class CriticAgent:
    """批评家 Agent"""
    
    # 禁用词列表
    FORBIDDEN_WORDS = [
        "突然", "不禁", "竟然", "居然", "忍不住"
    ]
    
    # 评估维度配置 - LOCK权重调整: C=40%!
    DIMENSION_CONFIG = {
        # LOCK系统 (40%) - 注意C的权重是其他的2倍
        "L_lead": {"weight": 0.08, "category": "lock"},         # 20% of 40% = 8%
        "O_objective": {"weight": 0.08, "category": "lock"},    # 20% of 40% = 8%
        "C_confrontation": {"weight": 0.16, "category": "lock"}, # 40% of 40% = 16%!!
        "K_knockout": {"weight": 0.08, "category": "lock"},      # 20% of 40% = 8%
        
        # 风格质量 (35%)
        "sensory_balance": {"weight": 0.07, "category": "style"},
        "dickensian_style": {"weight": 0.07, "category": "style"},
        "dialogue_quality": {"weight": 0.09, "category": "style"},
        "character_consistency": {"weight": 0.07, "category": "style"},
        "rhythm_control": {"weight": 0.05, "category": "style"},
        
        # 逻辑与体验 (25%)
        "plot_logic": {"weight": 0.09, "category": "logic"},
        "reader_experience": {"weight": 0.09, "category": "logic"},
        "worldbuilding_consistency": {"weight": 0.07, "category": "logic"},
    }
    
    def __init__(self, llm):
        self.llm = llm
    
    async def review(
        self,
        draft_content: str,
        scene_card: Dict[str, Any],
        character_profiles: List[Dict[str, Any]],
        world_settings: Dict[str, Any]
    ) -> CriticOutput:
        """
        审核内容
        
        Args:
            draft_content: 草稿内容
            scene_card: 场景卡片
            character_profiles: 角色档案
            world_settings: 世界观设定
            
        Returns:
            CriticOutput: 审核结果
        """
        from langchain.prompts import ChatPromptTemplate
        from langchain_core.output_parsers import PydanticOutputParser
        
        parser = PydanticOutputParser(pydantic_object=CriticOutput)
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", CRITIC_SYSTEM_PROMPT),
            ("human", CRITIC_USER_PROMPT_TEMPLATE)
        ])
        
        chain = prompt | self.llm | parser
        
        result = await chain.ainvoke({
            "draft_content": draft_content,
            "scene_id": scene_card.get("scene_id", ""),
            "pov_character": scene_card.get("pov_character", ""),
            "scene_objective": scene_card.get("objective", ""),
            "scene_conflict": scene_card.get("conflict", ""),
            "scene_outcome": scene_card.get("outcome", ""),
            "is_climax": scene_card.get("structural_function", "") in ["Climax", "Door2"],
            "character_profiles": json.dumps(character_profiles, ensure_ascii=False, indent=2),
            "world_settings": json.dumps(world_settings, ensure_ascii=False, indent=2),
            "forbidden_words": ", ".join(self.FORBIDDEN_WORDS),
            "format_instructions": parser.get_format_instructions()
        })
        
        # 补充规则检查
        result = self._apply_rule_checks(result, draft_content)
        
        return result
    
    def _apply_rule_checks(
        self, 
        result: CriticOutput, 
        content: str
    ) -> CriticOutput:
        """应用确定性规则检查"""
        import re
        
        # 禁用词检查
        forbidden_found = []
        for word in self.FORBIDDEN_WORDS:
            if word in content:
                count = content.count(word)
                forbidden_found.append(f"「{word}」出现{count}次")
        
        if forbidden_found:
            result.suggestions_high.insert(0, f"发现禁用词: {', '.join(forbidden_found)}")
            
            # 扣分
            for detail in result.dimension_details:
                if detail.dimension == "dialogue_quality":
                    detail.score = max(0, detail.score - len(forbidden_found))
                    detail.issues.extend(forbidden_found)
        
        # 重新计算总分
        result.total_score = self._calculate_total_score(result.dimension_details)
        
        # 重新决策 (传入完整result以检查LOCK分析)
        result.decision = self._make_decision(result)
        
        return result
    
    def _calculate_total_score(self, dimensions: List[DimensionScore]) -> float:
        """计算加权总分"""
        total = 0.0
        for dim in dimensions:
            if dim.dimension in self.DIMENSION_CONFIG:
                weight = self.DIMENSION_CONFIG[dim.dimension]["weight"]
                # 归一化到100分制
                total += dim.score * weight * 10
        return round(total, 1)
    
    def _make_decision(self, result: CriticOutput) -> str:
        """
        根据分数和LOCK分析做出决策
        
        核心规则:
        1. 总分必须达标
        2. C(冲突)维度必须>=7才能自动通过
        """
        score = result.total_score
        
        # 检查LOCK分析
        if result.lock_analysis:
            # 任一LOCK维度<=2，必须重写
            if result.lock_analysis.has_critical_failure:
                return "REWRITE"
            
            # 即使总分达标，C<7也不能自动通过
            c_sufficient = result.lock_analysis.c_score_sufficient
        else:
            c_sufficient = True  # 无LOCK分析时跳过此检查
        
        # 决策逻辑
        if score >= 80 and c_sufficient:
            return "APPROVED"
        elif score >= 70:
            return "HUMAN_REVIEW"  # 包括: 总分>=80但C<7的情况
        elif score >= 50:
            return "REVISE"
        else:
            return "REWRITE"
    
    def generate_revision_feedback(self, result: CriticOutput) -> str:
        """生成给Writer的修改反馈"""
        lines = ["## 审核结果\n"]
        lines.append(f"**决策**: {result.decision}")
        lines.append(f"**总分**: {result.total_score}/100\n")
        
        if result.suggestions_high:
            lines.append("### 🔴 必须修改\n")
            for i, s in enumerate(result.suggestions_high, 1):
                lines.append(f"{i}. {s}")
            lines.append("")
        
        if result.suggestions_medium:
            lines.append("### 🟡 建议修改\n")
            for i, s in enumerate(result.suggestions_medium, 1):
                lines.append(f"{i}. {s}")
            lines.append("")
        
        if result.revision_instructions:
            lines.append("### 📝 具体修改指令\n")
            for inst in result.revision_instructions:
                lines.append(f"**位置**: {inst.target}")
                lines.append(f"**问题**: {inst.issue}")
                lines.append(f"**建议**: {inst.suggestion}")
                lines.append(f"**优先级**: {inst.priority}\n")
        
        return "\n".join(lines)


# ============================================================
# LangGraph Node
# ============================================================

def create_critic_node(llm):
    """创建 Critic Agent 的 LangGraph Node"""
    agent = CriticAgent(llm)
    
    async def critic_node(state: dict) -> dict:
        """LangGraph Node 函数"""
        result = await agent.review(
            draft_content=state.get("draft_content", ""),
            scene_card=state.get("current_scene_card", {}),
            character_profiles=state.get("character_profiles", []),
            world_settings=state.get("world_settings", {})
        )
        
        return {
            **state,
            "critic_result": result.model_dump(),
            "critic_decision": result.decision,
            "critic_score": result.total_score,
            "revision_feedback": agent.generate_revision_feedback(result)
        }
    
    return critic_node
