# Ultra Analyze Report

**Session**: `uan-project-status-20260407`  
**Topic**: 项目现状分析  
**Completed**: 2026-04-07  
**Pipeline**: standard (inline fallback after subagent rate limits)

## Summary

- 当前权威交付面是 `desktop + src-ts`，不是旧的 Web/Streamlit 路径。
- 本地发布检查在 2026-04-07 生成 `GO` 结论，所有阻断项为 `PASS`。
- 当前主要风险不在主链路不可用，而在迁移收口后的双运行时复杂度、历史文档干扰、以及部分 CI 仍保留 soft gate。

## Technical State

- Desktop 前端采用壳层汇流架构：`App.tsx` 只装配 `Sidebar`、`AppMainContent`、`ChatSidebar`、`AppRightPanels`，具体启动和运行态逻辑下沉到 hooks。
- `useAppStartup()` 串联主题与后端引导；`useAppBackendBootstrap()` 在 Tauri 环境下把设置同步给 Rust，然后调用 `start_backend`。
- Rust 宿主负责解析 gateway base、健康检查与 API 代理；React 层不直接管理进程。
- Node gateway 聚合了 health/config/chat/memory/graph/agent/critic/skills/workflow/writing/mcp-admin 等端点组，说明当前后端边界已经以 TypeScript 网关为中心。
- 当前桌面可见功能面包含：知识库、设置、评估、MCP 状态、写作助手、文本优化、正文编辑、聊天侧栏。

## Delivery State

- `release-check-summary.md` 和 `release-readiness-artifact.json` 给出 `Decision: GO`。
- 阻断项包括版本一致性、交付语义门禁、TypeScript Phase 4 覆盖率基线、desktop check、sidecar readiness、external smoke、production guard、metrics guard，均为 `PASS`。
- 集成测试工作流同时覆盖 `src-ts` 与 `desktop`，并对 workflow route/plan/execute、critic、gateway runtime guard、selected desktop contracts 做验证。
- Codecov 当前不是 strict 模式；`token_present=false` 时采取降级策略，因此它更像质量信号而不是当前阻断项。

## Migration and Debt

- 仓库已经明确把 Node/TypeScript 定义为默认运行时和主要打包路径。
- Python 仍被保留为显式兼容 fallback，`scripts/start_gateway.py` 与 `desktop/scripts/choose_sidecar.cjs` 都体现了这一点。
- `src-ts/web/app.ts` 默认对根路由返回 `410`，只在显式配置可信转发 URL 时 `302`，说明旧 Web UI 已被降级为受限兼容层。
- 文档中存在大量历史规划、迁移说明和旧资产说明；仓库已开始通过 README 和 release notes 标注哪些是历史、哪些是权威，但认知噪音仍然较高。

## Current Assessment

项目当前不是“还在搭骨架”，而是“主运行链路已经打通并具备发布证据”的状态。更准确地说，它已经进入迁移收口后的治理阶段：需要持续减少双轨复杂度、把 soft gate 逐步升级为更稳定的强约束，并继续压缩历史资产对团队认知的干扰。

## Recommended Next Moves

1. 把仍处于观察期的 sidecar/runtime 相关 soft gate 设定一个升级时间点，逐步转为 hard gate。
2. 继续缩减 Python fallback 的权威范围，只保留确实需要的兼容入口。
3. 把“当前权威路径”和“历史参考文档”再做一次目录级分层，降低新成员误判成本。
