# AI 写作 Agent 系统 - 软件设计文档 (V7: Ultimate Edition)

> **Version**: 7.0 (Ultimate - 七大AI工具 + 四大记忆系统)
> **Date**: 2026-02-02
> **Status**: Draft
> **Reference**: 
> - AI Tools: Superpowers + Claude Code + LobeHub + Continue + Cline + Kilo Code + Roo Code
> - Memory Systems: Mem0 + Zep + GAM + Cognee

---

## 1. 版本演进

| 版本 | 主题 | 核心增强 |
|------|------|---------|
| V4 | Cherry Integration | 知识图谱 + 向量搜索 |
| V5 | CCW Integration | L1-L5 工作流 + OpenKL |
| V6 | Seven Tools | 技能系统 + 钩子 + 上下文提供器 |
| **V7** | **Ultimate** | **四层记忆 + 时序追踪 + 冲突解决 + 迭代检索** |

---

## 2. 终极架构总览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           用户界面层 (UI Layer)                              │
│  CLI / Streamlit Web UI / IDE Plugin (VS Code)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                      上下文提供器 (Context Providers) [Continue]             │
│  @character  @scene  @memory  @style  @timeline  @foreshadow  @chapter     │
├─────────────────────────────────────────────────────────────────────────────┤
│                         钩子系统 (Hook System) [Claude Code]                 │
│  SessionStart / PreToolUse / PostToolUse / PreWrite / PostWrite / Stop      │
├─────────────────────────────────────────────────────────────────────────────┤
│                      技能系统 (Skills System) [Superpowers]                  │
│  1%强制调用 / 三层优先级 / 热重载 / SKILL.md 格式                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                         核心平台层 (Platform Core)                           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ Agent       │ │ Memory      │ │ Workflow    │ │ Knowledge   │           │
│  │ Framework   │ │ System      │ │ Engine      │ │ Graph       │           │
│  │ [Plan/Act]  │ │ [四层+时序] │ │ [L1-L5]     │ │ [Kùzu]      │           │
│  │ (Cline)     │ │ (Mem0/Zep)  │ │ (CCW)       │ │ (Cherry)    │           │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ Checkpoint  │ │ Mode        │ │ Citation    │ │ Retrieval   │           │
│  │ Manager     │ │ System      │ │ System      │ │ Engine      │           │
│  │ [Git-based] │ │ [多模式]    │ │ [溯源]      │ │ [迭代检索]  │           │
│  │ (Cline)     │ │ (Roo Code)  │ │ (OpenKL)    │ │ (GAM)       │           │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘           │
├─────────────────────────────────────────────────────────────────────────────┤
│                        基础设施层 (Infrastructure)                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │ Kùzu DB  │ │ FastEmbed│ │ SQLite   │ │ File I/O │ │ LLM Providers    │  │
│  │ (图存储) │ │ (384维)  │ │ (持久化) │ │          │ │ (Claude/GPT/...)│  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 记忆系统重大升级 [Mem0 + Zep + GAM]

### 3.1 四层记忆架构 (学习 Mem0)

```python
# src/memory/memory_layers.py

from enum import Enum
from dataclasses import dataclass, field
from typing import Optional, List, Dict
from datetime import datetime

class MemoryLayer(Enum):
    """四层记忆架构 - 参考 Mem0"""
    EPHEMERAL = "ephemeral"   # 临时记忆 (当前对话，TTL < 1小时)
    SESSION = "session"       # 会话记忆 (当前写作任务)
    USER = "user"             # 用户记忆 (长期个人偏好)
    PROJECT = "project"       # 项目记忆 (小说级别共享)

class MemoryScope:
    """记忆作用域 - 多用户/多项目隔离"""
    user_id: Optional[str] = None
    project_id: Optional[str] = None
    session_id: Optional[str] = None

@dataclass
class LayeredMemory:
    """分层记忆结构"""
    id: str
    content: str
    layer: MemoryLayer = MemoryLayer.USER
    scope: MemoryScope = field(default_factory=MemoryScope)
    
    # 时序追踪 (学习 Zep)
    valid_from: datetime = field(default_factory=datetime.now)
    valid_until: Optional[datetime] = None
    superseded_by: Optional[str] = None  # 被哪条记忆替代
    
    # 重要性衰减
    importance: float = 0.5
    access_count: int = 0
    last_accessed: Optional[datetime] = None
    
    # 元数据
    tags: List[str] = field(default_factory=list)
    source: str = "user"  # user / agent / system
    confidence: float = 1.0
```

