---
title: 鍚屾寮曟搸锛氫簨浠堕┍鍔ㄦ贩鍚?+ 缁撴瀯鍖?diff + HUMAN_QUEUE
createdBy: harvest
related:
  - "spec:project:architecture-constraints-025"
---

---
type: spec
slug: harvest-brainstorm-sync-engine
title: 同步引擎：事件驱动混合 + 结构化 diff + HUMAN_QUEUE
tags: obsidian-integration,sync-engine,conflict-resolution
source: harvest
source_id: 20260528-brainstorm-obsidian-knowledge-integration
fragment_id: HRV-c1d2e3f4
created: 2026-06-13
---

Rust notify 监控 vault 变更 → Tauri event → Node handler。Node 知识实体变更 → EventBus → 写入 vault。周期性全量验证 (5 min) 确保最终一致性。变更检测：mtime + content hash 双验证。冲突策略：结构化 diff (按标题分区) + HUMAN_QUEUE 回退处理不可解冲突。同步状态持久化在 SQLite (sync_state + sync_conflicts 表)。
