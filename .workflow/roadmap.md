# Roadmap: Niko-Studio M19 — UX Polish + Plugin Architecture

## Overview

M13-M18 构建了完整的写作智能系统。M19 收尾 UX 闭环（PDF 导出、自定义模板）并引入 Plugin 架构让用户扩展分析能力。

## Phases

- [ ] **Phase 1: PDF Export + Custom Templates + Plugin Architecture** — 三个独立方向并行，完善产品闭环

## Phase Details

### Phase 1: PDF Export + Custom Templates + Plugin Architecture
**Goal**: PDF 报告导出、用户自定义分析模板、Plugin 扩展架构。
**Depends on**: M18 (completed)

**Requirements**:
- REQ-001: PDF 报告导出 — 在 Markdown 导出基础上增加 PDF 渲染
- REQ-002: 自定义分析模板 — 用户选择检测维度组合、自定义权重、保存/加载模板
- REQ-003: Plugin 架构 — 用户创建自定义分析技能，注册到分析引擎

**Success Criteria** (what must be TRUE):
1. 一键导出 PDF 格式的完整分析报告，包含分数图表
2. 用户可创建/保存/加载分析模板，选择维度 + 自定义权重
3. Plugin 系统支持用户注册自定义检测函数，并在 Dashboard 中显示结果
4. 所有新功能有测试覆盖

## Scope Decisions

- **In scope**:
  - PDF 导出（使用浏览器原生打印或 jsPDF）
  - 分析模板 CRUD（创建、保存、加载、删除）
  - Plugin 注册接口 + 生命周期 + 示例 Plugin
  - Plugin 管理面板

- **Deferred**:
  - Plugin 市场/分享
  - 云端模板同步
  - Plugin 沙箱安全隔离

- **Out of scope**:
  - 云同步 / 多设备
  - Code signing

## Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| 1. PDF Export + Custom Templates + Plugin Architecture | Not started | - |
