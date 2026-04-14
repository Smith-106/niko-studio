# Niko Studio

> **Version**: 9.0.6 (Platform Edition)
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

Windows 本地如果常见 `8000` 端口占用，可优先使用仓库内启动器。它会自动复用已有健康 gateway，或回退到 `8010` / 空闲端口，并把桌面进程显式指向该地址：

```powershell
./scripts/start_desktop_local.ps1
```

若使用 `cmd.exe`，可直接运行 `scripts\start_desktop_local.cmd`、`scripts\stop_desktop_local.cmd`、`scripts\status_desktop_local.cmd`、`scripts\selftest_desktop_local.cmd`。
若从现有 desktop npm 入口使用，也可执行 `npm --prefix desktop run local:start`、`local:start:force`、`local:start:binary`、`local:start:binary:force`、`local:gateway`、`local:status`、`local:stop`、`local:selftest`。

常用参数：

- `-BinaryDesktop`: 直接启动已编译桌面二进制
- `-NoDesktop`: 只拉起 / 复用 gateway
- `-ForceDesktop`: 即使已有桌面窗口也强制新开实例
- `-PreferredPort` / `-FallbackPort`: 覆盖默认的 `8000` / `8010`

若只想拉起 / 复用 gateway 而不打开桌面窗口，可直接执行 `npm --prefix desktop run local:gateway`。

停止由本地启动器新拉起的进程：

```powershell
./scripts/stop_desktop_local.ps1
```

查看当前本地启动器状态：

```powershell
./scripts/status_desktop_local.ps1
```

验证本地启动链路：

```powershell
./scripts/selftest_desktop_local.ps1
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

### Run Frontend Shell Only (Advisory Compatibility)

```bash
# 仅启动 Vite 前端壳层，不包含完整桌面运行时
npm --prefix desktop run dev
```

完整桌面链路仍以 `python scripts/start_gateway.py` + `npm --prefix desktop run tauri:dev` 为准。
Windows 上如需自动处理 gateway 端口冲突，可直接使用 `./scripts/start_desktop_local.ps1`。

## 📁 Project Structure

```text
niko-studio/
├── desktop/                    # 当前桌面产品入口（React + Tauri）
│   ├── src/                    # 前端 UI、hooks、stores、API client 与组件测试
│   └── src-tauri/              # Tauri/Rust 宿主、sidecar 启动与打包产物
├── src-ts/                     # 当前本地 Node/TypeScript gateway 与核心服务
│   ├── agents/                 # 写作与编排 agents
│   ├── mcp/                    # MCP / HTTP endpoints 与服务接线
│   ├── workflow/               # 工作流编排与状态流转
│   ├── narrative/              # 叙事分析与评估逻辑
│   ├── memory/                 # 记忆与知识相关能力
│   ├── search/ graph/ store/   # 检索、图谱与存储能力
│   └── tests/                  # TypeScript 后端测试
├── scripts/                    # 启动器、版本校验、authority alignment、release summary
├── config/                     # 本地/生产 YAML 配置
├── tests/                      # Python 单元测试（当前主要覆盖治理/脚本）
├── docs/                       # 发布契约、runbook、架构与历史参考
├── release-check-summary.md    # 最近一次本地发布检查快照
└── README.md
```

## 🛠️ Technology Stack

| Area | Current choice |
|------|----------------|
| Desktop UI | React 18 + TypeScript + Vite + Tailwind CSS + Zustand |
| Desktop host | Tauri 2 (Rust) |
| Local gateway | Node.js + TypeScript (`src-ts/`) |
| Runtime / parsing | `better-sqlite3`, `fastembed`, `mammoth`, `pdf-parse` |
| Release / governance | Python 3.11+ scripts in `scripts/` |
| Test stack | Vitest (`desktop/`, `src-ts/`) + targeted pytest (`tests/`) |

## ✅ Current Validation Entrypoints

- Desktop 本地验收：`npm --prefix desktop run check:local`
- Gateway 本地验收：`npm --prefix src-ts run check:local`
- 发布汇总快照：`python scripts/release_check_summary.py`
- 权威对齐检查：`python scripts/check_authority_alignment.py`
- 发布契约：`docs/release/RELEASE_NOTES.md`
- Desktop 运维手册：`docs/operations/DESKTOP_RUNBOOK.md`

## 📚 Documentation

- [文档索引](docs/INDEX.md) - 文档导航与当前发布口径
- [System Design](docs/sdd/01_System_Architecture.md) - 系统设计与模块规格
- [Release Notes](docs/release/RELEASE_NOTES.md) - 发布矩阵与 Go/No-Go 条件
- [Desktop Runbook](docs/operations/DESKTOP_RUNBOOK.md) - Desktop 运行、验收与排障
- [Rollback Runbook](docs/operations/ROLLBACK.md) - 回滚手册
- [Task List (V10 Optimized)](docs/TASKS_V10_OPTIMIZED.md) - 历史架构路线图

## 📄 License

当前仓库根目录未提供独立 `LICENSE` 文件；如需对外分发，请先明确许可策略。

## 🙏 Acknowledgments

Built on concepts from:
- [Cherry Studio](https://github.com/kangfenmao/cherry-studio) - AI Assistant Platform
- [Claude-Code-Workflow](https://github.com/anthropics/claude-code) - Workflow Patterns
- [OpenKL](https://github.com/wey-gu/openkl) - Open Knowledge Layer

---

*Version 9.0.6 Platform Edition | Updated: 2026-04-14*
