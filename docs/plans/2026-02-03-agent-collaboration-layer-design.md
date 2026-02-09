# Agent 协作层设计 (Agent Collaboration Layer)

**版本**: 1.0
**日期**: 2026-02-03
**状态**: 设计完成，待实现

---

## 1. 概述

### 1.1 设计目标

构建一个**混合式多智能体协作系统**：

- **四类专业 Agent**：角色、情节、世界观、风格专家
- **混合式协作**：简单任务直接执行，复杂任务协作探索
- **共享上下文**：共享内存 + 消息传递的混合方式

### 1.2 架构决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 协作模式 | 混合式 | 简单任务高效，复杂任务充分协作 |
| Agent 类型 | 4 类专业 Agent | 覆盖小说创作核心维度 |
| 上下文共享 | 共享内存 + 消息传递 | 兼顾效率和灵活性 |

### 1.3 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                   Agent 协作层 (Agent Collaboration)             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    Supervisor (协调者)                      │ │
│  │  - 任务分解与分发                                           │ │
│  │  - 复杂度评估 → 直接执行 / 协作探索                          │ │
│  │  - 结果综合与冲突解决                                       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│         ┌────────────────────┼────────────────────┐              │
│         │                    │                    │              │
│         ▼                    ▼                    ▼              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐ │
│  │ Character  │  │   Plot     │  │   World    │  │   Style    │ │
│  │   Agent    │  │   Agent    │  │   Agent    │  │   Agent    │ │
│  │  (角色)    │  │  (情节)    │  │  (世界观)  │  │  (风格)    │ │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘ │
│        │               │               │               │        │
│        └───────────────┴───────────────┴───────────────┘        │
│                              │                                   │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  SharedContext (共享上下文)                  │ │
│  │  - NovelMemory: 小说知识缓存                                │ │
│  │  - WorkingMemory: 当前任务工作区                            │ │
│  │  - MessageBus: Agent 间消息通道                             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 核心数据结构

```python
from dataclasses import dataclass, field
from enum import Enum
from typing import Protocol, Any

class AgentRole(Enum):
    """Agent 角色类型"""
    CHARACTER = "character"  # 角色专家
    PLOT = "plot"            # 情节专家
    WORLD = "world"          # 世界观专家
    STYLE = "style"          # 风格专家
    SUPERVISOR = "supervisor" # 协调者

class TaskComplexity(Enum):
    """任务复杂度"""
    SIMPLE = "simple"        # 单 Agent 可处理
    MODERATE = "moderate"    # 需要 2-3 个 Agent
    COMPLEX = "complex"      # 需要全部 Agent 协作

@dataclass
class AgentTask:
    """Agent 任务"""
    id: str
    query: str
    complexity: TaskComplexity
    required_roles: list[AgentRole]
    context: dict = field(default_factory=dict)
    parent_task_id: str | None = None

@dataclass
class AgentResponse:
    """Agent 响应"""
    agent_role: AgentRole
    task_id: str
    content: str
    confidence: float  # 0-1
    evidence: list[str]  # 支持证据
    suggestions: list[str] = field(default_factory=list)
    conflicts: list[str] = field(default_factory=list)

@dataclass
class CollaborationResult:
    """协作结果"""
    query: str
    responses: list[AgentResponse]
    synthesized_answer: str
    consensus_level: float  # 共识程度 0-1
    resolved_conflicts: list[str]
    metadata: dict = field(default_factory=dict)
```

---

## 3. 共享上下文系统

### 3.1 SharedContext 结构

```python
@dataclass
class SharedContext:
    """Agent 共享上下文"""
    novel_memory: 'NovelMemory'      # 小说知识（持久化）
    working_memory: 'WorkingMemory'  # 当前任务工作区（会话级）
    message_bus: 'MessageBus'        # Agent 间消息通道
```

### 3.2 NovelMemory 小说知识缓存

