# Niko Studio Desktop

Writer-first 桌面产品，基于 Tauri + React 构建，并通过本地 Node/TypeScript gateway 交付核心运行时。Python 仅保留给发布辅助脚本、治理脚本和显式兼容 override。

Desktop 客户端是当前主交付入口；本 README 与根 README 的 `Writer-First Desktop Delivery Contract` 以及 `docs/release/RELEASE_NOTES.md` 共享同一交付契约。

## 当前交付契约

- `Supported runtime`: `desktop/` + Tauri host + local `src-ts/` Node/TypeScript gateway. This is the shipped product, default build, and default runtime path.
- `Supported launcher`: `python scripts/start_gateway.py` remains an operator-facing entrypoint, but in the current checkout it starts the Node/TypeScript gateway by default.
- `Advisory compatibility surfaces`: explicit `--runtime python` legacy override, legacy `src/mcp/**` sources, and Streamlit validation flows only when a release candidate explicitly includes them.
- `Deprecated surface`: browser-first web entry (`src-ts/web/app.ts`) and any `WEB_UI_FORWARD_URL` forward are not shipped primary UI paths.

## 技术栈

- **前端**: React 18 + TypeScript + Vite + Tailwind CSS
- **桌面框架**: Tauri 2.0 (Rust)
- **状态管理**: Zustand
- **本地 Gateway**: Node.js + TypeScript (`../src-ts/`)
- **兼容 / 治理脚本**: Python 3.11+（`../scripts/start_gateway.py`、release helpers、governance scripts）

## 项目结构

```text
desktop/
├── src/                      # React 前端、hooks、stores、API client、组件测试
├── src-tauri/                # Tauri/Rust 宿主、sidecar 启动与打包配置
│   ├── src/main.rs           # 主进程入口
│   ├── bin/                  # sidecar / launcher 相关产物
│   └── tauri.conf.json       # Tauri 配置
├── scripts/                  # desktop 侧 sidecar/contract 校验脚本
├── package.json              # 开发、构建、测试、sidecar 脚本入口
├── vite.config.ts            # Vite 配置
├── tailwind.config.js        # Tailwind 配置
└── tsconfig.json             # TypeScript 配置
```

## 开发

### 前置条件

1. Node.js >= 20
2. Rust (rustup)
3. Python >= 3.11（发布辅助脚本、治理脚本、兼容 launcher）

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
# 1. 启动当前受支持的 Gateway 入口（默认 Node/TypeScript）
cd ..
python scripts/start_gateway.py --host 127.0.0.1 --port 8000

# 2. 返回 desktop/ 并启动桌面应用（新终端）
cd desktop
npm run tauri:dev
```

如仅需调试前端壳层，可运行 `npm run dev`；该命令只启动 Vite shell，不代表完整交付运行面。

Windows 本地若常见 `8000` 端口占用，可使用仓库内启动器自动复用已有健康 gateway，或回退到 `8010` / 空闲端口，并把桌面进程显式指向该地址：

```powershell
./scripts/start_desktop_local.ps1
```

若使用 `cmd.exe`，可改用 `scripts\start_desktop_local.cmd`、`scripts\stop_desktop_local.cmd`、`scripts\status_desktop_local.cmd`、`scripts\selftest_desktop_local.cmd`。
若你更习惯沿用 `package.json` 入口，也可在 `desktop/` 下运行 `npm run local:start`、`local:start:force`、`local:start:binary`、`local:start:binary:force`、`local:gateway`、`local:status`、`local:stop`、`local:selftest`。

可选参数：

- `-BinaryDesktop`: 直接启动已编译的 `desktop/src-tauri/target/debug/niko-studio-desktop.exe`
- `-NoDesktop`: 只拉起 / 复用 gateway，便于单独调试接口
- `-ForceDesktop`: 即使已存在 `Niko-Studio` 窗口，也强制再开一个新窗口
- `-PreferredPort` / `-FallbackPort`: 覆盖默认的 `8000` / `8010`

若只需拉起 / 复用 gateway 而不打开桌面窗口，可直接运行 `npm run local:gateway`。

日志默认写入仓库根目录 `.codex-run/`。
若需关闭由该启动器新拉起的本地进程，可运行 `./scripts/stop_desktop_local.ps1`。
若需查看当前本地启动器状态，可运行 `./scripts/status_desktop_local.ps1`。
若需自检本地启动链路，可运行 `./scripts/selftest_desktop_local.ps1`。

### 质量门禁

- `npm run check:quick`: 日常开发中的快速校验，当前执行 `lint`、`format:check`、`typecheck`、`check:node-sidecar`、`validate:sidecar-contract` 和 `test`，不包含构建步骤。
- `npm run check`: 较轻的构建型校验入口，当前只执行 `typecheck && build`，适合确认桌面前端可以完成编译，但不等同于完整本地验收。
- `npm run check:local`: 当前权威的本地验证路径；它映射到 `check:release`，会串行执行 `lint`、`format:check`、`test`、`build:sidecar`、`validate:sidecar-contract` 和 `build`，应作为本地交付前的标准质量门禁。

### 构建发布

```bash
npm run tauri:build
```

构建产物位于 `src-tauri/target/release/bundle/`

## 功能

- ✅ 对话管理
- ✅ Markdown 渲染 + 代码高亮
- ✅ 技能包选择
- ✅ L1/L3/L5 工作流切换
- ✅ 后端状态检测
- ✅ 系统托盘
- ✅ 设置页面
- ✅ 知识库浏览
- ✅ 质量评估面板

## 配置

设置保存在本地存储中，包括：

- API 地址
- 默认模型
- Temperature
- 工作流级别
- 主题
- 字体大小
