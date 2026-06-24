---
related:
  - project-project
---

# Roadmap: M28 — Architecture Hardening + UI Completion + Test Coverage

## Overview

M28 延续 M27 的安全与集成成果，聚焦四大支柱：
1. Reader 端点拆分与剩余输入校验收口
2. 架构解耦（Container/MCP、GatewayDeps ISP、craft-catalog 循环依赖）
3. UI 组件完成度（VoiceConsistencyDecorations、TemplateManagerPanel、Ctrl+S/dirty check）
4. MCP endpoints 测试覆盖率补完

## Phases

### Phase 1: Reader Endpoints Split + Remaining Input Validation
- **Goal**: 将 reader-endpoints.ts 1146 行 god module 拆分为 4 个功能组；补齐 SEC-001 剩余字段（personaId, dimension, focusAreas[], biases[], targetStyle, personaIds[]）的长度/类型校验。
- **Depends on**: M27 Phase 2
- **Requirements**: ISS-20260621-013, ISS-20260622-001..003

### Phase 2: Architecture Decoupling
- **Goal**: 解决 Container↔MCP 双向依赖、GatewayDeps 胖接口拆分、craft-catalog ↔ catalog-loader 循环依赖。
- **Depends on**: Phase 1

### Phase 3: UI Component Completion
- **Goal**: 实现 VoiceConsistencyDecorations、连接 TemplateManagerPanel 到 PlotTemplateService、为 NikoEditor 添加 Ctrl+S 和 dirty check。
- **Depends on**: Phase 2

### Phase 4: MCP Endpoint Test Coverage
- **Goal**: 为 30% 无测试覆盖的 MCP endpoints 补 unit/integration 测试，建立 endpoint contract tests。
- **Depends on**: Phase 3

## Deferred
- buildPersonalizedCraftProfile MCP endpoint 升级（ISS-20260622-011）
- workspace.ts 桥接模式重构（ISS-20260622-012）

## Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| 1. Reader Endpoints Split + Validation | Completed | 2026-06-24 |
| 2. Architecture Decoupling | Completed | 2026-06-24 |
| 3. UI Component Completion | Completed | 2026-06-24 |
| 4. MCP Test Coverage | Completed | 2026-06-24 |
