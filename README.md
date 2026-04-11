# Niko Studio

> **Version**: 9.0.2 (Platform Edition)
> **Architecture**: Writer-first Desktop + Tauri Shell + local Node/TypeScript Gateway
> **Positioning**: Writer-first desktop studio for manuscript authoring, Story Bible work, knowledge browsing, and workflow-assisted drafting

---

## 🎯 Product Overview

Niko Studio ships as a writer-first desktop product. The delivered runtime is the Tauri desktop shell in `desktop/`, backed by the local Node/TypeScript gateway in `src-ts/`. Repository governance helpers, release scripts, and compatibility surfaces remain in the tree, but they do not redefine the supported product/runtime contract.

```text
Supported product path
Desktop UI (`desktop/`)
  -> Tauri host
  -> local Node/TypeScript gateway (`src-ts/`)
  -> manuscript, Story Bible, chat drafting, workflow execution, evaluation, knowledge browsing

Compatibility and migration surfaces
  -> `scripts/start_gateway.py` launcher (defaults to Node/TypeScript)
  -> explicit legacy Python override when compatibility sources exist
  -> Streamlit validation flows when a candidate still ships them

Deprecated release surface
  -> browser-first web entry (`src-ts/web/app.ts`)
```

## ✨ Writer-Facing Capabilities

- Desktop authoring: manuscript editing, chat drafting, evaluation, settings, and knowledge browsing.
- Local gateway authority: current build/runtime truth is `desktop + src-ts`, with release automation and CI validating that default path.
- Governance and release helpers: Python remains for scripts, release checks, and explicit compatibility-only overrides.
- Compatibility surfaces: Streamlit and legacy Python runtime paths stay visible only as labeled compatibility surfaces, not as the primary shipped UI/runtime.

## 🚀 Quick Start

### Prerequisites

```bash
# Node.js 20+ and npm
node --version
npm --version

# Python 3.11+ (release helpers, governance scripts, compatibility launcher)
python --version

# Install Python helper dependencies
pip install -r requirements.txt

# Or use uv (recommended)
uv sync
```

当前默认构建与运行权威面是 `desktop + src-ts`。Python 主要保留给发布辅助脚本、治理脚本和显式兼容路径。

## Writer-First Desktop Delivery Contract

以下四条标签构成当前唯一的运行时 / 发布交付地图；`desktop/README.md`、`docs/release/RELEASE_NOTES.md` 与 `docs/operations/*.md` 仅复用这四条标签，不扩展新的运行时承诺。

- `Supported runtime`: `desktop/` + Tauri host + local `src-ts/` Node/TypeScript gateway. This is the shipped product, default build, and default runtime path.
- `Supported launcher`: `python scripts/start_gateway.py` remains an operator-facing entrypoint, but in the current checkout it starts the Node/TypeScript gateway by default.
- `Advisory compatibility surfaces`: explicit `--runtime python` legacy override, legacy `src/mcp/**` sources, and Streamlit validation flows only when a release candidate explicitly includes them.
- `Deprecated surface`: browser-first web entry (`src-ts/web/app.ts`) and any `WEB_UI_FORWARD_URL` forward are not shipped primary UI paths.

### 单命令验收入口

```bash
python scripts/release_check_summary.py
```

该命令会汇总版本一致性、baseline/e2e、production 守卫（reload/CORS/metrics）、authority alignment，以及当前交付契约观察点。

### 当前状态权威来源

- 当前产品 / 运行时交付契约：以本节与 `docs/release/RELEASE_NOTES.md` 为准。
- 当前本地闭环判断：以 `python scripts/release_check_summary.py` 输出为准。
- 当前 internal CI 权威入口：`.github/workflows/integration-tests.yml`
- `docs/TASKS_V10_OPTIMIZED.md` 保留为历史架构路线图，不作为当前发布完成度的唯一依据。

### 当前权威地图

- 运行时 / 构建默认权威：`desktop/` + `src-ts/` 代码与对应脚本。
- 交付契约权威：本节 `Writer-First Desktop Delivery Contract` + `docs/release/RELEASE_NOTES.md`
- 发布策略权威：`docs/release/RELEASE_NOTES.md`
- 本地发布快照权威：`python scripts/release_check_summary.py`
- internal CI 权威：`.github/workflows/integration-tests.yml`（包含 advisory lanes，以及 main 分支的 authority alignment / selected contract hard gates）
- 历史参考文档：`docs/TASKS_V10_OPTIMIZED.md`、`docs/ui_design_guide.md`、`docs/workflow-entrypoint-inventory.md`

## 前端工程约束（统一口径）

- 本地质量入口（权威）：`npm --prefix desktop run check:local`
- 后端 / 发布 CI 权威入口：`.github/workflows/external-release-gate.yml`
- internal CI 权威入口：`.github/workflows/integration-tests.yml`
- Desktop CI 构建入口（build / smoke）：`npm --prefix desktop run check`
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
# 正式 release 如需走 packaged fallback，需预先准备 `desktop/src-tauri/bin/niko-gateway*.exe`
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

### Run Development Server (Advisory Compatibility)

```bash
# Legacy compatibility/dev helper, not the default desktop delivery path
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

*Version 9.0.2 Platform Edition | Updated: 2026-04-09*
