# Roadmap: Niko-Studio M20 — Cloud Sync + Code Signing

## Overview

M20 完成最后两项基础设施：云同步数据层（工作区数据跨设备同步）和 Code signing 构建 pipeline 配置（Windows 代码签名集成到 Tauri 构建流程）。

## Phases

- [ ] **Phase 1: Cloud Sync Layer + Code Signing Pipeline** — 数据同步核心 + 签名构建配置

## Phase Details

### Phase 1: Cloud Sync Layer + Code Signing Pipeline
**Goal**: 实现云同步数据层（存储抽象、冲突解决、同步引擎）和 Code signing 构建配置（Tauri bundle signing、CI 集成脚本）。
**Depends on**: M19 (completed)

**Requirements**:
- REQ-001: 存储抽象层 — 统一 local/remote 存储接口
- REQ-002: 同步引擎 — 增量同步、冲突检测与解决
- REQ-003: 同步 API 端点 — MCP 同步接口
- REQ-004: Code Signing 配置 — Tauri bundle signing 配置 + CI 脚本

**Success Criteria** (what must be TRUE):
1. StorageAdapter 接口支持 local/remote 两种实现
2. SyncEngine 可检测数据变更、执行增量同步、解决冲突
3. MCP 同步端点支持 push/pull/status 操作
4. Tauri bundle 配置了 code signing 参数（env-driven），可 CI 构建

## Scope Decisions

- **In scope**:
  - StorageAdapter 抽象 + localStorage/fileSystem 实现
  - SyncEngine（增量 diff + last-write-wins 冲突解决）
  - MCP 同步端点（push/pull/status）
  - Code signing Tauri 配置 + PowerShell 签名脚本
  - 测试覆盖

- **Deferred**:
  - 实际云存储后端（S3/WebDAV）实现
  - 用户认证系统
  - 多用户协作
  - 自动更新签名验证

- **Out of scope**:
  - 移动端适配
  - 离线队列持久化

## Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| 1. Cloud Sync Layer + Code Signing Pipeline | Not started | - |
