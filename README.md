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

## Web 交付模型

当前 Web 交付模型以 **Desktop + MCP Gateway** 为主路径：

- 主交付路径：Desktop 客户端 + `scripts/start_gateway.py` 启动的 Gateway。
- Deprecated 路径：`src/web/app.py` 的 `GET /` 默认返回 `410`；仅在设置 `WEB_UI_FORWARD_URL` 时临时 `302` 转发。
- Streamlit 路径：用于原型与辅助验证，不作为主交付入口。

### 单命令验收入口

```bash
python scripts/release_check_summary.py
```

该命令会汇总版本一致性、baseline/e2e、production 守卫（reload/CORS/metrics）以及 CI 观察点。

## 前端工程约束（统一口径）

- 本地质量入口：`npm --prefix desktop run check`
- CI（Integration Tests / `desktop-build`）入口：`npm run check`
- 依赖审计：`npm audit --audit-level=high`

## 安全意图可见化（摘要）

- 运行时守卫、构建门禁、fallback/rollback 与发布前清单集中见：
  - [docs/SECURITY_VISIBILITY.md](docs/SECURITY_VISIBILITY.md)
- 回滚操作手册：
  - [docs/operations/ROLLBACK.md](docs/operations/ROLLBACK.md)

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
│   ├── sdd/             # System design specs (modular)
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
| P10: Testing | ✅ 100% | 74 test files (unit, integration, performance) | 18,183 |

**Total Codebase**: 166 source files, 62,163 lines | 74 test files, 18,183 lines

## 🤖 Jules Auto-Development

This project is designed for **Jules** automated development. See:

- [TASKS_V10_OPTIMIZED.md](docs/TASKS_V10_OPTIMIZED.md) - Complete task checklist
- [JULES.md](.github/JULES.md) - Development guidelines for Jules
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines

## 📚 Documentation

- [System Design](docs/sdd/01_System_Architecture.md) - Architecture & API specifications
- [Task List (V10 Optimized)](docs/TASKS_V10_OPTIMIZED.md) - Development roadmap
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
