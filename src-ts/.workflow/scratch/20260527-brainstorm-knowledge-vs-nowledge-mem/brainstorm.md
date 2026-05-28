# niko-studio 数据管理/知识库 vs Nowledge Mem 对比分析

## 1. 定位差异

| 维度 | niko-studio | Nowledge Mem |
|------|------------|-------------|
| 核心定位 | 叙事创作辅助的知识引擎 | 通用个人上下文管理器 |
| 目标用户 | 小说/叙事创作者 | 任何 AI 工具用户 |
| 知识域 | 角色关系、情节结构、世界观 | 决策记录、洞察、来源追踪 |
| 生命周期 | 项目级 → 角色/情节随故事演化 | 永久级 → 跨工具、跨项目持久 |

## 2. 数据模型对比

### niko-studio 叙事实体模型

```
Entity { id, name, type: EntityType, properties, embedding }
  EntityType: CHARACTER | LOCATION | EVENT | ITEM | FORESHADOW | THEME | PLOT_THREAD

Relationship { id, source, target, type: RelationType, properties, weight }
  RelationType: KNOWS | LOCATED_IN | PARTICIPATES | CAUSES | PRECEDES |
                FORESHADOWS | RESOLVES | CONFLICTS_WITH | SERVES | OPPOSES

Embedding { id, vector: float[], model, createdAt }
  检索: vector similarity + FTS5 keyword + RRF fusion
```

### niko-studio 分层记忆模型

```
UnifiedMemory {
  layers: ephemeral → session → user → project (4层)
  dimensions: timeline | context | character | worldview | preference | experience (6维)
  temporal: { validFrom, validUntil, supersedes[] } (时序覆盖链)
  conflict: ConflictResolver { strategy: LATEST_WINS | SOURCE_PRIORITY | MERGE | MANUAL }
}
```

### Nowledge Mem 模型

```
INowledgeMemService {
  // 记忆 CRUD
  addMemory(content, labels?, importance?, source?): Promise<MemoryId>
  getMemory(id): Promise<Memory | null>
  searchMemories(query, options?): Promise<Memory[]>
  deleteMemory(id): Promise<void>
  updateMemory(id, updates): Promise<Memory>

  // 图结构
  getRelatedMemories(id, depth?): Promise<Memory[]>
  createRelation(source, target, type): Promise<void>

  // 蒸馏/摘要
  summarizeMemories(ids): Promise<MemoryId>

  // 线程管理
  addThread(messages[]): Promise<ThreadId>
  searchThreads(query): Promise<Thread[]>

  // 导入
  importFromLibrary(source): Promise<ImportResult>
}

Memory { id, content, labels, importance, source, createdAt, updatedAt }
Thread { id, messages, summary, createdAt }
```

## 3. 核心能力对比

| 能力 | niko-studio | Nowledge Mem | 评述 |
|------|------------|-------------|------|
| **实体存储** | Entity (6种叙事类型 + 自定义) | Memory (labels + importance) | niko-studio 叙事特化，Nowledge Mem 通用 |
| **关系图** | Relation (10+ 叙事关系类型 + 权重) | Relation (type only) | niko-studio 更丰富，Nowledge Mem 更灵活 |
| **混合检索** | vector + FTS5 + RRF 融合 | 语义 + 关键词 + 图导航 | 能力相当，niko-studio 有 RRF 融合排序 |
| **时序模型** | 4层×6维 + validFrom/Until + supersedes | importance + createdAt | niko-studio 远超 — 时序覆盖链是核心差异 |
| **冲突处理** | ConflictResolver (4种策略) | 矛盾自动标记 | niko-studio 更精细，Nowledge Mem 更自动化 |
| **蒸馏/摘要** | 无原生支持 | summarizeMemories | Nowledge Mem 独有 — 自动提炼持久知识 |
| **线程管理** | 无 | Thread (对话保存+搜索) | Nowledge Mem 独有 |
| **跨工具** | 无 | 统一上下文服务 Claude/Cursor/Copilot | Nowledge Mem 独有核心优势 |
| **叙事分析** | hook/cliffhanger/voice-fingerprint/emotional-arc | 无 | niko-studio 独有核心优势 |
| **社区检测** | 无 | Library import + community detection | Nowledge Mem 独有 |

## 4. 存储后端对比

| 维度 | niko-studio | Nowledge Mem |
|------|------------|-------------|
| 主后端 | SQLite (better-sqlite3) | 本地文件 + HTTP API |
| 降级 | FS adapter (无 SQLite 时) | 离线缓存 |
| 向量存储 | 内置 embedding 表 + 余弦相似度 | 外部 embedding service |
| 全文搜索 | SQLite FTS5 | 内置关键词索引 |
| 分布式 | PG shadow-write (可选) | 无 |

## 5. 桥接设计（已实现）

niko-studio 已设计双向桥接层：

```
KnowledgeService
    ├── KnowledgeMemoryEngineAdapter (primary: UnifiedMemory)
    │       └── 4层6维时序 + 叙事实体
    └── NowledgeMemKnowledgeBridge (secondary: INowledgeMemService)
            └── 通用知识 + 跨工具上下文

CompositeKnowledgeMemoryBridge {
  primary: KnowledgeMemoryEngineAdapter    // 叙事特化，始终可用
  secondary: NowledgeMemKnowledgeBridge    // 通用上下文，静默降级
  write: 双写 (primary + secondary)
  read: primary 优先，secondary 补充
  failover: secondary 失败 → 静默降级到 primary-only
}
```

### 桥接映射规则

| niko-studio 概念 | Nowledge Mem 概念 | 映射方式 |
|-----------------|------------------|---------|
| Entity | Memory | labels = [entityType, ...tags] |
| Relationship | createRelation | type 映射 |
| UnifiedMemory 层级 | importance | ephemeral=1, session=3, user=7, project=10 |
| ConflictResolver 结果 | 更新 Memory | 以最新状态覆盖 |
| 时序覆盖链 | 无直接映射 | 仅同步当前有效状态 |

## 6. 互补关系结论

**不是替代关系，是桥接互补：**

1. **niko-studio 做不到的** — 跨工具上下文共享、自动蒸馏、对话线程保存、社区知识导入
2. **Nowledge Mem 做不到的** — 叙事实体类型、情节关系图、4层6维时序、冲突策略、叙事维度分析
3. **桥接价值** — Nowledge Mem 补充通用知识捕获，niko-studio 保持叙事特化，CompositeBridge 双写联动

### 推荐集成策略

- **短期**：通过 CompositeBridge 双写，Nowledge Mem 作为 secondary 存储降级运行
- **中期**：利用 Nowledge Mem 的 summarizeMemories 能力，将对话中的创作洞察自动蒸馏回 niko-studio 的 knowledge base
- **长期**：Nowledge Mem 的 Library/Community 功能可以作为叙事知识的外部来源，导入后通过 niko-studio 的叙事实体模型结构化
