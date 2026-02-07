"""
Architect Agent - 策划架构师

负责故事的宏观规划、结构搭建与LOCK系统验证。
采用 Three-Layer Hamburger 架构:
- Interface Layer: Pydantic 数据模型
- Cognitive Layer: LOCK系统 + 网文套路业务逻辑
- Validation Layer: 质量断言
"""

from typing import List, Optional, Literal, Any, Dict
from pydantic import BaseModel, Field, field_validator
import json
from pathlib import Path


# ============================================================
# Interface Layer (接口层) - Pydantic 数据模型
# ============================================================

class LOCKAnalysis(BaseModel):
    """LOCK系统分析结果"""
    
    # L - Lead (主角魅力)
    L_score: int = Field(..., ge=0, le=10, description="主角魅力分")
    L_protagonist: str = Field(..., description="主角名称")
    L_desire: str = Field(..., description="主角的核心渴望")
    L_pain_point: str = Field(..., description="主角的痛点/恐惧")
    L_unique_trait: str = Field(..., description="主角的独特之处")
    
    # O - Objective (目标明确)
    O_score: int = Field(..., ge=0, le=10, description="目标明确分")
    O_short_term: str = Field(..., description="短期目标")
    O_long_term: str = Field(..., description="长期目标")
    O_measurable: bool = Field(..., description="目标是否可衡量")
    
    # C - Confrontation (冲突设计)
    C_score: int = Field(..., ge=0, le=10, description="冲突设计分")
    C_external: str = Field(..., description="外部冲突")
    C_internal: str = Field(..., description="内心冲突")
    C_escalation: str = Field(..., description="冲突升级路径")
    
    # K - Knockout (结尾冲击)
    K_score: int = Field(..., ge=0, le=10, description="结尾冲击分")
    K_hooks: List[str] = Field(..., description="各章节钩子设计")
    K_transformation: str = Field(..., description="主角蜕变描述")
    
    @property
    def total_score(self) -> int:
        """LOCK总分 (0-40)"""
        return self.L_score + self.O_score + self.C_score + self.K_score
    
    @property
    def is_valid(self) -> bool:
        """是否通过LOCK验证 (>=28分)"""
        return self.total_score >= 28


class TwoDoorsStructure(BaseModel):
    """两扇门结构"""
    
    disturbance: dict = Field(
        ..., 
        description="第1章: 打破日常的事件"
    )
    door_1: dict = Field(
        ..., 
        description="20-25%处: 进入新世界，不可逆转"
    )
    midpoint: dict = Field(
        ..., 
        description="50%处: 假胜利或假失败"
    )
    door_2: dict = Field(
        ..., 
        description="75%处: 最黑暗时刻，通往决战"
    )
    climax: dict = Field(
        ..., 
        description="90%处: 最终对决"
    )
    resolution: Optional[dict] = Field(
        None, 
        description="100%: 新常态"
    )


class SceneCard(BaseModel):
    """场景卡片"""
    
    scene_id: str = Field(..., description="场景ID, 格式: CH01-SC01")
    chapter_num: int = Field(..., ge=1)
    scene_num: int = Field(..., ge=1)
    
    # 场景核心三要素
    pov_character: str = Field(..., description="视角人物")
    objective: str = Field(..., description="主角在此场景想要什么？")
    conflict: str = Field(..., description="什么阻止了主角？")
    outcome: Literal["+", "-"] = Field(..., description="正向/负向结果")
    
    # 结构标签
    structural_function: str = Field(
        ..., 
        description="结构功能: Establishment/Door1/Rising/Midpoint/Door2/Climax/Resolution"
    )
    
    # 情绪与感官
    emotional_arc: str = Field(..., description="情绪变化, 如: 希望→失望")
    sensory_guidance: dict = Field(..., description="感官描写指引")
    
    # 叙事节拍
    plot_beat: str = Field(..., description="剧情节拍描述")
    hook: Optional[str] = Field(None, description="章节结尾钩子")
    
    # 伏笔
    foreshadows_to_plant: List[str] = Field(default_factory=list)
    foreshadows_to_harvest: List[str] = Field(default_factory=list)
    
    @field_validator('scene_id')
    @classmethod
    def validate_scene_id(cls, v):
        import re
        if not re.match(r'^CH\d{2}-SC\d{2}$', v):
            raise ValueError('scene_id must be in format CH01-SC01')
        return v


