# PRD: AI Text Humanization Optimizer

**ID:** PRD-019
**Milestone:** M5
**Status:** Completed

## Overview

Add optimizer pipeline to reduce AI-like writing traces while preserving meaning and narrative intent.

## Context

Writing-helper parity requires explicit post-generation optimization for more natural style, including preset and custom instruction modes.

## Goals

- Add humanization optimizer stage after generation/revision.
- Provide preset modes for optimization behavior.
- Support custom rewrite instructions.

## User Stories

### US-001: 预设优化模式
- 作为写作者，我希望一键选择“人性化优化/AI改写指导”等预设，以便快速得到更自然文本。
- 范围：预设列表、参数映射、模式切换。

### US-002: 自定义优化指令
- 作为写作者，我希望输入自定义改写要求并执行优化，以便体现个人写作偏好。
- 范围：自定义指令输入、与预设叠加规则、参数校验。

### US-003: 优化前后可追溯对比
- 作为审核者，我希望查看优化前后文本与关键指标对比，以便评估优化有效性。
- 范围：before/after 快照、优化参数、evidence 关联。

## Implementation Plan (Research -> Plan Review -> Implement -> Quality)

### Phase R: Research
- 对齐生成/修订后处理链路，确定 optimizer 插入点。
- 梳理可复用 rewrite/critic 模块与质量信号字段。
- 定义 optimizer 最小输入输出契约（input_text/output_text/mode/instructions）。

### Phase P: Plan Review
- 确认预设与自定义指令的叠加优先级与覆盖规则。
- 冻结优化结果序列化结构，保障 CLI/UI 行为一致。
- 明确“意义保持”边界与失败回退策略。

### Phase I: Implement
- I1（US-001）：实现预设模式执行与参数映射。
- I2（US-002）：实现自定义优化指令与预设叠加处理。
- I3（US-003）：输出优化前后对比并写入 traceable evidence。

### Phase Q: Quality
- Q1：单测覆盖模式切换、自定义叠加与参数校验。
- Q2：集成验证优化前后语义保持与输出格式稳定。
- Q3：证据验证优化链路可追溯到源草稿与结果版本。

## Dependencies

- PRD-007: Quality Feedback Pipeline.
- PRD-017: Built-in Real-time Editor and Draft Rewrite.

## Acceptance Criteria

- [ ] Optimizer can run on selected draft text and return revised output.
- [ ] At least two preset modes are available (humanization / AI-modification-guidance).
- [ ] Custom optimizer instructions are supported and persisted.
- [ ] US-001/US-002/US-003 each has at least one automated test anchor.
- [ ] At least one quality evidence sample records before/after optimizer comparison under `.workflow/evidence/`.

---

*This PRD will be fully expanded when it becomes the active PRD.*