### 3.2 时序知识追踪 (学习 Zep Graphiti)

```python
# src/memory/temporal_memory.py

from dataclasses import dataclass
from datetime import datetime
from typing import Optional, List

@dataclass
class TemporalFact:
    """
    时序事实 - 支持知识演变追踪
    
    示例：
    - "主角喜欢红色" (valid_from: 第1章, valid_until: 第5章)
    - "主角现在喜欢蓝色" (valid_from: 第5章, supersedes: 上条)
    """
    id: str
    content: str
    entity_id: str  # 关联的实体（角色、地点等）
    
    # 时序边界
    valid_from: datetime
    valid_until: Optional[datetime] = None
    
    # 替代关系
    supersedes: Optional[str] = None      # 我替代了哪条
    superseded_by: Optional[str] = None   # 我被谁替代
    
    # 来源追踪
    source_chapter: Optional[str] = None
    source_scene: Optional[str] = None
    
    # 置信度
    confidence: float = 1.0

class TemporalMemoryManager:
    """时序记忆管理器"""
    
    def add_fact(self, fact: TemporalFact) -> str:
        """添加时序事实"""
        # 1. 检测冲突
        conflicts = self._detect_conflicts(fact)
        if conflicts:
            # 自动处理冲突
            for old_fact in conflicts:
                old_fact.valid_until = fact.valid_from
                old_fact.superseded_by = fact.id
                fact.supersedes = old_fact.id
        
        # 2. 存储
        return self._store(fact)
    
    def query_at_time(self, entity_id: str, query_time: datetime) -> List[TemporalFact]:
        """时间点查询 - 获取特定时间有效的事实"""
        # Cypher 查询：
        # MATCH (f:Fact {entity_id: $entity_id})
        # WHERE f.valid_from <= $query_time 
        #   AND (f.valid_until IS NULL OR f.valid_until > $query_time)
        # RETURN f
        pass
    
    def get_evolution(self, entity_id: str) -> List[TemporalFact]:
        """获取实体知识演变历史"""
        pass
```

### 3.3 智能冲突解决 (学习 Mem0)

```python
# src/memory/conflict_resolver.py

from dataclasses import dataclass
from typing import List, Optional
from enum import Enum

class ConflictAction(Enum):
    INSERT = "insert"      # 直接插入
    UPDATE = "update"      # 更新现有
    MERGE = "merge"        # 合并信息
    REJECT = "reject"      # 拒绝新记忆
    ASK_USER = "ask_user"  # 询问用户

@dataclass
class ConflictResolution:
    action: ConflictAction
    obsolete_ids: List[str] = None
    merged_content: Optional[str] = None
    reason: str = ""

class ConflictResolver:
    """
    智能冲突解决器 - 参考 Mem0
    
    处理场景：
    1. 重复记忆检测
    2. 矛盾信息检测
    3. 信息更新处理
    """
    
    def __init__(self, llm_client, vector_search, similarity_threshold: float = 0.85):
        self.llm = llm_client
        self.vector_search = vector_search
        self.similarity_threshold = similarity_threshold
    
    async def check_and_resolve(
        self, 
        new_memory: str, 
        scope: MemoryScope
    ) -> ConflictResolution:
        """检查并解决冲突"""
        
        # 1. 语义相似度检测
        similar_memories = await self.vector_search.search(
            query=new_memory,
            scope=scope,
            threshold=self.similarity_threshold
        )
        
        if not similar_memories:
            return ConflictResolution(action=ConflictAction.INSERT)
        
        # 2. LLM 驱动的矛盾检测
        conflicts = await self._detect_contradictions(new_memory, similar_memories)
        
        if not conflicts:
            # 相似但不矛盾 - 可能是补充信息
            return ConflictResolution(
                action=ConflictAction.MERGE,
                merged_content=await self._merge_facts(new_memory, similar_memories)
            )
        
        # 3. 有矛盾 - 更新旧记忆
        return ConflictResolution(
            action=ConflictAction.UPDATE,
            obsolete_ids=[c.id for c in conflicts],
            reason=f"新信息替代了 {len(conflicts)} 条旧记忆"
        )
    
    async def _detect_contradictions(self, new: str, existing: List) -> List:
        """使用 LLM 检测矛盾"""
        prompt = f"""
分析以下新信息是否与现有信息矛盾：

新信息：{new}

现有信息：
{chr(10).join([f"- {m.content}" for m in existing])}

如果存在矛盾，返回矛盾的现有信息ID列表。
如果是补充而非矛盾，返回空列表。
"""
        # LLM 调用...
        pass
    
    async def _merge_facts(self, new: str, existing: List) -> str:
        """合并多个相关事实"""
        prompt = f"""
将以下信息合并为一条完整的记忆：

新信息：{new}

相关信息：
{chr(10).join([f"- {m.content}" for m in existing])}

生成一条综合的、信息完整的记忆。
"""
        # LLM 调用...
        pass
```