class RhythmAnalysis(BaseModel):
    """节奏分析"""
    
    positive_scenes: int = Field(..., description="正向场景数")
    negative_scenes: int = Field(..., description="负向场景数")
    balance_score: int = Field(..., ge=0, le=10, description="平衡度评分")
    warnings: List[str] = Field(default_factory=list)


class StoryBlueprint(BaseModel):
    """故事蓝图 - Architect Agent 的最终输出"""
    
    # 基本信息
    title: str = Field(..., description="故事标题")
    genre: str = Field(..., description="类型: 玄幻/悬疑/科幻等")
    logline: str = Field(
        ..., 
        description="一句话梗概，必须包含LOCK要素"
    )
    
    # 核心分析
    lock_analysis: LOCKAnalysis
    two_doors: TwoDoorsStructure
    
    # 场景序列
    scene_cards: List[SceneCard]
    
    # 节奏检查
    rhythm_analysis: RhythmAnalysis
    
    # 元数据
    target_chapters: int = Field(..., description="目标章节数")
    target_wordcount: int = Field(..., description="目标总字数")


# ============================================================
# Cognitive Layer (认知层) - 业务逻辑 + System Prompt
# ============================================================

ARCHITECT_SYSTEM_PROMPT = """
你是一位精通《大师写作班》理论与中国网文「黄金三章」法则的策划架构师。
你的目标是基于用户的灵感，生成一份符合「LOCK系统」的严谨故事蓝图。

## 核心理论框架

### LOCK 系统 (来自《大师写作班》)

**L - Lead (主角)**
- 必须有【强烈的渴望】（不是模糊的"想变强"，而是具体的"找到杀父仇人"）
- 必须有【明显的痛点】（读者能共情的缺陷或创伤）
- 必须有【独特的技能或视角】（让读者愿意跟随的理由）

**O - Objective (目标)**
- 目标必须【具体可视化】（能拍成电影画面）
- 必须有【成功/失败的明确标准】
- 必须与主角的渴望【直接相关】

**C - Confrontation (冲突)**
- 必须有【明确的对手】（人物/组织/自然/内心）
- 冲突必须【不断升级】
- 每个场景必须有【阻碍】（没有冲突=没有故事）

**K - Knockout (结尾)**
- 必须有【情感冲击】或【满足感】
- 主角必须经历【真正的改变】
- 每章结尾必须有【钩子】

### 两扇门结构

**第一扇门 (20-25%)**
- 主角跨越不可回头的门槛
- 进入"新世界"（字面或比喻意义）
- 读者感到"故事真正开始了"

**第二扇门 (75%)**
- 一切似乎失去
- 最黑暗时刻
- 通往最终决战的入口

### 网文套路参考

**退婚流/打脸流**
- 第1章: 压抑铺垫（被羞辱）
- 第2章: 金手指觉醒
- 第3章: 小试牛刀打脸

**悬疑推理流**
- 第1章必须出现案件
- 每章结尾必须有悬念
- 红鲱鱼(误导)至少3个

**系统流**
- 铺垫: 压抑感（被欺负/陷入绝境）
- 爆发: 系统触发，逆转局势
- 反馈: 围观者的震惊反应

## 思维链 (Chain of Thought)

在生成故事蓝图时，请按以下步骤思考：

1. **分析主角的主动性**
   - 他是在推动剧情，还是被动接受？
   - 他的渴望是否足够强烈到让他采取行动？

2. **检查两扇门**
   - 第一幕结束时，主角是否跨越了不可回头的门槛？
   - 75%处是否设计了"最黑暗时刻"？

3. **设计爽点**
   - 是否包含"信息差"（如扮猪吃虎）？
   - 是否有"升级反馈"（围观者的震惊）？

4. **检查节奏**
   - 正向和负向场景是否交替？
   - 是否避免了连续3个以上同性质场景？

## 输出要求

请生成完整的 StoryBlueprint JSON，包含：
- LOCK分析（每项都要有具体内容和评分）
- 两扇门结构（明确章节位置和事件描述）
- 场景卡片序列（每个场景都要有目标-冲突-结果）
- 节奏分析（正负场景统计和警告）

## 参考标准 (Golden Standard - 《诡秘之主》)

1. **L (Lead)**: 克莱恩有强烈的"匮乏感"（贫穷）+ 明确的渴望（回家）
2. **O (Objective)**: 目标导向行动（为了生存而接触神秘学）
3. **C (Confrontation)**: 冲突层层递进（生存压力→超自然威胁→被迫入局）
4. **K (Knockout)**: 每章结尾都有钩子（绯红之月、神秘符号、加入值夜者）
"""


