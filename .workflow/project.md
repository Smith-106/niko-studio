# Project: niko-studio

## Context

M28（Architecture Hardening + UI Completion + Test Coverage）已于 2026-06-24 完成并通过集成审计（PASS）。该里程碑聚焦四大支柱：

1. **Reader 端点拆分与输入校验收口**：将 1146 行的 reader-endpoints.ts god module 拆分为 reader-types / reader-services / reader-validation / reader-routes 四个子模块，保留 reader-endpoints.ts 作为兼容性 shim；补齐 SEC-001 剩余字段（personaId、feedbackId、dimension、focusAreas、biases、targetStyle、version label 等）的长度与类型校验，并新增 validateStringArray / validateEnum 通用校验函数。
2. **架构解耦**：
   - 将 MCP gateway-bootstrap 的启动依赖从 container 层迁移到 composition-root 层，消除 container↔MCP 静态依赖。
   - 在 container/types.ts 引入 IWorkflowEventRelay 接口，adapters.ts 通过动态 require 构造 WorkflowEventRelay，实现接口与实现分离。
   - 将 GatewayDeps 从单一大接口拆分为 6 个角色接口（IHealthEngineAccess / IServiceRegistryAccess / IRuntimeStateAccess / IObservabilityAccess / IConfigAccess / IGatewayMetadata），并保留 GatewayDeps 类型别名确保向后兼容。
   - 提取 craft-types.ts 打破 craft-catalog ↔ catalog-loader 的循环依赖；将 craft-catalog 的 18 个 eager const 导出转为 lazy getter 函数，消费者按需调用。
3. **UI 组件完成度**：
   - 实现 VoiceConsistencyDecorations 与 VoiceConsistencyMark，为 NikoEditor 提供 voice consistency 警告的波浪下划线可视化及 toggle 控制。
   - 扩展 TemplateCategory 联合类型，新增 plot 分类；实现 PlotTemplateService 与 TemplateService 合并逻辑；TemplateManagerPanel / TemplateBrowserPanel 支持 plot 模板筛选与应用；DocumentEditor 通过 template:apply CustomEvent 消费并插入模板内容。
   - 为 DocumentEditor 添加 beforeunload 与 Tauri onCloseRequested dirty check 保护，保存后自动清除 dirty 状态。
4. **MCP endpoints 测试覆盖率补完**：新增 agents/m10/m11/content 路由契约测试与 all-tools listTools 响应契约测试，实现 coverage-gap-scanner 脚本，确认 7 个 route modules / 132 条 handlers 全部覆盖。

集成审计发现 3 个 LOW 级别 near-miss（P2 直接导入 P1 reader-routes、P4 硬编码 route count 66、P2 GatewayDeps 角色接口尚未迁移收窄）和 1 个 INFO 级既有边界（P3→P1 通过 writing-craft API 的间接依赖），无 HIGH/MEDIUM 缺口。