### 3.4 迭代检索引擎 (学习 GAM)

```python
# src/search/iterative_retriever.py

from dataclasses import dataclass
from typing import List, Optional

@dataclass
class RetrievalStep:
    """检索步骤"""
    query: str
    results: List[dict]
    reflection: str  # 对结果的反思
    next_query: Optional[str] = None  # 下一步查询

class IterativeRetriever:
    """
    迭代检索器 - 参考 GAM (General Agentic Memory)
    
    核心理念：检索 → 反思 → 再检索，直到信息充足
    """
    
    def __init__(self, vector_search, llm_client, max_iterations: int = 3):
        self.vector_search = vector_search
        self.llm = llm_client
        self.max_iterations = max_iterations
    
    async def search(self, query: str, context: str = "") -> dict:
        """
        迭代检索流程：
        1. 初始检索
        2. 反思结果是否充足
        3. 如果不充足，生成新查询继续检索
        4. 最终合成答案
        """
        steps: List[RetrievalStep] = []
        accumulated_context = []
        current_query = query
        
        for i in range(self.max_iterations):
            # 1. 执行检索
            results = await self.vector_search.hybrid_search(
                query=current_query,
                context=context
            )
            
            accumulated_context.extend(results)
            
            # 2. 反思结果
            reflection = await self._reflect(query, accumulated_context)
            
            step = RetrievalStep(
                query=current_query,
                results=results,
                reflection=reflection["reasoning"]
            )
            steps.append(step)
            
            # 3. 判断是否充足
            if reflection["is_sufficient"]:
                break
            
            # 4. 生成下一个查询
            current_query = reflection["next_query"]
            step.next_query = current_query
        
        # 5. 合成最终结果
        synthesis = await self._synthesize(query, accumulated_context, steps)
        
        return {
            "answer": synthesis,
            "steps": steps,
            "sources": accumulated_context
        }
    
    async def _reflect(self, original_query: str, context: List) -> dict:
        """反思当前检索结果"""
        prompt = f"""
原始问题：{original_query}

已检索到的信息：
{self._format_context(context)}

请分析：
1. 当前信息是否足以回答问题？
2. 如果不足，还需要查询什么信息？

返回 JSON：
{{
    "is_sufficient": true/false,
    "reasoning": "分析说明",
    "next_query": "下一步查询（如果不足）"
}}
"""
        # LLM 调用...
        pass
    
    async def _synthesize(self, query: str, context: List, steps: List) -> str:
        """合成最终答案"""
        pass
```

### 3.5 六维写作记忆 (学习 LobeHub + 写作适配)

