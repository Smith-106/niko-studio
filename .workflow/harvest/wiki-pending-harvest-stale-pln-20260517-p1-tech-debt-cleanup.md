---
slug: harvest-stale-pln-20260517-p1-tech-debt-cleanup
title: Plan: 6 tasks in 3 waves — console收口+as-any, translations+catalog, panels+workflow-engine.
type: note
tags: harvest,stale,plan,M24
source: harvest
source_ref: PLN-20260517-P1-tech-debt-cleanup
created_at: 2026-06-17T23:39:47.995Z
---

M24 Phase 1 现已收敛到 TASK-006 根因修复：一是 workflow-engine 公共 API 测试仍断言旧的 `run_stream`；二是 `src-ts` 作为独立子包未安装本地依赖，导致 `better-sqlite3` 与 `vitest` 无法在正确包上下文中解析。
