# niko-studio 三层架构蓝图

> Nowledge Mem 知识层 + niko-studio 引擎层 + 应用层
> 渐进式迁移，每步可验证

---

## 1. 架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│  应用层 (Application Layer)                                      │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────────┐  │
│  │ 写作工作流 │ │ 叙事分析  │ │ 45+ 技能   │ │ Tauri 桌面 UI    │  │
│  └─────┬────┘ └─────┬────┘ └─────┬─────┘ └────────┬─────────┘  │
│        └────────────┼───────────┼─────────────────┘             │
│                     ▼           ▼                                │
│            NarrativeAgentAPI  SkillAPI                          │
└────────────────────────┬───────────────────────────────────────┘
                         │
┌────────────────────────▼───────────────────────────────────────┐
│  引擎层 (Engine Layer) — niko-studio 领域特化                    │
│                                                                 │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │ NarrativeGraph   │  │ NarrativeMemory   │  │ ForeshadowTracker │
│  │ 6 EntityType     │  │ 6 DimensionType   │  │ max_distance  │  │
│  │ 10+ RelationType │  │ 六维加权检索       │  │ reminder_thr  │  │
│  │ GraphDB (SQLite) │  │ MemoryDB (SQLite) │  │ 章节距离计算   │  │
│  └────────┬────────┘  └────────┬─────────┘  └───────┬───────┘  │
│           └────────────────────┼─────────────────────┘          │
│                                ▼                                 │
│                    NarrativeEngine (统一门面)                     │
│           query() / analyze() / track() / sync()                │
└────────────────────────┬───────────────────────────────────────┘
                         │ KnowledgeBridge (重设计)
┌────────────────────────▼───────────────────────────────────────┐
│  知识层 (Knowledge Layer) — Nowledge Mem v0.8                    │
│                                                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌───────────────────────┐   │
│  │ LLM Wiki     │ │ 记忆衰减      │ │ 后台智能              │   │
│  │ Crystal      │ │ ACT-R + FSRS │ │ 聚类 + 矛盾 + 简报    │   │
│  │ [[wikilink]] │ │ 双时序       │ │ EVOLVES 演化链        │   │
│  │ Study w/ AI  │ │ 蒸馏         │ │ 早晨简报 → memory.md  │   │
│  └──────┬───────┘ └──────┬───────┘ └──────────┬────────────┘   │
│         └────────────────┼─────────────────────┘                │
│                          ▼                                       │
│               NowledgeMemAPI (HTTP + nmem CLI)                  │
│               127.0.0.1:19828 / MCP tools                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 各层接口契约

### 2.1 知识层 → 引擎层：NowledgeMemAPI

Nowledge Mem 对外暴露的能力，引擎层通过 `KnowledgeBridge` 消费：

```typescript
interface NowledgeMemAPI {
  // === 记忆 CRUD ===
  addMemory(input: AddMemoryInput): Promise<MemoryId>
  getMemory(id: MemoryId): Promise<Memory | null>
  searchMemories(query: string, opts?: SearchOpts): Promise<MemorySearchResult[]>
  updateMemory(id: MemoryId, patch: Partial<Memory>): Promise<void>
  deleteMemory(id: MemoryId): Promise<void>

  // === LLM Wiki (Crystal) ===
  listCrystals(opts?: { query?: string; tags?: string[] }): Promise<CrystalPage[]>
  getCrystal(slug: string): Promise<CrystalPage | null>
  studyWithAI(topic: string, depth?: number): Promise<CrystalPage>
  promoteToCrystal(memoryIds: MemoryId[], title: string): Promise<CrystalPage>

  // === 实体 ===
  getEntities(opts?: { type?: string; query?: string }): Promise<Entity[]>
  getRelations(entityId: EntityId, opts?: { direction?: 'in' | 'out' | 'both' }): Promise<Relation[]>

  // === 图搜索 ===
  graphSearch(query: string, opts?: GraphSearchOpts): Promise<GraphSearchResult[]>

  // === 时序 ===
  temporalQuery(opts: TemporalQueryOpts): Promise<TemporalResult[]>

  // === 蒸馏 ===
  distill(input: string, opts?: DistillOpts): Promise<DistillResult>

  // === 后台智能 ===
  getMorningBriefing(): Promise<MorningBriefing>
  getContradictions(): Promise<Contradiction[]>
  getEvolutionChains(entityId: EntityId): Promise<EvolutionChain[]>
}
```