```python
class NovelMemory:
    """小说知识缓存（跨会话持久化）"""

    def __init__(self, storage: StorageManager):
        self.storage = storage
        self._cache: dict[str, Any] = {}

    async def get_character(self, name: str) -> dict | None:
        """获取角色信息"""
        cache_key = f"character:{name}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        entities = await self.storage.graph.match_entities(
            [name], entity_types=["Character"]
        )
        if not entities:
            return None

        entity = entities[0]
        relations = await self.storage.graph.get_relations(entity.id)

        character_info = {
            "id": entity.id,
            "name": entity.name,
            "properties": entity.properties,
            "relations": [
                {"type": r.type, "target": r.target_id, "props": r.properties}
                for r in relations
            ]
        }

        self._cache[cache_key] = character_info
        return character_info

    async def get_world_setting(self, aspect: str) -> dict | None:
        """获取世界观设定"""
        cache_key = f"world:{aspect}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        results = await self.storage.vector.search_by_text(
            f"世界观设定 {aspect}",
            top_k=5,
            filter={"type": "world_setting"}
        )

        if not results:
            return None

        setting = {
            "aspect": aspect,
            "documents": [
                {"content": doc.content, "metadata": doc.metadata}
                for doc, _ in results
            ]
        }

        self._cache[cache_key] = setting
        return setting

    async def get_recent_plot(self, chapter_range: tuple[int, int] = None) -> list[dict]:
        """获取近期情节"""
        filter_cond = {"type": "plot_event"}
        if chapter_range:
            filter_cond["chapter"] = {"$gte": chapter_range[0], "$lte": chapter_range[1]}

        results = await self.storage.vector.search_by_text(
            "情节事件",
            top_k=20,
            filter=filter_cond
        )

        return [
            {"content": doc.content, "chapter": doc.metadata.get("chapter")}
            for doc, _ in results
        ]

    def invalidate(self, pattern: str = "*"):
        """清除缓存"""
        if pattern == "*":
            self._cache.clear()
        else:
            keys_to_remove = [k for k in self._cache if pattern in k]
            for k in keys_to_remove:
                del self._cache[k]
```

### 3.3 WorkingMemory 工作区

```python
class WorkingMemory:
    """当前任务工作区（会话级）"""

    def __init__(self):
        self._slots: dict[str, Any] = {}
        self._agent_contributions: dict[AgentRole, list[dict]] = defaultdict(list)
        self._facts: list[dict] = []
        self._hypotheses: list[dict] = []
        self._conflicts: list[dict] = []

    def set(self, key: str, value: Any, agent: AgentRole = None):
        """设置工作区槽位"""
        self._slots[key] = {
            "value": value,
            "set_by": agent,
            "timestamp": time.time()
        }
        if agent:
            self._agent_contributions[agent].append({
                "action": "set",
                "key": key,
                "value": value
            })

    def get(self, key: str) -> Any:
        """获取槽位值"""
        slot = self._slots.get(key)
        return slot["value"] if slot else None

    def add_fact(self, fact: str, source: AgentRole, evidence: list[str]):
        """添加已确认事实"""
        self._facts.append({
            "content": fact,
            "source": source,
            "evidence": evidence,
            "timestamp": time.time()
        })

    def add_hypothesis(self, hypothesis: str, source: AgentRole, confidence: float):
        """添加待验证假设"""
        self._hypotheses.append({
            "content": hypothesis,
            "source": source,
            "confidence": confidence,
            "verified": False
        })

    def add_conflict(self, description: str, agents: list[AgentRole], details: dict):
        """记录冲突"""
        self._conflicts.append({
            "description": description,
            "agents": agents,
            "details": details,
            "resolved": False
        })

    def get_context_for_agent(self, role: AgentRole) -> dict:
        """为特定 Agent 构建上下文"""
        return {
            "facts": self._facts,
            "hypotheses": [h for h in self._hypotheses if not h["verified"]],
            "other_contributions": {
                r: contribs for r, contribs in self._agent_contributions.items()
                if r != role
            },
            "unresolved_conflicts": [c for c in self._conflicts if not c["resolved"]]
        }

    def summarize(self) -> dict:
        """总结工作区状态"""
        return {
            "fact_count": len(self._facts),
            "hypothesis_count": len(self._hypotheses),
            "conflict_count": len([c for c in self._conflicts if not c["resolved"]]),
            "contributing_agents": list(self._agent_contributions.keys())
        }

    def clear(self):
        """清空工作区"""
        self._slots.clear()
        self._agent_contributions.clear()
        self._facts.clear()
        self._hypotheses.clear()
        self._conflicts.clear()
```

