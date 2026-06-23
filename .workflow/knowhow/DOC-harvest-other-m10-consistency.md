---
title: "涓€鑷存€ф鏌ヤ笁绉嶈Е鍙戯細鎵嬪姩 UI + 缂栫▼ API + 宸ヤ綔娴佹楠?tags: consistency-checking,multi-trigger"
createdBy: harvest
related:
- "knowhow-doc-harvest-other-intelligence-cache"
- "knowhow-doc-harvest-other-mirofish-graphrag"
- "knowhow-doc-harvest-debug-camelcase-api"
---
---
type: knowhow
slug: harvest-other-m10-consistency
title: 一致性检查三种触发：手动 UI + 编程 API + 工作流步骤
tags: consistency-checking,multi-trigger
source: harvest
source_id: m10-phase1
fragment_id: HRV-b4c5d6e7
created: 2026-06-13
---

一致性检查可从三种方式触发：1) 手动 UI (AnalysisPanel.tsx 或 EvaluationPanel.tsx)；2) 编程 API (runWorkspaceConsistencyCheck 或 runConsistencyCheck)；3) 作为 builtin-revision-pass 工作流步骤。使用 meaningfulWorkspace 获取完整项目上下文。