**通信方式：**
- HTTP API: `http://127.0.0.1:19828/api/v1/...`
- MCP Tools: `nmem` CLI 或 Claude Code MCP 集成
- 降级: 离线时引擎层独立运行，仅丢失知识层能力

### 2.2 引擎层 → 应用层：NarrativeEngineAPI

引擎层对应用层暴露的统一门面：

```typescript
interface NarrativeEngineAPI {
  // === 叙事实体 ===
  addEntity(type: EntityType, props: EntityProps): Promise<EntityId>
  getEntity(id: EntityId): Promise<NarrativeEntity | null>
  queryEntities(filter: EntityFilter): Promise<NarrativeEntity[]>

  // === 叙事关系 ===
  addRelation(from: EntityId, to: EntityId, type: RelationType, props?: RelationProps): Promise<RelationId>
  traverse(start: EntityId, opts: TraverseOpts): Promise<TraversalResult>

  // === 六维记忆 ===
  addNarrativeMemory(dimension: DimensionType, content: string, opts?: MemoryOpts): Promise<MemoryId>
  queryNarrativeMemory(dimension: DimensionType, query: string, opts?: DimensionalQueryOpts): Promise<DimensionalMemoryResult[]>

  // === 伏笔追踪 ===
  plantForeshadow(from: EntityId, hint: string, chapter: number, opts?: ForeshadowOpts): Promise<ForeshadowId>
  resolveForeshadow(id: ForeshadowId, chapter: number, resolution: string): Promise<void>
  getPendingForeshadows(currentChapter: number): Promise<PendingForeshadow[]>
  getForeshadowAlerts(currentChapter: number): Promise<ForeshadowAlert[]>

  // === 叙事分析 ===
  analyzeHook(text: string, chapter: number): Promise<HookAnalysis>
  analyzeCliffhanger(text: string): Promise<CliffhangerScore>
  analyzeVoiceFingerprint(text: string, characterId: EntityId): Promise<VoiceProfile>
  analyzeEmotionalArc(chapterRange: [number, number]): Promise<EmotionalArc>

  // === 知识同步 ===
  syncFromKnowledgeLayer(): Promise<SyncReport>      // Nowledge Mem → 引擎层
  syncToKnowledgeLayer(): Promise<SyncReport>        // 引擎层 → Nowledge Mem
  getSyncStatus(): Promise<SyncStatus>
}
```

### 2.3 应用层内部：NarrativeAgentAPI + SkillAPI

```typescript
interface NarrativeAgentAPI {
  // 写作会话
  startWritingSession(project: ProjectId, chapter?: number): Promise<SessionId>
  getWritingContext(session: SessionId): Promise<WritingContext>  // 自动聚合三层知识

  // AI 辅助
  suggestPlot(action: string, context: WritingContext): Promise<PlotSuggestion[]>
  checkContinuity(chapter: number): Promise<ContinuityIssue[]>
  generateOutline(premise: string): Promise<Outline>
}

interface SkillAPI {
  execute(skillName: string, input: SkillInput): Promise<SkillOutput>
  listSkills(category?: string): Promise<SkillDescriptor[]>
}
```

---

## 3. 数据映射与同步策略

### 3.1 实体映射：Nowledge Mem ↔ niko-studio

```
Nowledge Mem Entity                    niko-studio NarrativeEntity
─────────────────────                  ────────────────────────────
entity_type: "character"          →    type: CHARACTER
entity_type: "location"           →    type: LOCATION
entity_type: "event"              →    type: EVENT
entity_type: "object"             →    type: OBJECT
entity_type: "concept"            →    type: CONCEPT
entity_type: "timeline"           →    type: TIMELINE
name                              →    name
description                       →    description
aliases[]                         →    aliases[]
confidence                        →    (丢弃，niko-studio 使用确定性类型)
metadata.tags                     →    tags[]
metadata.first_chapter            →    firstAppearance: number
metadata.role                     →    role: 'protagonist'|'antagonist'|'supporting'|'minor'
```

