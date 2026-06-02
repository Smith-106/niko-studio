# Brainstorm: niko-studio 知识管理方案 — Karpathy LLM Wiki 重置评估

## 差距矩阵

| 能力维度 | Karpathy LLM Wiki 理想态 | niko-studio 当前状态 | 差距 |
|---------|------------------------|---------------------|------|
| **LLM 编译链** | LLM 读来源 → 提取概念 → 生成/更新 wiki 页面 | `promoteProjectWikiCanon` 仅手动提升，无 LLM 概念提取 | 核心缺失 |
| **增量变更检测** | SHA-256 hash 追踪，只重编译变更部分 | 无源文件 hash 追踪 | 缺失 |
| **Wiki 搜索** | embedding + BM25 + graph expansion | 纯 TF 词频评分（手写 `scoreProjectWikiPage`） | 严重不足 |
| **交叉引用** | `[[wikilink]]` 自动解析 + 双向链接 | `wiki-graph-search.ts` BFS/DFS 存在，但数据为空 | 管道有/数据无 |
| **矛盾检测** | LLM 标记新旧数据矛盾 | `conflict-resolver.ts` 存在但从未运行 | 管道有/从未启用 |
| **Lint/健康检查** | broken links, orphans, stale claims, duplicates | `knowledge-audit` 工作流已定义，从未执行 | 管道有/从未启用 |
| **页面类型系统** | concept / entity / comparison / overview / synthesis | Authority Contract（scope/canon/projection）但无内容类型 | 不足 |
| **Schema 配置** | CLAUDE.md / AGENTS.md 告诉 LLM 如何维护 wiki | `wiki-schema.ts` 硬编码 schema，CLAUDE.md 有全局指引 | 部分有 |
| **数据层** | 单层：Markdown 文件 + embedding 索引 | 多层重叠：Wiki Canon + Memory DB + Graph DB + Vector DB + OpenKL | 过度复杂 |

## 三方案评估

### 方案 A：全量重置为 Karpathy 模式

**做法**：废弃 Wiki Canon / Memory / Graph / Vector 多层架构，重写为 `raw/` + `wiki/` 两层 LLM Wiki。

**利**：
- 架构极简，符合 Karpathy "LLM owns the wiki" 理念
- 消除当前多系统重叠的复杂度
- 知识编译一次、持续维护，查询精度靠编译质量而非搜索算法

**弊**：
- 丢弃 54KB unified-memory + 120 行 graph-engine + hybrid search pipeline 等已有实现
- Memory 的双时序追踪（valid_from/until, supersedes）在 LLM Wiki 模式下无对应
- Graph 的 Cypher 查询 + 图遍历能力丢失
- Vector 语义搜索能力丢失（LLM Wiki 的 `llm-wiki-compiler` 实际也需要 embedding）
- niko-studio 是**写作工具**而非通用知识库——角色/地点/伏笔等叙事实体需要结构化图谱，纯 Markdown 不够

**风险**：高。重写量大，且丢失写作领域特有的结构化能力。

---

### 方案 B：渐进改造——在现有架构上补 LLM Wiki 能力

**做法**：保留现有存储层，新增 LLM 编译链 + 增量检测 + wiki 语义搜索。

**改造点**：
1. 新增 `wiki-compile.ts`：LLM 驱动的概念提取 → 页面生成/更新
2. 新增 `wiki-change-tracker.ts`：SHA-256 hash 增量检测
3. 重写 `wiki-query.ts`：从 TF 评分升级为 FTS5 + embedding 混合搜索
4. 新增页面类型系统：concept / entity / comparison / overview
5. 启用 `knowledge-audit` 和 `conflict-resolver`

**利**：
- 保留 Memory/Graph/Vector 的结构化能力
- 逐步改造，每步可验证
- 写作领域特有能力（伏笔追踪、时序记忆、角色档案）不丢失

**弊**：
- 不解决多系统重叠问题
- Wiki Canon 与 Memory/Graph 仍有职责交叉
- 改造分散，可能引入不一致

**风险**：中。工作量大但可控。

---

### 方案 C：混合方案——Wiki 层重置为 LLM Wiki，保留下层引擎

**做法**：将 Wiki Canon 层替换为 Karpathy 模式的 LLM Wiki（`raw/` + `wiki/`），但保留 Memory/Graph/Vector 作为 wiki 下层的结构化引擎。

**架构**：
```
用户 / LLM Agent
      │
      ▼
┌─────────────────────────────┐
│  LLM Wiki 层（Karpathy 模式）│  ← raw/ + wiki/，LLM 自动编译维护
│  concept / entity / overview │
│  [[wikilink]] 交叉引用       │
│  矛盾标记 + lint             │
└──────────┬──────────────────┘
           │ wiki-compile 时下沉
           ▼
┌─────────────────────────────┐
│  结构化引擎层（保留现有）     │
│  Memory DB  → 时序/冲突      │
│  Graph DB   → 关系遍历       │
│  Vector DB  → 语义搜索       │
└─────────────────────────────┘
```

