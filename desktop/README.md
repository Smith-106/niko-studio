# Niko Studio Desktop

Writer-first 桌面产品，基于 Tauri + React 构建，并通过本地 Node/TypeScript gateway 交付核心运行时。Python 仅保留给发布辅助脚本、治理脚本和显式兼容 override。

Desktop 客户端是当前主交付入口；本 README 与根 README 的 `Writer-First Desktop Delivery Contract` 以及 `docs/release/RELEASE_NOTES.md` 共享同一交付契约。

## 当前交付契约

- `Supported runtime`: `desktop/` + Tauri host + local `src-ts/` Node/TypeScript gateway. This is the shipped product, default build, and default runtime path.
- `Supported launcher`: `python scripts/start_gateway.py` remains an operator-facing entrypoint, but in the current checkout it starts the Node/TypeScript gateway by default.
- `Advisory compatibility surfaces`: explicit `--runtime python` legacy override, legacy `src/mcp/**` sources, and Streamlit validation flows only when a release candidate explicitly includes them.
- `Deprecated surface`: browser-first web entry (`src-ts/web/app.ts`) and any `WEB_UI_FORWARD_URL` forward are not shipped primary UI paths.

## 技术栈

- **前端**: React 18 + TypeScript + Tailwind CSS
- **桌面框架**: Tauri 2.0 (Rust)
- **状态管理**: Zustand
- **本地 Gateway**: Node.js + TypeScript (`src-ts/`)
- **兼容 / 治理脚本**: Python 3.11+ (`scripts/start_gateway.py`, release helpers, governance scripts)

## 项目结构

```
desktop/
├── src-tauri/           # Tauri (Rust)
│   ├── src/main.rs      # 主进程
│   ├── Cargo.toml       # Rust 依赖
│   └── tauri.conf.json  # 配置
│
├── src/                 # React 前端
│   ├── components/      # UI 组件
│   │   ├── Sidebar.tsx
│   │   ├── ChatArea.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── SettingsModal.tsx
│   │   ├── KnowledgeModal.tsx
│   │   └── EvaluationPanel.tsx
│   ├── stores/          # 状态管理
│   │   ├── appStore.ts
│   │   └── settingsStore.ts
│   ├── api/             # API 客户端
│   │   └── client.ts
│   ├── styles/
│   │   └── globals.css
│   ├── App.tsx
│   └── main.tsx
│
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## 开发

### 前置条件

1. Node.js >= 20
2. Rust (rustup)
3. Python >= 3.11（发布辅助脚本、治理脚本、兼容 launcher）

### 安装依赖

```bash
# 前端依赖
npm install

# Rust 依赖 (自动)
```

### 开发模式

```bash
# 1. 启动当前受支持的 Gateway 入口（默认 Node/TypeScript）
cd ..
python scripts/start_gateway.py --host 127.0.0.1 --port 8000

# 2. 返回 desktop/ 并启动桌面应用 (新终端)
cd desktop
npm run tauri:dev
```

如仅需调试前端壳层，可运行 `npm run dev`；该命令只启动 Vite shell，不代表完整交付运行面。

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
