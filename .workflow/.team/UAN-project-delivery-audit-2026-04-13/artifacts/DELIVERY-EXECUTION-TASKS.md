# Delivery Execution Tasks

## Purpose

将当前审查结论转成可直接执行的修复任务，目标是把仓库从“候选交付 / demo-ready”推进到“正式客户可签收”。

## Task DLV-001

- Title:
  修复 `Evaluation quality-check` 的前后端接口失配
- Priority:
  `P0`
- Why:
  当前客户可见按钮很可能会打到失效接口。
- Primary files:
  [desktop/src/api/evaluation.ts](D:/工作目录/niko-studio/desktop/src/api/evaluation.ts)
  [desktop/src/hooks/useEvaluationQualityCheck.ts](D:/工作目录/niko-studio/desktop/src/hooks/useEvaluationQualityCheck.ts)
  [desktop/src/components/EvaluationPanel.tsx](D:/工作目录/niko-studio/desktop/src/components/EvaluationPanel.tsx)
  [desktop/src/api/client.test.ts](D:/工作目录/niko-studio/desktop/src/api/client.test.ts)
  [desktop/src/components/EvaluationPanel.test.tsx](D:/工作目录/niko-studio/desktop/src/components/EvaluationPanel.test.tsx)
  [src-ts/mcp/routes/content.ts](D:/工作目录/niko-studio/src-ts/mcp/routes/content.ts)
- Likely change:
  把前端调用统一到真实受支持路径。
  如果后端需要兼容旧路径，则显式增加兼容路由并写清楚迁移意图。
  不要继续让测试只 mock 旧 client 调用而不校验真实 endpoint。
- Implementation notes:
  1. 先决定 authoritative path 是继续用 `/writing/quality`，还是补回 `/api/novel/quality-check` 的兼容入口。
  2. 调整 [desktop/src/api/evaluation.ts](D:/工作目录/niko-studio/desktop/src/api/evaluation.ts)。
  3. 更新 [desktop/src/api/client.test.ts](D:/工作目录/niko-studio/desktop/src/api/client.test.ts) 中对 fetch URL 的断言。
  4. 保留 [desktop/src/components/EvaluationPanel.test.tsx](D:/工作目录/niko-studio/desktop/src/components/EvaluationPanel.test.tsx) 的 UI 行为断言，同时补一条“真实 endpoint 被调用”的测试。
- Verification commands:
  ```powershell
  npm --prefix desktop run test -- src/api/client.test.ts src/components/EvaluationPanel.test.tsx
  npm --prefix src-ts exec -- vitest run tests/gateway-server.routes.test.ts --reporter=default
  ```
- Done when:
  UI 按钮触发的请求和 gateway 已注册路由一致，且测试能在不依赖错误 mock 的情况下证明这一点。

## Task DLV-002

- Title:
  给 `checkpoint create/list/restore` 补齐 authority，或在客户版隐藏恢复入口
- Priority:
  `P0`
- Why:
  当前 seam 不是主 workflow 全局失配，而是恢复面单独落后；如果客户可见，就不该原样带出。
- Primary files:
  [desktop/src/api/workflow/checkpoints.ts](D:/工作目录/niko-studio/desktop/src/api/workflow/checkpoints.ts)
  [desktop/src/hooks/useAppCheckpointMenu.ts](D:/工作目录/niko-studio/desktop/src/hooks/useAppCheckpointMenu.ts)
  [desktop/src/hooks/useEvaluationCheckpoints.ts](D:/工作目录/niko-studio/desktop/src/hooks/useEvaluationCheckpoints.ts)
  [desktop/src/hooks/useChatRecovery.ts](D:/工作目录/niko-studio/desktop/src/hooks/useChatRecovery.ts)
  [src-ts/mcp/endpoints/workflow.ts](D:/工作目录/niko-studio/src-ts/mcp/endpoints/workflow.ts)
  [src-ts/mcp/services/workflow.ts](D:/工作目录/niko-studio/src-ts/mcp/services/workflow.ts)
  [src-ts/mcp/workflow-service.workspace.test.ts](D:/工作目录/niko-studio/src-ts/mcp/workflow-service.workspace.test.ts)
  [src-ts/tests/mcp/workflow-endpoints.integration.test.ts](D:/工作目录/niko-studio/src-ts/tests/mcp/workflow-endpoints.integration.test.ts)
- Decision first:
  先定策略，再写代码。
  策略 A：客户版保留恢复功能，那就必须补 authority。
  策略 B：客户版不保留恢复功能，那就把 UI 入口和 API 触发面在客户 profile 下关掉。
- Implementation notes:
  1. 对照 `quickRollbackWorkflow` 已经怎么传 workspace，再统一 `createCheckpoint`、`restoreCheckpoint`、`listCheckpoints` 的 payload/authority 模型。
  2. 如果走隐藏策略，增加 release-profile gating，不只是在样式层隐藏按钮。
  3. 在 backend test 里明确覆盖 checkpoint list/create/restore 的 authority 行为。