**核心变更**：
1. `.writing/wiki/pages/` → `.writing/wiki/`（Karpathy 目录布局：raw/ + concepts/ + queries/ + index.md）
2. `wiki-schema.ts` 的 Authority Contract 保留但简化——增加 `pageKind: concept|entity|comparison|overview|synthesis`
3. 新增 `wiki-compiler.ts`：LLM 驱动的两阶段编译（概念提取 → 页面生成），增量检测
4. `wiki-query.ts` 重写：FTS5 + embedding + graph expansion（复用现有引擎）
5. Wiki 编译时同步下沉到 Memory/Graph/Vector——LLM Wiki 是**读层**，结构化引擎是**算层**

**利**：
- 获得 Karpathy 模式的核心优势（LLM 编译、增量维护、知识复利）
- 保留写作领域的结构化能力（时序记忆、图谱遍历、语义搜索）
- 架构分层清晰：Wiki 是人类/LLM 的交互面，引擎是底层能力
- 现有 25+ MCP 端点、DI 容器、测试套件大部分可复用

**弊**：
- 需要重写 wiki-schema + wiki-store + wiki-query + 新增 wiki-compiler
- 两层之间需要同步策略（wiki 页面 ↔ graph/memory 实体）
- 比纯重置复杂，比渐进改造更有架构感

**风险**：中。改动集中在 wiki 层，下层引擎稳定不变。

## 决策建议

**推荐方案 C+：混合架构，以 nashsu/llm_wiki 为核心借鉴。**

理由：
1. **写作工具不能丢结构化** — 角色关系、伏笔追踪、时序记忆是核心功能，纯 Markdown wiki 无法表达
2. **Karpathy 的精华是"编译"而非"存储"** — 核心创新是 LLM 自动维护 wiki，不是 markdown 文件本身。可以把编译能力嫁接到现有架构上
3. **多系统重叠不是减法问题而是分层问题** — Wiki 层做人类可读的综合视图，Memory/Graph/Vector 做机器可查的结构化索引，各司其职
4. **数据真空的根本原因是缺少编译链** — 不是存储架构问题，是没有"LLM 读来源 → 写 wiki"的自动化流程。补上编译链，现有管道就能活起来

### 为什么选 nashsu/llm_wiki 而非 llm-wiki-compiler？

| 维度 | nashsu/llm_wiki | llm-wiki-compiler | 与 niko-studio 契合度 |
|------|----------------|-------------------|---------------------|
| 技术栈 | TypeScript + Electron | TypeScript + CLI | niko-studio 也是 TS + Electron |
| 数据库 | SQLite (better-sqlite3) | 文件系统 (Markdown) | niko-studio 已有 SQLite 全家桶 |
| 向量搜索 | LanceDB | BM25 + embedding | LanceDB 比 Float32 BLOB 更现代 |
| 知识图谱 | 四信号 + Louvain 社区检测 | wikilink 图扩展 | 四信号更丰富，适配写作领域 |
| 增量编译 | SHA-256 + 增量缓存 | hash-aware 两阶段 | 两者等价 |
| 深度研究 | 多引擎 web 搜索自动摄入 | 无 | 写作领域的资料收集需要 |
| 多模态 | PDF 图片 + 视觉模型描述 | 无 | 写作领域的角色设定/场景图需要 |
| MCP 集成 | HTTP API :19828 | 原生 MCP Server | niko-studio 已有 HTTP MCP 端点 |
| 审核系统 | 异步人工审核队列 | eval 评分 | 审核队列更符合"人策划，LLM 编译"理念 |

**llm-wiki-compiler 的优势**（编译管线更清晰、eval 框架可 CI 门控）应选择性借鉴，但核心嫁接对象是 nashsu/llm_wiki。

---

## 方案 C+ 详细嫁接设计

### 架构总览

```
用户 / LLM Agent / Claude Code
         │
         ▼
┌──────────────────────────────────────────┐
│  LLM Wiki 层（借鉴 nashsu/llm_wiki）      │
│                                          │
│  ┌─────────────┐  ┌──────────────────┐   │
│  │ 两步思维链   │  │ 四信号知识图谱    │   │
│  │ 摄入管线    │  │ + Louvain 社区    │   │
│  └──────┬──────┘  └────────┬─────────┘   │
│         │                  │             │
│  ┌──────▼──────┐  ┌───────▼──────────┐   │
│  │ 增量编译器   │  │ 异步审核队列      │   │
│  │ SHA-256     │  │ 人策划 + LLM 编译 │   │
│  └──────┬──────┘  └──────────────────┘   │
│         │                                │
│  ┌──────▼──────────────────────────────┐ │
│  │ Wiki 页面存储                        │ │
│  │ pageKind: concept|entity|comparison  │ │
│  │         |overview|synthesis          │ │
│  │ [[wikilink]] 交叉引用               │ │
│  │ 来源追溯 (段落级 + 声明级引用)       │ │
│  └─────────────────────────────────────┘ │
└──────────┬───────────────────────────────┘
           │ 编译时下沉 (wiki-bridge.ts)
           ▼
┌──────────────────────────────────────────┐
│  结构化引擎层（niko-studio 现有，保留）    │
│                                          │
│  Memory DB → 双时序/六维/冲突检测         │
│  Graph DB  → 叙事实体/伏笔/钩子          │
│  Vector DB → 语义搜索 (→迁移到 LanceDB)  │
│  OpenKL    → 文档摄入 + 归一化           │
└──────────────────────────────────────────┘
```

