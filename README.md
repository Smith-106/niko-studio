# AI Agent Platform

> **Version**: 8.0.0 (Platform Edition)
> **Architecture**: Multi-Agent Collaboration + OpenKL Memory + CCW Workflow  
> **Positioning**: Cherry Studio / Claude-Code-Workflow style AI Agent Platform

---

## 🎯 Platform Overview

A local-first, extensible AI Agent platform that provides unified memory management, session orchestration, and multi-CLI integration. Designed to support multiple domain adapters including novel writing, code development, and knowledge management.

```
┌──────────────────────────────────────────────────────────────────┐
│                     AI Agent Platform                             │
├──────────────────────────────────────────────────────────────────┤
│                  Platform Core Layer                              │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────┐ │
│  │ Memory     │ │ Session    │ │ Multi-CLI  │ │ Knowledge      │ │
│  │ (OpenKL)   │ │ (CCW)      │ │ Orchestr.  │ │ Graph (Kùzu)   │ │
│  └────────────┘ └────────────┘ └────────────┘ └────────────────┘ │
├──────────────────────────────────────────────────────────────────┤
│                  Domain Adapter Layer                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐  │
│  │ Novel    │ │ Code     │ │ Knowled. │ │ Custom Domains...  │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

## ✨ Key Features

### 🧠 Memory Layer (OpenKL)
- **File System Contract**: Grep-friendly file storage + Graph-derived indexing
- **Temporal Organization**: `memories/by_date/YYYY-MM/DD/<id>.md`
- **Topic Symlinks**: `memories/topics/<slug>/` for cross-referencing
- **Vector Search**: Kùzu HNSW indexes with 384-dim FastEmbed

### 📝 Session Management (CCW)
- **5-Level Workflow**: Rapid → Lite → Standard → Brainstorm → Coordinator
- **Resume Strategy**: Native / Prompt-Concat / Hybrid modes
- **Smart Search**: Fuzzy (FTS + ripgrep) + Semantic (Embedding + RRF)

### 🔗 Citation System (OpenKL)
- **Transient Citations**: Returned by search, not persisted
- **Persisted Citations**: SHA256 verification + GC cleanup
- **Distillation**: 6 prompt templates with DerivedFrom relationships

### 📊 Knowledge Graph (Kùzu DB)
- **Platform Nodes**: MemoryNote, Doc, Chunk, Entity, Topic
- **Domain Nodes**: Character, Scene, Foreshadowing (Novel Adapter)
- **Cross-Domain Relations**: CHARACTER_MENTIONED_IN, SCENE_DERIVED_FROM

## 🚀 Quick Start

### Prerequisites

```bash
# Python 3.11+
python --version

# Install dependencies
pip install -r requirements.txt

# Or use uv (recommended)
uv sync
```

### 发布口径（internal / external）

- `internal`：内部 dry-run，允许跳过 e2e 冒烟，质量信号以告警为主。
- `external`：对外交付，必须通过 e2e 冒烟，且覆盖率与 CI 质量信号完整。
- 详细准入条件与回退要求见：`docs/release/RELEASE_NOTES.md`、`docs/operations/ROLLBACK.md`。

### 测试命令（交付基线）

```bash
# 单元 + 集成（排除 e2e），覆盖率门槛 80%
pytest tests/unit tests/integration -m "not e2e" --cov=src --cov-report=term-missing --cov-fail-under=80
```

### 外部发布附加验证（external）

```bash
# external 必须通过 e2e 冒烟（按 e2e marker 执行）
pytest -o addopts="" -m "e2e" tests/integration/test_e2e_workflow.py -q --tb=short
```

### Gateway 部署配置（CORS / reload）

开发配置：`config/niko-studio.yaml`

```yaml
gateway:
  host: 0.0.0.0
  port: 8000
  # 仅开发环境使用；生产环境默认强制关闭 reload
  reload: true
  cors_dev_origins:
    - "*"
  cors_prod_origins:
    - https://app.example.com
    - https://gray.example.com
  metrics_enabled: true
```

生产推荐配置：`config/niko-studio.production.yaml`

```yaml
env: production
gateway:
  reload: false
  cors_prod_origins:
    - https://app.example.com
    - https://gray.example.com
  metrics_enabled: true
```

- 开发环境（`env: development`）：允许宽松 CORS，支持热重载。
- 生产环境（`env: production`）：CORS 使用白名单，`reload` 默认关闭。

> 生产环境必须设置 `NIKO_CORS_PROD_ORIGINS`（逗号分隔）或在 `gateway.cors_prod_origins` 中配置真实域名，不能使用 `*` 或 localhost 占位。

生产域名白名单配置清单（上线前逐项确认）：
- 真实生产域名（例如 `https://app.example.com`）。
- 灰度/预发布域名（例如 `https://gray.example.com`）。
- 运维/回归验证来源域（如独立前端域名）。
- 禁止在生产白名单中保留 `*`。

### /metrics 采集说明与最低告警建议

采集方式：
- 周期采集 `GET /metrics`（建议 30s~60s 间隔）。
- 关注字段：`requests_total`、`requests_failed_total`、`latency_ms_avg`、`latency_ms_max`。

