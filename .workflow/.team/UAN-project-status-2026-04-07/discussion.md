# UAN-project-status-2026-04-07

## Topic

项目现状分析

## Mode

standard (non-interactive)

## Timeline

- 2026-04-07: Session initialized by coordinator.

## Conclusions

### Summary

项目当前已经进入迁移收口后的可发布阶段。权威交付路径明确收敛为 `desktop + src-ts`，并由 Tauri/Rust 宿主承接运行时契约；2026-04-07 的发布治理与验证证据仍为绿色。主要风险已经从“能否交付”转向“是否完成内部收敛”，包括 gateway 内部 placeholder/adapter/兼容路径债务、本地质量基线弱于 CI 与 release gate、以及产品叙事宽于当前写作型桌面工作台的真实可见面。

### Key Conclusions

- `desktop + src-ts` 已成为当前唯一可信的权威运行时与主交付路径，Python/Web 主要保留为 compatibility 或 historical surface。
- 发布治理是实的而不是口号：版本一致性、delivery gate、authority alignment、TypeScript typecheck 与 release-readiness 证据在 2026-04-07 仍为绿色。
- 外层架构分层较清晰，真正的结构债务集中在 gateway 内部 placeholder/stub、adapter concretion 和兼容面保留。
- 日常本地工程质量基线弱于 CI/发布门禁，缺少 repo-wide lint/format，`desktop` 本地 `check` 不含测试，`pytest.ini` 仍反映旧 Python `src` 树假设。
- 当前真实产品是以写作为中心的单工作台 Desktop，广义“多域 AI Agent Platform”更像底座愿景而不是当前等价产品承诺。
- 最明显的用户面未收口点在知识库非技能项新增/详情交互，以及 Story Bible 的持久化与数据边界。

### Recommendations

1. 收敛顶层产品口径，把当前主产品明确定义为写作优先的 Desktop 工作台，本地 Gateway 和平台能力作为底座或后续扩展来表述。
2. 继续压缩兼容包袱：Node/TypeScript 保持唯一自动 sidecar，Python 改为显式 opt-in，并给 Web forwarding 和其他历史 compatibility surface 制定退役清单。
3. 清理 `src-ts` 中的 placeholder/stub 服务注册，要求每条能力边界要么是真实现，要么是显式 unsupported。
4. 建立仓库级本地质量基线，包括 lint/format、一个更贴近发布关键路径的统一本地检查命令，以及对遗留 `pytest.ini` 的重整或退役。
5. 拆分 `desktop/src/api/client.ts` 并为 Tauri commands / gateway payloads 补共享契约定义。
6. 收口或禁用知识库角色/地点/情节的未完成交互。
7. 为 Story Bible 明确持久化策略，并把 local-only 或项目级存储边界写清楚。
8. 文档化目标部署/安全基线，包括 Tauri CSP 和可重复打包策略。

### Remaining Questions

- README 中哪些“多域平台”表述是近期产品承诺，哪些只是底座愿景？
- 哪些 Python/Web compatibility surface 仍有真实依赖，哪些已经可以退役？
- 知识库非技能项的新增/详情入口是未完成开发还是刻意占位？
- Story Bible 的 localStorage 数据是否已经被备份、导入导出或恢复机制覆盖？
- 当前缺失的 lint/format、Tauri CSP 与可重复部署基线，是否应该升级为正式发布阻塞项？

## Decision Trail

- 2026-04-07T00:00:00+08:00: 使用标准多视角分析流程，不进入交互式讨论轮，因为本次需求是一次性项目现状评估。

## Current Understanding (Final)

项目不是“等待定型”的迁移中样品，而是已经具备发布条件的写作型桌面工作台。接下来的核心工作应从功能扩张转向 authority 收窄、兼容债务压缩、本地质量基线补齐，以及用户可见未收口交互的关闭。

## Session Statistics

- Explorations: 3
- Analyses: 3
- Discussions: 0
- Strategy: standard
