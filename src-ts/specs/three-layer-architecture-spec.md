# niko-studio 三层架构技术规格书

> 版本: 1.0.0 | 日期: 2026-06-01 | 状态: Draft

---

## 目录

1. [系统架构总览](#1-系统架构总览)
2. [层间接口契约](#2-层间接口契约)
3. [数据模型与 Schema](#3-数据模型与-schema)
4. [API 规格](#4-api-规格)
5. [DI 容器注册计划](#5-di-容器注册计划)
6. [数据库 Schema](#6-数据库-schema)
7. [同步协议](#7-同步协议)
8. [性能需求](#8-性能需求)
9. [安全需求](#9-安全需求)
10. [部署架构](#10-部署架构)
11. [错误处理与降级策略](#11-错误处理与降级策略)
12. [测试策略](#12-测试策略)

---

## 1. 系统架构总览

### 1.1 架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Application Layer (Tauri v2)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ React 19     │  │ 45+ Craft    │  │ Workflow Engine           │  │
│  │ Frontend     │  │ Skills       │  │ ┌──────────────────────┐ │  │
│  │              │  │              │  │ │ RevisionLoop         │ │  │
│  │ - Editor     │  │ - Hook       │  │ │ (writer-critic, ×3)  │ │  │
│  │ - Dashboard  │  │ - Cliffhanger│  │ └──────────────────────┘ │  │
│  │ - Timeline   │  │ - Emotion    │  │ ┌──────────────────────┐ │  │
│  │ - Graph Viz  │  │ - Suspense   │  │ │ QualityGateLoop      │ │  │
│  │              │  │ - Foreshadow │  │ │ (gap→remedy, ×3)    │ │  │
│  │              │  │ - Style      │  │ └──────────────────────┘ │  │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘  │
│         │                 │                        │                 │
│         └─────────────────┼────────────────────────┘                 │
│                           │ Tauri IPC                               │
├───────────────────────────┼─────────────────────────────────────────┤
│                    Engine Layer (niko-studio)                        │
│                           │                                         │
│  ┌────────────────────────▼─────────────────────────────────────┐   │
│  │                  ServiceContainer (DI)                        │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │   │
│  │  │ INarrativeEngine│  │IKnowledgeBridge │  │INowledgeMem  │ │   │
│  │  │                 │  │                 │  │    API        │ │   │
│  │  │ - Analyzer      │  │ - Entity Map    │  │              │ │   │
│  │  │ - CriticEngine  │  │ - Memory Map    │  │ - HTTP       │ │   │
│  │  │ - Foreshadow    │  │ - Relation Map  │  │ - CLI (nmem) │ │   │
│  │  │ - Pacing        │  │ - Sync Ctrl     │  │ - MCP        │ │   │
│  │  │ - Style         │  │                 │  │              │ │   │
│  │  │ - Quality       │  │                 │  │              │ │   │
│  │  └────────┬────────┘  └────────┬────────┘  └──────┬───────┘ │   │
│  │           │                    │                   │         │   │
│  │           │      ┌─────────────┘                   │         │   │
│  │           │      │  Bridge Pattern                  │         │   │
│  └───────────┼──────┼──────────────────────────────────┼─────────┘   │
│              │      │                                  │             │
│  ┌───────────▼──────▼──────┐  ┌───────────────────────▼──────────┐  │
│  │   narrative.db          │  │        Sync Protocol              │  │
│  │   (merged memory+graph) │  │   ┌─────────────────────────┐    │  │
│  │                        │  │   │ Direction: bidirectional │    │  │
│  │   - entities           │  │   │ Trigger: event-driven   │    │  │
│  │   - relations          │  │   │ Conflict: LWW + semantic │    │  │
│  │   - memories           │  │   └─────────────────────────┘    │  │
│  │   - foreshadowing      │  │                                   │  │
│  │   - quality_scores     │  │                                   │  │
│  └────────────────────────┘  └───────────────────────────────────┘  │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                    Knowledge Layer (Nowledge Mem v0.8)               │
│                                                                     │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────────────┐ │
│  │ HTTP API       │  │ nmem CLI       │  │ MCP Tools             │ │
│  │ 127.0.0.1:19828│  │                │  │                       │ │
│  │                │  │ - memory add   │  │ - nowledge_search     │ │
│  │ - /memories   │  │ - memory query │  │ - nowledge_remember   │ │
│  │ - /entities   │  │ - entity ...   │  │ - nowledge_entity_*   │ │
│  │ - /relations  │  │ - relation ... │  │ - nowledge_relation_* │ │ │
│  │ - /search     │  │                │  │                       │ │
│  └───────┬────────┘  └───────┬────────┘  └───────────┬───────────┘ │
│          │                   │                       │              │
│          └───────────────────┼───────────────────────┘              │
│                              │                                      │
│  ┌───────────────────────────▼────────────────────────────────────┐ │
│  │                    Core Engine                                  │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │ │
│  │  │ Hybrid Search│  │ Graph        │  │ Background Intel     │ │ │
│  │  │ (semantic +  │  │ Navigation   │  │ - Clustering         │ │ │
│  │  │  keyword +   │  │              │  │ - Contradiction det. │ │ │
│  │  │  graph)      │  │              │  │ - Morning briefing   │ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 层间依赖原则

| 原则 | 说明 |
|------|------|
| 单向依赖 | Application → Engine → Knowledge，下层不依赖上层 |
| 接口隔离 | 层间通过 TypeScript interface 通信，不暴露实现细节 |
| 降级自治 | Knowledge Layer 不可用时，Engine Layer 可降级到本地存储 |
| 数据主权 | narrative.db 是 Engine Layer 的权威数据源；Nowledge Mem 是 Knowledge Layer 的权威数据源 |

### 1.3 数据流方向

```
写入: User Action → App Layer → Engine Layer → narrative.db (本地写)
                                           ↘ KnowledgeBridge → Nowledge Mem (异步同步)

读取: User Query → App Layer → Engine Layer → narrative.db (本地读)
                                          ↗ KnowledgeBridge → Nowledge Mem (搜索增强)
```

---

## 2. 层间接口契约

### 2.1 Knowledge Layer 接口 — INowledgeMemAPI

```typescript
/**
 * Nowledge Mem HTTP API 的客户端抽象
 * 所有调用通过 HTTP 连接到 127.0.0.1:19828
 */
interface INowledgeMemAPI {
  // ─── Memory 操作 ───

  /** 创建记忆条目 */
  createMemory(params: CreateMemoryParams): Promise<Memory>;

  /** 根据 ID 获取记忆 */
  getMemory(id: string): Promise<Memory | null>;

  /** 更新记忆内容 */
  updateMemory(id: string, patch: Partial<MemoryUpdate>): Promise<Memory>;

  /** 删除记忆 */
  deleteMemory(id: string): Promise<void>;

  /** 混合搜索：语义 + 关键词 + 图导航 */
  searchMemories(query: SearchQuery): Promise<SearchResult<Memory>>;

  /** 按标签筛选记忆 */
  queryMemoriesByLabels(labels: string[], options?: QueryOptions): Promise<Memory[]>;

  // ─── Entity 操作 ───

  /** 创建实体 */
  createEntity(params: CreateEntityParams): Promise<Entity>;

  /** 根据 ID 获取实体 */
  getEntity(id: string): Promise<Entity | null>;

  /** 更新实体 */
  updateEntity(id: string, patch: Partial<EntityUpdate>): Promise<Entity>;

  /** 删除实体 */
  deleteEntity(id: string): Promise<void>;

  /** 搜索实体 */
  searchEntities(query: string, options?: QueryOptions): Promise<SearchResult<Entity>>;

  // ─── Relation 操作 ───

  /** 创建关系 */
  createRelation(params: CreateRelationParams): Promise<Relation>;

  /** 获取关系 */
  getRelation(id: string): Promise<Relation | null>;

  /** 获取实体的所有关系 */
  getEntityRelations(entityId: string, direction?: 'incoming' | 'outgoing' | 'both'): Promise<Relation[]>;

  /** 删除关系 */
  deleteRelation(id: string): Promise<void>;

  // ─── Bulk 操作 ───

  /** 批量创建记忆 */
  bulkCreateMemories(items: CreateMemoryParams[]): Promise<Memory[]>;

  /** 批量创建实体 */
  bulkCreateEntities(items: CreateEntityParams[]): Promise<Entity[]>;

  /** 批量创建关系 */
  bulkCreateRelations(items: CreateRelationParams[]): Promise<Relation[]>;

  // ─── 健康检查 ───

  /** 检查 Nowledge Mem 是否可用 */
  healthCheck(): Promise<{ ok: boolean; version?: string; latencyMs: number }>;
}
```

### 2.2 Knowledge Bridge 接口 — IKnowledgeBridge

```typescript
/**
 * Engine Layer ↔ Knowledge Layer 的桥接层
 * 负责数据映射、同步控制和冲突解决
 */
interface IKnowledgeBridge {
  // ─── 实体映射 ───

  /** 将 niko Entity 同步到 Nowledge Mem */
  pushEntity(entity: niko.Entity): Promise<string>; // 返回 Nowledge entity ID

  /** 从 Nowledge Mem 拉取实体到 niko 格式 */
  pullEntity(nowledgeId: string): Promise<niko.Entity | null>;

  /** 批量推送实体 */
  pushEntities(entities: niko.Entity[]): Promise<Map<string, string>>; // localId → nowledgeId

  // ─── 记忆映射 ───

  /** 将 niko Memory 同步到 Nowledge Mem */
  pushMemory(memory: niko.Memory): Promise<string>;

  /** 从 Nowledge Mem 拉取记忆 */
  pullMemory(nowledgeId: string): Promise<niko.Memory | null>;

  /** 批量推送记忆 */
  pushMemories(memories: niko.Memory[]): Promise<Map<string, string>>;

  // ─── 关系映射 ───

  /** 将 niko Relation 同步到 Nowledge Mem */
  pushRelation(relation: niko.Relation): Promise<string>;

  /** 从 Nowledge Mem 拉取关系 */
  pullRelation(nowledgeId: string): Promise<niko.Relation | null>;

  // ─── 搜索代理 ───

  /** 通过 Nowledge Mem 的混合搜索增强 Engine Layer 搜索 */
  enhancedSearch(query: string, options?: EnhancedSearchOptions): Promise<BridgedSearchResult>;

  /** 图导航：获取实体的关联网络 */
  exploreEntityGraph(entityId: string, depth?: number): Promise<GraphExploreResult>;

  // ─── 同步控制 ───

  /** 启动双向同步 */
  startSync(config: SyncConfig): Promise<void>;

  /** 停止同步 */
  stopSync(): Promise<void>;

  /** 获取同步状态 */
  getSyncStatus(): SyncStatus;

  /** 手动触发全量同步 */
  fullSync(): Promise<SyncReport>;

  /** 解决同步冲突 */
  resolveConflict(conflictId: string, resolution: ConflictResolution): Promise<void>;

  // ─── 生命周期 ───

  /** 初始化桥接（验证连接、加载映射表） */
  initialize(): Promise<void>;

  /** 释放资源 */
  dispose(): Promise<void>;
}
```

### 2.3 Narrative Engine 接口 — INarrativeEngine

```typescript
/**
 * 叙事引擎的统一入口
 * 组合所有分析器、评估器和追踪器
 */
interface INarrativeEngine {
  // ─── 分析 ───

  /** 叙事分析：hook、cliffhanger、情感、悬念等 */
  analyze(text: string, options?: AnalyzeOptions): Promise<NarrativeAnalysis>;

  /** 单维度分析 */
  analyzeHook(text: string): Promise<HookAnalysis>;
  analyzeCliffhanger(text: string): Promise<CliffhangerAnalysis>;
  analyzeEmotion(text: string): Promise<EmotionAnalysis>;
  analyzeSuspense(text: string): Promise<SuspenseAnalysis>;
  analyzeVoice(text: string): Promise<VoiceFingerprint>;
  analyzeSubtext(text: string): Promise<SubtextAnalysis>;

  // ─── 评估 ───

  /** 综合质量评估（CriticEngine） */
  evaluate(text: string, context?: EvaluationContext): Promise<CritiqueResult>;

  /** 小说质量评估（6 维度） */
  evaluateQuality(text: string): Promise<NovelQualityReport>;

  /** 七宗罪检测 */
  evaluateDeadlySins(text: string): Promise<DeadlySinsReport>;

  // ─── 追踪 ───

  /** 伏笔管理 */
  getForeshadowTracker(): IForeshadowTracker;

  /** 节奏导航 */
  getPacingNavigator(): IPacingNavigator;

  /** 风格系统 */
  getStyleSystem(): IStyleSystem;

  // ─── 修订循环 ───

  /** 执行修订循环（writer-critic 迭代） */
  runRevisionLoop(params: RevisionLoopParams): Promise<RevisionLoopResult>;

  /** 执行质量门循环 */
  runQualityGateLoop(params: QualityGateParams): Promise<QualityGateResult>;

  // ─── 角色 ───

  /** 角色四自我分析 */
  analyzeFourSelves(characterId: string): Promise<FourSelvesAnalysis>;

  /** 角色一致性检查 */
  checkCharacterConsistency(characterId: string, text: string): Promise<ConsistencyReport>;
}
```

### 2.4 伏笔追踪器接口 — IForeshadowTracker

```typescript
interface IForeshadowTracker {
  /** 种下伏笔 */
  plant(params: PlantForeshadowParams): Promise<Foreshadow>;

  /** 更新伏笔状态 */
  updateStatus(id: string, status: ForeshadowStatus): Promise<Foreshadow>;

  /** 解析伏笔 */
  resolve(id: string, resolution: string): Promise<Foreshadow>;

  /** 标记伏笔过期 */
  expire(id: string): Promise<Foreshadow>;

  /** 获取到期/即将到期的伏笔 */
  getDueForeshadows(threshold?: number): Promise<Foreshadow[]>;

  /** 获取某章节相关的伏笔 */
  getByChapter(chapterId: string): Promise<Foreshadow[]>;

  /** 获取伏笔网络（图结构） */
  getForeshadowGraph(): Promise<ForeshadowGraph>;

  /** 检测遗忘风险 */
  detectOrphaned(maxDistance?: number): Promise<Foreshadow[]>;
}
```

### 2.5 节奏导航器接口 — IPacingNavigator

```typescript
interface IPacingNavigator {
  /** 分析当前节奏 */
  analyzePacing(chapters: ChapterSummary[]): Promise<PacingAnalysis>;

  /** 生成节奏处方 */
  prescribe(current: PacingState, target: PacingTarget): Promise<PacingPrescription>;

  /** 获取节奏曲线 */
  getPacingCurve(chapters: ChapterSummary[]): Promise<PacingCurve>;

  /** 预测节奏走向 */
  predictTrajectory(chapters: ChapterSummary[]): Promise<PacingTrajectory>;
}
```

### 2.6 风格系统接口 — IStyleSystem

```typescript
interface IStyleSystem {
  /** 分析文本风格 */
  analyzeStyle(text: string): Promise<StyleProfile>;

  /** 比较两段文本的风格差异 */
  compareStyles(textA: string, textB: string): Promise<StyleComparison>;

  /** 获取风格维度值 */
  getDimensionValues(text: string, dimensions?: StyleDimension[]): Promise<StyleDimensionMap>;

  /** 风格一致性检查 */
  checkConsistency(texts: string[], reference?: StyleProfile): Promise<StyleConsistencyReport>;
}
```

---

## 3. 数据模型与 Schema

### 3.1 Knowledge Layer 数据模型（Nowledge Mem）

```typescript
// ─── Memory Schema ───

interface NowledgeMemory {
  id: string;                              // UUID v4
  title: string;                           // 记忆标题
  content: string;                         // 记忆正文
  labels: string[];                        // 标签集合
  importance: number;                      // 0.1 - 1.0
  unit_type: NowledgeUnitType;             // 记忆单元类型
  temporal_context: NowledgeTemporalContext;// 时间上下文
  event_start?: string;                    // ISO 8601 datetime
  event_end?: string;                      // ISO 8601 datetime
  metadata: Record<string, unknown>;       // 扩展元数据
  is_crystal: boolean;                     // 是否为结晶（高置信度）
  version: number;                         // 版本号
  created_at: string;                      // ISO 8601
  updated_at: string;                      // ISO 8601
}

type NowledgeUnitType =
  | 'fact'        // 事实
  | 'preference'  // 偏好
  | 'decision'    // 决策
  | 'plan'        // 计划
  | 'procedure'   // 流程
  | 'learning'    // 学习
  | 'context'     // 上下文
  | 'event';      // 事件

type NowledgeTemporalContext =
  | 'past'      // 过去
  | 'present'   // 现在
  | 'future'    // 未来
  | 'timeless'; // 永恒

// ─── Entity Schema ───

interface NowledgeEntity {
  id: string;                              // UUID v4
  node_type: 'entity';                     // 节点类型
  entity_type: string;                     // 自由字符串（见映射表）
  name: string;                            // 实体名称
  description: string;                     // 实体描述
  aliases: string[];                       // 别名列表
  confidence: number;                      // 0.0 - 1.0
  metadata: Record<string, unknown>;       // 扩展元数据
  created_at: string;
  updated_at: string;
}

// ─── Relation Schema ───

interface NowledgeRelation {
  id: string;                              // UUID v4
  source_id: string;                       // 源实体 ID
  target_id: string;                       // 目标实体 ID
  relation_type: NowledgeRelationType;     // 关系类型
  evolves_kind?: EvolvesKind;              // EVOLVES 子类型
  weight: number;                          // 关系权重 0.0 - 1.0
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

type NowledgeRelationType =
  | 'RELATED'    // 通用关联
  | 'CAUSED'     // 因果
  | 'ENABLED'    // 使能
  | 'PART_OF'    // 组成
  | 'PRECEDED'   // 时序
  | 'EVOLVES';   // 演化

type EvolvesKind =
  | 'Replaces'    // 替代
  | 'Enriches'    // 丰富
  | 'Confirms'    // 确认
  | 'Challenges'; // 质疑
```

### 3.2 Engine Layer 数据模型（niko-studio）

```typescript
// ─── Entity ───

enum EntityType {
  CHARACTER = 'character',   // 角色
  LOCATION = 'location',     // 地点
  EVENT = 'event',           // 事件
  OBJECT = 'object',         // 物品
  CONCEPT = 'concept',       // 概念
  TIMELINE = 'timeline',     // 时间线
  FORESHADOW = 'foreshadow', // 伏笔
  PLOT_THREAD = 'plot_thread' // 情节线
}

interface Entity {
  id: string;
  entityType: EntityType;
  name: string;
  description: string;
  aliases: string[];
  properties: Record<string, unknown>;   // 类型特有属性
  confidence: number;
  metadata: EntityMetadata;
  createdAt: string;
  updatedAt: string;
}

interface EntityMetadata {
  source: 'user' | 'ai' | 'import';
  novelId?: string;
  chapterId?: string;
  nowledgeId?: string;                   // 关联的 Nowledge entity ID
  syncVersion: number;
}

// ─── Relation ───

enum RelationType {
  KNOWS = 'knows',                 // 认识
  LOCATED_IN = 'located_in',       // 位于
  PARTICIPATES = 'participates',   // 参与
  OWNS = 'owns',                   // 拥有
  CAUSES = 'causes',               // 导致
  PRECEDES = 'precedes',           // 先于
  FOLLOWS = 'follows',             // 后于
  RELATED_TO = 'related_to',       // 通用关联
  FORESHADOWS = 'foreshadows',     // 伏笔暗示
  RESOLVES = 'resolves',           // 伏笔解析
  CONFLICTS_WITH = 'conflicts_with' // 冲突
}

interface Relation {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: RelationType;
  weight: number;
  properties: Record<string, unknown>;
  metadata: RelationMetadata;
  createdAt: string;
  updatedAt: string;
}

interface RelationMetadata {
  nowledgeId?: string;
  evolvesKind?: EvolvesKind;
  syncVersion: number;
}

// ─── Memory (六维记忆) ───

enum DimensionType {
  TIMELINE = 'timeline',       // 时间线维度
  CONTEXT = 'context',         // 上下文维度
  CHARACTER = 'character',     // 角色维度
  WORLDVIEW = 'worldview',     // 世界观维度
  PREFERENCE = 'preference',   // 偏好维度
  EXPERIENCE = 'experience'    // 经验维度
}

interface Memory {
  id: string;
  dimension: DimensionType;
  title: string;
  content: string;
  labels: string[];
  importance: number;                    // 0.1 - 1.0
  temporalContext: 'past' | 'present' | 'future' | 'timeless';
  eventStart?: string;
  eventEnd?: string;
  metadata: MemoryMetadata;
  createdAt: string;
  updatedAt: string;
}

interface MemoryMetadata {
  novelId?: string;
  chapterId?: string;
  nowledgeId?: string;
  syncVersion: number;
  isCrystal: boolean;
}

// ─── Foreshadow ───

enum ForeshadowStatus {
  PLANTED = 'planted',         // 已种下
  APPROACHING = 'approaching', // 临近
  DUE = 'due',                 // 到期
  RESOLVED = 'resolved',       // 已解析
  EXPIRED = 'expired'          // 过期
}

interface Foreshadow {
  id: string;
  title: string;
  description: string;
  status: ForeshadowStatus;
  plantedChapterId: string;
  targetChapterId?: string;
  currentChapterId?: string;
  maxDistance: number;                    // 最大章节距离
  reminderThreshold: number;             // 提醒阈值（剩余距离）
  resolution?: string;
  relatedEntities: string[];             // 关联实体 ID
  tension: number;                       // 0.0 - 1.0 张力值
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ─── Narrative Analysis ───

interface HookAnalysis {
  question: number;       // 问题维度 0-1
  surprise: number;       // 意外维度 0-1
  stakes: number;         // 利害维度 0-1
  empathy: number;        // 共情维度 0-1
  overall: number;        // 综合得分 0-1
}

interface CliffhangerAnalysis {
  tension: number;        // 张力维度 0-1
  uncertainty: number;    // 不确定维度 0-1
  anticipation: number;   // 期待维度 0-1
  disruption: number;     // 打断维度 0-1
  overall: number;
}

interface EmotionCraftAnalysis {
  mode: 'show' | 'tell';
  layers: {
    physiological: number;  // 生理层 0-1
    behavioral: number;     // 行为层 0-1
    cognitive: number;      // 认知层 0-1
    social: number;         // 社会层 0-1
    spiritual: number;      // 精神层 0-1
  };
}

interface SuspenseAnalysis {
  informationGap: number;   // 信息缺口 0-1
  anticipation: number;     // 预期 0-1
  uncertainty: number;      // 不确定性 0-1
  overall: number;
}

interface VoiceFingerprint {
  vocabulary: number;
  sentenceStructure: number;
  rhythm: number;
  perspective: number;
  tone: number;
}

interface DeadlySinsReport {
  infodump: number;          // 信息倾倒 0-1
  purpleProse: number;       // 紫色散文 0-1
  telling: number;           // 讲述而非展示 0-1
  passiveVoice: number;      // 被动语态 0-1
  adverbOveruse: number;     // 副词滥用 0-1
  cliche: number;            // 陈词滥调 0-1
  weakDialogue: number;      // 软弱对话 0-1
}

// ─── CriticEngine ───

interface CritiqueResult {
  overallScore: number;                  // 0-100
  evaluators: EvaluatorResult[];
  strengths: string[];
  weaknesses: string[];
  suggestions: CritiqueSuggestion[];
}

interface EvaluatorResult {
  name: string;
  weight: number;
  score: number;
  details: Record<string, unknown>;
}

// ─── Novel Quality (6 dimensions) ───

interface NovelQualityReport {
  repetition: number;       // 重复度 (越低越好) 0-1
  tone: number;             // 基调一致性 0-1
  clarity: number;          // 清晰度 0-1
  causality: number;        // 因果逻辑 0-1
  detail: number;           // 细节丰富度 0-1
  factuality: number;       // 事实一致性 0-1
  overall: number;
}

// ─── Style System ───

interface StyleProfile {
  dimensions: StyleDimensionMap;         // 30 维度值
  categories: StyleCategorySummary[];    // 6 类别汇总
  fingerprint: string;                   // 风格指纹哈希
}

type StyleDimensionMap = Record<StyleDimension, number>;

// 30 dimensions across 6 categories
type StyleDimension =
  // 句法类 (Syntax)
  | 'sentenceLength' | 'clauseComplexity' | 'parallelism' | 'inversion' | 'fragmentation'
  // 词汇类 (Vocabulary)
  | 'vocabularyRichness' | 'abstractRatio' | 'sensoryWords' | 'rareWords' | 'repetitionRate'
  // 修辞类 (Rhetoric)
  | 'metaphorDensity' | 'imageryDensity' | 'allusionDensity' | 'ironyLevel' | 'personificationDensity'
  // 节奏类 (Rhythm)
  | 'tempo' | 'pauseFrequency' | 'dialogueRatio' | 'paragraphLength' | 'transitionDensity'
  // 语域类 (Register)
  | 'formality' | 'emotionalTemperature' | 'distance' | 'intimacy' | 'authority'
  // 叙事类 (Narrative)
  | 'perspectiveStability' | 'timeFlow' | 'descriptionDepth' | 'actionDensity' | 'reflectionRatio';

// ─── Revision Loop ───

interface RevisionLoopParams {
  text: string;
  context?: string;
  maxRevisions: number;                  // 默认 3
  stagnationThreshold: number;           // 停滞检测阈值
  evaluatorWeights?: Record<string, number>;
}

interface RevisionLoopResult {
  originalText: string;
  revisedTexts: string[];
  finalText: string;
  iterations: RevisionIteration[];
  stagnated: boolean;
  totalTokensUsed: number;
}

interface RevisionIteration {
  round: number;
  writerOutput: string;
  criticFeedback: CritiqueResult;
  improvementDelta: number;              // 改善幅度
}

// ─── Quality Gate Loop ───

interface QualityGateParams {
  text: string;
  thresholds: Record<string, number>;    // 各维度阈值
  maxRetries: number;                    // 默认 3
  escalationPolicy: 'strict' | 'relaxed' | 'adaptive';
}

interface QualityGateResult {
  passed: boolean;
  gaps: QualityGap[];
  remediations: RemediationAttempt[];
  finalScores: Record<string, number>;
  escalated: boolean;
}

// ─── Pacing ───

interface PacingPrescription {
  type: 'accelerate' | 'decelerate' | 'maintain' | 'transition' | 'climax';
  intensity: number;                     // 0-1
  techniques: string[];
  warnings: string[];
}
```

### 3.3 数据映射表

#### 3.3.1 Entity 映射

| niko EntityType | Nowledge entity_type | Nowledge labels |
|-----------------|---------------------|-----------------|
| CHARACTER | `character` | `[]` |
| LOCATION | `location` | `[]` |
| EVENT | `event` | `[]` |
| OBJECT | `object` | `[]` |
| CONCEPT | `concept` | `[]` |
| TIMELINE | `timeline` | `[]` |
| FORESHADOW | `concept` | `["foreshadow"]` |
| PLOT_THREAD | `concept` | `["plot-thread"]` |

#### 3.3.2 Memory 映射

| niko DimensionType | Nowledge unit_type | Nowledge labels |
|--------------------|-------------------|-----------------|
| TIMELINE | `event` | `["dimension:timeline"]` |
| CONTEXT | `context` | `["dimension:context"]` |
| CHARACTER | `fact` | `["dimension:character"]` |
| WORLDVIEW | `fact` | `["dimension:worldview"]` |
| PREFERENCE | `preference` | `["dimension:preference"]` |
| EXPERIENCE | `learning` | `["dimension:experience"]` |

#### 3.3.3 Relation 映射

| niko RelationType | Nowledge relation_type | Nowledge evolves_kind |
|-------------------|----------------------|----------------------|
| KNOWS | `RELATED` | — |
| LOCATED_IN | `PART_OF` | — |
| PARTICIPATES | `RELATED` | — |
| OWNS | `RELATED` | — |
| CAUSES | `CAUSED` | — |
| PRECEDES | `PRECEDED` | — |
| FOLLOWS | `PRECEDED` | — (方向反转) |
| RELATED_TO | `RELATED` | — |
| FORESHADOWS | `EVOLVES` | `Enriches` |
| RESOLVES | `EVOLVES` | `Confirms` |
| CONFLICTS_WITH | `EVOLVES` | `Challenges` |

---

## 4. API 规格

### 4.1 Nowledge Mem HTTP 端点

基础 URL: `http://127.0.0.1:19828`

| 方法 | 路径 | 说明 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/memories` | 创建记忆 | `CreateMemoryParams` | `Memory` |
| GET | `/memories/:id` | 获取记忆 | — | `Memory \| null` |
| PATCH | `/memories/:id` | 更新记忆 | `Partial<MemoryUpdate>` | `Memory` |
| DELETE | `/memories/:id` | 删除记忆 | — | `204` |
| POST | `/memories/search` | 搜索记忆 | `SearchQuery` | `SearchResult<Memory>` |
| POST | `/memories/bulk` | 批量创建 | `CreateMemoryParams[]` | `Memory[]` |
| POST | `/entities` | 创建实体 | `CreateEntityParams` | `Entity` |
| GET | `/entities/:id` | 获取实体 | — | `Entity \| null` |
| PATCH | `/entities/:id` | 更新实体 | `Partial<EntityUpdate>` | `Entity` |
| DELETE | `/entities/:id` | 删除实体 | — | `204` |
| POST | `/entities/search` | 搜索实体 | `{ query, options }` | `SearchResult<Entity>` |
| POST | `/entities/bulk` | 批量创建 | `CreateEntityParams[]` | `Entity[]` |
| POST | `/relations` | 创建关系 | `CreateRelationParams` | `Relation` |
| GET | `/relations/:id` | 获取关系 | — | `Relation \| null` |
| GET | `/entities/:id/relations` | 实体关系 | `?direction=both` | `Relation[]` |
| DELETE | `/relations/:id` | 删除关系 | — | `204` |
| POST | `/relations/bulk` | 批量创建 | `CreateRelationParams[]` | `Relation[]` |
| GET | `/health` | 健康检查 | — | `{ ok, version, uptime }` |

#### SearchQuery 结构

```typescript
interface SearchQuery {
  query: string;                         // 搜索词
  mode: 'semantic' | 'keyword' | 'hybrid'; // 搜索模式
  limit?: number;                        // 默认 10
  offset?: number;                       // 默认 0
  filters?: {
    unit_types?: NowledgeUnitType[];
    labels?: string[];
    importance_min?: number;
    importance_max?: number;
    temporal_context?: NowledgeTemporalContext;
    date_from?: string;
    date_to?: string;
  };
  include_graph?: boolean;               // 是否包含图导航结果
  graph_depth?: number;                  // 图导航深度，默认 1
}
```

### 4.2 MCP 端点

niko-studio 通过 Tauri MCP Server 暴露以下工具：

| 工具名 | 说明 | 参数 |
|--------|------|------|
| `nowledge_search` | 通过 Nowledge Mem 搜索 | `{ query, mode, limit, filters }` |
| `nowledge_remember` | 存储记忆到 Nowledge Mem | `{ title, content, unit_type, labels, importance, temporal_context }` |
| `nowledge_entity_create` | 创建实体 | `{ entity_type, name, description, aliases }` |
| `nowledge_entity_get` | 获取实体 | `{ id }` |
| `nowledge_entity_search` | 搜索实体 | `{ query, entity_type? }` |
| `nowledge_relation_create` | 创建关系 | `{ source_id, target_id, relation_type, evolves_kind? }` |
| `nowledge_relation_get` | 获取关系 | `{ id }` |
| `nowledge_graph_explore` | 图导航 | `{ entity_id, depth, relation_types? }` |
| `nowledge_sync_status` | 查看同步状态 | `{}` |
| `nowledge_sync_trigger` | 触发同步 | `{ direction: "push" \| "pull" \| "both" }` |
| `narrative_analyze` | 叙事分析 | `{ text, dimensions? }` |
| `narrative_evaluate` | 质量评估 | `{ text, context? }` |
| `narrative_foreshadow_plant` | 种下伏笔 | `{ title, description, planted_chapter, target_chapter? }` |
| `narrative_foreshadow_resolve` | 解析伏笔 | `{ id, resolution }` |
| `narrative_foreshadow_due` | 到期伏笔 | `{ threshold? }` |
| `narrative_style_analyze` | 风格分析 | `{ text }` |
| `narrative_pacing` | 节奏分析 | `{ chapters }` |
| `narrative_revision_loop` | 修订循环 | `{ text, max_revisions? }` |
| `narrative_quality_gate` | 质量门 | `{ text, thresholds? }` |

### 4.3 Tauri IPC 命令

| 命令 | 说明 | 请求 | 响应 |
|------|------|------|------|
| `knowledge:search` | 知识搜索 | `{ query, dimension? }` | `BridgedSearchResult` |
| `knowledge:sync:start` | 启动同步 | `SyncConfig` | `void` |
| `knowledge:sync:status` | 同步状态 | — | `SyncStatus` |
| `knowledge:entity:create` | 创建实体 | `Entity` | `Entity` |
| `knowledge:entity:list` | 列出实体 | `{ type?, novelId? }` | `Entity[]` |
| `knowledge:relation:create` | 创建关系 | `Relation` | `Relation` |
| `knowledge:graph:explore` | 图探索 | `{ entityId, depth }` | `GraphExploreResult` |
| `narrative:analyze` | 叙事分析 | `{ text, options }` | `NarrativeAnalysis` |
| `narrative:evaluate` | 质量评估 | `{ text, context? }` | `CritiqueResult` |
| `narrative:revision` | 修订循环 | `RevisionLoopParams` | `RevisionLoopResult` |
| `narrative:quality_gate` | 质量门 | `QualityGateParams` | `QualityGateResult` |
| `foreshadow:plant` | 种下伏笔 | `PlantForeshadowParams` | `Foreshadow` |
| `foreshadow:due` | 到期伏笔 | `{ threshold? }` | `Foreshadow[]` |

---

## 5. DI 容器注册计划

### 5.1 服务标识符

```typescript
// ─── 新增标识符 ───

const INowledgeMemAPI = Symbol('INowledgeMemAPI');
const IKnowledgeBridge = Symbol('IKnowledgeBridge');
const INarrativeEngine = Symbol('INarrativeEngine');
const IForeshadowTracker = Symbol('IForeshadowTracker');
const IPacingNavigator = Symbol('IPacingNavigator');
const IStyleSystem = Symbol('IStyleSystem');

// ─── 已有标识符（保留） ───

const IGraphManager = Symbol('IGraphManager');
const IMemoryStore = Symbol('IMemoryStore');
const IEntityRepository = Symbol('IEntityRepository');
const IRelationRepository = Symbol('IRelationRepository');
const ICriticEngine = Symbol('ICriticEngine');
const INovelQuality = Symbol('INovelQuality');

// ─── 废弃标识符 ───
// IWikiStore      → 已迁移至 INowledgeMemAPI
// IWikiSchema     → 已迁移至 IKnowledgeBridge
// IWikiQuery      → 已迁移至 INowledgeMemAPI.searchMemories
// IWikiKnowledgeLayer → 已迁移至 IKnowledgeBridge
```

### 5.2 注册顺序与生命周期

```typescript
/**
 * DI 容器注册
 * 顺序：底层依赖 → 上层组合 → 门面
 * 生命周期：Singleton（单例），除非特别标注
 */
function registerServices(container: ServiceContainer): void {
  // ── Phase 1: 基础设施 ──

  container.registerSingleton(INowledgeMemAPI, () =>
    new NowledgeMemHTTPAdapter({
      baseUrl: 'http://127.0.0.1:19828',
      timeout: 5000,
      retryConfig: { maxRetries: 3, backoffMs: 1000 },
    })
  );

  // ── Phase 2: 数据层 ──

  container.registerSingleton(IGraphManager, () =>
    new SqliteGraphManager(container.get(IEntityRepository), container.get(IRelationRepository))
  );

  container.registerSingleton(IMemoryStore, () =>
    new SqliteMemoryStore(narrativeDbPath)
  );

  // ── Phase 3: 桥接层 ──

  container.registerSingleton(IKnowledgeBridge, () =>
    new CompositeKnowledgeMemoryBridge({
      nowledgeApi: container.get(INowledgeMemAPI),
      entityRepo: container.get(IEntityRepository),
      relationRepo: container.get(IRelationRepository),
      memoryStore: container.get(IMemoryStore),
      syncConfig: loadSyncConfig(),
    })
  );

  // ── Phase 4: 叙事引擎组件 ──

  container.registerSingleton(IForeshadowTracker, () =>
    new ForeshadowTracker(container.get(IGraphManager), container.get(IMemoryStore))
  );

  container.registerSingleton(ICriticEngine, () =>
    new CriticEngine(defaultEvaluatorWeights())
  );

  container.registerSingleton(INovelQuality, () =>
    new NovelQualityEvaluator()
  );

  container.registerSingleton(IPacingNavigator, () =>
    new PacingNavigator()
  );

  container.registerSingleton(IStyleSystem, () =>
    new StyleSystem()
  );

  // ── Phase 5: 叙事引擎门面 ──

  container.registerSingleton(INarrativeEngine, () =>
    new NarrativeEngine({
      analyzer: new NarrativeAnalyzer(),
      critic: container.get(ICriticEngine),
      quality: container.get(INovelQuality),
      foreshadow: container.get(IForeshadowTracker),
      pacing: container.get(IPacingNavigator),
      style: container.get(IStyleSystem),
    })
  );
}
```

### 5.3 依赖关系图

```
INarrativeEngine
  ├── NarrativeAnalyzer
  ├── ICriticEngine
  │     └── 5× Evaluator (weighted)
  ├── INovelQuality
  │     └── 6× DimensionEvaluator
  ├── IForeshadowTracker
  │     ├── IGraphManager
  │     │     ├── IEntityRepository
  │     │     └── IRelationRepository
  │     └── IMemoryStore
  ├── IPacingNavigator
  └── IStyleSystem

IKnowledgeBridge (CompositeKnowledgeMemoryBridge)
  ├── INowledgeMemAPI (NowledgeMemHTTPAdapter)
  │     └── HTTP → 127.0.0.1:19828
  ├── IEntityRepository
  ├── IRelationRepository
  └── IMemoryStore
```

---

## 6. 数据库 Schema

### 6.1 narrative.db 表结构

```sql
-- ─── 实体表 ───

CREATE TABLE entities (
  id            TEXT PRIMARY KEY,         -- UUID v4
  entity_type   TEXT NOT NULL,            -- EntityType enum value
  name          TEXT NOT NULL,
  description   TEXT DEFAULT '',
  aliases       TEXT DEFAULT '[]',        -- JSON array
  properties    TEXT DEFAULT '{}',        -- JSON object
  confidence    REAL DEFAULT 1.0,         -- 0.0 - 1.0
  novel_id      TEXT,                     -- 所属小说
  source        TEXT DEFAULT 'user',      -- 'user' | 'ai' | 'import'
  nowledge_id   TEXT,                     -- Nowledge Mem 关联 ID
  sync_version  INTEGER DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_entities_type ON entities(entity_type);
CREATE INDEX idx_entities_novel ON entities(novel_id);
CREATE INDEX idx_entities_nowledge ON entities(nowldege_id);

-- ─── 关系表 ───

CREATE TABLE relations (
  id             TEXT PRIMARY KEY,
  source_id      TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  target_id      TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  relation_type  TEXT NOT NULL,           -- RelationType enum value
  weight         REAL DEFAULT 1.0,
  properties     TEXT DEFAULT '{}',       -- JSON object
  nowledge_id    TEXT,
  evolves_kind   TEXT,                    -- EvolvesKind (nullable)
  sync_version   INTEGER DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_relations_source ON relations(source_id);
CREATE INDEX idx_relations_target ON relations(target_id);
CREATE INDEX idx_relations_type ON relations(relation_type);

-- ─── 六维记忆表 ───

CREATE TABLE memories (
  id               TEXT PRIMARY KEY,
  dimension        TEXT NOT NULL,         -- DimensionType enum value
  title            TEXT NOT NULL,
  content          TEXT NOT NULL,
  labels           TEXT DEFAULT '[]',     -- JSON array
  importance       REAL DEFAULT 0.5,      -- 0.1 - 1.0
  temporal_context TEXT DEFAULT 'timeless',
  event_start      TEXT,                  -- ISO 8601
  event_end        TEXT,
  is_crystal       INTEGER DEFAULT 0,     -- boolean
  novel_id         TEXT,
  chapter_id       TEXT,
  nowledge_id      TEXT,
  sync_version     INTEGER DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_memories_dimension ON memories(dimension);
CREATE INDEX idx_memories_novel ON memories(novel_id);
CREATE INDEX idx_memories_nowledge ON memories(nowldege_id);
CREATE INDEX idx_memories_importance ON memories(importance);

-- ─── 伏笔追踪表 ───

CREATE TABLE foreshadows (
  id                 TEXT PRIMARY KEY,
  title              TEXT NOT NULL,
  description        TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'planted', -- ForeshadowStatus
  planted_chapter_id TEXT NOT NULL,
  target_chapter_id  TEXT,
  current_chapter_id TEXT,
  max_distance       INTEGER DEFAULT 10,  -- 最大章节距离
  reminder_threshold INTEGER DEFAULT 3,   -- 提醒阈值
  resolution         TEXT,
  related_entities   TEXT DEFAULT '[]',   -- JSON array of entity IDs
  tension            REAL DEFAULT 0.5,    -- 0.0 - 1.0
  novel_id           TEXT,
  metadata           TEXT DEFAULT '{}',
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_foreshadows_status ON foreshadows(status);
CREATE INDEX idx_foreshadows_novel ON foreshadows(novel_id);
CREATE INDEX idx_foreshadows_chapter ON foreshadows(planted_chapter_id);

-- ─── 质量评分表 ───

CREATE TABLE quality_scores (
  id            TEXT PRIMARY KEY,
  target_type   TEXT NOT NULL,            -- 'chapter' | 'scene' | 'paragraph'
  target_id     TEXT NOT NULL,
  evaluator     TEXT NOT NULL,            -- 评估器名称
  scores        TEXT NOT NULL,            -- JSON: dimension→score map
  overall       REAL NOT NULL,
  suggestions   TEXT DEFAULT '[]',        -- JSON array
  revision_round INTEGER DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_quality_target ON quality_scores(target_type, target_id);
CREATE INDEX idx_quality_evaluator ON quality_scores(evaluator);

-- ─── 同步状态表 ───

CREATE TABLE sync_state (
  id              TEXT PRIMARY KEY,       -- 本地实体/记忆 ID
  entity_type     TEXT NOT NULL,          -- 'entity' | 'memory' | 'relation'
  nowledge_id     TEXT,                   -- Nowledge Mem 对应 ID
  sync_direction  TEXT NOT NULL,          -- 'push' | 'pull' | 'bidirectional'
  last_synced_at  TEXT,
  sync_version    INTEGER DEFAULT 0,
  conflict_state  TEXT,                   -- null | 'detected' | 'resolved'
  conflict_data   TEXT,                   -- JSON: 冲突详情
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_sync_nowledge ON sync_state(nowldege_id);
CREATE INDEX idx_sync_type ON sync_state(entity_type);
CREATE INDEX idx_sync_conflict ON sync_state(conflict_state);
```

### 6.2 向量数据库（vectors.db / 未来 LanceDB）

```sql
-- 当前 SQLite FTS5 方案

CREATE VIRTUAL TABLE memory_vectors USING fts5(
  memory_id,
  title,
  content,
  labels,
  dimension,
  tokenize='porter unicode61'
);

-- 未来 LanceDB 迁移方案（伪代码）
// const lancedb = await connect(vectorsDbPath);
// const table = await lancedb.createTable('embeddings', [
//   { id: 'uuid', vector: [0.1, ...], memory_id: 'uuid', dimension: 'timeline' }
// ]);
```

### 6.3 文件目录结构

```
~/.niko-studio/
├── narrative.db              # 合并后主数据库 (原 memory.db + graph.db)
├── vectors.db                # 向量/FTS 索引
├── sync/                     # 桥接同步状态
│   ├── mapping.json          # ID 映射表 (local ↔ nowledge)
│   ├── sync-log.jsonl        # 同步操作日志
│   └── conflict-queue.json   # 待解决冲突队列
├── backups/                  # 自动备份
│   └── narrative-YYYYMMDD.db
└── config.json               # 用户配置
```

---

## 7. 同步协议

### 7.1 同步方向

| 方向 | 触发条件 | 说明 |
|------|---------|------|
| Push (Engine → Nowledge) | 实体/记忆/关系创建或更新 | 将本地变更推送到 Nowledge Mem |
| Pull (Nowledge → Engine) | 搜索增强、图导航、Nowledge 聚类/矛盾检测结果 | 将 Nowledge 洞察拉取到本地 |
| Bidirectional | 定时全量同步、冲突解决后 | 双向对齐 |

### 7.2 触发机制

```typescript
enum SyncTrigger {
  ON_CREATE = 'on_create',       // 本地创建实体时自动 push
  ON_UPDATE = 'on_update',       // 本地更新实体时自动 push
  ON_DELETE = 'on_delete',       // 本地删除实体时同步删除 Nowledge 侧
  ON_SEARCH = 'on_search',       // 搜索时自动 pull 增强结果
  ON_CHAPTER_CHANGE = 'on_chapter_change', // 章节变更时检查伏笔状态
  SCHEDULED = 'scheduled',       // 定时全量同步（默认每小时）
  MANUAL = 'manual',             // 用户手动触发
}
```

### 7.3 同步流程

```
Push 流程:
  1. 本地创建/更新 Entity/Memory/Relation
  2. 写入 narrative.db + 更新 sync_version
  3. 发出 SyncEvent → KnowledgeBridge
  4. Bridge 进行数据映射（niko → Nowledge）
  5. 调用 INowledgeMemAPI 创建/更新
  6. 记录 mapping: localId → nowledgeId
  7. 更新 sync_state 表

Pull 流程:
  1. 搜索请求到达 KnowledgeBridge
  2. Bridge 调用 INowledgeMemAPI.searchMemories
  3. Nowledge 返回混合搜索结果
  4. Bridge 进行数据映射（Nowledge → niko）
  5. 合并到本地搜索结果（去重、排序）
  6. 返回 BridgedSearchResult

全量同步:
  1. 遍历 sync_state，找出 last_synced_at 早于 updated_at 的记录
  2. 批量 push 差异
  3. 从 Nowledge 拉取 clustering/contradiction 结果
  4. 合并到本地
  5. 处理冲突
```

### 7.4 冲突解决策略

| 策略 | 适用场景 | 说明 |
|------|---------|------|
| LWW (Last Write Wins) | 默认策略 | 比较 updated_at，最新写入胜出 |
| Semantic Merge | 内容冲突 | 语义合并：保留两方的信息增量 |
| Manual Resolution | 高 importance 数据 | 推送至冲突队列，等待用户选择 |
| Source Priority | AI vs User | 用户手动创建优先于 AI 生成 |

```typescript
interface ConflictResolution {
  strategy: 'lww' | 'semantic' | 'manual' | 'source_priority';
  winner: 'local' | 'nowledge' | 'merged';
  mergedData?: Entity | Memory | Relation;  // 仅 semantic 策略
  reason: string;
}
```

### 7.5 同步降级

| Nowledge Mem 状态 | 行为 |
|-------------------|------|
| 在线（延迟 < 200ms） | 全功能：双向同步、混合搜索、图导航 |
| 在线但慢（200ms - 2s） | 降级：仅 push，搜索跳过 Nowledge 增强 |
| 离线 | 本地自治：所有操作在 narrative.db 完成，变更进入 pending 队列，上线后批量同步 |
| 版本不兼容 | 告警 + 只读：仅允许 pull，禁止 push 防止数据损坏 |

---

## 8. 性能需求

### 8.1 延迟指标

| 操作 | 目标延迟 | 最大延迟 | 备注 |
|------|---------|---------|------|
| 本地实体 CRUD | < 10ms | 50ms | SQLite 直写 |
| 本地记忆搜索（FTS5） | < 50ms | 200ms | 10k 条记录内 |
| Nowledge HTTP 调用 | < 200ms | 2s | 含网络 + 处理 |
| 混合搜索（本地 + Nowledge） | < 500ms | 3s | 并行执行，取较快 |
| 图导航（depth=2） | < 300ms | 1.5s | |
| 叙事分析（单章节） | < 2s | 5s | 含 AI 调用 |
| 修订循环（3 轮） | < 30s | 60s | 含 3× AI 调用 |
| 质量门循环（3 轮） | < 45s | 90s | 含 3× (分析 + 修订) |
| 全量同步（1000 条） | < 30s | 120s | |
| 伏笔状态检查 | < 20ms | 100ms | |

### 8.2 吞吐量

| 场景 | 指标 |
|------|------|
| 批量实体导入 | > 1000 条/秒 |
| 批量关系导入 | > 500 条/秒 |
| 并发搜索 | 支持 5 个并发搜索请求 |
| FTS5 索引更新 | < 1ms/条 |

### 8.3 存储限制

| 资源 | 限制 | 备注 |
|------|------|------|
| narrative.db 大小 | < 500 MB | 超过时触发归档 |
| 单条记忆 content | < 100 KB | 超过时建议拆分 |
| 实体总数 | < 50,000 | 单小说 |
| 关系总数 | < 200,000 | 单小说 |
| FTS5 索引大小 | < DB 大小的 30% | |
| 同步队列 | < 10,000 条 pending | 超过时批量合并 |

### 8.4 内存使用

| 组件 | 预估内存 | 上限 |
|------|---------|------|
| Tauri 主进程 | 50 MB | 150 MB |
| React 前端 | 100 MB | 300 MB |
| Nowledge Mem 进程 | 200 MB | 500 MB |
| 总计 | 350 MB | 1 GB |

---

## 9. 安全需求

### 9.1 本地优先架构

| 原则 | 实现 |
|------|------|
| 数据主权 | 所有数据默认存储在本地 `~/.niko-studio/` |
| 离线可用 | Nowledge Mem 不可用时系统完全可用 |
| 无云依赖 | 不强制任何云服务，AI 功能使用用户配置的端点 |
| 用户控制 | 用户可完全禁用 Nowledge Mem 集成 |

### 9.2 API 认证

```typescript
interface NowledgeMemAuth {
  /** Nowledge Mem HTTP API 认证方式 */
  type: 'none' | 'api_key' | 'local_only';

  /** API Key（仅 api_key 模式） */
  apiKey?: string;

  /** 绑定地址（仅 local_only 模式） */
  bindAddress: '127.0.0.1';  // 强制本地回环
}
```

- 默认模式：`local_only`，Nowledge Mem 仅监听 `127.0.0.1:19828`
- 生产模式：可启用 `api_key` 认证
- 禁止：`0.0.0.0` 绑定（防止网络暴露）

### 9.3 数据隔离

| 隔离维度 | 实现 |
|---------|------|
| 小说隔离 | 每个 novel_id 的实体/记忆/关系逻辑隔离，共享物理表 |
| 用户隔离 | 单用户桌面应用，无多租户需求 |
| 进程隔离 | Nowledge Mem 独立进程，通过 HTTP 通信 |
| 文件隔离 | 数据目录权限 700（仅当前用户可访问） |

### 9.4 敏感数据处理

| 数据类型 | 处理方式 |
|---------|---------|
| AI API Key | 存储于系统 Keychain（Tauri keyring 插件），不在配置文件中明文存储 |
| 用户创作内容 | 本地加密存储可选（AES-256-GCM），默认明文 |
| 同步数据 | 本地 → Nowledge 通信走 HTTP（本地回环），无远程传输 |
| 日志 | 不记录完整创作内容，仅记录操作类型和元数据 |

---

## 10. 部署架构

### 10.1 Tauri v2 打包

```
niko-studio installer/
├── niko-studio.exe              # Tauri 主应用
├── runtime/
│   ├── nmem.exe                 # Nowledge Mem CLI
│   ├── nowledge-mem-server/    # Nowledge Mem HTTP 服务
│   │   ├── server.exe
│   │   └── config.toml
│   └── data/                    # 初始数据目录
│       └── seed/
└── resources/
    ├── frontend/                # React 构建产物
    └── migrations/              # DB migration scripts
```

### 10.2 Nowledge Mem 打包策略

| 策略 | 说明 |
|------|------|
| 嵌入式 | Nowledge Mem 作为 Tauri sidecar 进程启动 |
| 生命周期 | 随 Tauri 应用启动/停止 |
| 端口 | 默认 19828，可配置，冲突时自动递增 |
| 健康检查 | 启动后轮询 `/health`，超时 10s 视为不可用 |
| 降级 | 启动失败时跳过，Engine Layer 使用本地存储 |

### 10.3 Tauri Sidecar 配置

```json
// src-tauri/tauri.conf.json
{
  "plugins": {
    "shell": {
      "sidecars": [
        {
          "id": "nowledge-mem-server",
          "path": "runtime/nowledge-mem-server/server",
          "args": ["--port", "19828", "--data-dir", "$APP_DATA/nowledge"],
          "autoStart": true,
          "healthCheck": {
            "url": "http://127.0.0.1:19828/health",
            "intervalMs": 30000,
            "timeoutMs": 5000
          }
        }
      ]
    }
  }
}
```

### 10.4 数据目录

| 平台 | 路径 |
|------|------|
| Windows | `%APPDATA%/niko-studio/` |
| macOS | `~/Library/Application Support/niko-studio/` |
| Linux | `~/.local/share/niko-studio/` |

### 10.5 更新策略

| 组件 | 更新方式 |
|------|---------|
| niko-studio 主应用 | Tauri 内置更新器 |
| Nowledge Mem | 随主应用一起更新，sidecar 版本绑定 |
| 前端 | 随主应用一起更新 |
| DB Schema | 前向兼容 migration，启动时自动执行 |

---

## 11. 错误处理与降级策略

### 11.1 错误分类

```typescript
enum ErrorCategory {
  // ── Knowledge Layer 错误 ──
  NOWLEDGE_UNAVAILABLE = 'nowledge_unavailable',    // Nowledge Mem 不可达
  NOWLEDGE_TIMEOUT = 'nowledge_timeout',            // 请求超时
  NOWLEDGE_VERSION_MISMATCH = 'nowledge_version',   // 版本不兼容
  NOWLEDGE_AUTH_FAILED = 'nowledge_auth',           // 认证失败

  // ── Bridge 错误 ──
  SYNC_CONFLICT = 'sync_conflict',                  // 同步冲突
  SYNC_MAPPING_ERROR = 'sync_mapping',              // 数据映射失败
  SYNC_PARTIAL_FAILURE = 'sync_partial',            // 部分同步失败

  // ── Engine Layer 错误 ──
  ANALYSIS_FAILED = 'analysis_failed',              // 叙事分析失败
  EVALUATION_FAILED = 'evaluation_failed',          // 评估失败
  REVISION_STAGNATION = 'revision_stagnation',      // 修订停滞
  QUALITY_GATE_ESCALATION = 'quality_escalation',   // 质量门升级

  // ── Storage 错误 ──
  DB_CORRUPTION = 'db_corruption',                  // 数据库损坏
  DB_FULL = 'db_full',                              // 存储空间不足
  DB_MIGRATION_FAILED = 'db_migration',             // 迁移失败
}
```

### 11.2 降级矩阵

| 错误 | 降级行为 | 用户感知 | 恢复方式 |
|------|---------|---------|---------|
| Nowledge Mem 不可达 | 切换到纯本地模式，同步进入 pending 队列 | 搜索结果不含 Nowledge 增强 | 自动检测上线 |
| Nowledge Mem 超时 | 跳过 Nowledge 增强，使用本地结果 | 搜索可能不够全面 | 重试 + 指数退避 |
| 同步冲突 | 写入冲突队列，使用 LWW 临时解决 | 可能有数据不一致提示 | 用户手动解决 |
| 数据映射失败 | 跳过该条目，记录错误日志 | 部分数据未同步 | 修复映射规则后重试 |
| 叙事分析失败 | 返回降级结果（基础统计） | 分析维度减少 | 重试 |
| 修订停滞 | 停止循环，返回最佳版本 | 显示"无法继续改善" | 用户手动调整 |
| 质量门升级 | 放宽阈值或标记为需人工审核 | 显示"需要人工干预" | 用户手动处理 |
| DB 损坏 | 从最近备份恢复 | 可能丢失最近数据 | 自动恢复 + 告警 |

### 11.3 重试策略

```typescript
interface RetryConfig {
  maxRetries: number;          // 默认 3
  baseBackoffMs: number;       // 默认 1000
  maxBackoffMs: number;        // 默认 30000
  backoffMultiplier: number;   // 默认 2
  retryableErrors: ErrorCategory[];
}

// 各操作的重试配置
const RETRY_POLICIES: Record<string, RetryConfig> = {
  nowledge_api: {
    maxRetries: 3,
    baseBackoffMs: 1000,
    maxBackoffMs: 30000,
    backoffMultiplier: 2,
    retryableErrors: ['nowledge_timeout', 'nowledge_unavailable'],
  },
  sync_push: {
    maxRetries: 5,
    baseBackoffMs: 2000,
    maxBackoffMs: 60000,
    backoffMultiplier: 2,
    retryableErrors: ['nowledge_unavailable', 'sync_partial'],
  },
  narrative_analysis: {
    maxRetries: 2,
    baseBackoffMs: 3000,
    maxBackoffMs: 15000,
    backoffMultiplier: 2,
    retryableErrors: ['analysis_failed'],
  },
};
```

### 11.4 停滞检测

```typescript
/**
 * 修订循环的停滞检测
 * 当连续两轮改善幅度低于阈值时判定为停滞
 */
interface StagnationDetector {
  /** 最小改善幅度阈值 */
  threshold: number;           // 默认 0.05 (5%)

  /** 检测方法 */
  detect(iterations: RevisionIteration[]): boolean;
  // 实现：iterations[n].improvementDelta < threshold
  //       && iterations[n-1].improvementDelta < threshold
}
```

---

## 12. 测试策略

### 12.1 测试分层

| 层级 | 范围 | 工具 | 覆盖目标 |
|------|------|------|---------|
| 单元测试 | 纯函数、数据映射、业务逻辑 | Vitest | > 80% |
| 集成测试 | DI 容器、Bridge、DB 操作 | Vitest + 临时 SQLite | 关键路径 100% |
| 契约测试 | Nowledge Mem API 契约 | MSW (Mock Service Worker) | 所有端点 |
| E2E 测试 | 完整用户流程 | Playwright | 核心场景 |
| 性能测试 | 搜索延迟、同步吞吐 | Vitest benchmark | 达标 |
| 基准测试 | 叙事分析质量 | 自定义对比基准 | 不退化 |

### 12.2 关键测试用例

#### 12.2.1 数据映射测试

```typescript
describe('KnowledgeBridge Entity Mapping', () => {
  it('should map CHARACTER to nowledge entity_type=character', async () => {
    const entity = createTestEntity({ entityType: EntityType.CHARACTER });
    const nowledgeEntity = bridge.mapEntityToNowledge(entity);
    expect(nowldegeEntity.entity_type).toBe('character');
    expect(nowldegeEntity.labels).toEqual([]);
  });

  it('should map FORESHADOW to concept+["foreshadow"]', async () => {
    const entity = createTestEntity({ entityType: EntityType.FORESHADOW });
    const nowledgeEntity = bridge.mapEntityToNowledge(entity);
    expect(nowldegeEntity.entity_type).toBe('concept');
    expect(nowldegeEntity.labels).toContain('foreshadow');
  });

  it('should map FORESHADOWS relation to EVOLVES+Enriches', async () => {
    const relation = createTestRelation({ relationType: RelationType.FORESHADOWS });
    const nowledgeRelation = bridge.mapRelationToNowledge(relation);
    expect(nowldegeRelation.relation_type).toBe('EVOLVES');
    expect(nowldegeRelation.evolves_kind).toBe('Enriches');
  });

  it('should map FOLLOWS to PRECEDED with reversed direction', async () => {
    const relation = createTestRelation({
      relationType: RelationType.FOLLOWS,
      sourceId: 'B', targetId: 'A'  // B follows A
    });
    const nowledgeRelation = bridge.mapRelationToNowledge(relation);
    expect(nowldegeRelation.relation_type).toBe('PRECEDED');
    expect(nowldegeRelation.source_id).toBe('A');  // direction reversed
    expect(nowldegeRelation.target_id).toBe('B');
  });

  it('should roundtrip entity without data loss', async () => {
    const original = createTestEntity({ entityType: EntityType.LOCATION });
    const nowledge = bridge.mapEntityToNowledge(original);
    const roundtripped = bridge.mapNowledgeToEntity(nowldege);
    expect(roundtripped.entityType).toBe(original.entityType);
    expect(roundtripped.name).toBe(original.name);
    expect(roundtripped.aliases).toEqual(original.aliases);
  });
});
```

#### 12.2.2 同步测试

```typescript
describe('KnowledgeBridge Sync', () => {
  it('should push entity to Nowledge Mem and record mapping', async () => {
    const entity = createTestEntity();
    const nowledgeId = await bridge.pushEntity(entity);
    expect(nowldegeId).toBeTruthy();
    const mapping = await syncStateRepo.getMapping(entity.id);
    expect(mapping.nowldege_id).toBe(nowldegeId);
  });

  it('should handle Nowledge Mem unavailable gracefully', async () => {
    mockNowledgeAPI.setOffline(true);
    const entity = createTestEntity();
    // 本地操作应成功
    await entityRepo.create(entity);
    // Push 应进入 pending 队列
    await bridge.pushEntity(entity);
    const pending = await syncStateRepo.getPending();
    expect(pending).toHaveLength(1);
  });

  it('should resolve conflicts with LWW by default', async () => {
    const local = createTestEntity({ updatedAt: '2026-06-01T12:00:00Z' });
    const remote = createTestEntity({ updatedAt: '2026-06-01T11:00:00Z' });
    const resolution = bridge.resolveConflict(local, remote, { strategy: 'lww' });
    expect(resolution.winner).toBe('local');
  });

  it('should batch sync 1000 entities within 30s', async () => {
    const entities = Array.from({ length: 1000 }, () => createTestEntity());
    const start = Date.now();
    await bridge.pushEntities(entities);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(30000);
  });
});
```

#### 12.2.3 叙事引擎测试

```typescript
describe('NarrativeEngine', () => {
  it('should detect all 7 deadly sins', async () => {
    const text = loadFixture('purple-prose-sample.txt');
    const report = await engine.evaluateDeadlySins(text);
    expect(report.purpleProse).toBeGreaterThan(0.5);
  });

  it('should detect revision stagnation', async () => {
    const params = { text: 'sample', maxRevisions: 3, stagnationThreshold: 0.05 };
    const result = await engine.runRevisionLoop(params);
    // 如果改善幅度持续低于阈值，应标记为停滞
    if (result.stagnated) {
      expect(result.iterations.length).toBeLessThanOrEqual(3);
    }
  });

  it('should track foreshadow lifecycle', async () => {
    const tracker = engine.getForeshadowTracker();
    const f = await tracker.plant({
      title: 'Mysterious Key',
      description: 'A key found in the attic',
      plantedChapterId: 'ch-1',
      targetChapterId: 'ch-5',
      maxDistance: 10,
      reminderThreshold: 3,
    });
    expect(f.status).toBe(ForeshadowStatus.PLANTED);

    await tracker.updateStatus(f.id, ForeshadowStatus.APPROACHING);
    const due = await tracker.getDueForeshadows();
    expect(due).toHaveLength(0);  // 还未到期

    await tracker.resolve(f.id, 'The key opens the secret door');
    const resolved = await tracker.getByChapter('ch-5');
    expect(resolved[0].status).toBe(ForeshadowStatus.RESOLVED);
  });
});
```

#### 12.2.4 Nowledge Mem 契约测试

```typescript
describe('Nowledge Mem API Contract', () => {
  it('should match memory schema on create', async () => {
    const response = await nowledgeAPI.createMemory({
      title: 'Test Memory',
      content: 'Test content',
      unit_type: 'fact',
      labels: ['test'],
      importance: 0.8,
      temporal_context: 'present',
    });
    expect(response).toMatchObject({
      id: expect.any(String),
      title: 'Test Memory',
      unit_type: 'fact',
      importance: 0.8,
      version: 1,
    });
  });

  it('should return search results in expected format', async () => {
    const results = await nowledgeAPI.searchMemories({
      query: 'test',
      mode: 'hybrid',
      limit: 5,
    });
    expect(results.items).toBeInstanceOf(Array);
    expect(results.total).toBeGreaterThanOrEqual(0);
    results.items.forEach(item => {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('score');
    });
  });
});
```

### 12.3 性能基准

```typescript
describe('Performance Benchmarks', () => {
  it('entity CRUD < 10ms p95', async () => {
    const durations: number[] = [];
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      await entityRepo.create(createTestEntity());
      durations.push(performance.now() - start);
    }
    durations.sort((a, b) => a - b);
    const p95 = durations[Math.floor(durations.length * 0.95)];
    expect(p95).toBeLessThan(10);
  });

  it('FTS5 search < 50ms for 10k records', async () => {
    // 预填充 10k 记录
    await seedMemories(10000);
    const start = performance.now();
    await memoryStore.search('test query');
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });
});
```

### 12.4 质量回归基准

```typescript
/**
 * 叙事分析质量的回归测试
 * 基于 golden dataset，确保分析结果不退化
 */
describe('Narrative Quality Regression', () => {
  const baseline = loadBaseline('narrative-analysis-baseline.json');

  it('hook analysis should not regress beyond 5%', async () => {
    const text = loadFixture('hook-test-sample.txt');
    const result = await engine.analyzeHook(text);
    const expected = baseline.hookAnalysis;
    expect(Math.abs(result.overall - expected.overall)).toBeLessThan(0.05);
  });

  it('critic scores should be within baseline range', async () => {
    const text = loadFixture('critic-test-sample.txt');
    const result = await engine.evaluate(text);
    expect(result.overallScore).toBeGreaterThanOrEqual(baseline.criticScore - 5);
    expect(result.overallScore).toBeLessThanOrEqual(baseline.criticScore + 5);
  });
});
```

---

## 附录 A: 废弃接口迁移表

| 废弃接口 | 替代接口 | 迁移说明 |
|---------|---------|---------|
| `IWikiStore` | `INowledgeMemAPI` | 所有 CRUD 操作迁移至 Nowledge Mem HTTP 适配器 |
| `IWikiSchema` | `IKnowledgeBridge` | Schema 映射逻辑迁移至 Bridge 的 map 方法 |
| `IWikiQuery` | `INowledgeMemAPI.searchMemories` | 查询方法迁移至 Nowledge 搜索 API |
| `IWikiKnowledgeLayer` | `IKnowledgeBridge` | 知识层完整功能迁移至 Bridge |
| `memory.db` | `narrative.db` | 合并到主数据库，表结构不变 |
| `graph.db` | `narrative.db` | 合并到主数据库，表结构不变 |

## 附录 B: 环境变量

| 变量 | 默认值 | 说明 |
|------|-------|------|
| `NIKO_NOWLEDGE_URL` | `http://127.0.0.1:19828` | Nowledge Mem HTTP 地址 |
| `NIKO_NOWLEDGE_AUTH` | `none` | 认证模式 |
| `NIKO_NOWLEDGE_API_KEY` | — | API Key（仅 api_key 模式） |
| `NIKO_DATA_DIR` | 平台默认 | 数据目录路径 |
| `NIKO_SYNC_INTERVAL_MS` | `3600000` | 全量同步间隔（1 小时） |
| `NIKO_SYNC_BATCH_SIZE` | `100` | 批量同步大小 |
| `NIKO_LOG_LEVEL` | `info` | 日志级别 |
| `NIKO_AI_ENDPOINT` | — | AI 服务端点 |

## 附录 C: 修订历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0.0 | 2026-06-01 | 初始版本：三层架构完整技术规格 |
