# Milestone Summary: M28

## 目标

Architecture Hardening + UI Completion + Test Coverage：
1. Reader 端点拆分与剩余输入校验收口
2. Container/MCP 架构解耦
3. UI 组件完成度
4. MCP endpoints 测试覆盖率补完

## 时间

- 开始：2026-06-22
- 完成：2026-06-24
- 审计：2026-06-24，verdict PASS

## 交付物

### Phase 1 — Reader Endpoints Split + Validation
- `src-ts/mcp/input-validation.ts`：新增 MAX_* 常量与 `validateStringArray` / `validateEnum`
- `src-ts/reader/mcp/reader-types.ts`、`reader-services.ts`、`reader-validation.ts`、`reader-routes.ts`
- `src-ts/reader/mcp/reader-endpoints.ts`：兼容性 shim（含 TODO ISS-20260621-013）
- 新增 custom persona store ready guard 与回归测试

### Phase 2 — Architecture Decoupling
- `src-ts/mcp/gateway-bootstrap.ts` import 路径迁移到 composition-root
- `src-ts/container/types.ts`：`IWorkflowEventRelay` 接口
- `src-ts/container/adapters.ts`：动态 require 构造 WorkflowEventRelay
- `src-ts/mcp/endpoints/health.ts`：GatewayDeps 拆分为 6 角色接口 + 兼容别名
- `src-ts/narrative/writing-craft/craft-types.ts`：独立类型层
- `src-ts/narrative/writing-craft/craft-catalog.ts`：18 const → 18 lazy getter

### Phase 3 — UI Component Completion
- `VoiceConsistencyMark.ts` + `VoiceConsistencyDecorations.tsx`
- `NikoEditor.tsx` 注册 mark 与 toggle
- `plotTemplateService.ts` + TemplateCategory `'plot'` 扩展
- `TemplateManagerPanel` / `TemplateBrowserPanel` 支持 plot
- `DocumentEditor.tsx` 消费 `template:apply` 事件与 dirty check（beforeunload + Tauri onCloseRequested）

### Phase 4 — MCP Endpoint Test Coverage
- `tests/mcp/routes/agents-routes.test.ts`
- `tests/mcp/routes/m10-routes.test.ts`
- `tests/mcp/routes/m11-routes.test.ts`
- `tests/mcp/routes/content-routes-additional.test.ts`
- `tests/mcp/all-tools.test.ts`（扩展 listTools 契约测试）
- `src-ts/scripts/coverage-gap-scanner.ts` + `package.json` `coverage:gap` script

## 审计结果

- **Status**: PASS
- **Gaps**: 0 high/medium，3 low near-misses
  1. P2 MCP endpoints/index.ts 直接 import P1 reader-routes（建议走 P1 barrel）
  2. P4 content-routes-additional.test.ts 硬编码 route count 66
  3. P2 GatewayDeps 角色接口尚未被消费者收窄

## 归档

- 计划目录：`.workflow/milestones/M28/artifacts/20260624-plan-P{1-4}-*`
- 审计报告：`.workflow/milestones/M28/audit-report.md`
- 路线图快照：`.workflow/milestones/M28/roadmap-snapshot.md`
- 学习记录：已追加到 `.workflow/specs/learnings.md`

## 后续建议

1. 创建 tracking issue 逐步将 GatewayDeps 消费者迁移到窄角色接口。
2. 未来新增 reader routes 时同步更新 P4 的 route count 断言或改为动态推导。
3. 按 TODO ISS-20260621-013 在适当时机移除 reader-endpoints.ts shim。
4. 当前无后续里程碑；项目进入 completed 状态。