```python
# src/memory/six_dimensional_memory.py

from dataclasses import dataclass, field
from typing import Dict, List
from enum import Enum

class WritingMemoryDimension(Enum):
    """六维写作记忆 - LobeHub 适配"""
    
    # 1. 事件时间线 (Activities)
    TIMELINE = "timeline"       # 故事中发生的事件序列
    
    # 2. 故事上下文 (Contexts)
    CONTEXT = "context"         # 当前场景、目标、冲突
    
    # 3. 写作经验 (Experiences)
    EXPERIENCE = "experience"   # 用户反馈、修改历史、偏好学习
    
    # 4. 角色身份 (Identities)
    CHARACTER = "character"     # 人物关系、社交网络
    
    # 5. 创作偏好 (Preferences)
    PREFERENCE = "preference"   # 风格偏好、禁忌设定、常用词汇
    
    # 6. 世界设定 (Personas → Worldview)
    WORLDVIEW = "worldview"     # 世界观、魔法体系、社会结构

@dataclass
class SixDimensionalMemory:
    """六维写作记忆存储"""
    
    dimensions: Dict[WritingMemoryDimension, List[dict]] = field(default_factory=dict)
    
    def add_memory(self, dimension: WritingMemoryDimension, content: dict):
        """添加到指定维度"""
        if dimension not in self.dimensions:
            self.dimensions[dimension] = []
        self.dimensions[dimension].append(content)
    
    def query_dimension(self, dimension: WritingMemoryDimension, query: str) -> List[dict]:
        """查询特定维度"""
        pass
    
    def cross_dimensional_search(self, query: str) -> Dict[WritingMemoryDimension, List[dict]]:
        """跨维度搜索"""
        pass

# 维度特化管理器
class TimelineManager:
    """时间线维度管理 - 事件序列"""
    def add_event(self, chapter: str, scene: str, event: str, timestamp: str): pass
    def get_chapter_events(self, chapter: str) -> List[dict]: pass
    def get_timeline(self, start: str, end: str) -> List[dict]: pass

class CharacterManager:
    """角色维度管理 - 人物关系"""
    def add_character(self, name: str, profile: dict): pass
    def add_relationship(self, char1: str, char2: str, relation: str): pass
    def get_character_network(self, name: str) -> dict: pass

class WorldviewManager:
    """世界观维度管理 - 设定系统"""
    def add_setting(self, category: str, name: str, description: str): pass
    def get_magic_system(self) -> dict: pass
    def get_social_structure(self) -> dict: pass
```

---

## 4. 技能系统增强 [Superpowers]

### 4.1 强制调用机制

```python
# src/skills/skill_enforcer.py

class SkillEnforcer:
    """
    技能强制调用器 - 1% 规则
    
    在任何 Agent 响应前，必须检查并调用相关技能
    """
    
    def __init__(self, skill_loader: SkillLoader, threshold: float = 0.01):
        self.loader = skill_loader
        self.threshold = threshold
    
    def enforce(self, task: str) -> List[Skill]:
        """
        强制检查并返回必须调用的技能
        
        规则：如果相关性 >= 1%，必须调用
        """
        all_skills = self.loader.discover_skills()
        mandatory = []
        
        for skill in all_skills:
            relevance = self._calculate_relevance(task, skill)
            if relevance >= self.threshold:
                mandatory.append(skill)
        
        return sorted(mandatory, key=lambda s: s.priority)
    
    def _calculate_relevance(self, task: str, skill: Skill) -> float:
        """计算任务与技能的相关性"""
        # 1. 关键词匹配
        keyword_score = self._keyword_match(task, skill.triggers)
        
        # 2. 语义相似度
        semantic_score = self._semantic_similarity(task, skill.description)
        
        # 3. 标签匹配
        tag_score = self._tag_match(task, skill.tags)
        
        return max(keyword_score, semantic_score, tag_score)
```

### 4.2 写作技能包

| 技能 | 文件 | 触发词 | 优先级 |
|------|------|--------|--------|
| `brainstorming` | `skills/brainstorming/SKILL.md` | 头脑风暴, 构思, 设定 | P0 |
| `chapter-writing` | `skills/chapter-writing/SKILL.md` | 写章节, 续写, 创作 | P0 |
| `character-design` | `skills/character-design/SKILL.md` | 角色设计, 人物 | P1 |
| `dialogue-polish` | `skills/dialogue-polish/SKILL.md` | 对话润色, 修改对话 | P1 |
| `plot-structuring` | `skills/plot-structuring/SKILL.md` | 剧情结构, 故事线 | P1 |
| `foreshadowing` | `skills/foreshadowing/SKILL.md` | 伏笔, 埋线, 呼应 | P2 |
| `style-consistency` | `skills/style-consistency/SKILL.md` | 风格检查, 一致性 | P2 |