**反向映射（引擎层 → Nowledge Mem）：**
```
niko-studio NarrativeEntity           Nowledge Mem Entity
───────────────────────────           ─────────────────────
type: CHARACTER                  →    entity_type: "character"
type: FORESHADOW                 →    entity_type: "concept" + labels: ["foreshadow", "narrative-device"]
type: PLOT_THREAD                →    entity_type: "concept" + labels: ["plot-thread", "narrative-device"]
foreshadowMaxDistance             →    metadata.foreshadow_max_distance
foreshadowReminderThreshold      →    metadata.reminder_threshold
```

**注意：** `FORESHADOW` 和 `PLOT_THREAD` 在 Nowledge Mem 中没有直接对应，降级为 `concept` + labels 标记。叙事距离字段存入 metadata。

### 3.2 记忆映射：六维 ↔ Nowledge Mem

```
niko-studio DimensionType        Nowledge Mem unit_type + labels
─────────────────────            ─────────────────────────────────
timeline                    →    unit_type: "event" + temporal_context: "past"/"present"/"future"
context                     →    unit_type: "context" + labels: ["dimension:context"]
character                   →    unit_type: "fact" + labels: ["dimension:character", "char:{entityId}"]
worldview                   →    unit_type: "fact" + labels: ["dimension:worldview"]
preference                  →    unit_type: "preference" + labels: ["dimension:preference"]
experience                  →    unit_type: "learning" + labels: ["dimension:experience"]
```

**检索差异处理：**

| 场景 | Nowledge Mem 行为 | niko-studio 需求 | 桥接策略 |
|------|------------------|-----------------|---------|
| 记忆排序 | ACT-R 衰减 + FSRS 反馈 | 六维加权（timeline 时间窗口、character 实体关联度） | 引擎层收到 Nowledge Mem 结果后**重新排序** |
| 伏笔提醒 | 无 | 距离阈值触发 | 引擎层**独立计算**，不依赖知识层 |
| 矛盾检测 | 后台自动 | 写作时实时 | 知识层检测到的矛盾**推送**到引擎层 |

### 3.3 关系映射：RelationType ↔ EVOLVES

```
niko-studio RelationType         Nowledge Mem Relation
──────────────────────           ───────────────────────
KNOWS                       →    type: "RELATED" + metadata.strength
LOCATED_IN                  →    type: "PART_OF"
PARTICIPATES                →    type: "ENABLED"
FORESHADOWS                 →    type: "EVOLVES" + evolvesKind: "Enriches" + metadata.narrative_type: "foreshadow"
RESOLVES                    →    type: "EVOLVES" + evolvesKind: "Confirms" + metadata.narrative_type: "resolution"
CONFLICTS_WITH              →    type: "EVOLVES" + evolvesKind: "Challenges"
SERVES                      →    type: "CAUSED"
OPPOSES                     →    type: "EVOLVES" + evolvesKind: "Challenges" + metadata.narrative_type: "opposition"
```

### 3.4 同步方向与策略

```
                    写入方向                  读取方向
知识层 → 引擎层     syncFromKnowledgeLayer()   引擎层消费 Crystal/Entity/Memory
引擎层 → 知识层     syncToKnowledgeLayer()     写作产出下沉为 Nowledge Mem 记忆

同步触发时机：
  ├── 启动时       full sync（增量 hash 检测）
  ├── 写作会话开始  pull relevant entities + memories
  ├── 章节完成      push new entities + memories + relations
  ├── Nowledge Mem 简报  push contradictions + evolution alerts
  └── 定时（30min）  双向增量 sync
```

**冲突解决策略：**
- **实体类型冲突**：Nowledge Mem 提取的 `entity_type` 与引擎层不一致 → 以引擎层为准（引擎层是领域权威）
- **记忆内容冲突**：同一条记忆两边都更新 → 以时间戳最新为准
- **关系冲突**：同一对实体关系类型不同 → 标记为矛盾，推送到审核队列

---

## 4. DI 容器改造

### 4.1 现有容器结构

```
Container
  ├── IKnowledgeLayer        → AgentKnowledgeLayer (当前)
  ├── IMemoryStore           → SQLiteMemoryStore
  ├── IGraphEngine           → GraphEngine
  ├── IVectorStore           → SQLiteVectorStore
  ├── IWikiStore             → ProjectWikiStore
  ├── IWikiSchema            → ProjectWikiSchema
  ├── INowledgeMemAdapter    → NowledgeMemKnowledgeBridge (secondary)
  └── ICompositeBridge       → CompositeKnowledgeMemoryBridge
```