最低告警建议（可按业务流量调整）：
- 请求失败率：5 分钟窗口内 `requests_failed_total / requests_total > 1%` 告警。
- 平均延迟：`latency_ms_avg > 500ms` 持续 5 分钟告警。
- 最大延迟：`latency_ms_max > 2000ms` 连续 3 次采集告警。

### 发布检查汇总（含 production 守卫）

```bash
python scripts/release_check_summary.py
```

汇总将包含：版本一致性、baseline、e2e、production CORS/reload 守卫、metrics 守卫、coverage 信号。

### Initialize Database

```bash
# Initialize Kùzu database and create schema
python -c "from src.graph.graph_manager import init_schema; init_schema()"
```

### 运行 Gateway

```bash
# 开发环境（允许 reload）
python scripts/start_gateway.py --host 0.0.0.0 --port 8000 --reload

# 生产环境（默认关闭 reload，并启用生产 CORS 白名单）
python scripts/start_gateway.py --env production --config config/niko-studio.production.yaml --host 0.0.0.0 --port 8000

# 若需环境变量覆盖
NIKO_CORS_PROD_ORIGINS="https://app.example.com,https://gray.example.com" python scripts/start_gateway.py --env production --config config/niko-studio.production.yaml
```

可用运维端点：
- `GET /health`
- `GET /metrics`
- `GET /tools`
- `POST /chat`

### Run Development Server

```bash
# Start the development server
python dev_run.py
```

## 📁 Project Structure

```
niko-studio/
├── docs/
│   ├── SDD_V8_FINAL.md     # System Design Document (V8)
│   └── TASKS_V10_OPTIMIZED.md # Development Task List (V10)
├── src/
│   ├── agents/             # Core Agents (Commander, Architect, Writer, Critic)
│   ├── memory/             # Memory Layer (MemoryManager, CitationManager)
│   ├── workflow/           # Workflow System (Levels, Sessions)
│   ├── search/             # Search Services (SmartSearch, VectorSearch)
│   ├── store/              # Document Store (StoreManager)
│   ├── graph/              # Knowledge Graph (GraphManager)
│   └── services/           # Platform Services
├── tests/
│   ├── unit/               # Unit Tests
│   └── integration/        # Integration Tests
├── .niko/                  # Runtime Data (Project Workspace)
│   ├── sessions/           # Active/Archived sessions
│   ├── memory/             # Long-term memories
│   ├── config/             # Project configuration
│   ├── drafts/             # Draft versions
│   └── exports/            # Export output
└── README.md
```

## 🛠️ Technology Stack

| Component | Choice | Source |
|-----------|--------|--------|
| Vector Storage | **Kùzu HNSW** | OpenKL |
| File Storage | **OpenKL File Contract** | OpenKL |
| Graph Database | **Kùzu DB (Embedded)** | OpenKL |
| Session Management | **Session Manager** | CCW |
| Resume Strategy | **Native/Hybrid** | CCW |
| Citation System | **CitationManager** | OpenKL |
| Embedding | **FastEmbed (384-dim)** | - |
| MCP Services | **Sequential Thinking** | Cherry |

## 📋 Development Phases

| Phase | Status | Modules | Lines |
|-------|--------|---------|-------|
| P1: Core Agents | ✅ 100% | Commander, Architect, Writer, Critic + 6 others | 5,061 |
| P2: Workflow Levels | ✅ 100% | L1-L5 (Rapid → Coordinator) + ResumeStrategy | 8,354 |
| P3: Memory Layer | ✅ 100% | 12 components (MemoryManager, Citation, Temporal, 6D, etc.) | 8,845 |
| P4: Citation & Distill | ✅ 100% | CitationManager, DistillationManager (6 templates) | (incl. P3) |
| P5: Session & Search | ✅ 100% | SessionManager, SmartSearch, VectorSearch, IterativeRetriever | 2,652 |
| P6: Knowledge Layer | ✅ 100% | StoreManager, GraphManager (Cypher), OpenKL Contract | 3,296 |
| P7-9: Services | ✅ 100% | BackupManager, TokenService, ObsidianService, Reranker (4 strategies) | 5,156 |
| P10: Testing | 🟡 45% | 74 test files (unit, integration, performance) | 18,183 |

**Total Codebase**: 166 source files, 62,163 lines | 74 test files, 18,183 lines

## 🤖 Jules Auto-Development

This project is designed for **Jules** automated development. See:

- [TASKS.md](docs/TASKS.md) - Complete task checklist
- [JULES.md](.github/JULES.md) - Development guidelines for Jules
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines

## 📚 Documentation

- [System Design (SDD V2.1)](docs/SDD_V2.md) - Architecture & API specifications
- [Task List (V8.0.0)](docs/TASKS.md) - Development roadmap
- [OpenKL Design](openkl/rfcs/0000-openkl-design.md) - Memory layer design

## 📄 License

Apache License 2.0

## 🙏 Acknowledgments

Built on concepts from:
- [Cherry Studio](https://github.com/kangfenmao/cherry-studio) - AI Assistant Platform
- [Claude-Code-Workflow](https://github.com/anthropics/claude-code) - Workflow Patterns
- [OpenKL](https://github.com/wey-gu/openkl) - Open Knowledge Layer

---

*Version 8.0.0 Platform Edition | Updated: 2026-02-12*
