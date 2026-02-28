# PRD: Historical Detail Scorecard

**ID:** PRD-027
**Milestone:** M6
**Status:** Pending

## Overview

Implement history-detail scorecard dimensions (ritual, clothing, institution, chronology) with evidence output.

## Context

Historical and alternate-history projects require enforceable checks beyond generic writing quality metrics.

## Goals

- Define history-detail scorecard schema and dimension weights.
- Produce machine-readable per-dimension scoring outputs.
- Link score results to evidence for audit and review.

## History Detail Scorecard (V1)

- Ritual Etiquette（礼仪）
- Clothing & Accessories（服饰）
- Institutions & Governance（制度官制）
- Military & Warfare Semantics（军制兵事）
- Architecture & Utensils（建筑器物）
- Chronology Consistency（时间纪年）

## Scoring and Thresholds (Default)

- Score range: 0~100 per dimension.
- Weighted total score default:
  - Ritual 15%, Clothing 15%, Institutions 20%, Military 15%, Architecture 15%, Chronology 20%.
- Default pass thresholds:
  - `warn_threshold = 70`
  - `block_threshold = 60` (for hard-gate profiles).

## Evidence Output Contract (Minimum)

- `dimension_scores`: map of six dimensions to numeric score.
- `weighted_total`: aggregated score.
- `citations`: evidence anchors by source and text fragment.
- `issues`: list of failed checks with reason and suggested fix.
- `gate_recommendation`: pass | warn | block.

## User Stories

### US-001: 历史细节维度评分
- 作为作者，我希望系统按礼仪/服饰/制度/时序等维度打分，以便快速发现问题。
- 范围：维度定义、分值区间、权重模型。

### US-002: 可追溯证据输出
- 作为审核者，我希望每个维度分数可追溯到文本片段和依据来源。
- 范围：evidence anchor、source attribution、reason 字段。

### US-003: 阈值与告警语义
- 作为维护者，我希望按阈值触发一致的告警/阻断语义，以便纳入发布门禁。
- 范围：threshold config、severity mapping、block reason。

## Implementation Plan (Research -> Plan Review -> Implement -> Quality)

### Phase R: Research
- 盘点历史题材常见核查维度与可自动化规则。
- 对齐现有 quality evidence 字段与扩展点。

### Phase P: Plan Review
- 冻结 scorecard 维度/权重/阈值 schema。
- 明确 source attribution 与争议条目处理策略。

### Phase I: Implement
- I1（US-001）：实现历史细节维度评分计算。
- I2（US-002）：实现维度级 evidence 输出与来源关联。
- I3（US-003）：实现阈值告警与阻断语义映射。

### Phase Q: Quality
- Q1：单测覆盖评分维度、权重和阈值边界。
- Q2：集成验证历史题材输入下输出稳定可重复。
- Q3：证据验证维度分数可追溯到依据与文本锚点。

## Dependencies

- PRD-025: Novel Profile and Scoped Reference Library.
- PRD-026: Genre Taxonomy and Adaptive Rubric Packs.

## Acceptance Criteria

- [ ] History-detail scorecard dimensions and thresholds are defined.
- [ ] Per-dimension scores are machine-readable and evidence-linked.
- [ ] Warning/block semantics are deterministic and configurable.
- [ ] Alternate-History and Ancient-Romance profiles include scorecard gate participation config.
- [ ] US-001/US-002/US-003 each has at least one automated test anchor.

---

*This PRD will be fully expanded when it becomes the active PRD.*