---

## 5. 钩子系统 [Claude Code]

### 5.1 写作生命周期钩子

```python
# src/hooks/writing_hooks.py

class WritingHooks:
    """写作专用钩子"""
    
    @hook(HookType.SESSION_START)
    async def load_story_context(self, session: Session) -> dict:
        """会话开始时加载故事上下文"""
        return {
            "current_chapter": await self.get_current_chapter(),
            "character_summaries": await self.get_active_characters(),
            "recent_events": await self.get_recent_events(limit=10),
            "pending_foreshadows": await self.get_unresolved_foreshadows(),
            "style_guide": await self.get_style_guide()
        }
    
    @hook(HookType.PRE_WRITE)
    async def validate_scene_card(self, context: dict) -> bool:
        """写作前验证场景卡片完整性"""
        scene_card = context.get("scene_card")
        if not scene_card:
            return True  # 无场景卡片时跳过
        
        required_fields = ["location", "characters", "goal", "conflict"]
        missing = [f for f in required_fields if not scene_card.get(f)]
        
        if missing:
            raise ValidationError(f"场景卡片缺少: {missing}")
        
        return True
    
    @hook(HookType.POST_WRITE)
    async def update_knowledge_graph(self, result: WriteResult):
        """写作后自动更新知识图谱"""
        # 1. 提取新实体
        entities = await self.extract_entities(result.content)
        
        # 2. 提取关系
        relations = await self.extract_relations(result.content, entities)
        
        # 3. 更新图谱
        await self.knowledge_graph.batch_update(entities, relations)
        
        # 4. 检查伏笔状态
        await self.check_foreshadow_resolution(result.content)
    
    @hook(HookType.POST_WRITE)
    async def trigger_evaluation(self, result: WriteResult):
        """写作后触发多维评估"""
        evaluation = await self.critic.evaluate(
            content=result.content,
            dimensions=["LOCK", "五感", "风格一致性", "角色一致性"]
        )
        
        if evaluation.overall_score < 0.7:
            # 触发修改建议
            await self.suggest_improvements(evaluation)
```

---

## 6. 上下文提供器 [Continue]

### 6.1 @引用系统

```python
# src/context/providers.py

class ContextProviderRegistry:
    """上下文提供器注册表"""
    
    providers = {
        "@character": CharacterProvider,    # 角色设定
        "@scene": SceneProvider,            # 场景描述
        "@chapter": ChapterProvider,        # 章节内容
        "@memory": MemoryProvider,          # 语义搜索记忆
        "@timeline": TimelineProvider,      # 时间线事件
        "@foreshadow": ForeshadowProvider,  # 伏笔状态
        "@style": StyleProvider,            # 风格指南
        "@worldview": WorldviewProvider,    # 世界观设定
        "@relationship": RelationshipProvider,  # 人物关系
    }

# 使用示例
"""
用户输入: 
"写第5章，@character:张三 决定离开 @scene:古堡，
回忆起 @memory:与李四的约定"

系统自动：
1. 解析所有 @ 引用
2. 并行获取各提供器内容
3. 构建完整上下文
4. 传递给 Writer Agent
"""
```

---

## 7. Plan/Act 双模式 [Cline]

### 7.1 Commander 增强

