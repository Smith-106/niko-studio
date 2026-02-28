# PRD: Novel Profile and Scoped Reference Library

**ID:** PRD-025
**Milestone:** M6
**Status:** In Progress

## Overview

Introduce per-novel profile contracts with project-scoped reference library manifests and source provenance.

## Context

Different novels require different reference corpora (era/history/world background). A global shared pool risks cross-project contamination and weak traceability.

## Goals

- Add a first-class `NovelProfile` contract with `project_id` + `genre_tags` + reference-library manifest.
- Ensure retrieval and memory pipelines honor profile scope.
- Persist source provenance in evidence artifacts for auditability.

## User Stories

### US-001: 小说级配置隔离
- 作为作者，我希望为每本小说配置独立资料库，避免跨项目污染。
- 范围：profile 标识、项目作用域绑定、隔离策略。

### US-002: 参考资料清单与溯源
- 作为作者，我希望维护参考资料清单并记录来源，以便后续审校可追溯。
- 范围：manifest schema、source 元数据、版本/更新时间字段。

### US-003: 检索链路按 Profile 生效
- 作为系统维护者，我希望检索与记忆读写自动带 profile 过滤，以便保持一致性。
- 范围：query 过滤、memory scope、fallback 语义。

## NovelProfile Schema (V1)

- `profile_id`: 小说级唯一标识（建议稳定 slug）。
- `project_id`: 项目标识（检索/记忆/证据作用域主键）。
- `title`: 小说标题（用于人类可读输出）。
- `genre_tags`: 题材标签数组（后续 PRD-026 用于 rubric 选择）。
- `reference_manifest`: 项目独立资料清单对象：
  - `version`: manifest 版本号（初始 `1`）。
  - `updated_at`: ISO8601 更新时间。
  - `sources`: 资料来源数组，元素字段至少包含：
    - `source_id`: 来源唯一 ID。
    - `source_type`: `book | archive | article | note | other`。
    - `title`: 来源标题。
    - `uri_or_ref`: 外部链接或内部引用键。
    - `authority`: 可信度等级（`high | medium | low`）。
    - `license`: 许可/使用约束（可为空字符串）。
    - `snapshot`: 版本快照标记（日期/版次/commit 等）。
- `policy`: profile 级策略对象：
  - `missing_profile_behavior`: `warn_and_fallback | strict_block`（默认 `warn_and_fallback`）。
- `created_at` / `updated_at`: profile 元数据时间戳。

## Planned Code Touchpoints

- `src/workflow/state.py`: 在 workflow state 中持久化 `NovelProfile` 基础字段。
- `src/workflow/base_state.py`: 扩展状态 schema，保证序列化兼容。
- `src/workflow/session/session_manager.py`: 会话恢复/保存时携带 profile。
- `src/agents/architect.py`: 规划阶段注入 `project_id/genre_tags` 到后续任务上下文。
- `src/agents/writer.py`: 写作链路检索调用附带 profile scope。
- `src/memory/unified_memory.py`: 读写接口强制 `project_id/profile_id` 过滤。
- `src/services/memory_service.py`: 统一服务层增加 profile-aware 查询参数透传。
- `src/search/iterative_retriever.py`: 检索器过滤条件纳入 profile 作用域。
- `src/mcp/gateway.py`: MCP 网关入参/回包增加 profile 字段透传与校验。
- `src/cli/commands/run.py`: CLI 主执行入口接收并注入 profile。
- `src/cli/main.py`: CLI 参数面新增 profile 相关参数或配置读取。

## Automated Test Anchors

- **US-001（隔离）**
  - `tests/unit/workflow/test_state.py`: profile 字段序列化/反序列化不丢失。
  - `tests/unit/workflow/test_session_manager.py`: 多小说会话并行时 scope 不串线。
- **US-002（manifest+溯源）**
  - `tests/unit/services/test_memory_service.py`: provenance 字段落盘与读取一致。
  - `tests/unit/services/test_memory_service_extra.py`: `reference_manifest.sources` 字段完整性校验。
- **US-003（检索链路生效）**
  - `tests/unit/search/test_iterative_retriever.py`: profile 过滤命中与未命中边界。
  - `tests/unit/mcp/test_gateway_endpoints.py`: gateway 参数透传 profile 后行为一致。
- **跨层回归锚点**
  - `tests/unit/test_workflow.py`: workflow 端到端最小链路下 profile scope 一致。
  - `tests/unit/test_critic_integration.py`: 证据输出包含来源归因字段时不回退。

## Implementation Plan (Research -> Plan Review -> Implement -> Quality)

### Phase R: Research
- 梳理现有 project/session scope 与 memory/retrieval 接口。
- 识别 profile 注入点（CLI、workflow state、retriever、memory）。

### Phase P: Plan Review
- 冻结 `NovelProfile` 最小 schema 与 manifest 字段。
- 确认 profile 缺失时默认行为与兼容策略。

### Phase I: Implement
- I1（US-001）：引入 profile 配置与项目隔离绑定。
- I2（US-002）：实现参考资料 manifest 与来源溯源字段。
- I3（US-003）：完成检索/记忆链路 profile 过滤。

### Phase Q: Quality
- Q1：单测覆盖 profile schema、scope 过滤与 manifest 序列化。
- Q2：集成验证多小说并行场景下无交叉污染。
- Q3：证据验证来源溯源字段完整且可追溯。

## Dependencies

- PRD-008: Narrative Entity Model.
- PRD-021: Multi-LLM Provider Matrix.

## Acceptance Criteria

- [ ] Every novel can bind an independent profile and scoped reference library.
- [ ] Retrieval/memory operations enforce profile scope consistently.
- [ ] Evidence artifacts include source provenance fields.
- [ ] US-001/US-002/US-003 each has at least one automated test anchor.

---

*This PRD will be fully expanded when it becomes the active PRD.*