### 嫁接模块清单

| 模块 | 来源借鉴 | 新建/改造 | 关键接口 |
|------|---------|----------|---------|
| **wiki-compiler.ts** | nashsu 两步思维链 | 新建 | `compile(sourcePath, opts)` → `CompileResult` |
| **wiki-change-tracker.ts** | nashsu SHA-256 + 增量缓存 | 新建 | `hasChanged(filePath)` → boolean, `updateHash(filePath)` |
| **wiki-knowledge-fusion.ts** | nashsu 四信号图谱 | 新建 | `buildGraph(pages)` → `WikiGraph`, `detectCommunities()` → `Community[]` |
| **wiki-review-queue.ts** | nashsu 异步审核 | 新建 | `enqueue(item)`, `review(itemId, verdict)` |
| **wiki-schema.ts** | llm-wiki-compiler pageKind | 改造 | 扩展 Authority Contract 增加 `pageKind` |
| **wiki-query.ts** | llm-wiki-compiler 混合检索 | **重写** | FTS5 + embedding + graph expansion，替换 TF 评分 |
| **wiki-store.ts** | 保留 | 小改 | 适配新 schema |
| **wiki-bridge.ts** | 新设计 | 新建 | wiki↔engine 双向同步 |
| **vector-store.ts** | nashsu LanceDB | **替换** | Float32 BLOB → LanceDB |
| **deep-research.ts** | nashsu 深度研究 | 新建 | 多引擎 web 搜索 + 自动摄入 |

### 两步思维链摄入管线设计（核心嫁接）

```
Step 1: ANALYZE（分析阶段）
  输入: source document / conversation / web search results
  处理: LLM 提取关键概念、实体、关系、声明
  输出: structured extraction (concepts[], entities[], claims[], relations[])
  特性: 增量缓存 — 未变 source 跳过分析

Step 2: GENERATE（生成阶段）
  输入: Step 1 的 extraction + 已有 wiki 页面
  处理: LLM 生成/更新 wiki 页面，解析 [[wikilink]]，标记矛盾
  输出: 新增/更新的 wiki pages + 矛盾标记 + 审核队列项
  特性: 段落级 + 声明级来源引用
```

### 四信号知识图谱设计

| 信号 | 计算方式 | 用途 |
|------|---------|------|
| **Direct Links** | `[[wikilink]]` 双向链接计数 | 直接主题关联 |
| **Source Overlap** | Jaccard 系数（共享来源文档） | 隐含主题关联 |
| **Adamic-Adar** | 共同邻居的 -log(deg) 之和 | 结构性关联强度 |
| **Type Affinity** | 同 pageKind 的衰减加权 | 类型内聚性 |

Louvain 社区检测用于：
- 自动发现知识簇（如"魔法体系"、"政治势力"、"地理区域"）
- 生成 overview/synthesis 页面的候选主题
- wiki-digest 的主题聚类输入

### Wiki↔Engine 同步策略 (wiki-bridge.ts)

```
编译时下沉（Wiki → Engine）:
  wiki page (pageKind=entity) → Graph DB entity + relations
  wiki page claims → Memory DB memories (带来源引用)
  wiki page content chunks → Vector DB embeddings

查询时上浮（Engine → Wiki）:
  Graph traversal → 相关 wiki pages (graph expansion)
  Vector similarity → 补充 wiki pages (semantic expansion)
  Memory temporal query → wiki page 版本链 (时序上下文)
```

### 执行路径

1. **新增 `wiki-compiler.ts`** — 两阶段编译：概念提取 → 页面生成，LLM 驱动
2. **新增 `wiki-change-tracker.ts`** — SHA-256 增量检测
3. **扩展 `wiki-schema.ts`** — 增加 `pageKind` 类型系统
4. **重写 `wiki-query.ts`** — FTS5 + embedding 混合搜索，替换手写 TF 评分
5. **新增 wiki↔engine 同步** — 编译时将实体/关系下沉到 Graph/Memory
6. **启用 lint** — 接入 `knowledge-audit` 定期执行
7. **填充数据** — 从现有写作技能模块（45+ craft skills）和叙事分析器提取初始 wiki 页面
