"""
Writer Agent - 写作执行者

负责将场景卡片转化为具体的文学描写。
采用 Prompt Chaining 模式，分阶段生成内容。
核心风格：狄更斯「万物有灵」+ 《诡秘之主》翻译腔
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, model_validator
import json


# ============================================================
# Interface Layer (接口层) - Pydantic 数据模型
# ============================================================

class WriterInput(BaseModel):
    """Writer Agent 输入"""

    # 兼容集成测试：允许传入 scene_card，并在验证阶段映射到标准字段
    scene_card: Optional[Dict[str, Any]] = None

    # 场景信息 (来自Architect)
    scene_id: str = ""
    chapter_num: int = 1
    pov_character: str = ""
    objective: str = Field(default="", description="主角在此场景想要什么")
    conflict: str = Field(default="", description="什么阻止了主角")
    outcome: str = Field(default="+", description="正向(+)/负向(-)")

    # 叙事信息
    plot_beat: str = Field(default="", description="剧情节拍描述")
    emotional_arc: str = Field(default="平静→变化", description="情绪变化，如：紧张→恐惧")
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

    @model_validator(mode="after")
    def _normalize_from_scene_card(self):
        """兼容 scene_card 输入格式并补齐默认值。"""
        card = self.scene_card or {}
        if not self.scene_id:
            self.scene_id = card.get("scene_id", "scene-001")
        if not self.pov_character:
            self.pov_character = card.get("pov_character", "主角")
        if not self.objective:
            self.objective = card.get("objective", "推进剧情")
        if not self.conflict:
            self.conflict = card.get("conflict", "遭遇阻碍")
        if not self.outcome:
            self.outcome = card.get("outcome", "+")
        if not self.plot_beat:
            self.plot_beat = card.get("plot_beat", "场景推进")
        if not self.emotional_arc:
            self.emotional_arc = card.get("emotional_arc", "平静→变化")
        chapter_num = card.get("chapter_num")
        if chapter_num is not None:
            self.chapter_num = chapter_num
        return self


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
    """写作执行者 Agent - 集成 AgentKnowledgeLayer"""

    # 禁用词列表
    FORBIDDEN_WORDS = ["突然", "不禁", "竟然", "居然", "忍不住"]

    def __init__(
        self,
        llm,
        skill_loader=None,
        knowledge_layer: Optional[Any] = None,
        enable_knowledge_retrieval: bool = True
    ):
        """
        Args:
            llm: LangChain LLM 实例
            skill_loader: 技能加载器
            knowledge_layer: AgentKnowledgeLayer 实例
            enable_knowledge_retrieval: 是否启用知识检索增强
        """
        self.llm = llm
        self.skill_loader = skill_loader
        self.knowledge_layer = knowledge_layer
        self.enable_knowledge_retrieval = enable_knowledge_retrieval
        self._injected_skills: List[str] = []

    # ========== AgentKnowledgeLayer 集成方法 ==========

    async def retrieve_context(
        self,
        query: str,
        context_types: Optional[List[str]] = None,
        limit: int = 10
    ) -> Dict[str, Any]:
        """
        从知识层检索相关上下文

        Args:
            query: 查询文本
            context_types: 上下文类型过滤 ['character', 'location', 'event', 'foreshadow']
            limit: 返回结果数量限制

        Returns:
            Dict: 检索到的上下文信息
        """
        if not self.knowledge_layer or not self.enable_knowledge_retrieval:
            return {"entities": [], "relations": [], "memories": []}

        context = {
            "entities": [],
            "relations": [],
            "memories": []
        }

        try:
            # 检索相关实体
            if hasattr(self.knowledge_layer, 'search_entities'):
                entities = await self._safe_call(
                    self.knowledge_layer.search_entities,
                    query, limit=limit
                )
                if context_types:
                    entities = [e for e in entities if e.get('type') in context_types]
                context["entities"] = entities

            # 检索相关关系
            if hasattr(self.knowledge_layer, 'get_related_entities'):
                for entity in context["entities"][:3]:  # 限制关系检索
                    relations = await self._safe_call(
                        self.knowledge_layer.get_related_entities,
                        entity.get('id')
                    )
                    context["relations"].extend(relations)

            # 检索相关记忆/历史
            if hasattr(self.knowledge_layer, 'search_memories'):
                memories = await self._safe_call(
                    self.knowledge_layer.search_memories,
                    query, limit=limit
                )
                context["memories"] = memories

        except Exception as e:
            # 静默失败，不影响主流程
            pass

        return context

    async def _safe_call(self, func, *args, **kwargs):
        """安全调用，处理同步/异步函数"""
        import asyncio
        import inspect

        if inspect.iscoroutinefunction(func):
            return await func(*args, **kwargs)
        else:
            return func(*args, **kwargs)

    def _build_knowledge_context(self, retrieved: Dict[str, Any]) -> str:
        """
        将检索到的知识构建为上下文文本

        Args:
            retrieved: 检索结果

        Returns:
            str: 格式化的上下文文本
        """
        if not retrieved or (not retrieved.get("entities") and not retrieved.get("memories")):
            return ""

        parts = ["## 知识库上下文\n"]

        # 实体信息
        entities = retrieved.get("entities", [])
        if entities:
            parts.append("### 相关角色/地点")
            for ent in entities[:5]:
                name = ent.get("name", ent.get("id", "未知"))
                ent_type = ent.get("type", "")
                desc = ent.get("description", "")
                parts.append(f"- **{name}** ({ent_type}): {desc}")
            parts.append("")

        # 关系信息
        relations = retrieved.get("relations", [])
        if relations:
            parts.append("### 角色关系")
            for rel in relations[:5]:
                source = rel.get("source", "")
                target = rel.get("target", "")
                rel_type = rel.get("type", "")
                parts.append(f"- {source} --[{rel_type}]--> {target}")
            parts.append("")

        # 历史记忆
        memories = retrieved.get("memories", [])
        if memories:
            parts.append("### 相关历史")
            for mem in memories[:3]:
                content = mem.get("content", str(mem))[:200]
                parts.append(f"- {content}")
            parts.append("")

        return "\n".join(parts)

    async def write_with_knowledge(self, input_data: 'WriterInput', allow_llm_fallback: bool = True) -> 'WriterOutput':
        """
        使用知识层增强的写作方法

        在写作前先检索相关知识，增强上下文理解。

        Args:
            input_data: WriterInput 输入数据
            allow_llm_fallback: 是否允许 LLM 降级

        Returns:
            WriterOutput: 写作输出
        """
        # 构建查询
        query_parts = [
            input_data.pov_character,
            input_data.objective,
            input_data.conflict
        ]
        query = " ".join(filter(None, query_parts))

        # 检索知识
        retrieved = await self.retrieve_context(
            query,
            context_types=["character", "location", "event"],
            limit=10
        )

        # 构建知识上下文
        knowledge_context = self._build_knowledge_context(retrieved)

        # 如果有知识上下文，增强角色信息
        if knowledge_context and retrieved.get("entities"):
            enhanced_profiles = list(input_data.character_profiles)
            for ent in retrieved["entities"]:
                if ent.get("type") == "character":
                    # 检查是否已存在
                    exists = any(
                        p.get("name") == ent.get("name")
                        for p in enhanced_profiles
                    )
                    if not exists:
                        enhanced_profiles.append({
                            "name": ent.get("name"),
                            "description": ent.get("description", ""),
                            "source": "knowledge_layer"
                        })
            input_data.character_profiles = enhanced_profiles

        # 调用原始 write 方法
        output = await self.write(input_data, allow_llm_fallback=allow_llm_fallback)

        # 记录使用的知识到输出元数据
        if hasattr(output, 'metadata'):
            output.metadata = output.metadata or {}
            output.metadata["knowledge_retrieved"] = {
                "entities_count": len(retrieved.get("entities", [])),
                "relations_count": len(retrieved.get("relations", [])),
                "memories_count": len(retrieved.get("memories", []))
            }

        return output

    async def sync_to_knowledge_layer(self, output: 'WriterOutput', scene_id: str) -> None:
        """
        将写作输出同步到知识层

        Args:
            output: WriterOutput 写作输出
            scene_id: 场景 ID
        """
        if not self.knowledge_layer:
            return

        try:
            # 同步出现的角色
            if hasattr(self.knowledge_layer, 'add_entity'):
                for char_name in output.characters_appeared:
                    await self._safe_call(
                        self.knowledge_layer.add_entity,
                        char_name.lower().replace(" ", "_"),
                        char_name,
                        "character",
                        f"Appeared in scene {scene_id}"
                    )

            # 同步地点
            if hasattr(self.knowledge_layer, 'add_entity'):
                for location in output.locations:
                    await self._safe_call(
                        self.knowledge_layer.add_entity,
                        location.lower().replace(" ", "_"),
                        location,
                        "location",
                        f"Featured in scene {scene_id}"
                    )

            # 同步伏笔
            if hasattr(self.knowledge_layer, 'add_entity'):
                for fs in output.foreshadows_planted:
                    await self._safe_call(
                        self.knowledge_layer.add_entity,
                        f"foreshadow_{scene_id}_{hash(fs) % 10000}",
                        fs,
                        "foreshadow",
                        f"Planted in scene {scene_id}"
                    )

        except Exception as e:
            # 静默失败
            pass

    def inject_skills(self, skill_ids: List[str]) -> str:
        """
        注入技能包内容到风格指南

        Args:
            skill_ids: 要注入的技能ID列表

        Returns:
            合并后的技能指导文本
        """
        if not self.skill_loader:
            return ""

        self._injected_skills = skill_ids
        skill_contents = []

        for skill_id in skill_ids:
            try:
                skill = self.skill_loader.load_skill(skill_id)
                if skill:
                    skill_contents.append(f"### {skill.get('name', skill_id)}\n{skill.get('content', '')}")
            except Exception as e:
                print(f"Warning: Failed to load skill {skill_id}: {e}")

        return "\n\n".join(skill_contents)

    def _build_enhanced_prompt(self, base_prompt: str, skill_ids: List[str]) -> str:
        """构建带技能注入的增强 Prompt"""
        skill_guidance = self.inject_skills(skill_ids)

        if not skill_guidance:
            return base_prompt

        enhanced = f"""{base_prompt}

