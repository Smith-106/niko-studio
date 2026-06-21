---
title: Obsidian Rust-Node-WebView 涓夊眰鏋舵瀯
createdBy: harvest
related:
  - "spec:project:architecture-constraints-020"
---

---
type: spec
slug: harvest-brainstorm-obsidian-architecture
title: Obsidian Rust-Node-WebView 三层架构
tags: obsidian-integration,architecture,rust,tauri
source: harvest
source_id: 20260528-brainstorm-obsidian-knowledge-integration
fragment_id: HRV-a9b0c1d2
created: 2026-06-13
---

Rust 层 (notify crate + tauri-plugin-fs): 文件监控, vault 文件监测, 大文件流式读取。Node sidecar 层 (remark + onnxruntime-node + better-sqlite3): markdown 解析, embedding 生成, 同步引擎, 向量搜索。WebView 层 (React + Cytoscape.js): 知识图谱可视化, 编辑器交互, 同步状态 UI。Rust notify 监控变更 → Tauri event → Node handler。
