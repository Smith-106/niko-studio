# 知识库系统 - 实现路线图

**版本**: 1.0
**日期**: 2026-02-03
**状态**: 待实施

---

## 阶段概览

```
Phase 1: 基础设施 (Week 1-2)
    ├── 存储适配层核心
    └── 基础数据结构

Phase 2: 检索能力 (Week 3-4)
    ├── 向量搜索 + 图搜索
    ├── 查询分析器
    └── 基础路由

Phase 3: 质量保障 (Week 5-6)
    ├── CRAG 分级评估
    ├── Self-RAG 验证
    └── 自动修订

Phase 4: Agent 协作 (Week 7-8)
    ├── 专业 Agent
    ├── Supervisor
    └── 完整集成

Phase 5: 集成优化 (Week 9-10)
    ├── 全流程集成
    ├── 性能优化
    └── 生产级后端
```

---

## 相关设计文档

| 层次 | 文档 |
|------|------|
| 检索策略层 | `2026-02-03-adaptive-rag-retrieval-design.md` |
| 质量保障层 | `2026-02-03-quality-assurance-layer-design.md` |
| 存储适配层 | `2026-02-03-storage-adapter-layer-design.md` |
| Agent 协作层 | `2026-02-03-agent-collaboration-layer-design.md` |

---

## Phase 1: 基础设施

**目标**: 建立存储层核心能力，支持向量/图/社区三种存储后端

| 任务 ID | 任务 | 依赖 | 产出 | 状态 |
|---------|------|------|------|------|
| **P1-01** | 通用数据结构定义 | - | `models/documents.py`, `models/entities.py` | ⬜ |
| **P1-02** | VectorStore Protocol | P1-01 | `storage/protocols/vector.py` | ⬜ |
| **P1-03** | ChromaAdapter 实现 | P1-02 | `storage/adapters/chroma.py` | ⬜ |
| **P1-04** | GraphStore Protocol | P1-01 | `storage/protocols/graph.py` | ⬜ |
| **P1-05** | NetworkXAdapter 实现 | P1-04 | `storage/adapters/networkx.py` | ⬜ |
| **P1-06** | CommunityStore Protocol | P1-01 | `storage/protocols/community.py` | ⬜ |
| **P1-07** | JSONCommunityStore 实现 | P1-06 | `storage/adapters/json_community.py` | ⬜ |
| **P1-08** | StorageManager 基础版 | P1-03,05,07 | `storage/manager.py` | ⬜ |
| **P1-09** | 配置加载系统 | - | `config/loader.py` | ⬜ |

### 验收标准

- [ ] 可以初始化 StorageManager
- [ ] 向量存储可添加/搜索文档
- [ ] 图存储可添加实体/关系/邻域扩展
- [ ] 社区存储可添加/查询社区

---

## Phase 2: 检索能力

**目标**: 实现自适应检索策略，支持 5 种搜索策略和级联执行

| 任务 ID | 任务 | 依赖 | 产出 | 状态 |
|---------|------|------|------|------|
| **P2-01** | QueryAnalysis 数据结构 | P1-01 | `retrieval/models.py` | ⬜ |
| **P2-02** | QueryAnalyzer 实现 | P2-01 | `retrieval/analyzer.py` | ⬜ |
| **P2-03** | RuleRouter 实现 | P2-01 | `retrieval/router.py` | ⬜ |
| **P2-04** | BasicSearch 策略 | P1-08 | `retrieval/strategies/basic.py` | ⬜ |
| **P2-05** | LocalSearch 策略 | P1-08 | `retrieval/strategies/local.py` | ⬜ |
| **P2-06** | QualityEvaluator 实现 | P2-01 | `retrieval/evaluator.py` | ⬜ |
| **P2-07** | CascadeExecutor 实现 | P2-04,05,06 | `retrieval/executor.py` | ⬜ |
| **P2-08** | GlobalSearch 策略 | P1-08 | `retrieval/strategies/global.py` | ⬜ |
| **P2-09** | DRIFTSearch 策略 | P2-05,08 | `retrieval/strategies/drift.py` | ⬜ |
| **P2-10** | LLMArbiter 实现 | P2-01 | `retrieval/arbiter.py` | ⬜ |
| **P2-11** | AdaptiveRAGPipeline 集成 | P2-03,07,10 | `retrieval/pipeline.py` | ⬜ |

### 验收标准

- [ ] 查询可正确分析并路由
- [ ] Basic/Local/Global/DRIFT 四种策略可独立运行
- [ ] 级联执行可自动升级策略
- [ ] 质量评估阈值生效

---

## Phase 3: 质量保障

**目标**: 实现 CRAG + Self-RAG 双阶段质量保障机制