### 3.4 MessageBus 消息通道

```python
@dataclass
class AgentMessage:
    """Agent 间消息"""
    id: str
    sender: AgentRole
    receiver: AgentRole | None  # None = 广播
    type: str  # query, response, notify, request_review
    content: Any
    reply_to: str | None = None
    timestamp: float = field(default_factory=time.time)

class MessageBus:
    """Agent 间消息总线"""

    def __init__(self):
        self._queues: dict[AgentRole, Queue] = {}
        self._handlers: dict[AgentRole, dict[str, Callable]] = defaultdict(dict)
        self._message_history: list[AgentMessage] = []

    def register_agent(self, role: AgentRole):
        """注册 Agent"""
        self._queues[role] = Queue()

    async def send(self, message: AgentMessage):
        """发送消息"""
        self._message_history.append(message)

        if message.receiver is None:
            for role, queue in self._queues.items():
                if role != message.sender:
                    await queue.put(message)
        else:
            if message.receiver in self._queues:
                await self._queues[message.receiver].put(message)

    async def send_and_wait(
        self,
        message: AgentMessage,
        timeout: float = 30.0
    ) -> AgentMessage | None:
        """发送并等待回复"""
        await self.send(message)

        try:
            reply = await asyncio.wait_for(
                self._wait_for_reply(message.id, message.sender),
                timeout=timeout
            )
            return reply
        except asyncio.TimeoutError:
            return None

    async def receive(self, role: AgentRole) -> AgentMessage:
        """接收消息"""
        return await self._queues[role].get()

    def get_conversation(
        self,
        between: tuple[AgentRole, AgentRole] = None
    ) -> list[AgentMessage]:
        """获取对话历史"""
        if between is None:
            return self._message_history.copy()

        return [
            m for m in self._message_history
            if (m.sender in between and
                (m.receiver is None or m.receiver in between))
        ]
```

---

## 4. 专业 Agent 设计

### 4.1 BaseAgent 抽象基类

```python
from abc import ABC, abstractmethod

class BaseAgent(ABC):
    """Agent 基类"""

    def __init__(
        self,
        role: AgentRole,
        context: SharedContext,
        config: AgentConfig
    ):
        self.role = role
        self.context = context
        self.config = config
        self.context.message_bus.register_agent(role)

    @abstractmethod
    async def process(self, task: AgentTask) -> AgentResponse:
        """处理任务"""
        ...

    @abstractmethod
    def get_expertise_prompt(self) -> str:
        """获取专业领域 Prompt"""
        ...

    async def explore(self, query: str) -> AgentResponse:
        """探索性查询（用于 Multi-Agent Search）"""
        knowledge = await self._gather_knowledge(query)
        prompt = self._build_exploration_prompt(query, knowledge)
        response = await self._generate(prompt)

        return AgentResponse(
            agent_role=self.role,
            task_id=f"explore_{uuid.uuid4().hex[:8]}",
            content=response["answer"],
            confidence=response["confidence"],
            evidence=response["evidence"],
            suggestions=response.get("suggestions", [])
        )

    async def _gather_knowledge(self, query: str) -> dict:
        """收集相关知识"""
        return {
            "novel_context": await self._get_relevant_context(query),
            "working_memory": self.context.working_memory.get_context_for_agent(self.role)
        }

    @abstractmethod
    async def _get_relevant_context(self, query: str) -> dict:
        """获取角色相关的上下文"""
        ...

    async def _generate(self, prompt: str) -> dict:
        """LLM 生成"""
        response = await llm.generate(
            prompt,
            model=self.config.model,
            temperature=self.config.temperature
        )
        return parse_json(response)
```