```python
# src/agents/commander.py (增强版)

class CommanderMode(Enum):
    PLAN = "plan"   # 计划模式：收集信息、生成计划、等待审批
    ACT = "act"     # 执行模式：按计划执行、创建检查点

class EnhancedCommander(Commander):
    """增强版 Commander - 支持 Plan/Act 模式"""
    
    def __init__(self):
        super().__init__()
        self.mode = CommanderMode.PLAN
        self.current_plan: Optional[Plan] = None
    
    async def process(self, task: str) -> Result:
        if self.mode == CommanderMode.PLAN:
            return await self.plan_mode(task)
        else:
            return await self.act_mode()
    
    async def plan_mode(self, task: str) -> Plan:
        """
        计划模式：
        1. 分析任务复杂度
        2. 查询相关记忆和知识
        3. 生成详细执行计划
        4. 等待用户审批
        """
        # 1. 复杂度分析
        complexity = await self.analyze_complexity(task)
        
        # 2. 收集上下文
        context = await self.gather_context(task)
        
        # 3. 生成计划
        plan = await self.generate_plan(task, complexity, context)
        
        # 4. 返回计划等待审批
        self.current_plan = plan
        return plan
    
    async def act_mode(self) -> Result:
        """
        执行模式：
        1. 按计划逐步执行
        2. 每步创建检查点
        3. 支持中断和回滚
        """
        if not self.current_plan:
            raise ValueError("No plan to execute")
        
        results = []
        for step in self.current_plan.steps:
            # 创建检查点
            checkpoint = await self.checkpoint_manager.create(step)
            
            try:
                result = await self.execute_step(step)
                results.append(result)
            except Exception as e:
                # 回滚到上一个检查点
                await self.checkpoint_manager.restore(checkpoint)
                raise
        
        return Result(steps=results)
```

---

## 8. 检查点系统 [Cline]

```python
# src/workflow/checkpoint_manager.py

class CheckpointManager:
    """
    检查点管理器 - Git-based 状态快照
    """
    
    def __init__(self, repo_path: str):
        self.repo_path = repo_path
        self.checkpoints_dir = Path(repo_path) / ".niko" / "checkpoints"
    
    async def create(self, step: PlanStep) -> Checkpoint:
        """创建检查点"""
        checkpoint_id = f"cp_{step.id}_{datetime.now().isoformat()}"
        
        checkpoint = Checkpoint(
            id=checkpoint_id,
            step_id=step.id,
            created_at=datetime.now(),
            state={
                "chapter_content": await self.get_current_chapter(),
                "knowledge_graph_snapshot": await self.kg.export(),
                "memory_state": await self.memory.export(),
                "agent_history": self.conversation_history.copy()
            }
        )
        
        # 保存到文件
        await self.save_checkpoint(checkpoint)
        
        # 创建 Git 提交
        await self.git_commit(f"Checkpoint: {checkpoint_id}")
        
        return checkpoint
    
    async def restore(self, checkpoint: Checkpoint):
        """恢复到检查点"""
        # 1. 恢复章节内容
        await self.restore_chapter(checkpoint.state["chapter_content"])
        
        # 2. 恢复知识图谱
        await self.kg.import_snapshot(checkpoint.state["knowledge_graph_snapshot"])
        
        # 3. 恢复记忆状态
        await self.memory.import_state(checkpoint.state["memory_state"])
        
        # 4. Git reset
        await self.git_reset(checkpoint.commit_hash)
    
    async def list_checkpoints(self, session_id: str) -> List[Checkpoint]:
        """列出会话的所有检查点"""
        pass
```

---

## 9. 多模式系统 [Roo Code]

```python
# src/modes/writing_modes.py

class WritingMode(Enum):
    """写作模式"""
    DRAFT = "draft"           # 草稿模式 - 快速生成
    POLISH = "polish"         # 润色模式 - 精细修改
    REVIEW = "review"         # 评审模式 - 多维评估
    OUTLINE = "outline"       # 大纲模式 - 结构规划
    DIALOGUE = "dialogue"     # 对话模式 - 专注对话
    DESCRIPTION = "description"  # 描写模式 - 场景描写
    FORESHADOW = "foreshadow"    # 伏笔模式 - 伏笔管理

class ModeSystem:
    """模式系统管理"""
    
    mode_configs = {
        WritingMode.DRAFT: {
            "agent_behavior": "快速生成，不追求完美",
            "evaluation_threshold": 0.5,
            "allowed_tools": ["Write", "Read"],
            "prompt_modifier": "快速创作，保持流畅"
        },
        WritingMode.POLISH: {
            "agent_behavior": "细致修改，提升质量",
            "evaluation_threshold": 0.8,
            "allowed_tools": ["Write", "Read", "Edit", "Critique"],
            "prompt_modifier": "精雕细琢，注重文学性"
        },
        WritingMode.REVIEW: {
            "agent_behavior": "只读分析，不做修改",
            "evaluation_threshold": 0.9,
            "allowed_tools": ["Read", "Critique", "Analyze"],
            "prompt_modifier": "严格评审，多维度分析"
        }
    }
    
    def switch_mode(self, mode: WritingMode):
        """切换写作模式"""
        config = self.mode_configs[mode]
        self.current_mode = mode
        self.apply_config(config)
```

