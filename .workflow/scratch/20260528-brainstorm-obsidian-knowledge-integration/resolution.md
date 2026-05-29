# Brainstorm 决议：Obsidian + Knowledge/Mem 整合

> 日期：2026-05-28 | Session: maestro-20260528-164300
> 状态：brainstorm complete, 待 plan 阶段

---

## 核心决议

### 1. 架构：Rust-Node-WebView 三层分工

| 层 | 技术 | 职责 |
|----|------|------|
| Rust | `notify` crate + `tauri-plugin-fs` | File watcher、vault 文件监听、大文件流式读取 |
| Node sidecar | `remark` + `onnxruntime-node` + `better-sqlite3` | Markdown 解析、embedding 生成、同步引擎、向量搜索 |
| WebView | React + Cytoscape.js | 知识图谱可视化、编辑器交互、同步状态 UI |

### 2. 可视化：Cytoscape.js

- Canvas 渲染，2000 节点流畅，满足个人知识库规模
- 4 种视图模式：全屏(Ctrl+G) / 分屏(左编辑器右图谱) / 侧边栏(迷你径向) / 悬浮窗(wikilink 触发)
- 节点类型：note / concept / character / location / ai-suggestion / obsidian-note
- 边类型：wikilink / reference / semantic-similarity / shared-tags / ai-inferred

### 3. 同步引擎：Event-driven Hybrid

- Rust `notify` 监听 vault 变更 → Tauri event → Node handler
- Node 知识实体变更 → EventBus → 写入 vault
- 定期全量校验（5 分钟）确保最终一致性
- 变更检测：mtime + content hash 双重
- 冲突策略：structured diff（按 heading 分区）+ HUMAN_QUEUE fallback

### 4. Knowledge/Mem：bge-small-zh-v1.5 + sqlite-vec

- Embedding：onnxruntime-node + bge-small-zh-v1.5（24MB，384 维）
- Vector store：sqlite-vec extension（~5ms@10k，与现有 SQLite 一致）
- Retrieval：Vector Search topK=20 + FTS5 topK=20 → RRF Fusion → MMR Rerank
- 增量索引：监听 vault 变更 → hash 对比 → 重新 chunk+embed+upsert

### 5. 数据模型

```
VaultNote: filePath, frontmatter, title, bodyAst, wikilinks[], embeds[], tags[], callouts[]
NoteLink: source, target, type(wikilink|embed|tag), context
SyncState: vaultPath, notePath, entityId, vaultMtime, vaultHash, knowledgeMtime, knowledgeHash, lastSyncAt
ConflictState: id, vaultPath, notePath, vaultContent, knowledgeContent, detectedAt, resolution
```

### 6. Obsidian 集成为可选模块

- 不安装 Obsidian 时应用正常运行
- `.niko-studio/` 元数据目录与 `.obsidian/` 并列，不侵入 vault
- Vault 选择 UX：自动发现 + 手动目录选择

---

## 实施路线

| Phase | 内容 | 周期 |
|-------|------|------|
| 1 | Rust file watcher + vault 选择 UI + ObsidianService 增强 + Cytoscape.js 集成 + 基础图谱 | 2 周 |
| 2 | TipTap Wikilink Extension + WritingContextPanel + AI 上下文选择器 | 2 周 |
| 3 | 双向同步引擎 + sync_state 持久化 + 冲突 UI + structured diff | 2 周 |
| 4 | bge-small-zh embedding + sqlite-vec + 增量索引 + retrieval pipeline | 2 周 |
| 5 | 分屏模式 + 搜索/过滤/Mini-map + 右键菜单 + 性能优化 | 1 周 |

---

## 风险与缓解

| 风险 | 严重度 | 缓解 |
|------|--------|------|
| 大 vault 性能（10k+ 笔记） | 高 | 渐进式索引 + 异步 embedding + graph LOD |
| Obsidian 同时持有文件锁（Windows） | 高 | Rust `notify` + proper HANDLE 共享模式 |
| vault 写入安全性 | 中 | Atomic write + 备份 + 只读模式 |
| Obsidian 格式兼容性漂移 | 中 | 格式版本检测 + 适配层隔离 |
| sqlite-vec 跨平台编译 | 低 | 预编译 binary + fallback 暴力扫描 |

---

## Sub-goals Mapping

| Sub-goal | 对应 Phase | 关键交付 |
|----------|-----------|---------|
| G1: Obsidian vault 数据读取与解析层 | 1+3 | ObsidianService + remark pipeline + file watcher |
| G2: 知识图谱可视化组件 | 1+5 | Cytoscape.js + 4 视图模式 + 交互 |
| G3: 双向数据同步引擎 | 3 | sync engine + conflict resolution + persistence |
| G4: 写作辅助知识上下文注入 | 2+4 | Wikilink + WritingContext + embedding + retrieval |