### 4.2 CharacterAgent 角色专家

```python
class CharacterAgent(BaseAgent):
    """角色专家 Agent"""

    EXPERTISE_PROMPT = """你是一位角色分析专家，专注于：
- 角色性格、动机、背景分析
- 角色关系网络和人物弧光
- 角色行为一致性验证
- 角色对话风格和语言特征

在回答时，请从角色心理和人物塑造的角度进行分析。"""

    EXPLORATION_PROMPT = """## 角色专家分析

### 查询
{query}

### 相关角色信息
{character_context}

### 工作区上下文
{working_context}

### 任务
从角色塑造的角度分析这个问题：
1. 涉及哪些角色？他们的性格/动机如何影响情况？
2. 角色关系如何作用于此？
3. 行为是否符合已建立的角色设定？
4. 有哪些值得注意的角色发展机会？

### 输出格式
```json
{{
  "answer": "详细分析",
  "confidence": 0.0-1.0,
  "evidence": ["支持证据1", "支持证据2"],
  "characters_involved": ["角色1", "角色2"],
  "relationship_insights": "关系洞察",
  "consistency_check": "一致性检查结果",
  "suggestions": ["建议1", "建议2"]
}}
```"""

    async def _get_relevant_context(self, query: str) -> dict:
        """获取角色相关上下文"""
        character_names = await self._extract_character_names(query)

        characters = {}
        for name in character_names:
            char_info = await self.context.novel_memory.get_character(name)
            if char_info:
                characters[name] = char_info

        if characters:
            entity_ids = [c["id"] for c in characters.values()]
            neighborhood = await self.context.novel_memory.storage.graph.expand_neighborhood(
                entity_ids,
                max_hops=1,
                relation_filter=["KNOWS", "LOVES", "HATES", "FAMILY", "ALLY", "ENEMY"]
            )
            relationships = self._format_relationships(neighborhood)
        else:
            relationships = []

        return {
            "characters": characters,
            "relationships": relationships
        }
```

### 4.3 PlotAgent 情节专家

```python
class PlotAgent(BaseAgent):
    """情节专家 Agent"""

    EXPERTISE_PROMPT = """你是一位情节分析专家，专注于：
- 事件因果链和情节逻辑
- 叙事节奏和张力曲线
- 冲突设置和解决
- 伏笔、悬念和转折

在回答时，请从叙事结构和情节推进的角度进行分析。"""

    EXPLORATION_PROMPT = """## 情节专家分析

### 查询
{query}

### 情节上下文
{plot_context}

### 工作区上下文
{working_context}

### 任务
从情节结构的角度分析这个问题：
1. 这与哪些情节事件相关？因果链如何？
2. 当前情节在整体叙事弧中的位置？
3. 存在哪些冲突？如何推进或解决？
4. 有哪些伏笔或悬念需要注意？

### 输出格式
```json
{{
  "answer": "详细分析",
  "confidence": 0.0-1.0,
  "evidence": ["支持证据1", "支持证据2"],
  "related_events": ["事件1", "事件2"],
  "causal_chain": "因果分析",
  "narrative_position": "叙事位置分析",
  "conflicts": ["冲突1", "冲突2"],
  "suggestions": ["建议1", "建议2"]
}}
```"""

    async def _get_relevant_context(self, query: str) -> dict:
        """获取情节相关上下文"""
        plot_results = await self.context.novel_memory.storage.vector.search_by_text(
            query,
            top_k=10,
            filter={"type": {"$in": ["plot_event", "scene", "chapter_summary"]}}
        )

        recent_plot = await self.context.novel_memory.get_recent_plot()

        return {
            "related_events": [{"content": doc.content, "score": score} for doc, score in plot_results],
            "recent_plot": recent_plot
        }
```

### 4.4 WorldAgent 世界观专家

