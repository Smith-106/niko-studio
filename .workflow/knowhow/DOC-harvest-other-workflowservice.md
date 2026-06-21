---
title: "WorkflowService pattern: 鍐呯疆宸ヤ綔娴佸父閲?+ checkpoint 璐ㄩ噺闂ㄦ帶"
createdBy: harvest
related:
  - "spec:project:architecture-constraints-022"
---

---
type: knowhow
slug: harvest-other-workflowservice
title: WorkflowService pattern: 内置工作流常量 + checkpoint 质量门控
tags: workflowService,builtin-workflow,checkpoint
source: harvest
source_id: m10-phase1
fragment_id: HRV-c5d6e7f8
created: 2026-06-13
---

workflowService.ts 定义 BUILTIN_WORKFLOWS 常量数组。executeWorkflow 初始化运行。runNextStep 递归处理 enabledSteps。step 的 checkpoint 属性 ('review' 或 'approve') 暂停执行，通过 approveStep 实现质量门控。
