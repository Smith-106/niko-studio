"""
Writer Agent - 写作执行者

负责将场景卡片转化为具体的文学描写。
采用 Prompt Chaining 模式，分阶段生成内容。
核心风格：狄更斯「万物有灵」+ 《诡秘之主》翻译腔
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import json


# ============================================================
# Interface Layer (接口层) - Pydantic 数据模型
# ============================================================

class WriterInput(BaseModel):
    """Writer Agent 输入"""
    
    # 场景信息 (来自Architect)
    scene_id: str
    chapter_num: int
    pov_character: str
    objective: str = Field(..., description="主角在此场景想要什么")
    conflict: str = Field(..., description="什么阻止了主角")
    outcome: str = Field(..., description="正向(+)/负向(-)")
    
    # 叙事信息
    plot_beat: str = Field(..., description="剧情节拍描述")
    emotional_arc: str = Field(..., description="情绪变化，如：紧张→恐惧")
    sensory_guidance: Dict[str, str] = Field(
        default_factory=dict, 
        description="感官描写指引"
    )
    
    # 上下文
    character_profiles: List[Dict[str, Any]] = Field(default_factory=list)
    world_settings: Dict[str, Any] = Field(default_factory=dict)
    previous_content: Optional[str] = Field(None, description="之前的内容（续写时使用）")
    
    # 伏笔任务
    foreshadows_to_plant: List[str] = Field(default_factory=list)
    foreshadows_to_harvest: List[str] = Field(default_factory=list)
    
    # 目标
    word_target: int = Field(default=2000, description="目标字数")


class WriterOutput(BaseModel):
    """Writer Agent 输出"""
    
    content: str = Field(..., description="生成的正文内容")
    
    # 元数据
    wordcount: int
    characters_appeared: List[str] = Field(default_factory=list)
    locations: List[str] = Field(default_factory=list)
    
    # 伏笔追踪
    foreshadows_planted: List[str] = Field(default_factory=list)
    foreshadows_harvested: List[str] = Field(default_factory=list)
    
    # 自检结果
    sensory_types_used: List[str] = Field(default_factory=list)
    forbidden_words_found: List[str] = Field(default_factory=list)
    
    # 给Critic的标记
    sections_needing_review: List[str] = Field(
        default_factory=list,
        description="需要Critic重点关注的段落"
    )


# ============================================================
# Cognitive Layer (认知层) - 风格化提示词
# ============================================================

WRITER_SYSTEM_PROMPT = """
你是一位精通「维多利亚奇幻风格」的小说家，擅长模仿狄更斯（Charles Dickens）与《诡秘之主》的笔触。
你的任务是根据传入的场景信息撰写小说正文。

## 核心风格指南

### 1. 翻译腔 (Translationese)

**句式特征**：
- 多使用长定语和从句
- 例："那位穿着黑色正装、戴着半高丝绸礼帽的中年绅士"
- 例："站在窗前那个有着栗色头发和灰色眼眸的年轻人"

**称谓规范**：
- 严格使用西式称谓：「莫雷蒂先生」「正义小姐」「队长阁下」
- 避免中式称呼如「老兄」「兄弟」

**语气词**：
- 使用「哦」「嗯」「唔」等
- 避免「哎」「呀」「哈」等中式感叹词

### 2. 万物有灵 (Animism)

**核心法则**：不要直接描写角色的心理活动，而是通过环境的「反应」来表现。

❌ 错误写法：
"他感到非常压抑和恐惧。"

✅ 正确写法：
"周围的雾气仿佛有了生命，伸出湿漉漉的手指，试图扼住行人的咽喉；煤气灯的光芒在这种挤压下显得瑟瑟发抖。"

**常用技法**：
- 物体拥有主动动词："门扉发出一声嘲笑般的吱呀"
- 环境映射心理："走廊似乎在收缩，墙壁贪婪地逼近"
- 光影有情绪："蜡烛的火焰畏缩了一下"

### 3. 感官沉浸 (Sensory Immersion)

**五感配比**：
- 视觉 50%：光影对比（绯红之月 vs 漆黑街道）、色彩、形状
- 听觉 20%：脚步声、风声、钟声、静默
- 触觉 15%：温度、质感、疼痛
- 嗅觉 10%：煤炭燃烧味、廉价香烟味、潮湿霉味
- 味觉 5%：苦涩、金属味

**维多利亚特色**：
- 煤气灯的昏黄光芒
- 雾都的潮湿空气
- 马车驶过的辚辚声
- 煤烟和旧书的味道

