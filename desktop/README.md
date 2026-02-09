# Niko-Studio Desktop

AI 辅助写作桌面应用，基于 Tauri + React + Python 构建。

## 技术栈

- **前端**: React 18 + TypeScript + Tailwind CSS
- **桌面框架**: Tauri 2.0 (Rust)
- **状态管理**: Zustand
- **后端**: Python + FastAPI (MCP Gateway)

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

1. Node.js >= 18
2. Rust (rustup)
3. Python >= 3.10

### 安装依赖

```bash
# 前端依赖
npm install

# Rust 依赖 (自动)
```

### 开发模式

```bash
# 1. 启动 Python 后端
cd ..
python -m uvicorn src.mcp.gateway:app --host 127.0.0.1 --port 8000

# 2. 启动桌面应用 (新终端)
npm run tauri:dev
```

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