```python
class WorldAgent(BaseAgent):
    """世界观专家 Agent"""

    EXPERTISE_PROMPT = """你是一位世界观设定专家，专注于：
- 世界规则和设定一致性
- 魔法/科技/社会体系
- 地理、历史、文化背景
- 设定冲突检测和修复

在回答时，请从世界观完整性和一致性的角度进行分析。"""

    EXPLORATION_PROMPT = """## 世界观专家分析

### 查询
{query}

### 世界观设定
{world_context}

### 工作区上下文
{working_context}

### 任务
从世界观设定的角度分析这个问题：
1. 涉及哪些世界观设定？
2. 是否与已有设定一致？存在冲突吗？
3. 需要补充或澄清哪些设定？
4. 有哪些设定约束需要遵守？

### 输出格式
```json
{{
  "answer": "详细分析",
  "confidence": 0.0-1.0,
  "evidence": ["支持证据1", "支持证据2"],
  "relevant_settings": ["设定1", "设定2"],
  "consistency_check": {{
    "status": "consistent|minor_conflict|major_conflict",
    "details": "具体说明"
  }},
  "constraints": ["约束1", "约束2"],
  "suggestions": ["建议1", "建议2"]
}}
```"""

    async def _get_relevant_context(self, query: str) -> dict:
        """获取世界观相关上下文"""
        setting_results = await self.context.novel_memory.storage.vector.search_by_text(
            query,
            top_k=10,
            filter={"type": {"$in": ["world_setting", "rule", "lore", "location", "magic_system"]}}
        )

        settings_by_type = defaultdict(list)
        for doc, score in setting_results:
            setting_type = doc.metadata.get("setting_type", "general")
            settings_by_type[setting_type].append({
                "content": doc.content,
                "score": score
            })

        return {"settings": dict(settings_by_type)}
```

### 4.5 StyleAgent 风格专家

```python
class StyleAgent(BaseAgent):
    """风格专家 Agent"""

    EXPERTISE_PROMPT = """你是一位写作风格专家，专注于：
- 文风和语言特色
- 叙事视角和人称运用
- 节奏、氛围和情感基调
- 对话风格和描写技巧

在回答时，请从文学表达和风格一致性的角度进行分析。"""

    EXPLORATION_PROMPT = """## 风格专家分析

### 查询
{query}

### 风格参考
{style_context}

### 工作区上下文
{working_context}

### 任务
从写作风格的角度分析这个问题：
1. 应该采用什么叙事视角和人称？
2. 适合什么样的语言风格和情感基调？
3. 如何与已有文风保持一致？
4. 有哪些风格技巧建议？

### 输出格式
```json
{{
  "answer": "详细分析",
  "confidence": 0.0-1.0,
  "evidence": ["支持证据1", "支持证据2"],
  "recommended_style": {{
    "narrative_voice": "叙事视角",
    "tone": "情感基调",
    "pacing": "节奏建议"
  }},
  "style_consistency": "一致性分析",
  "techniques": ["技巧1", "技巧2"],
  "suggestions": ["建议1", "建议2"]
}}
```"""

    async def _get_relevant_context(self, query: str) -> dict:
        """获取风格相关上下文"""
        style_samples = await self.context.novel_memory.storage.vector.search_by_text(
            query,
            top_k=5,
            filter={"type": {"$in": ["chapter", "scene", "style_reference"]}}
        )

        style_guide = await self.context.novel_memory.get_world_setting("writing_style")
        style_features = await self._analyze_style_features(style_samples)

        return {
            "samples": [{"content": doc.content[:500]} for doc, _ in style_samples],
            "style_guide": style_guide,
            "detected_features": style_features
        }
```

---

## 5. Supervisor 协调者

### 5.1 核心实现

