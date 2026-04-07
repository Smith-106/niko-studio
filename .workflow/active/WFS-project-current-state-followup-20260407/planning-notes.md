# Planning Notes

## User Intent

GOAL: 基于 2026-04-07 项目现状分析，制作可供执行的 issue 队列，优先覆盖尚未收口的结构债、工程基线和用户面缺口。
SCOPE: 生成一个可直接执行的后续任务队列与依赖关系，不执行实现。
CONTEXT: 新规划，输入来自 `.workflow/.team/UAN-project-status-2026-04-07/` 产物与最近已完成的 `WFS-post-governance-hardening-20260407`。

## Baseline Assumptions

- 当前主交付路径已经收敛到 `desktop + src-ts`，不重新打开已完成的治理收口工作。
- 本轮队列要避免重复 `WFS-post-governance-hardening-20260407` 已覆盖的 authority/governance 项。
- 当前 worktree 只有 `.workflow/.team/` 未跟踪，不构成源码级冲突。
- 目标是形成能被后续执行工作流消费的 `IMPL-*.json` 队列，而不是泛泛建议。

## Seed Findings

- 结构债集中在 `src-ts` placeholder/stub/adapter 与过宽兼容面。
- 工程质量问题集中在 repo 级 lint/format 缺失、本地校验弱于 CI、遗留 `pytest.ini` 默认姿态。
- 产品面缺口集中在知识库非技能项交互、Story Bible 持久化边界，以及过宽的产品叙事。

## Context Findings

- Conflict risk: `low`
- Recommended execution: `wave-based`
- Excluded as already complete:
  - `WFS-post-governance-hardening-20260407` 的 authority/governance hardening
  - 2026-04-07 当天已经完成的 release/docs/workflow 一致性治理
- Recommended modules:
  - `gateway-integration-boundary-closure`
  - `local-engineering-baseline`
  - `desktop-api-contract-split`
  - `knowledge-surface-closure`
  - `story-bible-persistence-clarification`
- Critical file clusters:
  - `src-ts/container/ServiceContainer.ts`, `src-ts/container/adapters.ts`, `src-ts/integrations/adapters.ts`, `src-ts/memory/unified-memory.ts`, `src-ts/web/app.ts`
  - `desktop/src/api/client.ts`, `desktop/src-tauri/src/main.rs`
  - `desktop/src/components/KnowledgeModal.tsx`, `desktop/src/components/knowledge/*`
  - `desktop/src/components/StoryBiblePanel.tsx`
  - `desktop/package.json`, `src-ts/package.json`, `pytest.ini`

## N+1 Context

### Decisions

| Decision | Rationale | Revisit? |
|----------|-----------|----------|
| Keep `WFS-post-governance-hardening-20260407` as the exclusion boundary for this queue | Governance and authority hardening already completed with `GO` and `authority_alignment_signal = PASS` | No |
| Use a 5-wave queue with `IMPL-001` to `IMPL-010` | Gateway debt, engineering baseline, desktop contract split, and user-surface closure can be staged with low same-wave overlap | No |
| Run `gateway`, `engineering baseline`, and `desktop transport contract` work before user-surface closure | `KnowledgeModal` and `StoryBiblePanel` depend on a cleaner desktop and gateway contract surface to avoid rework | No |
| Keep Story Bible in the near-term queue as `local-only + explicit portability`, not project-synced persistence | Current evidence supports clarifying the existing local draft boundary before adding gateway or storage writes | Yes |

### Deferred

- [ ] Narrow top-level product narrative beyond the execution queue to match the current writing-first desktop workbench surface.
- [ ] Define the next deployment and security baseline for Tauri CSP, repeatable packaging, and remaining manual release checks.
