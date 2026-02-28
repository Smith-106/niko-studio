# PRD: API Configuration UX and Timeout/Debug Ergonomics

**ID:** PRD-022
**Milestone:** M5
**Status:** Completed

## Overview

Provide intuitive API settings UX, long-timeout handling (up to 10 minutes), and user-friendly error/debug surfaces.

## Context

Writing-helper parity requires straightforward model/API switching, long-running request support, and clear troubleshooting output.

## Goals

- Add clear API configuration UX for model/provider switching.
- Support timeout settings up to 10 minutes where applicable.
- Improve error messages with actionable debug details.

## User Stories

### US-001: API 配置体验统一
- 作为写作者，我希望在一个界面完成 provider/model/key/base-url 配置并即时校验，以便减少配置错误。
- 范围：配置表单、即时反馈、敏感字段处理。

### US-002: 长超时请求可观测
- 作为写作者，我希望将请求超时配置到 10 分钟并看到执行状态，以便处理长文本生成任务。
- 范围：timeout 参数范围、请求状态显示、取消/失败语义。

### US-003: 错误与调试信息分层展示
- 作为写作者，我希望看到友好错误摘要和可展开技术细节，以便快速定位问题。
- 范围：用户层错误文案、debug context、trace 关联。

## Implementation Plan (Research -> Plan Review -> Implement -> Quality)

### Phase R: Research
- 对齐现有 API 配置入口、运行时参数与错误返回结构。
- 梳理 timeout 在 CLI/UI/gateway 的传递链路与上限约束。
- 定义错误展示最小字段（summary/code/provider/request_id/debug_info）。

### Phase P: Plan Review
- 确认配置校验规则与敏感信息展示边界。
- 冻结超时参数语义（默认值/最大值/越界处理）。
- 明确错误分层展示协议，确保 UI 与 CLI 可映射。

### Phase I: Implement
- I1（US-001）：实现 API 配置表单与即时校验反馈。
- I2（US-002）：实现最长 10 分钟超时支持与请求状态可观测性。
- I3（US-003）：实现分层错误展示与 debug context 关联。

### Phase Q: Quality
- Q1：单测覆盖配置校验、超时边界与错误结构序列化。
- Q2：集成验证长请求在不同 provider 下行为一致。
- Q3：证据验证错误链路可追溯并具备可操作调试信息。

## Dependencies

- PRD-021: Multi-LLM Provider Matrix.
- PRD-013: Optional UI Execution Bridge.

## Acceptance Criteria

- [ ] API settings UI covers provider/model/key/base-url and validation feedback.
- [ ] Long-timeout requests (up to 10 minutes) are supported and observable.
- [ ] Error surfaces include user-friendly summary plus technical debug context.
- [ ] US-001/US-002/US-003 each has at least one automated test anchor.
- [ ] At least one run includes timeout/error-debug evidence links under `.workflow/evidence/`.

---

*This PRD will be fully expanded when it becomes the active PRD.*
