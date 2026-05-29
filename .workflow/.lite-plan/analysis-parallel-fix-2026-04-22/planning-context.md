# Planning Context — analysis-parallel-fix-2026-04-22

## Goal
基于 ANL-2026-04-22 分析结果，形成可并行执行的最小闭环修复计划，优先提升恢复链（checkpoint/restore/quickRollback）正确性与可验证性。

## Source Analysis Artifacts
- `.workflow/.analysis/ANL-2026-04-22-分模块功能实现分析验证nikostudio状态/discussion.md`
- `.workflow/.analysis/ANL-2026-04-22-分模块功能实现分析验证nikostudio状态/perspectives.json`
- `.workflow/.analysis/ANL-2026-04-22-分模块功能实现分析验证nikostudio状态/research.json`
- `.workflow/.analysis/ANL-2026-04-22-分模块功能实现分析验证nikostudio状态/explorations/recovery-round2.json`

## Problem Summary
1. `restoreCheckpoint` 在共享工作区执行 `git checkout`，缺少 workspace 级互斥，存在并发副作用风险。
2. `quickRollback` 在 restore 失败场景可能产生状态持久化偏差，存在“状态已更新但工作区未恢复”风险。
3. recovery 相关测试以成功路径为主，并发冲突/失败注入/destructive confirm 分支覆盖不足。

## Scope
- 修复恢复链并发与状态原子性问题（workflow engine / workflow service）。
- 补齐恢复链关键异常路径测试（MCP integration + engine integration + desktop interaction）。

## Out of Scope (this plan)
- 容器装配根收敛（ContainerModule/ServiceContainer 双轨）
- workspace 契约单一事实源重构
- 全链路 OTEL/tracing 引入

## Parallel Workstreams
- **WS1 — Recovery lock domain**
  - 在 `checkpoint/restore/quickRollback` 关键 git 操作段增加 workspace 级异步互斥。
  - Anchors: `src-ts/workflow/workflow-engine.ts` (restore/rollback git 操作路径)
- **WS2 — QuickRollback atomicity**
  - 仅在 restore 成功后持久化 rollback/checkpoint 相关状态；失败分支保持一致性并记录可诊断信息。
  - Anchors: `src-ts/workflow/workflow-engine.ts` (quickRollback 状态持久化路径)
- **WS3 — Recovery test matrix**
  - 新增并发恢复、destructive restore 确认、git 失败注入、一致性断言用例。
  - Anchors: `src-ts/tests/mcp/workflow-endpoints.integration.test.ts`, `src-ts/tests/workflow/workflow-engine.integration.test.ts`, `desktop/src/components/ChatArea.test.tsx`

## Dependency Strategy
- WS1 与 WS2 可并行实现。
- WS3 依赖 WS1+WS2 合入后的行为稳定面，避免重复改测。

## Acceptance Gates
1. 并发恢复/回滚不再产生跨会话工作区污染。
2. quickRollback 在失败场景不写入误导性成功状态。
3. recovery 相关关键失败路径具有自动化测试覆盖并可稳定复现。
4. 现有 happy-path 回归不退化。