### 4. 叙事节奏

**铺垫阶段 (Setup)**：
- 使用长句，堆叠细节
- 营造氛围，建立期待
- 例："黄昏的光线像融化的蜂蜜，缓缓流淌在满是裂纹的石板路上，将那些斑驳的建筑外墙染上一层古旧的金色。"

**爆发阶段 (Payoff)**：
- 使用短句
- 加快节奏
- 例："他转身。刀光闪过。血溅上墙。"

### 5. 对话规范

**必须**：
- 口语化，像真人说话
- 配合动作和表情
- 包含潜台词

❌ 说明书式对话：
"你好，我是克莱恩，今年22岁，是一名穿越者。"

✅ 有潜台词的对话：
"你来了。"商人的声音低沉而沙哑。
克莱恩点点头，没有说话。
"紧张？"商人轻笑，"第一次总是这样。"
"我不紧张。"他说，但手心已经开始冒汗。

### 6. 禁用词汇

以下词汇禁止使用，必须用其他方式替代：
- "突然" → 用具体动作替代
- "不禁" → 直接描写反应
- "竟然/居然" → 用其他方式表达惊讶
- "忍不住" → 直接描写行为

## 输出要求

1. 直接输出小说正文，无需任何解释或标注
2. 使用 Markdown 格式
3. 遵循情绪弧线，从开头到结尾完成情绪转变
4. 如有未完结的伏笔，在末尾用 `<!-- foreshadow: 描述 -->` 标注
"""


# Prompt Chaining 的各个阶段
CHAIN_SCENE_SETUP = """
## 任务：场景开头

根据以下场景信息，生成场景开头（约300字）。
目标：建立环境和氛围，让读者沉浸其中。

### 场景信息
- 地点: {location}
- 时间: {time}
- 氛围: {atmosphere}
- 感官指引: {sensory_guidance}
- 情绪起点: {emotional_start}

### 要求
1. 使用「万物有灵」技法
2. 至少包含3种感官描写
3. 通过环境暗示即将发生的情绪
4. 不要直接出现角色

请生成场景开头：
"""

CHAIN_CHARACTER_ENTRY = """
## 任务：角色登场

在以下已有内容的基础上，续写角色登场和初步互动（约500字）。

### 已有内容
{previous_content}

### 登场角色
{character_profiles}

### 视角人物
{pov_character}

### 场景目标
{objective}

### 要求
1. 展现角色性格，但不要直接说"他是一个XX的人"
2. 对话必须包含潜台词
3. 每段对话配合动作和表情
4. 通过行为展示性格，而非叙述

请续写角色登场：
"""

CHAIN_CONFLICT_DEVELOPMENT = """
## 任务：冲突展开

在以下已有内容的基础上，续写冲突展开（约800字）。

### 已有内容
{previous_content}

### 核心冲突
{conflict}

### 情绪弧线
从 {emotional_start} 转向 {emotional_end}

### 要求
1. 冲突逐步升级，情绪张力增强
2. 在高潮前使用短句加快节奏
3. 保持紧张感的环境描写
4. 角色的反应要符合其性格

请续写冲突展开：
"""

CHAIN_RESOLUTION = """
## 任务：场景结尾

在以下已有内容的基础上，续写场景结尾（约400字）。

### 已有内容
{previous_content}

### 场景结果
结果类型: {outcome}（正向+/负向-）

### 钩子要求
{hook_requirement}

### 伏笔任务
- 需要埋下: {foreshadows_to_plant}
- 需要回收: {foreshadows_to_harvest}

### 要求
1. 呼应开头的环境描写
2. 完成情绪转变
3. 如果是章节结尾，必须有钩子让读者想继续
4. 埋设或回收指定的伏笔