## 技能包指导

以下是本场景需要应用的写作技能：

{skill_guidance}

请在创作中融入以上技能的要点。
"""
        return enhanced
    
    async def write(self, input_data: WriterInput, allow_llm_fallback: bool = True) -> WriterOutput:
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

        # 从上下文自动注入技能（可选）
        skill_ids = []
        if isinstance(input_data.world_settings, dict):
            candidate_skills = input_data.world_settings.get("recommended_skills") or input_data.world_settings.get("skill_ids")
            if isinstance(candidate_skills, list):
                skill_ids = [s for s in candidate_skills if isinstance(s, str) and s]
        if skill_ids:
            self.inject_skills(skill_ids)

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
            },
            allow_llm_fallback=allow_llm_fallback
        )

        # Chain 2: 角色登场
        character_entry = await self._run_chain(
            CHAIN_CHARACTER_ENTRY,
            {
                "previous_content": scene_setup,
                "character_profiles": json.dumps(input_data.character_profiles, ensure_ascii=False),
                "pov_character": input_data.pov_character,
                "objective": input_data.objective
            },
            allow_llm_fallback=allow_llm_fallback
        )

        # Chain 3: 冲突展开
        conflict_dev = await self._run_chain(
            CHAIN_CONFLICT_DEVELOPMENT,
            {
                "previous_content": scene_setup + "\n\n" + character_entry,
                "conflict": input_data.conflict,
                "emotional_start": emotional_start,
                "emotional_end": emotional_end
            },
            allow_llm_fallback=allow_llm_fallback
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
            },
            allow_llm_fallback=allow_llm_fallback
        )
        
        # 合并完整内容
        full_content = f"{scene_setup}\n\n{character_entry}\n\n{conflict_dev}\n\n{resolution}"
        
        # 后处理和自检
        output = self._post_process(full_content, input_data)
        
        return output
    
    async def _run_chain(self, prompt_template: str, variables: dict, allow_llm_fallback: bool = True) -> str:
        """运行单个Chain阶段"""
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_core.output_parsers import StrOutputParser

        if not self.llm:
            raise RuntimeError("LLM not configured for WriterAgent")

        system_prompt = WRITER_SYSTEM_PROMPT
        if self._injected_skills and self.skill_loader:
            skill_guidance = self.inject_skills(self._injected_skills)
            if skill_guidance:
                system_prompt = f"{WRITER_SYSTEM_PROMPT}\n\n## 技能包指导\n\n{skill_guidance}\n\n请在创作中融入以上技能要点。"

        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", prompt_template)
        ])

        chain = prompt | self.llm | StrOutputParser()

        try:
            return await chain.ainvoke(variables)
        except Exception as exc:
            if not allow_llm_fallback:
                raise RuntimeError("LLM execution failed with fallback disabled") from exc
            raise
    
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
        word_target: int = 500,
        allow_llm_fallback: bool = True
    ) -> str:
        """续写功能"""
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_core.output_parsers import StrOutputParser

        if not self.llm:
            raise RuntimeError("LLM not configured for WriterAgent")

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

        try:
            return await chain.ainvoke({
                "existing_content": existing_content,
                "continuation_hint": continuation_hint,
                "word_target": word_target
            })
        except Exception as exc:
            if not allow_llm_fallback:
                raise RuntimeError("LLM execution failed with fallback disabled") from exc
            raise
    
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

    async def revise(self, draft: str, feedback: Dict[str, Any], allow_llm_fallback: bool = True) -> WriterOutput:
        """
        根据 Critic 反馈修订稿件

        Args:
            draft: 原始稿件
            feedback: Critic 返回的反馈，包含 issues 和 suggestions
            allow_llm_fallback: 是否允许 LLM 降级

        Returns:
            WriterOutput: 修订后的输出
        """
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_core.output_parsers import StrOutputParser

        if not self.llm:
            raise RuntimeError("LLM not configured for WriterAgent")

        # 解析反馈
        issues = feedback.get("issues", [])
        suggestions = feedback.get("suggestions", [])
        dimension_scores = feedback.get("dimension_scores", {})

        # 构建修订指令
        revision_instructions = []

        # 根据维度分数确定修订重点
        low_score_dims = [
            dim for dim, score in dimension_scores.items()
            if score < 7
        ]

        if low_score_dims:
            revision_instructions.append(f"重点改进以下维度: {', '.join(low_score_dims)}")

        if issues:
            revision_instructions.append("修复以下问题:")
            for issue in issues[:5]:  # 限制问题数量
                revision_instructions.append(f"  - {issue}")

        if suggestions:
            revision_instructions.append("采纳以下建议:")
            for suggestion in suggestions[:3]:
                revision_instructions.append(f"  - {suggestion}")

        prompt = ChatPromptTemplate.from_messages([
            ("system", WRITER_SYSTEM_PROMPT),
            ("human", """
## 任务：修订稿件

### 原稿
{draft}

### 修订要求
{revision_instructions}

### 注意事项
1. 保留原稿中优秀的部分
2. 针对性地修复指出的问题
3. 保持整体风格一致
4. 修订后字数应与原稿相近

请输出修订后的完整内容：
""")
        ])

        chain = prompt | self.llm | StrOutputParser()

        try:
            revised_content = await chain.ainvoke({
                "draft": draft,
                "revision_instructions": "\n".join(revision_instructions)
            })
        except Exception as exc:
            if not allow_llm_fallback:
                raise RuntimeError("LLM execution failed with fallback disabled") from exc
            raise

        # 构建输出
        wordcount = len(revised_content)

        # 检测禁用词
        forbidden_found = [
            word for word in self.FORBIDDEN_WORDS
            if word in revised_content
        ]

        return WriterOutput(
            content=revised_content,
            wordcount=wordcount,
            characters_appeared=[],
            locations=[],
            foreshadows_planted=[],
            foreshadows_harvested=[],
            sensory_types_used=[],
            forbidden_words_found=forbidden_found,
            sections_needing_review=[]
        )


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
        
        result = await agent.write(input_data, allow_llm_fallback=state.get("allow_llm_fallback", True))
        
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