---

## 10. 更新的任务清单

### Phase 15: 记忆系统升级 (Priority: P0) [NEW]

```
15.1 四层记忆架构 [Mem0]
    - [ ] src/memory/memory_layers.py
    - [ ] 实现 MemoryLayer 枚举
    - [ ] 实现 LayeredMemory 数据结构
    - [ ] 实现层级间提升/降级逻辑

15.2 时序知识追踪 [Zep]
    - [ ] src/memory/temporal_memory.py
    - [ ] 实现 TemporalFact 数据结构
    - [ ] 实现 valid_from/valid_until 追踪
    - [ ] 实现 supersedes 替代链
    - [ ] 实现时间点查询

15.3 智能冲突解决 [Mem0]
    - [ ] src/memory/conflict_resolver.py
    - [ ] 实现语义相似度检测
    - [ ] 实现 LLM 驱动的矛盾检测
    - [ ] 实现 MERGE/UPDATE/REJECT 策略

15.4 迭代检索引擎 [GAM]
    - [ ] src/search/iterative_retriever.py
    - [ ] 实现检索-反思-再检索循环
    - [ ] 实现信息充足性判断
    - [ ] 实现最终合成

15.5 六维写作记忆 [LobeHub]
    - [ ] src/memory/six_dimensional_memory.py
    - [ ] 实现 TimelineManager
    - [ ] 实现 CharacterManager
    - [ ] 实现 WorldviewManager
```

### Phase 16: 七大工具集成 (Priority: P0)

```
16.1 技能系统 [Superpowers]
    - [ ] src/skills/skill_enforcer.py
    - [ ] 创建 7 个写作技能 SKILL.md

16.2 钩子系统 [Claude Code]
    - [ ] src/hooks/hook_system.py
    - [ ] src/hooks/writing_hooks.py

16.3 上下文提供器 [Continue]
    - [ ] src/context/providers.py
    - [ ] 实现 @character, @scene 等提供器

16.4 Plan/Act 双模式 [Cline]
    - [ ] 增强 src/agents/commander.py

16.5 检查点系统 [Cline]
    - [ ] src/workflow/checkpoint_manager.py

16.6 多模式系统 [Roo Code]
    - [ ] src/modes/writing_modes.py
```

---

## 11. 开发优先级总结

```
🔴 P0 - 立即实施 (Week 1-2)
├── 四层记忆架构 (最大价值)
├── 时序知识追踪 (核心差异化)
├── 智能冲突解决 (数据质量保障)
└── 技能强制调用 (行为一致性)

🟡 P1 - 短期规划 (Week 3-4)
├── 迭代检索引擎
├── 钩子系统
├── 上下文提供器
└── Plan/Act 双模式

🟢 P2 - 中期规划 (Week 5-6)
├── 六维写作记忆
├── 检查点系统
├── 多模式系统
└── MCP 集成
```

---

## 12. 预期收益

| 改进项 | 来源 | 预期收益 |
|--------|------|---------|
| 四层记忆 | Mem0 | 减少记忆污染 60% |
| 时序追踪 | Zep | 知识一致性 +50% |
| 冲突解决 | Mem0 | 数据质量 +40% |
| 迭代检索 | GAM | 检索准确率 +35% |
| 技能系统 | Superpowers | 写作质量 +40% |
| 钩子系统 | Claude Code | 自动化 +50% |
| 上下文提供器 | Continue | 减少重复输入 60% |
| Plan/Act | Cline | 复杂任务处理 +30% |
| 检查点 | Cline | 容错能力 +50% |
| 多模式 | Roo Code | 用户体验 +30% |

---

**总结**：V7 版本将 Niko-Studio 从基础写作 Agent 升级为 **业界领先的 AI 写作平台**，融合了七大 AI 编程工具的架构优势和四大记忆系统的核心能力。