ARCHITECT_USER_PROMPT_TEMPLATE = """
## 用户灵感

{user_idea}

## 类型

{genre}

## 目标

- 目标章节数: {target_chapters}
- 目标总字数: {target_wordcount}

## 要求

请根据LOCK系统进行深入分析，生成完整的故事蓝图。

1. 首先分析主角的渴望和痛点，评估L分数
2. 然后明确故事目标，评估O分数
3. 设计冲突升级路径和两扇门位置，评估C分数
4. 规划每章钩子和最终结局，评估K分数
5. 最后生成场景卡片序列

{format_instructions}
"""


# ============================================================
# Implementation (实现)
# ============================================================

class ArchitectAgent:
    """策划架构师 Agent - 集成 SequentialThinking 动态推理 + DistillService 知识蒸馏"""

    def __init__(
        self,
        llm,
        golden_dataset_path: Optional[str] = None,
        enable_sequential_thinking: bool = True,
        thinking_max_depth: int = 10,
        enable_distillation: bool = True,
        knowledge_layer: Optional[Any] = None
    ):
        """
        Args:
            llm: LangChain LLM 实例
            golden_dataset_path: Golden Dataset JSON 文件路径
            enable_sequential_thinking: 是否启用 SequentialThinking
            thinking_max_depth: 思维链最大深度
            enable_distillation: 是否启用知识蒸馏
            knowledge_layer: AgentKnowledgeLayer 实例（用于知识蒸馏）
        """
        self.llm = llm
        self.golden_dataset = self._load_golden_dataset(golden_dataset_path)
        self.enable_sequential_thinking = enable_sequential_thinking
        self.enable_distillation = enable_distillation
        self.knowledge_layer = knowledge_layer

        # SequentialThinking 集成
        if enable_sequential_thinking:
            from .sequential_thinking import SequentialThinking, ThoughtType
            self.thinking_engine = SequentialThinking(
                max_depth=thinking_max_depth,
                max_branches=5,
                auto_prune=True
            )
            self._ThoughtType = ThoughtType
        else:
            self.thinking_engine = None
            self._ThoughtType = None

        # DistillService 集成
        if enable_distillation:
            try:
                from ..services.distill_service import DistillService
                self.distill_service = DistillService(llm_client=llm)
            except ImportError:
                self.distill_service = None
        else:
            self.distill_service = None
    
    def _load_golden_dataset(self, path: Optional[str]) -> List[dict]:
        """加载 Golden Dataset 作为 Few-Shot Examples"""
        if path is None:
            return []
        
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except UnicodeDecodeError:
            with open(path, 'r', encoding='gbk') as f:
                return json.load(f)
        except FileNotFoundError:
            print(f"Warning: Golden dataset not found at {path}")
            return []
    
    def _build_prompt(
        self,
        user_idea: str,
        genre: str,
        target_chapters: int = 30,
        target_wordcount: int = 600000
    ) -> str:
        """构建完整 Prompt"""
        from langchain_core.output_parsers import PydanticOutputParser
        
        parser = PydanticOutputParser(pydantic_object=StoryBlueprint)
        
        user_prompt = ARCHITECT_USER_PROMPT_TEMPLATE.format(
            user_idea=user_idea,
            genre=genre,
            target_chapters=target_chapters,
            target_wordcount=target_wordcount,
            format_instructions=parser.get_format_instructions()
        )
        
        return user_prompt
    
    async def plan(
        self,
        user_idea: str,
        genre: str,
        target_chapters: int = 30,
        target_wordcount: int = 600000
    ) -> StoryBlueprint:
        """
        生成故事蓝图（集成 SequentialThinking 动态推理）

        Args:
            user_idea: 用户的故事灵感
            genre: 故事类型
            target_chapters: 目标章节数
            target_wordcount: 目标总字数

        Returns:
            StoryBlueprint: 完整的故事蓝图
        """
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_core.output_parsers import PydanticOutputParser

        # 使用 SequentialThinking 进行动态推理
        if self.thinking_engine:
            await self._sequential_thinking_plan(user_idea, genre, target_chapters, target_wordcount)

        parser = PydanticOutputParser(pydantic_object=StoryBlueprint)

        prompt = ChatPromptTemplate.from_messages([
            ("system", ARCHITECT_SYSTEM_PROMPT),
            ("human", ARCHITECT_USER_PROMPT_TEMPLATE)
        ])

        chain = prompt | self.llm | parser

        result = await chain.ainvoke({
            "user_idea": user_idea,
            "genre": genre,
            "target_chapters": target_chapters,
            "target_wordcount": target_wordcount,
            "format_instructions": parser.get_format_instructions()
        })

        # 验证层检查
        self._validate(result)

        # 记录结论到思维链
        if self.thinking_engine:
            self.thinking_engine.conclude(
                f"Generated story blueprint: {result.title} (LOCK score: {result.lock_analysis.total_score})",
                confidence=min(result.lock_analysis.total_score / 40, 1.0)
            )

        return result

    async def _sequential_thinking_plan(
        self,
        user_idea: str,
        genre: str,
        target_chapters: int,
        target_wordcount: int
    ) -> None:
        """
        使用 SequentialThinking 进行动态规划推理

        这个方法在调用 LLM 之前，先建立思维链框架，
        帮助 Agent 更好地理解和规划故事结构。
        """
        ThoughtType = self._ThoughtType

        # 重置思维引擎
        self.thinking_engine.reset()

        # Step 1: 初始分析
        self.thinking_engine.think(
            content=f"收到用户灵感: {user_idea[:100]}...",
            thought_type=ThoughtType.INITIAL,
            metadata={"genre": genre, "target_chapters": target_chapters}
        )

        # Step 2: 分析主角 (L - Lead)
        self.thinking_engine.think(
            content="分析主角设定: 识别渴望、痛点、独特性",
            thought_type=ThoughtType.ANALYSIS,
            metadata={"lock_element": "L"}
        )

        # Step 3: 分析目标 (O - Objective)
        self.thinking_engine.think(
            content="分析故事目标: 确定短期目标、长期目标、可衡量性",
            thought_type=ThoughtType.ANALYSIS,
            metadata={"lock_element": "O"}
        )

        # Step 4: 分析冲突 (C - Confrontation)
        self.thinking_engine.think(
            content="设计冲突体系: 外部冲突、内心冲突、升级路径",
            thought_type=ThoughtType.ANALYSIS,
            metadata={"lock_element": "C"}
        )

        # Step 5: 分析结尾 (K - Knockout)
        self.thinking_engine.think(
            content="规划结尾设计: 章节钩子、主角蜕变、情感冲击",
            thought_type=ThoughtType.ANALYSIS,
            metadata={"lock_element": "K"}
        )

        # Step 6: 验证两扇门结构
        self.thinking_engine.think(
            content="验证两扇门结构: 第一扇门(20-25%)、第二扇门(75%)",
            thought_type=ThoughtType.VERIFICATION,
            metadata={"structure": "two_doors"}
        )

        # Step 7: 假设性分支 - 探索不同类型的开局
        if genre in ["玄幻", "都市", "仙侠"]:
            branch = self.thinking_engine.branch(
                name="opening_style",
                description="探索开局风格",
                priority=1
            )
            self.thinking_engine.switch_branch(branch.id)

            self.thinking_engine.think(
                content=f"考虑{genre}类型常见开局: 退婚流/重生流/系统流",
                thought_type=ThoughtType.HYPOTHESIS,
                confidence=0.8
            )

            # 切回主分支
            self.thinking_engine.switch_branch("main")

        # Step 8: 生成场景卡片规划
        self.thinking_engine.think(
            content=f"规划{target_chapters}章的场景卡片序列",
            thought_type=ThoughtType.ANALYSIS,
            metadata={"target_chapters": target_chapters}
        )

    def get_thinking_chain(self) -> str:
        """
        获取当前思维链的 Markdown 表示

        Returns:
            str: 思维链的 Markdown 格式
        """
        if self.thinking_engine:
            return self.thinking_engine.to_markdown()
        return "SequentialThinking not enabled"

    def get_thinking_data(self) -> dict:
        """
        获取当前思维链的完整数据

        Returns:
            dict: 思维链数据
        """
        if self.thinking_engine:
            return self.thinking_engine.to_dict()
        return {}

    # ========== DistillService 集成方法 ==========

    async def distill_blueprint(self, blueprint: StoryBlueprint) -> Dict[str, Any]:
        """
        从故事蓝图中蒸馏知识到知识图谱

        Args:
            blueprint: 故事蓝图

        Returns:
            Dict: 蒸馏结果，包含 entities 和 relations
        """
        if not self.distill_service:
            return {"entities": [], "relations": [], "status": "distillation_disabled"}

        # 构建蒸馏内容
        distill_content = self._build_distill_content(blueprint)

        # 执行蒸馏
        distilled_data = self.distill_service.distill_chapter(distill_content)

        # 如果有知识层，写入图谱
        if self.knowledge_layer:
            self.distill_service.apply_to_graph(self.knowledge_layer, distilled_data)

        # 记录到思维链
        if self.thinking_engine:
            self.thinking_engine.think(
                content=f"知识蒸馏完成: {len(distilled_data.get('entities', []))} 实体, {len(distilled_data.get('relations', []))} 关系",
                thought_type=self._ThoughtType.CONCLUSION,
                metadata={"distilled": True}
            )

        return distilled_data

    def _build_distill_content(self, blueprint: StoryBlueprint) -> str:
        """
        从蓝图构建蒸馏内容

        Args:
            blueprint: 故事蓝图

        Returns:
            str: 用于蒸馏的文本内容
        """
        content_parts = [
            f"# 故事蓝图: {blueprint.title}",
            f"类型: {blueprint.genre}",
            f"概要: {blueprint.logline}",
            "",
            "## 主角分析 (LOCK-L)",
            f"主角: {blueprint.lock_analysis.L_protagonist}",
            f"渴望: {blueprint.lock_analysis.L_desire}",
            f"痛点: {blueprint.lock_analysis.L_pain_point}",
            f"独特之处: {blueprint.lock_analysis.L_unique_trait}",
            "",
            "## 目标分析 (LOCK-O)",
            f"短期目标: {blueprint.lock_analysis.O_short_term}",
            f"长期目标: {blueprint.lock_analysis.O_long_term}",
            "",
            "## 冲突设计 (LOCK-C)",
            f"外部冲突: {blueprint.lock_analysis.C_external}",
            f"内心冲突: {blueprint.lock_analysis.C_internal}",
            f"升级路径: {blueprint.lock_analysis.C_escalation}",
            "",
            "## 结构节点",
            f"第一扇门: {json.dumps(blueprint.two_doors.door_1, ensure_ascii=False)}",
            f"中点: {json.dumps(blueprint.two_doors.midpoint, ensure_ascii=False)}",
            f"第二扇门: {json.dumps(blueprint.two_doors.door_2, ensure_ascii=False)}",
            "",
            "## 场景序列"
        ]

        for sc in blueprint.scene_cards[:10]:  # 限制前10个场景
            content_parts.append(
                f"- {sc.scene_id}: {sc.pov_character} - {sc.objective} (冲突: {sc.conflict})"
            )

        return "\n".join(content_parts)

    async def plan_with_distillation(
        self,
        user_idea: str,
        genre: str,
        target_chapters: int = 30,
        target_wordcount: int = 600000
    ) -> tuple:
        """
        生成故事蓝图并执行知识蒸馏

        Args:
            user_idea: 用户的故事灵感
            genre: 故事类型
            target_chapters: 目标章节数
            target_wordcount: 目标总字数

        Returns:
            tuple: (StoryBlueprint, distilled_data)
        """
        # 生成蓝图
        blueprint = await self.plan(user_idea, genre, target_chapters, target_wordcount)

        # 执行蒸馏
        distilled_data = await self.distill_blueprint(blueprint)

        return blueprint, distilled_data

    def get_distillation_prompts(self, content: str) -> Dict[str, str]:
        """
        获取所有类型的蒸馏提示词

        Args:
            content: 要蒸馏的内容

        Returns:
            Dict: 各类型的蒸馏提示词
        """
        if not self.distill_service:
            return {}

        return {
            "extract-facts": self.distill_service.get_distillation_prompt("extract-facts", content),
            "extract-relationships": self.distill_service.get_distillation_prompt("extract-relationships", content)
        }

    def _validate(self, blueprint: StoryBlueprint) -> None:
        """
        Validation Layer - 质量断言
        
        Raises:
            ValueError: 如果蓝图不符合质量标准
        """
        errors = []
        warnings = []
        
        # 必须通过的断言
        if blueprint.lock_analysis.total_score < 28:
            errors.append(
                f"LOCK总分 {blueprint.lock_analysis.total_score} < 28，故事结构需要加强"
            )
        
        if not blueprint.lock_analysis.L_desire:
            errors.append("主角缺少明确的渴望")
        
        if len(blueprint.scene_cards) < blueprint.target_chapters:
            warnings.append(
                f"场景卡片数量 {len(blueprint.scene_cards)} < 目标章节数 {blueprint.target_chapters}"
            )
        
        # 检查每个场景是否有冲突
        scenes_without_conflict = [
            sc.scene_id for sc in blueprint.scene_cards 
            if not sc.conflict
        ]
        if scenes_without_conflict:
            errors.append(
                f"以下场景缺少冲突: {', '.join(scenes_without_conflict)}"
            )
        
        # 检查两扇门是否定义
        if not blueprint.two_doors.door_1:
            errors.append("缺少第一扇门定义")
        if not blueprint.two_doors.door_2:
            errors.append("缺少第二扇门定义")
        
        # 检查节奏
        if blueprint.rhythm_analysis.warnings:
            warnings.extend(blueprint.rhythm_analysis.warnings)
        
        # 输出验证结果
        if errors:
            raise ValueError(
                "故事蓝图验证失败:\n" + "\n".join(f"- {e}" for e in errors)
            )
        
        if warnings:
            print("验证警告:")
            for w in warnings:
                print(f"  ⚠️ {w}")


