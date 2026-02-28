# PRD: Markdown One-click Export Experience

**ID:** PRD-018
**Milestone:** M5
**Status:** Completed

## Overview

Add one-click markdown export from draft/revision artifacts with stable file naming and trace metadata.

## Context

Export is a core writing-helper expectation and should be simple, deterministic, and auditable.

## Goals

- Provide one-click markdown export.
- Ensure stable naming convention and output location.
- Persist export trace metadata for audit.

## User Stories

### US-001: 一键导出当前草稿
- 作为写作者，我希望在草稿视图中一键导出 Markdown，以便快速对外分享或归档。
- 范围：导出入口、当前草稿选择、导出成功反馈。

### US-002: 稳定命名与目录策略
- 作为写作者，我希望导出文件名与目录可预测且稳定，以便批量管理历史版本。
- 范围：命名模板（session/revision/timestamp）、输出目录约定、冲突处理。

### US-003: 导出行为可追溯落盘
- 作为审核者，我希望每次导出都写入 trace/evidence，以便审计导出来源与版本关联。
- 范围：export trace 字段、evidence link、与 revision/generation 关联。

## Implementation Plan (Research -> Plan Review -> Implement -> Quality)

### Phase R: Research
- 对齐现有草稿/修订产物路径与命名约定（draft/revision/evidence）。
- 识别可复用导出实现与文件写入边界。
- 定义导出元数据最小字段（session_id/revision_id/export_path/exported_at）。

### Phase P: Plan Review
- 确认导出命名优先级与冲突处理策略（覆盖/递增/失败返回）。
- 冻结导出目录与证据字段结构，确保 CLI/UI 一致。
- 明确导出失败时可恢复行为与错误语义。

### Phase I: Implement
- I1（US-001）：实现一键导出入口与当前草稿导出主路径。
- I2（US-002）：实现确定性命名、目录策略与冲突处理。
- I3（US-003）：导出成功后写入 traceable evidence 元数据。

### Phase Q: Quality
- Q1：单测覆盖导出参数校验、命名稳定性与冲突处理。
- Q2：集成验证 CLI/UI 导出行为与输出一致。
- Q3：证据验证导出记录可追溯到对应 revision/generation。

## Dependencies

- PRD-017: Built-in Real-time Editor and Draft Rewrite.

## Acceptance Criteria

- [ ] User can export latest draft to Markdown in one action.
- [ ] Exported file names and paths follow deterministic convention.
- [ ] Export operation is recorded in traceable evidence metadata.
- [ ] US-001/US-002/US-003 each has at least one automated test anchor.
- [ ] At least one end-to-end run includes export evidence links under `.workflow/evidence/`.

---

*This PRD will be fully expanded when it becomes the active PRD.*