- Verification commands:
  ```powershell
  npm --prefix src-ts exec -- vitest run tests/mcp/workflow-endpoints.integration.test.ts mcp/workflow-service.workspace.test.ts --reporter=default
  python scripts/check_authority_alignment.py
  npm --prefix desktop run test -- src/api/client.test.ts src/hooks/writerWorkflowExperience.test.tsx
  ```
- Done when:
  客户构建里不存在未受控的 checkpoint 恢复面。

## Task DLV-003

- Title:
  补全正式签收证据包
- Priority:
  `P0`
- Why:
  当前 release 绿灯不能替代 formal sign-off 留存。
- Primary files:
  [docs/release/SIGN_OFF.md](D:/工作目录/niko-studio/docs/release/SIGN_OFF.md)
  [scripts/release_check_summary.py](D:/工作目录/niko-studio/scripts/release_check_summary.py)
  [release-check-summary.md](D:/工作目录/niko-studio/release-check-summary.md)
  [release-readiness-artifact.json](D:/工作目录/niko-studio/.workflow/evidence/release/release-readiness-artifact.json)
  [2026-04-13-package-readme.md](D:/工作目录/niko-studio/.workflow/evidence/release/2026-04-13-package-readme.md)
  [2026-04-13-delivery-manifest.md](D:/工作目录/niko-studio/.workflow/evidence/release/2026-04-13-delivery-manifest.md)
- Implementation notes:
  1. 明确缺的是“工件没生成”还是“工件生成了但没进 manifest”。
  2. 如果 `SIGN_OFF.md` 过时，就同步修订标准；不要让代码状态和签收文档长期分叉。
  3. 把 authority/XML/JUnit 等最终要求写进 manifest，而不是只存在口头流程里。
- Verification commands:
  ```powershell
  python scripts/release_check_summary.py
  python scripts/delivery_gate.py
  python scripts/check_authority_alignment.py
  ```
- Done when:
  按 [docs/release/SIGN_OFF.md](D:/工作目录/niko-studio/docs/release/SIGN_OFF.md) 逐项核对时，不再需要解释“这个证据在仓库外”。

## Task DLV-004

- Title:
  解决 `uiBridge` 配置来源漂移
- Priority:
  `P1`
- Why:
  这是“可选但可能不可用”的典型客户困惑源。
- Primary files:
  [desktop/src/components/SettingsModal.tsx](D:/工作目录/niko-studio/desktop/src/components/SettingsModal.tsx)
  [desktop/src/api/config.ts](D:/工作目录/niko-studio/desktop/src/api/config.ts)
  [src-ts/container/gateway-control-plane.ts](D:/工作目录/niko-studio/src-ts/container/gateway-control-plane.ts)
  [desktop/src/components/SettingsModal.test.tsx](D:/工作目录/niko-studio/desktop/src/components/SettingsModal.test.tsx)
  [src-ts/tests/mcp/config-endpoints.test.ts](D:/工作目录/niko-studio/src-ts/tests/mcp/config-endpoints.test.ts)
- Decision first:
  `uiBridge` 是不是客户支持功能。
- Implementation notes:
  1. 如果支持，就让 config/save/reload 真正驱动 runtime。
  2. 如果不支持，就从客户版设置和文档里去掉，不要只在 backend 留一个 env 开关。
  3. 测试要证明“UI 显示、配置存储、runtime 行为”三者一致。
- Verification commands:
  ```powershell
  npm --prefix desktop run test -- src/components/SettingsModal.test.tsx src/api/client.test.ts
  npm --prefix src-ts exec -- vitest run tests/mcp/config-endpoints.test.ts --reporter=default
  ```
- Done when:
  客户不会再碰到一个看得见、改得动、但实际不生效的 transport 模式。

## Task DLV-005

- Title:
  按客户 release profile 跑一次端到端验收
- Priority:
  `P2`
- Why:
  当前大多是源码和测试证据，最后还缺一份“按客户交付形态实际跑过”的验收证明。
- Scope:
  `Evaluation`
  `workflow execute/lifecycle`
  `settings config`
  `MCP status`
  `checkpoint/recovery` 暴露面
- Suggested outputs:
  一份验收记录
  一份最终 manifest 更新
  一次新的 GO / NO_GO 结论
- Verification commands:
  ```powershell
  python scripts/delivery_gate.py
  python scripts/check_authority_alignment.py
  npm --prefix src-ts run check:local
  npm --prefix desktop run check:local
  ```
- Done when:
  客户支持范围内的每一条可见路径，都能被明确标记成“正常工作 / 已隐藏 / 不在范围”。

## Suggested Sequence

1. 先做 `DLV-001`
2. 再做 `DLV-002`
3. 接着做 `DLV-003`
4. 然后做 `DLV-004`
5. 最后做 `DLV-005`

## Practical Rule

- `DLV-001`、`DLV-002`、`DLV-003` 不闭合，不建议重新给正式交付 GO。
- `DLV-004` 取决于客户范围定义，但不要带着漂移状态出货。
- `DLV-005` 是最后的放行前复核，不是替代前面修复的捷径。
