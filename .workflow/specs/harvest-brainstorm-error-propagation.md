---
title: "M24 璺ㄧ壒鎬ч敊璇紶鎾鍒?tags: m24,error-handling,graceful-degradation"
createdBy: harvest
related:
  - "spec:project:architecture-constraints-027"
---

---
type: spec
slug: harvest-brainstorm-error-propagation
title: M24 跨特性错误传播规则
tags: m24,error-handling,graceful-degradation
source: harvest
source_id: 20260517-brainstorm-m24-milestone-direction
fragment_id: HRV-e3f4a5b6
created: 2026-06-13
---

F-005 catalog 加载失败不得阻塞应用启动（回退空目录）。F-006 工作流步骤失败须触发检查点保存。F-007 可视化渲染错误须 ErrorBoundary 隔离，不影响编辑器。F-004 翻译模块加载失败回退到 key 显示。错误分类：瞬态（网络超时、LLM 限流）→指数退避最多 3 次重试；数据（模式验证失败）→回退捆绑默认+告警；逻辑（无效状态转换）→日志+优雅降级；致命（OOM、不可恢复损坏）→崩溃报告+重启提示。