| 任务 ID | 任务 | 依赖 | 产出 | 状态 |
|---------|------|------|------|------|
| **P3-01** | RelevanceGrade 枚举 + GradedDocument | P1-01 | `quality/models.py` | ⬜ |
| **P3-02** | RelevanceGrader 实现 | P3-01 | `quality/crag/grader.py` | ⬜ |
| **P3-03** | KnowledgeRefiner 实现 | P3-02, P2-11 | `quality/crag/refiner.py` | ⬜ |
| **P3-04** | ReflectionToken 枚举 | P3-01 | `quality/selfrag/tokens.py` | ⬜ |
| **P3-05** | SelfRAGValidator 实现 | P3-04 | `quality/selfrag/validator.py` | ⬜ |
| **P3-06** | SelfRAGReviser 实现 | P3-05 | `quality/selfrag/reviser.py` | ⬜ |
| **P3-07** | QualityAssurancePipeline 集成 | P3-03,06 | `quality/pipeline.py` | ⬜ |
| **P3-08** | QualityReport 生成 | P3-07 | `quality/report.py` | ⬜ |

### 验收标准

- [ ] CRAG 可正确三级分级
- [ ] 知识精炼可保留/补充/丢弃
- [ ] Self-RAG 三维验证通过
- [ ] 自动修订最多 2 轮
- [ ] 质量报告完整生成

---

## Phase 4: Agent 协作

**目标**: 实现多智能体协作系统，支持 4 类专业 Agent 和混合式协作

| 任务 ID | 任务 | 依赖 | 产出 | 状态 |
|---------|------|------|------|------|
| **P4-01** | SharedContext 结构 | P1-08 | `agents/context.py` | ⬜ |
| **P4-02** | NovelMemory 实现 | P4-01 | `agents/memory/novel.py` | ⬜ |
| **P4-03** | WorkingMemory 实现 | P4-01 | `agents/memory/working.py` | ⬜ |
| **P4-04** | BaseAgent 抽象类 | P4-01 | `agents/base.py` | ⬜ |
| **P4-05** | CharacterAgent 实现 | P4-04 | `agents/specialists/character.py` | ⬜ |
| **P4-06** | PlotAgent 实现 | P4-04 | `agents/specialists/plot.py` | ⬜ |
| **P4-07** | WorldAgent 实现 | P4-04 | `agents/specialists/world.py` | ⬜ |
| **P4-08** | StyleAgent 实现 | P4-04 | `agents/specialists/style.py` | ⬜ |
| **P4-09** | MessageBus 实现 | - | `agents/messaging.py` | ⬜ |
| **P4-10** | Supervisor (简单/中等) | P4-05-09 | `agents/supervisor.py` | ⬜ |
| **P4-11** | Supervisor (复杂+冲突解决) | P4-10 | `agents/supervisor.py` | ⬜ |
| **P4-12** | AgentCollaborationPipeline | P4-11 | `agents/pipeline.py` | ⬜ |
| **P4-13** | MultiAgentSearch 策略 | P4-12, P2-11 | `retrieval/strategies/multi_agent.py` | ⬜ |

### 验收标准

- [ ] 4 类 Agent 可独立探索
- [ ] Supervisor 正确评估复杂度
- [ ] parallel/sequential/iterative 策略生效
- [ ] 冲突检测和解决工作正常
- [ ] MultiAgentSearch 集成到 RAG

---

## Phase 5: 集成优化

**目标**: 完成全流程集成，添加生产级后端和监控能力

| 任务 ID | 任务 | 依赖 | 产出 | 状态 |
|---------|------|------|------|------|
| **P5-01** | FullRAGWithAgentsPipeline | P2-11, P3-07, P4-12 | `pipeline/full.py` | ⬜ |
| **P5-02** | 错误处理与降级 | P5-01 | `pipeline/error_handler.py` | ⬜ |
| **P5-03** | 健康检查系统 | P1-08 | `storage/health.py` | ⬜ |
| **P5-04** | PgVectorAdapter | P1-02 | `storage/adapters/pgvector.py` | ⬜ |
| **P5-05** | Neo4jAdapter | P1-04 | `storage/adapters/neo4j.py` | ⬜ |
| **P5-06** | 社区检测 + 报告生成 | P1-07 | `storage/community_detection.py` | ⬜ |
| **P5-07** | 性能监控 + 日志 | P5-01 | `utils/monitoring.py` | ⬜ |
| **P5-08** | 单元测试套件 | 全部 | `tests/` | ⬜ |
| **P5-09** | 集成测试 | P5-08 | `tests/integration/` | ⬜ |
| **P5-10** | 文档生成 | 全部 | `docs/api/` | ⬜ |

### 验收标准

- [ ] 完整流程端到端运行
- [ ] 错误降级机制生效
- [ ] 生产级后端可切换
- [ ] 测试覆盖率 > 80%

