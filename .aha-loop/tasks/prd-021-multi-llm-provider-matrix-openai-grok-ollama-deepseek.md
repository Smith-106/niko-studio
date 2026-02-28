# PRD: Multi-LLM Provider Matrix (OpenAI/Grok/Ollama/DeepSeek)

**ID:** PRD-021
**Milestone:** M5
**Status:** Completed

## Overview

Extend provider integration and routing to include Grok/Ollama/DeepSeek with per-provider capability constraints.

## Context

Current matrix is not yet aligned with writing-helper expectation for broad provider compatibility.

## Goals

- Add provider adapters/configs for Grok, Ollama, and DeepSeek.
- Keep routing deterministic with capability-aware constraints.
- Preserve compatibility with existing OpenAI flow.

## User Stories

### US-001: 多 Provider 配置统一入口
- 作为写作者，我希望在统一入口配置 OpenAI/Grok/Ollama/DeepSeek，以便按场景切换模型。
- 范围：provider/model/base-url/key 字段、校验反馈、默认值策略。

### US-002: 能力约束驱动路由
- 作为系统运营者，我希望路由根据 provider 能力约束选择可执行路径，以便避免运行时不兼容。
- 范围：capability matrix、路由判定、降级/拒绝语义。

### US-003: 适配器兼容性可验证
- 作为审核者，我希望每个 provider 都有兼容性测试锚点，以便确保升级不破坏现有流程。
- 范围：adapter contract tests、关键接口覆盖、证据落盘。

## Implementation Plan (Research -> Plan Review -> Implement -> Quality)

### Phase R: Research
- 对齐现有 provider 接口与 gateway 约束边界。
- 梳理 OpenAI/Grok/Ollama/DeepSeek 的最小兼容参数集合。
- 定义 capability matrix 字段与路由判定输入。

### Phase P: Plan Review
- 确认统一配置字段与 provider-specific 扩展策略。
- 冻结 capability-aware routing 规则与错误语义。
- 明确兼容性测试范围（连接、请求、响应、错误路径）。

### Phase I: Implement
- I1（US-001）：实现多 provider 统一配置与校验反馈。
- I2（US-002）：实现 capability-aware routing 与约束判定。
- I3（US-003）：补齐 adapter compatibility tests 与证据输出。

### Phase Q: Quality
- Q1：单测覆盖 provider 配置校验、路由分支与错误语义。
- Q2：集成验证四类 provider 在核心流程下行为一致性。
- Q3：证据验证兼容性测试结果可追溯到 provider/version。

## Dependencies

- PRD-003: Adapter Compatibility Test Harness.
- PRD-006: Generation Control Surface.

## Acceptance Criteria

- [ ] Providers OpenAI/Grok/Ollama/DeepSeek are configurable in runtime surface.
- [ ] Provider routing respects declared capability constraints.
- [ ] Adapter compatibility tests cover all configured providers.
- [ ] US-001/US-002/US-003 each has at least one automated test anchor.
- [ ] At least one compatibility evidence sample records provider-matrix execution results under `.workflow/evidence/`.

---

*This PRD will be fully expanded when it becomes the active PRD.*
