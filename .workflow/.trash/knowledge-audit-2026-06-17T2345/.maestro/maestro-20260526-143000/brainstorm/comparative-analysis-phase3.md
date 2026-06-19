# Maestro-Flow vs NIKO-Studio: Phase 3 深度对比分析

## 1. Dashboard 可视化架构

### maestro-flow 实现
- **独立子包** `dashboard/`：195 React 组件 + 25 Zustand store + 14 Hono 路由 + 7 WebSocket handler
- **技术栈**：React 19 + Zustand 5 + Hono + ws + framer-motion + react-virtuoso + Tailwind CSS 4
- **双通道实时通信**：SSE `/events`（状态广播）+ WebSocket `/ws`（双向交互）
- **核心数据流**：`.workflow/` files → FSWatcher → StateManager → DashboardEventBus → SSE/WS → Zustand → React

#### DashboardEventBus
- 基于 Node EventEmitter 的类型化事件总线，maxListeners: 50
- 60+ 事件类型：board, agent, execution, commander, coordinate, requirement, team, room, wiki, collab, workspace
- Ring buffer 1000 条历史事件
- `onAny()` / `offAny()` 订阅全部事件

#### FSWatcher
- Chokidar 监听 `.workflow/` 目录，50+ glob pattern
- 每文件 150ms debounce
- Windows 兼容：`usePolling: true`
- 映射文件变更到具体事件（`phase:updated`, `task:updated` 等）

#### 客户端连接
- `useSSE.ts`：EventSource + 指数退避重连（1s-30s），命名事件分发到 Zustand store
- `useWebSocket.ts`：WebSocket + 同样重连，**hydration gate**（队列 WS 消息直到 REST 初始化完成），**100ms 消息缓冲**，**审批事件立即绕过**

#### 可视化组件
- **Kanban Board**：6 列布局（Backlog→Done），键盘导航
- **Timeline/Gantt**：周刻度 + Today 标记 + 可展开行
- **Command Center**：活跃执行仪表盘
- **Conflict Heatmap**：文件冲突热力图
- **Wiki Graph**：知识图谱 + 健康评分面板
- **Sparkline Charts**：轻量趋势图
- **Brainstorm Visualizer**：HTML 原型服务器 + compare grid

### niko-studio 现状
- **MCP Gateway**：HTTP REST，P2 WebSocket（刚实现），无前端 dashboard
- **Three.js 3D Scene Dashboard**：场景卡片 + LOCK 评分 + 依赖图（写作领域）
- **无 workflow 可视化**：workflow 状态只能通过 HTTP 轮询获取

### 迁移建议

| 项 | 优先级 | 工期 | 价值 | 说明 |
|----|--------|------|------|------|
| WorkflowEventBus | P1 | 1天 | 高 | 在 MCP Gateway 层引入类型化事件总线，替换当前硬编码的 hook 调用 |
| Workflow FSWatcher | P2 | 2天 | 高 | 监听 `.workflow/` 文件变更，触发事件总线广播 |
| 写作 Workflow Kanban | P3 | 3天 | 中 | 写作阶段看板（Ideation→Drafting→Revision→QC→Done） |
| Sparkline Metrics | P3 | 1天 | 中 | 字数趋势、质量评分、一致性检查结果 |
| Brainstorm Compare | P4 | 2天 | 中 | 复用 maestro 的 HTML 原型对比模式，用于对比 AI 生成的写作方案 |

**关键架构决策**：niko-studio 是 Tauri 应用，前端通过 Tauri event bridge 与后端通信，**不需要 SSE**。推荐：
- Tauri `listen` 替代 SSE 用于状态广播
- WebSocket `/ws/events` 保留用于外部集成（CLI 工具、监控面板）

---

## 2. 配置热加载与动态重配置

### maestro-flow 实现

#### FSWatcher + Debounce
- `fs.watch()` 监听 workspace state 目录
- 变更批量化 + settle 后发射事件
- 只处理 `.json`/`.yaml`，忽略临时文件

#### Overlay 系统（最精妙的模式）
- **声明式配置覆盖**：base config + layered overlays = computed config
- `overlays/` 目录：YAML/JSON 补丁，按优先级排序
- **深度合并**：数组替换（非合并），对象递归合并
- **作用域匹配**：overlay 可指定 workspace/phase/skill 上下文
- **关键原则：computed config, never mutated** — 每次从 base + overlays 重新计算

#### Spec-Bridge（动态 Hook 注入）
- Spec 声明期望的 hooks，Spec-Bridge 翻译为 hook 注册
- **增量协调**：spec 变更时，diff 旧/新 hook 注册，只应用增量
- 支持**中途 workflow hook 重配置**：spec 文件在 step 间变更时，下一步使用新 hooks