### 4.2 改造后容器结构

```
Container
  │
  ├── 知识层（新）
  │   └── INowledgeMemAPI        → NowledgeMemHTTPClient  // HTTP 127.0.0.1:19828
  │       ├── 离线降级            → NullNowledgeMemAPI     // Nowledge Mem 不可用时
  │       └── 配置                → NowledgeMemConfig      // host/port/timeout/retry
  │
  ├── 桥接层（重设计）
  │   └── IKnowledgeBridge       → KnowledgeBridgeV2
  │       ├── entityMapper        → NarrativeEntityMapper  // EntityType ↔ entity_type
  │       ├── memoryMapper        → DimensionalMemoryMapper // DimensionType ↔ unit_type+labels
  │       ├── relationMapper      → NarrativeRelationMapper  // RelationType ↔ EVOLVES
  │       ├── syncEngine          → IncrementalSyncEngine   // hash-based incremental
  │       └── conflictResolver    → BridgeConflictResolver  // 冲突策略
  │
  ├── 引擎层（保留 + 增强）
  │   ├── INarrativeEngine       → NarrativeEngine         // 统一门面（新）
  │   ├── INarrativeGraph        → NarrativeGraphStore     // 重命名自 GraphEngine
  │   ├── INarrativeMemory       → NarrativeMemoryStore    // 重命名自 SQLiteMemoryStore
  │   ├── IForeshadowTracker     → ForeshadowTracker       // 从 NarrativeMemory 拆分
  │   ├── INarrativeAnalyzer     → NarrativeAnalyzer       // hook/cliffhanger/voice/emotional
  │   └── IDistillationService   → DistillationService     // 保留
  │
  ├── 废弃（删除）
  │   ├── IWikiStore             → 功能由 Nowledge Mem Crystal 替代
  │   ├── IWikiSchema            → 功能由 Nowledge Mem schema + 映射层替代
  │   ├── IWikiQuery             → 功能由 Nowledge Mem 混合检索替代
  │   └── IWikiKnowledgeLayer    → 功能由 KnowledgeBridgeV2 替代
  │
  └── 应用层（保留）
      ├── INarrativeAgentAPI     → NarrativeAgent
      └── ISkillAPI              → SkillRegistry
```

### 4.3 注册改造

```typescript
// 改造前
container.register<IKnowledgeLayer>('IKnowledgeLayer', AgentKnowledgeLayer)

// 改造后
container.register<INowledgeMemAPI>('INowledgeMemAPI', NowledgeMemHTTPClient, [
  new NowledgeMemConfig({ host: '127.0.0.1', port: 19828 })
])
container.register<IKnowledgeBridge>('IKnowledgeBridge', KnowledgeBridgeV2, [
  ref('INowledgeMemAPI'),
  new NarrativeEntityMapper(),
  new DimensionalMemoryMapper(),
  new NarrativeRelationMapper(),
  new IncrementalSyncEngine(),
  new BridgeConflictResolver()
])
container.register<INarrativeEngine>('INarrativeEngine', NarrativeEngine, [
  ref('INarrativeGraph'),
  ref('INarrativeMemory'),
  ref('IForeshadowTracker'),
  ref('INarrativeAnalyzer'),
  ref('IKnowledgeBridge')
])
```

---

## 5. 数据目录重组

### 5.1 现有目录

```
.writing/
  ├── memory.db          # 六维记忆
  ├── graph.db           # 叙事图谱
  ├── vectors.db         # 向量索引
  ├── core_memories      # 核心记忆
  ├── store/             # OpenKL 摄入
  └── wiki/
      ├── pages/         # Wiki Canon（将废弃）
      └── projections/   # 图谱/记忆投影（将废弃）
```

### 5.2 改造后目录

```
.writing/
  ├── narrative.db       # 合并 memory.db + graph.db（WAL 模式，单连接）
  │   ├── memories       # 六维记忆表
  │   ├── entities       # 叙事实体表
  │   ├── relations      # 叙事关系表
  │   ├── foreshadows    # 伏笔追踪表
  │   └── sync_state     # 同步状态表（hash + last_sync_at）
  ├── vectors.db         # 保留（后续迁移到 LanceDB）
  ├── store/             # OpenKL 摄入（保留）
  └── sync/
      ├── bridge-state.json   # 桥接层状态
      ├── conflict-queue.json # 冲突队列
      └── mapping-cache.json  # ID 映射缓存（nowledge_id ↔ narrative_id）
```