---

## 任务依赖图

```
P1-01 ──┬── P1-02 ── P1-03 ──┐
        ├── P1-04 ── P1-05 ──┼── P1-08 ── P2-04/05/08
        ├── P1-06 ── P1-07 ──┘            │
        │                                  │
        └── P2-01 ── P2-02 ── P2-03 ──────┼── P2-11 ── P3-03
                                           │              │
                     P2-06 ────────────────┘              │
                                                          │
P3-01 ── P3-02 ────────────────────────────────────── P3-07 ── P5-01
         │                                               │
         └── P3-04 ── P3-05 ── P3-06 ────────────────────┘

P4-01 ── P4-02/03 ── P4-04 ── P4-05/06/07/08 ── P4-10 ── P4-12 ── P5-01
                                     │
                     P4-09 ──────────┘
```

---

## 目录结构

```
niko-studio/
├── src/
│   └── knowledge/                    # 知识库系统
│       ├── models/                   # 数据模型
│       │   ├── documents.py          # Document, Entity, Relation
│       │   └── entities.py           # Community, NeighborhoodResult
│       │
│       ├── storage/                  # 存储适配层
│       │   ├── protocols/            # Protocol 定义
│       │   │   ├── vector.py
│       │   │   ├── graph.py
│       │   │   └── community.py
│       │   ├── adapters/             # 具体实现
│       │   │   ├── chroma.py
│       │   │   ├── networkx.py
│       │   │   ├── json_community.py
│       │   │   ├── pgvector.py       # Phase 5
│       │   │   └── neo4j.py          # Phase 5
│       │   ├── manager.py            # StorageManager
│       │   └── health.py             # 健康检查
│       │
│       ├── retrieval/                # 检索策略层
│       │   ├── models.py             # QueryAnalysis, SearchResult
│       │   ├── analyzer.py           # QueryAnalyzer
│       │   ├── router.py             # RuleRouter
│       │   ├── arbiter.py            # LLMArbiter
│       │   ├── evaluator.py          # QualityEvaluator
│       │   ├── executor.py           # CascadeExecutor
│       │   ├── strategies/           # 搜索策略
│       │   │   ├── basic.py
│       │   │   ├── local.py
│       │   │   ├── global.py
│       │   │   ├── drift.py
│       │   │   └── multi_agent.py
│       │   └── pipeline.py           # AdaptiveRAGPipeline
│       │
│       ├── quality/                  # 质量保障层
│       │   ├── models.py             # RelevanceGrade, ReflectionToken
│       │   ├── crag/                 # CRAG 模块
│       │   │   ├── grader.py
│       │   │   └── refiner.py
│       │   ├── selfrag/              # Self-RAG 模块
│       │   │   ├── tokens.py
│       │   │   ├── validator.py
│       │   │   └── reviser.py
│       │   ├── pipeline.py           # QualityAssurancePipeline
│       │   └── report.py             # QualityReport
│       │
│       ├── agents/                   # Agent 协作层
│       │   ├── context.py            # SharedContext
│       │   ├── memory/               # 记忆模块
│       │   │   ├── novel.py          # NovelMemory
│       │   │   └── working.py        # WorkingMemory
│       │   ├── messaging.py          # MessageBus
│       │   ├── base.py               # BaseAgent
│       │   ├── specialists/          # 专业 Agent
│       │   │   ├── character.py
│       │   │   ├── plot.py
│       │   │   ├── world.py
│       │   │   └── style.py
│       │   ├── supervisor.py         # Supervisor
│       │   └── pipeline.py           # AgentCollaborationPipeline
│       │
│       ├── pipeline/                 # 完整管道
│       │   ├── full.py               # FullRAGWithAgentsPipeline
│       │   └── error_handler.py      # 错误处理
│       │
│       └── config/                   # 配置
│           ├── loader.py
│           └── defaults.py
│
├── config/                           # 配置文件
│   ├── storage.yaml
│   ├── rag.yaml
│   ├── quality_assurance.yaml
│   └── agent_collaboration.yaml
│
└── tests/                            # 测试
    ├── unit/
    └── integration/
```

---

## 里程碑

| 里程碑 | 完成条件 | 目标日期 |
|--------|----------|----------|
| M1: 存储就绪 | Phase 1 全部完成 | Week 2 |
| M2: 检索可用 | Phase 2 全部完成 | Week 4 |
| M3: 质量保障 | Phase 3 全部完成 | Week 6 |
| M4: Agent 协作 | Phase 4 全部完成 | Week 8 |
| M5: 生产就绪 | Phase 5 全部完成 | Week 10 |

---

*文档版本: 1.0 | 创建时间: 2026-02-03*