```python
class Supervisor:
    """Agent 协调者"""

    COMPLEXITY_PROMPT = """评估查询的复杂度和所需专业领域。

## 查询
{query}

## 评估维度
1. **复杂度**:
   - SIMPLE: 单一维度问题，一个专家即可回答
   - MODERATE: 涉及 2-3 个维度，需要多专家协作
   - COMPLEX: 多维度交织，需要全面协作

2. **所需专家**:
   - CHARACTER: 角色相关（性格、关系、动机）
   - PLOT: 情节相关（事件、因果、冲突）
   - WORLD: 世界观相关（设定、规则、约束）
   - STYLE: 风格相关（文风、视角、氛围）

## 输出格式
```json
{{
  "complexity": "SIMPLE|MODERATE|COMPLEX",
  "required_roles": ["CHARACTER", "PLOT", ...],
  "reasoning": "一句话理由",
  "collaboration_strategy": "parallel|sequential|iterative"
}}
```"""

    SYNTHESIS_PROMPT = """综合多位专家的分析，形成统一回答。

## 原始查询
{query}

## 专家回答
{agent_responses}

## 发现的冲突
{conflicts}

## 任务
1. 综合各专家观点，形成完整回答
2. 解决或标注无法解决的冲突
3. 评估整体共识程度

## 输出格式
```json
{{
  "synthesized_answer": "综合回答",
  "consensus_level": 0.0-1.0,
  "key_insights": ["洞察1", "洞察2"],
  "resolved_conflicts": ["已解决冲突1"],
  "unresolved_conflicts": ["未解决冲突1"],
  "confidence": 0.0-1.0
}}
```"""

    def __init__(self, context: SharedContext, config: SupervisorConfig):
        self.context = context
        self.config = config
        self.agents: dict[AgentRole, BaseAgent] = {}

    def register_agent(self, agent: BaseAgent):
        """注册专业 Agent"""
        self.agents[agent.role] = agent

    async def process(self, query: str) -> CollaborationResult:
        """处理查询的主入口"""
        assessment = await self._assess_complexity(query)

        task = AgentTask(
            id=f"task_{uuid.uuid4().hex[:8]}",
            query=query,
            complexity=TaskComplexity(assessment["complexity"]),
            required_roles=[AgentRole(r) for r in assessment["required_roles"]]
        )

        if task.complexity == TaskComplexity.SIMPLE:
            responses = await self._execute_simple(task)
        elif task.complexity == TaskComplexity.MODERATE:
            responses = await self._execute_moderate(task, assessment["collaboration_strategy"])
        else:
            responses = await self._execute_complex(task)

        result = await self._synthesize(query, responses)
        self.context.working_memory.clear()

        return result
```

### 5.2 执行策略

```python
class Supervisor:
    # ... 上面的代码 ...

    async def _execute_simple(self, task: AgentTask) -> list[AgentResponse]:
        """简单任务：单 Agent 直接执行"""
        role = task.required_roles[0]
        agent = self.agents.get(role)
        response = await agent.process(task)
        return [response]

    async def _execute_moderate(
        self,
        task: AgentTask,
        strategy: str
    ) -> list[AgentResponse]:
        """中等任务：2-3 个 Agent 协作"""
        agents = [self.agents[role] for role in task.required_roles if role in self.agents]

        if strategy == "parallel":
            responses = await asyncio.gather(*[
                agent.process(task) for agent in agents
            ])
            return list(responses)

        elif strategy == "sequential":
            responses = []
            for agent in agents:
                response = await agent.process(task)
                responses.append(response)
                self.context.working_memory.set(
                    f"response_{agent.role.value}",
                    response.content,
                    agent=agent.role
                )
            return responses

        else:  # iterative
            return await self._iterative_collaboration(task, agents, max_rounds=2)

    async def _execute_complex(self, task: AgentTask) -> list[AgentResponse]:
        """复杂任务：全员协作"""
        all_agents = list(self.agents.values())
        initial_responses = await asyncio.gather(*[
            agent.process(task) for agent in all_agents
        ])

        conflicts = self.context.working_memory._conflicts
        if not conflicts:
            return list(initial_responses)

        refined_responses = await self._resolve_conflicts(
            task,
            list(initial_responses),
            conflicts
        )

        return refined_responses

    async def _iterative_collaboration(
        self,
        task: AgentTask,
        agents: list[BaseAgent],
        max_rounds: int = 2
    ) -> list[AgentResponse]:
        """迭代式协作"""
        responses = []

        for round_num in range(max_rounds):
            round_responses = []

            for agent in agents:
                response = await agent.process(task)
                round_responses.append(response)
                self.context.working_memory.set(
                    f"round_{round_num}_{agent.role.value}",
                    response.content,
                    agent=agent.role
                )

            responses = round_responses

            if self._check_consensus(round_responses):
                break

        return responses

    def _check_consensus(self, responses: list[AgentResponse]) -> bool:
        """检查是否达成共识"""
        if len(responses) < 2:
            return True

        avg_confidence = sum(r.confidence for r in responses) / len(responses)
        has_conflicts = any(r.conflicts for r in responses)

        return avg_confidence >= 0.7 and not has_conflicts
```

