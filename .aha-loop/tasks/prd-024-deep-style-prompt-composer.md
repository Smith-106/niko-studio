# PRD: Deep Style Prompt Composer

**ID:** PRD-024
**Milestone:** M5
**Status:** Completed

## Overview

Provide multi-dimensional style composition controls for language, structure, narration, and emotion with reusable presets.

## Context

Writing-helper parity requires deeper style control than basic `style/length/constraints`, including explicit style dimensions and composable prompt templates.

## Goals

- Add style dimensions for language tone, structural cadence, narration mode, and emotional intensity.
- Provide reusable presets and previewable composed prompt output.
- Keep composed style controls compatible with existing generation control surface.

## User Stories

### US-001: 多维风格面板建模
- 作为写作者，我希望分别配置语言、结构、叙述、情感四个维度，以便精细控制输出风格。
- 范围：维度字段定义、默认值、参数校验。

### US-002: 预设与可编辑组合
- 作为写作者，我希望一键套用预设后仍可逐维度微调，以便同时兼顾效率与个性化。
- 范围：预设模板、应用后可编辑、回滚到默认。

### US-003: 风格组合可追溯落盘
- 作为审核者，我希望每次生成都记录风格组合参数，以便复现输出并对比质量差异。
- 范围：generation controls 证据字段扩展与 trace 关联。

## Implementation Plan (Research -> Plan Review -> Implement -> Quality)

### Phase R: Research
- 对齐现有 generation controls：`style/length/constraints` 的输入链路与落盘格式。
- 梳理可复用 UI 控件模式（与 PRD-017 编辑器交互一致）。
- 定义四维风格最小字段与枚举约束。

### Phase P: Plan Review
- 确认“预设 + 自定义微调”冲突处理策略（覆盖规则与优先级）。
- 冻结风格参数序列化结构，确保 CLI/UI 语义一致。
- 明确 evidence 扩展字段不破坏既有 schema。

### Phase I: Implement
- I1（US-001）：实现四维风格参数模型与输入校验。
- I2（US-002）：实现预设应用、微调、重置与预览组合。
- I3（US-003）：在生成与修订路径中写入可追溯风格组合证据。

### Phase Q: Quality
- Q1：单测覆盖参数校验、预设叠加与覆盖优先级。
- Q2：集成验证同一参数在 CLI/UI 下生成一致。
- Q3：证据验证可复现同一风格组合输出（或可解释差异）。

## Dependencies

- PRD-006: Generation Control Surface.
- PRD-017: Built-in Real-time Editor and Draft Rewrite.

## Acceptance Criteria

- [ ] User can compose style controls across at least four dimensions (language/structure/narration/emotion).
- [ ] Preset styles can be applied and further edited without losing explicit dimension values.
- [ ] Composed style payload is persisted as traceable generation control evidence.
- [ ] US-001/US-002/US-003 each has at least one automated test anchor.
- [ ] At least one end-to-end run includes style-composition evidence links under `.workflow/evidence/`.

---

*This PRD will be fully expanded when it becomes the active PRD.*
