# 执行计划：Obsidian + Knowledge/Mem 整合

> 基于 brainstorm resolution | Session: maestro-20260528-164300
> 日期：2026-05-28

---

## Phase 1: Rust File Watcher + Vault 选择 UI + Cytoscape.js 集成 + 基础图谱

### Wave 1.1: 基础设施层（Rust + Node）

| Task | 文件 | 描述 |
|------|------|------|
| T1.1.1 | `src-tauri/src/vault_watcher.rs` | 新增 Rust `notify` file watcher 模块，监听 vault 目录变更，发送 Tauri event `vault:file-changed` |
| T1.1.2 | `src-tauri/src/vault_commands.rs` | 新增 Tauri commands: `list_vaults`, `select_vault`, `start_vault_watcher`, `stop_vault_watcher` |
| T1.1.3 | `src-tauri/src/main.rs` | 注册新 commands + 初始化 watcher 模块 |
| T1.1.4 | `src-ts/services/obsidian-service.ts` | 增强: `readVaultConfig()` 读取 `.obsidian/graph.json` + `app.json`；添加 vault 验证逻辑 |
| T1.1.5 | `desktop/src-tauri/Cargo.toml` | 添加 `notify` crate 依赖 |

### Wave 1.2: 前端图谱基础

| Task | 文件 | 描述 |
|------|------|------|
| T1.2.1 | `desktop/package.json` | 添加 `cytoscape` + `@types/cytoscape` 依赖 |
| T1.2.2 | `desktop/src/stores/knowledgeGraphSlice.ts` | 新增 Zustand slice: nodes, edges, viewMode, filterState, syncStatus |
| T1.2.3 | `desktop/src/stores/appStore.ts` | 注册 knowledgeGraphSlice |
| T1.2.4 | `desktop/src/components/knowledge-graph/KnowledgeGraphView.tsx` | 主图谱视图组件，集成 Cytoscape.js，force-directed 布局，全屏模式 |
| T1.2.5 | `desktop/src/components/knowledge-graph/KnowledgeGraphToolbar.tsx` | 工具栏：搜索、过滤、布局切换、视图模式 |
| T1.2.6 | `desktop/src/components/knowledge-graph/useCytoscape.ts` | Hook: Cytoscape 实例管理，增量更新，事件绑定 |
| T1.2.7 | `desktop/src/components/AppMainContent.tsx` | 视图路由：editor / graph / split 模式切换 |

### Wave 1.3: Vault 选择 UI + 集成

| Task | 文件 | 描述 |
|------|------|------|
| T1.3.1 | `desktop/src/components/settings/VaultSelector.tsx` | Vault 选择组件：自动发现 + 手动目录选择 |
| T1.3.2 | `desktop/src/hooks/useAppUiPersistence.ts` | 扩展 RightPanelType: `knowledgeGraph` + `writingContext` |
| T1.3.3 | `desktop/src/components/AppHeader.tsx` | 新增知识图谱切换按钮 |
| T1.3.4 | 测试 | knowledgeGraphSlice 单元测试 + Cytoscape 渲染测试 |

---

## Phase 2: TipTap Wikilink + WritingContext + AI 上下文选择器

### Wave 2.1: Wikilink 编辑器扩展

| Task | 文件 | 描述 |
|------|------|------|
| T2.1.1 | `desktop/src/components/editor/WikilinkMark.ts` | TipTap Mark: 正则 `[[...]]`，渲染为可点击 wikilink |
| T2.1.2 | `desktop/src/components/editor/WikilinkContextBubble.tsx` | Hover 浮窗：笔记摘要 + 连接数 |
| T2.1.3 | `desktop/src/components/DocumentEditor.tsx` | 集成 WikilinkMark extension |

### Wave 2.2: 写作上下文面板

| Task | 文件 | 描述 |
|------|------|------|
| T2.2.1 | `desktop/src/stores/writingContextSlice.ts` | 新增 Zustand slice: contextNotes, aiSelectedNoteIds, recommendations |
| T2.2.2 | `desktop/src/components/panels/WritingContextPanel.tsx` | 右侧面板：相关笔记列表 + AI 上下文选择 + token 计数 |
| T2.2.3 | `desktop/src/components/panels/AiContextSelector.tsx` | 勾选笔记 + 应用到 AI 对话 |
| T2.2.4 | `desktop/src/components/ChatAreaComposer.tsx` | 注入上下文指示条："已加载 N 篇笔记 (X tokens)" |
| T2.2.5 | 测试 | writingContextSlice 单元测试 + Wikilink 解析测试 |

---

## Phase 3: 双向同步引擎 + Sync State 持久化 + 冲突 UI

### Wave 3.1: 同步引擎核心