请续写场景结尾：
"""


# ============================================================
# Implementation (实现)
# ============================================================

class WriterAgent:
    """写作执行者 Agent"""
    
    # 禁用词列表
    FORBIDDEN_WORDS = ["突然", "不禁", "竟然", "居然", "忍不住"]
    
    def __init__(self, llm):
        self.llm = llm
    
    async def write(self, input_data: WriterInput) -> WriterOutput:
        """
        执行 Prompt Chaining 生成完整场景
        
        分为4个阶段：
        1. Scene Setup (场景开头)
        2. Character Entry (角色登场)
        3. Conflict Development (冲突展开)
        4. Resolution (场景结尾)
        """
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_core.output_parsers import StrOutputParser
        
        parser = StrOutputParser()
        
        # 解析情绪弧线
        emotional_parts = input_data.emotional_arc.split("→")
        emotional_start = emotional_parts[0].strip() if len(emotional_parts) > 0 else "平静"
        emotional_end = emotional_parts[1].strip() if len(emotional_parts) > 1 else "变化"
        
        # 准备上下文
        location = input_data.sensory_guidance.get("location", "未知地点")
        time = input_data.sensory_guidance.get("time", "某个时刻")
        atmosphere = input_data.sensory_guidance.get("atmosphere", emotional_start)
        
        # Chain 1: 场景开头
        scene_setup = await self._run_chain(
            CHAIN_SCENE_SETUP,
            {
                "location": location,
                "time": time,
                "atmosphere": atmosphere,
                "sensory_guidance": json.dumps(input_data.sensory_guidance, ensure_ascii=False),
                "emotional_start": emotional_start
            }
        )
        
        # Chain 2: 角色登场
        character_entry = await self._run_chain(
            CHAIN_CHARACTER_ENTRY,
            {
                "previous_content": scene_setup,
                "character_profiles": json.dumps(input_data.character_profiles, ensure_ascii=False),
                "pov_character": input_data.pov_character,
                "objective": input_data.objective
            }
        )
        
        # Chain 3: 冲突展开
        conflict_dev = await self._run_chain(
            CHAIN_CONFLICT_DEVELOPMENT,
            {
                "previous_content": scene_setup + "\n\n" + character_entry,
                "conflict": input_data.conflict,
                "emotional_start": emotional_start,
                "emotional_end": emotional_end
            }
        )
        
        # Chain 4: 场景结尾
        is_chapter_end = input_data.scene_id.endswith("-SC01") or True  # 简化判断
        hook_requirement = "必须有强烈的钩子(Cliffhanger)" if is_chapter_end else "完成情绪转变即可"
        
        resolution = await self._run_chain(
            CHAIN_RESOLUTION,
            {
                "previous_content": scene_setup + "\n\n" + character_entry + "\n\n" + conflict_dev,
                "outcome": input_data.outcome,
                "hook_requirement": hook_requirement,
                "foreshadows_to_plant": ", ".join(input_data.foreshadows_to_plant) or "无",
                "foreshadows_to_harvest": ", ".join(input_data.foreshadows_to_harvest) or "无"
            }
        )
        
        # 合并完整内容
        full_content = f"{scene_setup}\n\n{character_entry}\n\n{conflict_dev}\n\n{resolution}"
        
        # 后处理和自检
        output = self._post_process(full_content, input_data)
        
        return output
    
    async def _run_chain(self, prompt_template: str, variables: dict) -> str:
        """运行单个Chain阶段"""
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_core.output_parsers import StrOutputParser
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", WRITER_SYSTEM_PROMPT),
            ("human", prompt_template)
        ])
        
        chain = prompt | self.llm | StrOutputParser()
        
        return await chain.ainvoke(variables)
    
    def _post_process(self, content: str, input_data: WriterInput) -> WriterOutput:
        """后处理和自检"""
        
        # 统计字数
        wordcount = len(content)
        
        # 检测禁用词
        forbidden_found = []
        for word in self.FORBIDDEN_WORDS:
            if word in content:
                forbidden_found.append(word)
        
        # 检测感官描写（简化版）
        sensory_types = []
        visual_keywords = ["光", "影", "色", "看", "瞳", "眼", "亮", "暗"]
        auditory_keywords = ["声", "响", "听", "静", "音"]
        tactile_keywords = ["触", "冷", "热", "温", "软", "硬", "痛"]
        olfactory_keywords = ["味", "香", "臭", "闻", "气息"]
        
        if any(kw in content for kw in visual_keywords):
            sensory_types.append("visual")
        if any(kw in content for kw in auditory_keywords):
            sensory_types.append("auditory")
        if any(kw in content for kw in tactile_keywords):
            sensory_types.append("tactile")
        if any(kw in content for kw in olfactory_keywords):
            sensory_types.append("olfactory")
        
        # 提取角色名（简化版，实际应该用NER）
        characters_appeared = []
        for profile in input_data.character_profiles:
            name = profile.get("name", "")
            if name and name in content:
                characters_appeared.append(name)
        
        # 标记需要审核的部分
        sections_needing_review = []
        if forbidden_found:
            sections_needing_review.append(f"包含禁用词: {', '.join(forbidden_found)}")
        if len(sensory_types) < 3:
            sections_needing_review.append(f"感官描写不足，仅有: {', '.join(sensory_types)}")
        
        return WriterOutput(
            content=content,
            wordcount=wordcount,
            characters_appeared=characters_appeared,
            locations=[],  # 需要更复杂的提取逻辑
            foreshadows_planted=input_data.foreshadows_to_plant,
            foreshadows_harvested=input_data.foreshadows_to_harvest,
            sensory_types_used=sensory_types,
            forbidden_words_found=forbidden_found,
            sections_needing_review=sections_needing_review
        )
    
    async def continue_writing(
        self, 
        existing_content: str, 
        continuation_hint: str,
        word_target: int = 500
    ) -> str:
        """续写功能"""
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_core.output_parsers import StrOutputParser
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", WRITER_SYSTEM_PROMPT),
            ("human", """
