# PRD: Built-in Real-time Editor and Draft Rewrite

**ID:** PRD-017
**Milestone:** M5
**Status:** Completed

## Overview

Provide built-in real-time editing for generated drafts with deterministic save/reload and revision linkage.

## Context

Current flow is CLI-first and evidence-complete, but writing-helper parity requires first-class in-app editing and iterative rewrite ergonomics.

## Goals

- Add built-in editor for generated draft content.
- Support save/reload without data loss.
- Link editor rewrites to revision evidence chain.

## User Stories

### US-001: 实时编辑草稿内容
- 作为写作者，我希望在内置编辑器中直接修改生成草稿，以便在不切换上下文的情况下快速迭代。
- 范围：草稿加载、编辑态更新、显式保存。

### US-002: 无损保存与重载
- 作为写作者，我希望保存后的草稿在刷新/重开后内容一致，以便确保不会丢失改动。
- 范围：确定性保存、版本戳、重载一致性校验。

### US-003: 修订证据链追踪
- 作为审核者，我希望每次编辑保存都能关联 revision 证据，以便审计“改前/改后”变化。
- 范围：保存事件 trace_id、revision_id、evidence_link 关联。

## Implementation Plan (Research -> Plan Review -> Implement -> Quality)

### Phase R: Research
- 对齐现有草稿入口与状态流：`src/cli/commands/guided_draft.py`、`src/workflow/revision_loop.py`、`src/ui/streamlit_app.py`。
- 识别编辑状态最小字段（draft_id/session_id/revision_id/content/updated_at）。
- 输出编辑-保存-重载时序草图到 PRD 备注。

### Phase P: Plan Review
- 确认“CLI 与 UI 语义一致”边界：不新增平行状态机，仅复用 workflow stage 语义。
- 确认 evidence 最小扩展字段：`trace.session_id`、`trace.revision_id`、`evidence_links[]`。
- 冻结 US-001~US-003 依赖与验收入口。

### Phase I: Implement
- I1（US-001）：实现编辑器加载与编辑缓冲（默认从最近 draft 初始化）。
- I2（US-002）：实现保存/重载路径，提供一致性检查（保存后 hash/version 匹配）。
- I3（US-003）：保存事件产出 revision evidence 链接并可在质量证据中追溯。

### Phase Q: Quality
- Q1：单测覆盖编辑/保存/重载主路径与异常路径。
- Q2：端到端验证“生成 -> 编辑 -> 保存 -> 重载 -> 证据可追溯”。
- Q3：产出最小证据文件并在 release summary 中可引用。

## Dependencies

- PRD-004: Guided Idea-to-Draft CLI Session.
- PRD-005: Checkpointed Revision Loop.
- PRD-013: Optional UI Execution Bridge.

## Acceptance Criteria

- [ ] User can edit generated draft content in built-in editor.
- [ ] Save/reload is deterministic and lossless.
- [ ] Edited outputs are traceable in revision evidence.
- [ ] US-001/US-002/US-003 each has at least one automated test anchor.
- [ ] Evidence links for one end-to-end sample run are persisted under `.workflow/evidence/`.

---

*This PRD will be fully expanded when it becomes the active PRD.*