| Task | 文件 | 描述 |
|------|------|------|
| T3.1.1 | `src-ts/services/obsidian-knowledge-sync.ts` | 重构: mtime+hash 双重检测，structured diff (按 heading 分区)，HUMAN_QUEUE fallback |
| T3.1.2 | `src-ts/services/sync-state-store.ts` | 新增: SQLite 持久化 sync_state + sync_conflicts 表 |
| T3.1.3 | `src-ts/services/vault-file-processor.ts` | 新增: remark pipeline 解析 markdown → ParsedNote |
| T3.1.4 | `src-ts/services/markdown-diff.ts` | 新增: structured diff 按 heading 分区合并 |

### Wave 3.2: 同步 UI

| Task | 文件 | 描述 |
|------|------|------|
| T3.2.1 | `desktop/src/components/panels/SyncStatusIndicator.tsx` | 同步状态图标 + 上次同步时间 |
| T3.2.2 | `desktop/src/components/panels/ConflictResolutionPanel.tsx` | 左右对照冲突解决，使用 `diff` 库高亮差异 |
| T3.2.3 | 测试 | sync engine 集成测试 + 冲突解决测试 |

---

## Phase 4: bge-small-zh Embedding + sqlite-vec + 增量索引 + Retrieval

### Wave 4.1: Embedding 管线

| Task | 文件 | 描述 |
|------|------|------|
| T4.1.1 | `src-ts/knowledge/providers/local-embedding.ts` | 实现: onnxruntime-node + bge-small-zh-v1.5 (384 dim) |
| T4.1.2 | `src-ts/knowledge/embedding-service.ts` | 接入: LOCAL provider 实际实现，batch 32 + cache |
| T4.1.3 | `assets/models/bge-small-zh-v1.5/` | 下载 ONNX quantized 模型 (~24MB) |

### Wave 4.2: Vector Store + Retrieval

| Task | 文件 | 描述 |
|------|------|------|
| T4.2.1 | `src-ts/search/vector-search.ts` | 迁移: sqlite-vec extension 替代暴力扫描 |
| T4.2.2 | `src-ts/search/retrieval-pipeline.ts` | 新增: Vector topK=20 + FTS5 topK=20 → RRF Fusion → MMR Rerank |
| T4.2.3 | `src-ts/services/incremental-indexer.ts` | 新增: 监听 vault 变更 → hash 对比 → chunk+embed+upsert |
| T4.2.4 | `src-ts/api/knowledge-routes.ts` | 新增: `/knowledge/search`, `/knowledge/context` endpoints |
| T4.2.5 | 测试 | embedding 管线测试 + vector search 性能测试 + retrieval 端到端测试 |

---

## Phase 5: 分屏模式 + 搜索/过滤/Mini-map + 右键菜单 + 性能优化

### Wave 5.1: 高级交互

| Task | 文件 | 描述 |
|------|------|------|
| T5.1.1 | `desktop/src/components/knowledge-graph/KnowledgeGraphCanvas.tsx` | 拆分 Canvas 组件，支持分屏 + Mini-map |
| T5.1.2 | `desktop/src/components/knowledge-graph/GraphMinimap.tsx` | Mini-map: 120px 宽，半透明 + 视口矩形 |
| T5.1.3 | `desktop/src/components/knowledge-graph/GraphContextMenu.tsx` | 右键菜单: 打开笔记/创建链接/AI摘要/复制wikilink |
| T5.1.4 | `desktop/src/components/knowledge-graph/GraphSearchInput.tsx` | 实时搜索 + 高亮匹配 + zoom-to-fit |
| T5.1.5 | `desktop/src/components/knowledge-graph/GraphFilterDropdown.tsx` | 多维过滤: 节点类型/边类型/标签/日期/连接数 |

### Wave 5.2: 性能优化 + 收尾

| Task | 文件 | 描述 |
|------|------|------|
| T5.2.1 | `desktop/src/components/knowledge-graph/SidebarGraphView.tsx` | 侧边栏径向布局（当前笔记一度关联） |
| T5.2.2 | 性能 | lazy loading、graph LOD、large vault 测试 (10k notes) |
| T5.2.3 | 测试 | E2E 测试: vault 选择 → 图谱渲染 → 节点点击 → 编辑器跳转 |
| T5.2.4 | 文档 | 更新 README + docs-site |

---

## 依赖关系

```
Wave 1.1 (Rust 基础) → Wave 1.3 (Vault UI)
Wave 1.2 (图谱基础) → Wave 1.3 (集成)
Wave 1.2 → Wave 5.1 (高级交互依赖基础图谱)

Wave 2.1 (Wikilink) → Wave 2.2 (上下文面板)
Phase 1 → Phase 3 (同步需要 vault 访问层)
Phase 1 → Phase 4 (索引需要 vault 访问层)
Phase 3 + Phase 4 → Phase 2 (上下文注入依赖同步+retrieval)

Phase 1+2+3+4 → Phase 5 (收尾优化)
```

## 预估工作量

| Phase | Tasks | 预估时间 |
|-------|-------|---------|
| Phase 1 | 14 | 2 周 |
| Phase 2 | 8 | 2 周 |
| Phase 3 | 7 | 2 周 |
| Phase 4 | 8 | 2 周 |
| Phase 5 | 9 | 1 周 |
| **Total** | **46** | **9 周** |