#### Graph-Walker（阶段门控配置解析）
- **Phase-gate 模式**：每个 phase 边界重读 config
- **Phase 内配置冻结**：执行期间不变
- **版本追踪**：config 快照有 version number，walker 在 phase 边界检查
- `WalkerEventBridge` 将 walker 状态转换翻译为 dashboard 事件

#### Extension Loader（插件热添加）
- 懒加载：启动时发现，首次使用时加载
- `loadExtension(name)` 可随时调用
- **只增不减**：loaded extensions 不会卸载（安全权衡）

### niko-studio 现状
- `ConfigManager`：启动时读取 `niko-studio.yaml`，全量校验
- `mcp/config.ts`：MCP 服务器配置静态加载（启动时一次）
- **无热加载**：配置变更需重启
- 已有 `config-reload.test.ts`：说明概念在 roadmap 上

### 迁移建议

| 项 | 优先级 | 工期 | 价值 | 说明 |
|----|--------|------|------|------|
| Debounced Config Watcher | P1 | 1天 | 高 | 监听 `niko-studio.yaml` 变更，触发 `config-changed` 事件 |
| Typed EventBus for Gateway | P1 | 1天 | 高 | 替换硬编码 hook 调用，解耦 config 生产者与消费者 |
| Phase-Gate Config Freeze | P2 | 1天 | 高 | workflow step 执行期间冻结 config，step 间重解析 |
| Overlay/Computed Config | P3 | 2天 | 中 | 支持 `config/overlays/`，按 workspace/phase 覆盖 |
| Spec-Bridge Delta Reconcile | P3 | 2天 | 中 | MCP 服务器列表变更时，增量启停（不重启全部） |
| Lazy Extension Loading | P4 | 1天 | 中 | MCP server 插件懒加载，减少启动时间 |

---

## 3. TUI（终端 UI）架构

### maestro-flow 实现
- **Ink + React**：TUI 用 React 组件模型渲染在终端中
- 4 个 hub：ConfigHub、InstallHub、ToolsDashboard、OverlayList
- 共享设计 token：配色方案、间距、边框样式
- 组件复用：Box, Text, GradientHeader, ShortcutFooter
- 安装流程 UI：Blueprint → ComponentGrid → Hooks → Confirm → Execute → Result

### niko-studio 现状
- CLI 通过 `cli/commands.ts` 提供，纯文本输出
- 无 TUI

### 迁移建议
- **不迁移**。niko-studio 是 Tauri 桌面应用，有完整的 React 前端。TUI 只对 CLI-first 工具有价值。

---

## 4. 核心架构原则

maestro-flow 所有动态重配置机制共享一个不变原则：

> **Computed config, never mutated**
> 1. 读 base config
> 2. 计算 effective config（base + overlays/specs/guards）
> 3. 在当前执行单元使用 computed config
> 4. 执行完毕后丢弃 computed config
> 5. 下次边界重新计算

这使得热加载变得简单：改 base 文件 → 下次计算自动生效。无需处理增量状态变更。

niko-studio 当前采用 "启动时一次性读取 + 内存缓存" 模式。引入此原则需要：
- WorkflowEngine：在 `_executeStep()` 前读 config，step 内冻结
- MCP Gateway：在请求处理前重解析 config
- 热加载触发器：FSWatcher → EventBus → 标记 config stale

---

## 5. 综合优先级路线图

| # | 项目 | 优先级 | 工期 | 前置依赖 | 预期收益 |
|---|------|--------|------|----------|----------|
| 1 | WorkflowEventBus | P1 | 1天 | 无 | 解耦事件分发，为 WS/Tauri 推送铺路 |
| 2 | Config Debounced Watcher | P1 | 1天 | EventBus | 无需重启即可更新配置 |
| 3 | Phase-Gate Config Freeze | P2 | 1天 | Config Watcher | 防止 mid-request 不一致 |
| 4 | Workflow FSWatcher | P2 | 2天 | EventBus | 实时 workflow 状态广播 |
| 5 | 写作 Workflow Kanban | P3 | 3天 | FSWatcher + EventBus | 写作进度可视化 |
| 6 | Overlay/Computed Config | P3 | 2天 | Config Watcher | 多环境配置支持 |
| 7 | Spec-Bridge Delta Reconcile | P3 | 2天 | Overlay | MCP 服务器增量启停 |
| 8 | Sparkline Metrics | P3 | 1天 | EventBus | 写作质量趋势 |
| 9 | Brainstorm Compare | P4 | 2天 | 无 | AI 方案对比 UI |
| 10 | Lazy Extension Loading | P4 | 1天 | 无 | 减少启动时间 |