**Nowledge Mem 侧的数据目录：**
```
~/ai-now/                    # Nowledge Mem 默认目录
  ├── data/
  │   ├── memories.db        # 通用记忆
  │   ├── entities.db        # 通用实体
  │   └── crystals/          # LLM Wiki 页面
  ├── memory.md              # 早晨简报
  └── config.yaml            # Nowledge Mem 配置
```

---

## 6. MCP 端点重组

### 6.1 现有端点（25+）

```
POST /wiki/promote          → 废弃（由 Nowledge Mem Crystal 替代）
POST /wiki/list             → 废弃（由 Nowledge Mem listCrystals 替代）
POST /wiki/page             → 废弃（由 Nowledge Mem getCrystal 替代）
POST /memory/search         → 保留（引擎层六维检索）
POST /memory/add            → 保留（引擎层记忆写入）
POST /memory/upload         → 重定向到 Nowledge Mem
POST /memory/temporal       → 保留（引擎层时序查询）
POST /graph/query           → 保留（引擎层图谱查询）
POST /graph/character       → 保留（引擎层角色档案）
POST /graph/foreshadows     → 增强（加入提醒计算）
POST /workspace/context     → 保留
```

### 6.2 新增端点

```
POST /narrative/sync                # 触发双向同步
POST /narrative/foreshadow/alerts   # 伏笔提醒
POST /narrative/analyze/hook        # 钩子检测
POST /narrative/analyze/cliffhanger # 悬念评分
POST /narrative/analyze/voice       # 声纹分析
POST /narrative/analyze/emotional   # 情感弧线
POST /nowledge/bridge/status        # 桥接状态
POST /nowledge/bridge/resolve       # 解决冲突
```

---

## 7. 渐进式迁移路径

### Phase 1: Nowledge Mem 集成（P0，2-3 天）

**目标：** Nowledge Mem 作为知识层可用，与引擎层双向通信

```
Step 1.1: NowledgeMemHTTPClient 实现
  - HTTP API 客户端，连接 127.0.0.1:19828
  - 离线降级 NullNowledgeMemAPI
  - 健康检查 + 自动重连

Step 1.2: KnowledgeBridgeV2 实现
  - 三组 Mapper（entity/memory/relation）
  - IncrementalSyncEngine（hash 检测）
  - BridgeConflictResolver

Step 1.3: DI 注册替换
  - INowledgeMemAPI 注册
  - IKnowledgeBridge 注册
  - 旧 ICompositeBridge 保留但标记 @deprecated

Step 1.4: 验证
  - Nowledge Mem 写入记忆 → 引擎层可读取
  - 引擎层写入实体 → Nowledge Mem 可查询
  - Nowledge Mem 离线 → 引擎层独立运行
```

### Phase 2: 引擎层重构（P1，3-5 天）

**目标：** 引擎层独立为叙事领域权威，与知识层解耦

```
Step 2.1: NarrativeEngine 统一门面
  - 整合 NarrativeGraph + NarrativeMemory + ForeshadowTracker
  - 统一 API 边界

Step 2.2: ForeshadowTracker 从 NarrativeMemory 拆分
  - 独立的伏笔状态机（planted → approaching → due → resolved/expired）
  - 章节距离计算 + 提醒逻辑

Step 2.3: NarrativeAnalyzer 独立
  - hook / cliffhanger / voice-fingerprint / emotional-arc
  - 与记忆存储解耦，纯计算服务

Step 2.4: memory.db + graph.db → narrative.db 合并
  - SQLite WAL 模式，单连接池
  - 新增 foreshadows 表、sync_state 表

Step 2.5: 验证
  - NarrativeEngine 独立运行测试
  - 六维加权检索正确性
  - 伏笔提醒触发正确性
```

### Phase 3: Wiki 层迁移（P1，2-3 天）

**目标：** 废弃自建 Wiki，全面使用 Nowledge Mem Crystal