### 5.3 协作策略总结

| 复杂度 | 策略 | 执行方式 | 适用场景 |
|--------|------|----------|----------|
| SIMPLE | 单 Agent | 直接执行 | 单一维度问题 |
| MODERATE | parallel | 并行执行后综合 | 多维度但独立 |
| MODERATE | sequential | 顺序传递上下文 | 有依赖关系 |
| MODERATE | iterative | 多轮协商 | 需要讨论 |
| COMPLEX | 全员协作 | 并行 + 冲突解决 | 多维度交织 |

---

## 6. 完整集成

### 6.1 AgentCollaborationPipeline

```python
@dataclass
class AgentConfig:
    """单个 Agent 配置"""
    model: str = "default"
    temperature: float = 0.7
    max_tokens: int = 2000
    timeout: float = 30.0

@dataclass
class SupervisorConfig:
    """Supervisor 配置"""
    complexity_model: str = "fast"
    synthesis_model: str = "default"
    max_collaboration_rounds: int = 2
    consensus_threshold: float = 0.7
    conflict_resolution_enabled: bool = True

@dataclass
class CollaborationConfig:
    """Agent 协作层完整配置"""
    character_agent: AgentConfig = field(default_factory=AgentConfig)
    plot_agent: AgentConfig = field(default_factory=AgentConfig)
    world_agent: AgentConfig = field(default_factory=AgentConfig)
    style_agent: AgentConfig = field(default_factory=AgentConfig)
    supervisor: SupervisorConfig = field(default_factory=SupervisorConfig)
    default_strategy: str = "parallel"
    enable_message_bus: bool = True
    working_memory_ttl: float = 3600.0
    max_concurrent_agents: int = 4
    agent_timeout: float = 30.0
    total_timeout: float = 120.0

class AgentCollaborationPipeline:
    """Agent 协作管道"""

    def __init__(
        self,
        storage: StorageManager,
        config: CollaborationConfig
    ):
        self.config = config
        self.context = SharedContext(
            novel_memory=NovelMemory(storage),
            working_memory=WorkingMemory(),
            message_bus=MessageBus()
        )
        self.supervisor = Supervisor(self.context, config.supervisor)
        self._init_agents()

    def _init_agents(self):
        """初始化所有 Agent"""
        agents = [
            CharacterAgent(AgentRole.CHARACTER, self.context, self.config.character_agent),
            PlotAgent(AgentRole.PLOT, self.context, self.config.plot_agent),
            WorldAgent(AgentRole.WORLD, self.context, self.config.world_agent),
            StyleAgent(AgentRole.STYLE, self.context, self.config.style_agent)
        ]
        for agent in agents:
            self.supervisor.register_agent(agent)

    async def query(self, query: str) -> CollaborationResult:
        """查询入口"""
        try:
            result = await asyncio.wait_for(
                self.supervisor.process(query),
                timeout=self.config.total_timeout
            )
            return result
        except asyncio.TimeoutError:
            return CollaborationResult(
                query=query,
                responses=[],
                synthesized_answer="处理超时，请简化问题后重试。",
                consensus_level=0.0,
                resolved_conflicts=[],
                metadata={"error": "timeout"}
            )

    async def explore(
        self,
        query: str,
        roles: list[AgentRole] = None
    ) -> list[AgentResponse]:
        """多 Agent 并行探索"""
        if roles is None:
            roles = [AgentRole.CHARACTER, AgentRole.PLOT, AgentRole.WORLD]

        agents = [self.supervisor.agents[role] for role in roles if role in self.supervisor.agents]
        responses = await asyncio.gather(*[agent.explore(query) for agent in agents])
        return list(responses)
```

