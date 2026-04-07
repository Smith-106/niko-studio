# AI Agent Platform

> **Version**: 8.2.0 (Platform Edition)
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
# Node.js 20+ and npm
node --version
npm --version

# Python 3.11+ (release helpers and compatibility scripts)
python --version

# Install dependencies
pip install -r requirements.txt

# Or use uv (recommended)
uv sync
```

当前默认构建与运行权威面是 `desktop + src-ts`。Python 主要保留给发布辅助脚本和显式兼容路径。

## Web 交付模型

当前 Web 交付模型以 **Desktop + MCP Gateway** 为主路径：

- 主交付路径：Desktop 客户端 + Tauri 宿主管理的本地 Gateway。当前桌面运行时与默认构建都优先 Node/TypeScript Gateway。
- 兼容启动路径：`scripts/start_gateway.py` 默认（`--runtime auto`）启动 Node/TypeScript Gateway；`--runtime python` 仅用于兼容分支。若 legacy Python 源缺失，auto 会回落 Node。
- Deprecated 路径：`src-ts/web/app.ts` 的 `GET /` 默认返回 `410`；仅在设置 `WEB_UI_FORWARD_URL` 时临时 `302` 转发。
- Streamlit 路径：用于原型与兼容性验证，不作为主交付入口。

### 单命令验收入口

```bash
python scripts/release_check_summary.py
```

该命令会汇总版本一致性、baseline/e2e、production 守卫（reload/CORS/metrics）以及 CI 观察点。

### 当前状态权威来源

- 当前运行与发布口径：以 `docs/release/RELEASE_NOTES.md` 为准。
- 当前本地闭环判断：以 `python scripts/release_check_summary.py` 输出为准。
- 当前 internal CI 权威入口：`.github/workflows/integration-tests.yml`
- `docs/TASKS_V10_OPTIMIZED.md` 保留为历史架构路线图，不作为当前发布完成度的唯一依据。

### 当前权威地图

- 运行时 / 构建默认权威：`desktop/` + `src-ts/` 代码与对应脚本。
- 发布策略权威：`docs/release/RELEASE_NOTES.md`
- 本地发布快照权威：`python scripts/release_check_summary.py`
- internal CI 权威：`.github/workflows/integration-tests.yml`（包含 advisory lanes，以及 main 分支的 authority alignment / selected contract hard gates）
- 历史参考文档：`docs/TASKS_V10_OPTIMIZED.md`、`docs/ui_design_guide.md`、`docs/workflow-entrypoint-inventory.md`

## 前端工程约束（统一口径）

- 本地质量入口：`npm --prefix desktop run check`
- 后端 / 发布 CI 权威入口：`.github/workflows/external-release-gate.yml`
- internal CI 权威入口：`.github/workflows/integration-tests.yml`
- Desktop CI 构建入口：`npm run check`
- 依赖审计：`npm audit --audit-level=high`

## 阶段 4：执行（自主运行）

规划完成后，可运行 Aha Loop 的 PRD 自主执行循环：

```bash
# 推荐：在独立终端执行（非 Claude Code 会话）
./scripts/aha-loop/orchestrator.sh

# 若在当前会话内触发嵌套保护，请先清理变量
unset CLAUDECODE && ./scripts/aha-loop/orchestrator.sh
```

系统会按 Story 自动进入五阶段工作流（按需执行）：
- 研究：拉取依赖实现/资料并生成研究结论
- 并行探索：对重大决策自动创建 worktree 并并行评估方案
- 计划审查：根据研究/探索结果调整实现计划
- 实现：按验收标准落地代码改动
- 质量检查：执行质量门禁并验证验收条件

说明：AI 会自主判断阶段是否需要执行，但最终发布准入仍以项目质量基线与门禁结果为准。

## 安全意图可见化（摘要）

- 运行时守卫、构建门禁、fallback/rollback 与发布前清单集中见：
  - [docs/SECURITY_VISIBILITY.md](docs/SECURITY_VISIBILITY.md)
- 回滚操作手册：
  - [docs/operations/ROLLBACK.md](docs/operations/ROLLBACK.md)

### Initialize Database

```bash
# Gateway runtime 会在首次启动时初始化所需存储
# 如需手动验证 TypeScript 运行面
npm --prefix src-ts run typecheck
```

### 构建 Desktop Sidecar

```bash
# 默认：Node sidecar（Node-first）
npm --prefix desktop run build:sidecar

# 显式 Python 兼容构建（仅 legacy entry 存在时可用）
# 当前 checkout 默认不包含该 legacy entry
python scripts/build_gateway_sidecar.py --legacy-entry src/mcp/sidecar_entry.py
```

### 运行 Gateway

```bash
# 默认（auto）：启动 Node/TypeScript Gateway
python scripts/start_gateway.py --host 0.0.0.0 --port 8000

# 生产环境（按配置启动）
python scripts/start_gateway.py --env production --config config/niko-studio.production.yaml --host 0.0.0.0 --port 8000

# 显式 Python 兼容回退（仅 legacy src/mcp/gateway.py 存在时可用）
python scripts/start_gateway.py --runtime python --host 0.0.0.0 --port 8000
```

可用运维端点：
- `GET /health`
- `GET /metrics`
- `GET /tools`
- `POST /chat`

`POST /chat` 响应字段补充（兼容性说明）：
- `writer_metadata`（optional）
  - `warnings?: string[]`（当前包含 Writer 的非阻断告警代码前缀，如 `knowledge_retrieval_failed`、`openai_proxy_fallback_failed`）
  - `knowledge_retrieved?: { entities_count: number, relations_count: number, memories_count: number }`

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
│   └── TASKS_V10_OPTIMIZED.md # Historical architecture roadmap (not the current release source of truth)
├── src-ts/
│   ├── agents/             # Core Agents (Commander, Architect, Writer, Critic)
│   ├── memory/             # Memory Layer
│   ├── workflow/           # Workflow System
│   ├── search/             # Search Services
│   ├── store/              # Document Store
│   ├── graph/              # Knowledge Graph
│   ├── services/           # Platform Services
│   └── tests/              # Current backend validation surface
├── desktop/                # Desktop shell, sidecar contract, and frontend checks
├── src/                    # Optional legacy Python compatibility surface (normally absent in the current checkout)
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
- `docs/TASKS_V10_OPTIMIZED.md` is retained as a historical architecture roadmap and does not override current release-readiness artifacts.
- [JULES.md](.github/JULES.md) - Development guidelines for Jules
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines

## 📚 Documentation

- [System Design](docs/sdd/01_System_Architecture.md) - Architecture & API specifications
- [Task List (V10 Optimized)](docs/TASKS_V10_OPTIMIZED.md) - Historical architecture roadmap
- [OpenKL Design](openkl/rfcs/0000-openkl-design.md) - Memory layer design

## 📄 License

Apache License 2.0

## 🙏 Acknowledgments

Built on concepts from:
- [Cherry Studio](https://github.com/kangfenmao/cherry-studio) - AI Assistant Platform
- [Claude-Code-Workflow](https://github.com/anthropics/claude-code) - Workflow Patterns
- [OpenKL](https://github.com/wey-gu/openkl) - Open Knowledge Layer

---

*Version 8.2.0 Platform Edition | Updated: 2026-04-07*