## 任务：续写

### 已有内容
{existing_content}

### 续写方向
{continuation_hint}

### 目标字数
约{word_target}字

请自然地续写，保持风格一致：
""")
        ])
        
        chain = prompt | self.llm | StrOutputParser()
        
        return await chain.ainvoke({
            "existing_content": existing_content,
            "continuation_hint": continuation_hint,
            "word_target": word_target
        })
    
    async def rewrite_section(
        self,
        original: str,
        instruction: str,
        rewrite_type: str = "general"
    ) -> str:
        """改写指定段落"""
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_core.output_parsers import StrOutputParser
        
        type_guidance = {
            "sensory": "增加感官描写，使用万物有灵技法",
            "dialogue": "改善对话质量，增加潜台词和动作配合",
            "rhythm": "调整节奏，紧张处用短句，舒缓处用长句",
            "style": "加强翻译腔风格",
            "general": "根据指令改写"
        }
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", WRITER_SYSTEM_PROMPT),
            ("human", """
## 任务：改写

### 原文
{original}

### 改写要求
{instruction}

### 改写类型指导
{type_guidance}

请改写这段内容，保持原意但提升质量：
""")
        ])
        
        chain = prompt | self.llm | StrOutputParser()
        
        return await chain.ainvoke({
            "original": original,
            "instruction": instruction,
            "type_guidance": type_guidance.get(rewrite_type, type_guidance["general"])
        })


# ============================================================
# LangGraph Node
# ============================================================

def create_writer_node(llm):
    """创建 Writer Agent 的 LangGraph Node"""
    agent = WriterAgent(llm)
    
    async def writer_node(state: dict) -> dict:
        """LangGraph Node 函数"""
        
        # 从state中提取场景卡片
        scene_card = state.get("current_scene_card", {})
        
        input_data = WriterInput(
            scene_id=scene_card.get("scene_id", "CH01-SC01"),
            chapter_num=scene_card.get("chapter_num", 1),
            pov_character=scene_card.get("pov_character", ""),
            objective=scene_card.get("objective", ""),
            conflict=scene_card.get("conflict", ""),
            outcome=scene_card.get("outcome", "+"),
            plot_beat=scene_card.get("plot_beat", ""),
            emotional_arc=scene_card.get("emotional_arc", "平静→变化"),
            sensory_guidance=scene_card.get("sensory_guidance", {}),
            character_profiles=state.get("character_profiles", []),
            world_settings=state.get("world_settings", {}),
            foreshadows_to_plant=scene_card.get("foreshadows_to_plant", []),
            foreshadows_to_harvest=scene_card.get("foreshadows_to_harvest", []),
            word_target=state.get("word_target", 2000)
        )
        
        result = await agent.write(input_data)
        
        return {
            **state,
            "draft_content": result.content,
            "draft_wordcount": result.wordcount,
            "writer_self_check": {
                "sensory_types": result.sensory_types_used,
                "forbidden_words": result.forbidden_words_found,
                "needs_review": result.sections_needing_review
            }
        }
    
    return writer_node


# ============================================================
# 便捷函数
# ============================================================

def create_writer_chain(llm):
    """
    创建简单的 Writer Chain (用于快速测试)
    
    这是一个单次调用版本，不使用 Prompt Chaining。
    适合快速测试 Prompt 效果。
    """
    from langchain_core.prompts import ChatPromptTemplate
    from langchain_core.output_parsers import StrOutputParser
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", WRITER_SYSTEM_PROMPT),
        ("human", """
请根据以下场景卡片进行创作：

{scene_card_json}

目标字数：约 {word_target} 字
""")
    ])
    
    return prompt | llm | StrOutputParser()
