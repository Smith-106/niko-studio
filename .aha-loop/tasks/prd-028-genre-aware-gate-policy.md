# PRD: Genre-Aware Gate Policy

**ID:** PRD-028
**Milestone:** M6
**Status:** Pending

## Overview

Add per-profile gate policy (hard_gate/warn_only) and integrate rubric-based block semantics into release checks.

## Context

Not all projects should be blocked by the same strictness. Gate policy must be configurable by profile and genre while keeping deterministic behavior.

## Goals

- Add profile-level gate policy controls.
- Integrate rubric/scorecard outcomes into release gate decisions.
- Keep deterministic, auditable block/release semantics.

## Gate Policy Matrix (Default)

- `hard_gate`: below `block_threshold` blocks release.
- `warn_only`: below threshold emits warnings, release allowed.
- Policy is configured per `NovelProfile`, with optional per-genre override.

## Genre-Aware Blocking Rules (V1)

- Alternate History / Ancient Romance: history-detail scorecard participates in gate decision.
- Suspense/Detective: clue continuity + resolution coherence below threshold can trigger block in `hard_gate` mode.
- Sci-Fi/Future: causality + tech consistency below threshold can trigger block in `hard_gate` mode.
- Other genres default to warn-only unless profile explicitly sets `hard_gate`.

## Decision Trace Fields (Minimum)

- `profile_id`, `genre_tags`, `policy_mode`
- `rubric_results` (per pack)
- `history_detail_scorecard` (if enabled)
- `final_decision` (pass/warn/block)
- `blocking_reasons` (array)
- `suggested_actions` (array)

## User Stories

### US-001: 项目级门禁策略
- 作为作者，我希望为小说设置 hard_gate/warn_only 策略，以匹配创作阶段。
- 范围：policy config、默认策略、覆盖规则。

### US-002: 评分卡结果接入发布门禁
- 作为审核者，我希望评分卡结果直接影响发布判定，以便减少漏检。
- 范围：gate evaluator、block reason、decision artifact。

### US-003: 门禁决策可解释
- 作为维护者，我希望每次阻断都能看到明确原因和修复建议。
- 范围：decision trace、human-readable summary、debug detail。

## Implementation Plan (Research -> Plan Review -> Implement -> Quality)

### Phase R: Research
- 梳理现有 release gate 逻辑与可插入点。
- 识别 profile policy 与 quality score 输出接口。

### Phase P: Plan Review
- 冻结 gate policy schema 与优先级。
- 明确阻断原因模型与对外展示字段。

### Phase I: Implement
- I1（US-001）：实现项目级门禁策略配置与读取。
- I2（US-002）：接入 rubric/scorecard 到 gate evaluator。
- I3（US-003）：输出可解释门禁决策与调试上下文。

### Phase Q: Quality
- Q1：单测覆盖策略切换、阈值边界、阻断分支。
- Q2：集成验证 hard_gate/warn_only 两种模式行为。
- Q3：证据验证门禁决策可追溯且可解释。

## Dependencies

- PRD-026: Genre Taxonomy and Adaptive Rubric Packs.
- PRD-027: Historical Detail Scorecard.

## Acceptance Criteria

- [ ] Profile-level gate policy supports `hard_gate` and `warn_only`.
- [ ] Release gate consumes rubric/scorecard outcomes deterministically.
- [ ] Block decisions include actionable reason and trace context.
- [ ] US-001/US-002/US-003 each has at least one automated test anchor.

---

*This PRD will be fully expanded when it becomes the active PRD.*
