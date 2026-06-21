---
title: "缁勪欢瀛愮洰褰?+ 鍏煎鎬?re-export 閿氭ā寮?tags: component-structure,re-export-anchor,backward-compat"
createdBy: harvest
related:
  - "spec:project:coding-conventions-002"
---

---
type: knowhow
slug: harvest-debug-reexport-anchor
title: 组件子目录 + 兼容性 re-export 锚模式
tags: component-structure,re-export-anchor,backward-compat
source: harvest
source_id: 20260525-test-P1-tech-debt-cleanup
fragment_id: HRV-c3d4e5f6
created: 2026-06-13
---

Evaluation 组件 (10 files in evaluation/) 和 StoryBible 组件 (13 files in story-bible/) 在子目录组织。兼容性 re-export 锚点 (EvaluationPanel.tsx, StoryBiblePanel.tsx) 保留在旧导入路径。