### 6.2 与 RAG 集成

```python
class MultiAgentSearch:
    """多智能体搜索策略（用于 Adaptive RAG）"""

    def __init__(self, collaboration: AgentCollaborationPipeline):
        self.collaboration = collaboration

    async def search(
        self,
        query: str,
        analysis: QueryAnalysis
    ) -> SearchResult:
        """执行多智能体协作搜索"""
        responses = await self.collaboration.explore(query)

        documents = []
        for response in responses:
            doc = Document(
                id=f"agent_{response.agent_role.value}_{response.task_id}",
                content=response.content,
                metadata={
                    "source": "agent",
                    "agent_role": response.agent_role.value,
                    "confidence": response.confidence,
                    "evidence": response.evidence
                }
            )
            documents.append(doc)

        avg_confidence = sum(r.confidence for r in responses) / len(responses) if responses else 0

        return SearchResult(
            documents=documents,
            scores=[r.confidence for r in responses],
            strategy_used=RouteDecision.MULTI_AGENT,
            metadata={"agent_count": len(responses), "avg_confidence": avg_confidence}
        )
```

---

## 7. 配置参数

```yaml
# config/agent_collaboration.yaml

# === Agent 配置 ===
character_agent:
  model: default
  temperature: 0.7
  max_tokens: 2000
  timeout: 30.0

plot_agent:
  model: default
  temperature: 0.7
  max_tokens: 2000
  timeout: 30.0

world_agent:
  model: default
  temperature: 0.5  # 世界观需要更确定性
  max_tokens: 2000
  timeout: 30.0

style_agent:
  model: default
  temperature: 0.8  # 风格可以更创意
  max_tokens: 2000
  timeout: 30.0

# === Supervisor 配置 ===
supervisor:
  complexity_model: fast
  synthesis_model: default
  max_collaboration_rounds: 2
  consensus_threshold: 0.7
  conflict_resolution_enabled: true

# === 协作参数 ===
default_strategy: parallel
enable_message_bus: true
working_memory_ttl: 3600.0

# === 性能参数 ===
max_concurrent_agents: 4
agent_timeout: 30.0
total_timeout: 120.0
```

---

## 8. 模块总结

| 模块 | 职责 |
|------|------|
| **SharedContext** | 共享上下文：NovelMemory + WorkingMemory + MessageBus |
| **NovelMemory** | 小说知识缓存（角色、设定、情节） |
| **WorkingMemory** | 当前任务工作区（事实、假设、冲突） |
| **MessageBus** | Agent 间消息通道 |
| **BaseAgent** | Agent 抽象基类 |
| **CharacterAgent** | 角色专家 |
| **PlotAgent** | 情节专家 |
| **WorldAgent** | 世界观专家 |
| **StyleAgent** | 风格专家 |
| **Supervisor** | 协调者（复杂度评估、任务分发、结果综合） |
| **AgentCollaborationPipeline** | 完整协作管道 |
| **MultiAgentSearch** | 多智能体搜索策略（集成到 RAG） |

---

## 9. 实现优先级

| 阶段 | 模块 | 依赖 |
|------|------|------|
| P1 | SharedContext (NovelMemory + WorkingMemory) | StorageManager |
| P2 | BaseAgent + CharacterAgent | P1 |
| P3 | PlotAgent + WorldAgent + StyleAgent | P2 |
| P4 | MessageBus | - |
| P5 | Supervisor (简单/中等策略) | P1-P4 |
| P6 | Supervisor (复杂策略 + 冲突解决) | P5 |
| P7 | AgentCollaborationPipeline | P1-P6 |
| P8 | MultiAgentSearch + RAG 集成 | P7 + RAG 层 |

---

*文档版本: 1.0 | 创建时间: 2026-02-03*
