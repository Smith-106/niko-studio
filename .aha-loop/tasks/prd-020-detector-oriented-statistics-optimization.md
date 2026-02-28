# PRD: Detector-oriented Statistics Optimization

**ID:** PRD-020
**Milestone:** M5
**Status:** Completed

## Overview

Introduce measurable perplexity/burstiness optimization and detector-facing validation strategy.

## Context

To match writing-helper capability claims, optimization must include explicit statistical targets and measurable before/after deltas.

## Goals

- Define measurable perplexity/burstiness optimization pipeline.
- Add before/after metrics reporting.
- Add detector-oriented validation output for review.

## User Stories

### US-001: 统计基线采样
- 作为写作者，我希望在优化前自动得到 perplexity/burstiness 基线，以便明确改写目标。
- 范围：指标采样、基线结构、异常值处理。

### US-002: 面向指标的优化与回写
- 作为写作者，我希望优化后自动回写指标变化量，以便判断是否达到预期。
- 范围：优化前后测量、delta 计算、阈值提示。

### US-003: 检测器导向摘要输出
- 作为审核者，我希望获得 detector-facing 摘要并落盘证据，以便进行风险评估与复现。
- 范围：summary 字段、trace 关联、quality evidence 链接。

## Implementation Plan (Research -> Plan Review -> Implement -> Quality)

### Phase R: Research
- 对齐现有质量评分/证据结构，确认统计指标落盘位置。
- 梳理 perplexity/burstiness 计算方式与可重复性约束。
- 定义指标最小 schema（baseline/after/delta/threshold/status）。

### Phase P: Plan Review
- 确认统计采样窗口、文本分片与聚合策略。
- 冻结 delta 判定规则与 detector 摘要结构。
- 明确“不追求虚假提升”的约束与可解释输出边界。

### Phase I: Implement
- I1（US-001）：实现优化前指标采样与基线记录。
- I2（US-002）：实现优化后指标计算与 delta 回写。
- I3（US-003）：实现 detector-oriented summary 并写入 evidence。

### Phase Q: Quality
- Q1：单测覆盖指标计算、delta 判定与异常样本处理。
- Q2：集成验证同一输入在重复运行下指标输出稳定。
- Q3：证据验证统计摘要可追溯到优化输入与输出。

## Dependencies

- PRD-019: AI Text Humanization Optimizer.

## Acceptance Criteria

- [ ] Perplexity and burstiness measurements are produced before and after optimization.
- [ ] Optimization output includes machine-readable metric deltas.
- [ ] Detector-oriented validation summary is traceable in quality evidence.
- [ ] US-001/US-002/US-003 each has at least one automated test anchor.
- [ ] At least one end-to-end or quality run includes detector-oriented metric evidence links under `.workflow/evidence/`.

---

*This PRD will be fully expanded when it becomes the active PRD.*
