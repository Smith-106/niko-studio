---
title: M24 5 鎺ュ彛鍚戝悗鍏煎濂戠害
createdBy: harvest
related:
  - "spec:project:architecture-constraints-024"
---

---
type: spec
slug: harvest-brainstorm-backward-compat
title: M24 5 接口向后兼容契约
tags: m24,backward-compatibility,interface-contract
source: harvest
source_id: 20260517-brainstorm-m24-milestone-direction
fragment_id: HRV-f4a5b6c7
created: 2026-06-13
---

1. WorkflowEngine 所有公共方法 (route, plan, execute, run, stream)。2. useI18n() hook 返回类型 Translations。3. EvaluationPanel 和 StoryBiblePanel props 接口。4. craft-catalog.ts 所有导出类型 (SatisfactionPattern 等)。5. Backend API endpoints (/api/workflow/*, /api/narrative/*)。内部实现可自由重构，消费者代码不需修改。
