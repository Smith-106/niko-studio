---
type: note
slug: harvest-analysis-revision-issues
title: RevisionOrchestrator 高复杂度 + 冗余 API 调用
tags: maintainability,RevisionOrchestrator,cyclomatic-complexity
source: harvest
source_id: 20260525-review-P1-tech-debt-cleanup
fragment_id: HRV-e9f0a1b2
created: 2026-06-13
---

revisionOrchestrator.ts:86-274 run() 方法高圈复杂度，7 个 RevisionResult 构造点中 5 个仅 revisionSession 不同。revisionSession 在 4 个位置重建可能冲突。evaluate() 每迭代调两次（冗余 + N+1）：maxIterations=5 时 11 次而非 6 次。修复：提取 buildResult helper + 复用上迭代 newEvaluation。