```
Step 3.1: 废弃 IWikiStore / IWikiSchema / IWikiQuery / IWikiKnowledgeLayer
  - 标记 @deprecated
  - Wiki 查询重定向到 Nowledge Mem Crystal API

Step 3.2: MCP 端点迁移
  - /wiki/* → 重定向到 Nowledge Mem HTTP API
  - 新增 /narrative/* 端点

Step 3.3: 数据迁移
  - 现有 wiki/pages/ 内容 → Nowledge Mem Crystal
  - wiki-index.json → Nowledge Mem 实体 + 标签

Step 3.4: 验证
  - Crystal 页面可搜索
  - [[wikilink]] 交叉引用可用
  - Study with AI 可用
```

### Phase 4: 应用层适配（P2，3-5 天）

**目标：** 应用层全面消费新 API

```
Step 4.1: WritingContext 聚合器重写
  - 从 NarrativeEngine + KnowledgeBridge 聚合上下文
  - 替代直接查询 wiki/memory/graph

Step 4.2: NarrativeAgent 适配
  - 使用 NarrativeEngineAPI 替代直接调用底层

Step 4.3: 技能模块适配
  - 45+ craft skills 逐个迁移到新 API

Step 4.4: Tauri UI 适配
  - 新增 Nowledge Mem 状态面板
  - 新增伏笔追踪可视化
  - 新增叙事分析面板

Step 4.5: 端到端验证
  - 完整写作工作流测试
  - Nowledge Mem ↔ 引擎层同步测试
  - 离线模式测试
```

---

## 8. 关键设计决策

### 8.1 为什么不直接用 Nowledge Mem 的 Entity 替代 NarrativeEntity？

**决策：** 保留 NarrativeEntity，不替换为 Nowledge Mem Entity。

**理由：**
- Nowledge Mem Entity 的 `entity_type` 是自由字符串，无编译时类型检查
- 叙事实体有领域特有字段（`role`, `firstAppearance`, `foreshadowMaxDistance`），Nowledge Mem Entity 无这些字段
- 引擎层的六维加权检索依赖 `DimensionType` 枚举，Nowledge Mem 的 `labels` 无法表达权重体系
- 引擎层是叙事领域的**权威**，知识层是通用知识的**沉淀**——权威不应向下对齐

### 8.2 为什么合并 memory.db + graph.db？

**决策：** 合并为 narrative.db。

**理由：**
- 叙事实体和记忆高频联合查询（"角色 A 的所有记忆"需要 entity + memory join）
- SQLite WAL 模式下单库性能更优（避免 cross-database transaction）
- 同步状态表需要和实体/记忆在同一事务中更新
- 简化备份和迁移

### 8.3 Nowledge Mem 不可用时怎么办？

**决策：** 优雅降级，引擎层完全独立运行。

**降级行为：**
- `NowledgeMemHTTPClient` 健康检查失败 → 切换到 `NullNowledgeMemAPI`
- `KnowledgeBridgeV2` 检测到 null API → 跳过同步，引擎层独立
- 应用层提示 "知识层离线，部分功能不可用"（Crystal 搜索、跨工具上下文等）
- 引擎层核心功能（叙事实体、六维记忆、伏笔追踪、叙事分析）不受影响

### 8.4 ID 映射策略

**决策：** 双 ID 体系 + 映射缓存。

```
niko-studio narrative_id (UUID v4)  ←→  Nowledge Mem entity_id/memory_id (UUID v4)
```

- 映射存储在 `.writing/sync/mapping-cache.json`
- 同步时写入映射
- 删除时清理映射
- 映射缓存启动时从两侧对账

---

## 9. 风险与缓解

| 风险 | 可能性 | 影响 | 缓解 |
|------|:---:|:---:|------|
| Nowledge Mem HTTP API 不稳定 | 中 | 高 | 离线降级 + 重试 + 熔断 |
| 映射层数据丢失（ID 对不上） | 低 | 高 | 映射缓存 + 启动对账 + 双写确认 |
| 六维检索排序在桥接后不一致 | 中 | 中 | 引擎层收到结果后重新排序 |
| Nowledge Mem 版本升级破坏 API | 低 | 高 | API 版本锁定 + 适配器模式 |
| 合并 DB 时数据丢失 | 低 | 高 | 先备份 + 迁移脚本 + 验证脚本 |
| 45+ 技能迁移工作量大 | 高 | 中 | 按使用频率分批迁移，低频技能延后 |