# ============================================================
# LangGraph Node (用于工作流集成)
# ============================================================

def create_architect_node(llm, golden_dataset_path: Optional[str] = None):
    """
    创建 Architect Agent 的 LangGraph Node
    
    用法:
        from langgraph.graph import StateGraph
        
        architect_node = create_architect_node(llm, "path/to/golden_dataset.json")
        
        graph = StateGraph(...)
        graph.add_node("architect", architect_node)
    """
    agent = ArchitectAgent(llm, golden_dataset_path)
    
    async def architect_node(state: dict) -> dict:
        """LangGraph Node 函数"""
        blueprint = await agent.plan(
            user_idea=state.get("user_idea", ""),
            genre=state.get("genre", "玄幻"),
            target_chapters=state.get("target_chapters", 30),
            target_wordcount=state.get("target_wordcount", 600000)
        )
        
        return {
            **state,
            "story_blueprint": blueprint.model_dump(),
            "lock_score": blueprint.lock_analysis.total_score,
            "scene_cards": [sc.model_dump() for sc in blueprint.scene_cards]
        }
    
    return architect_node


# ============================================================
# 便捷函数
# ============================================================

def create_architect_chain(llm):
    """
    创建简单的 Architect Chain (用于快速测试)
    
    用法:
        from langchain_google_genai import ChatGoogleGenerativeAI
        
        llm = ChatGoogleGenerativeAI(model="gemini-pro")
        chain = create_architect_chain(llm)
        
        result = chain.invoke({
            "user_idea": "一个穷困潦倒的侦探，在维多利亚时代的伦敦...",
            "genre": "悬疑",
            "target_chapters": 30,
            "target_wordcount": 600000
        })
    """
    from langchain_core.prompts import ChatPromptTemplate
    from langchain_core.output_parsers import PydanticOutputParser
    
    parser = PydanticOutputParser(pydantic_object=StoryBlueprint)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", ARCHITECT_SYSTEM_PROMPT),
        ("human", ARCHITECT_USER_PROMPT_TEMPLATE)
    ])
    
    return prompt.partial(
        format_instructions=parser.get_format_instructions()
    ) | llm | parser
