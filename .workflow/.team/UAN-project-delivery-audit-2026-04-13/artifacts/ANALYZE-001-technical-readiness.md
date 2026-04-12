# ANALYZE-001 Technical Readiness

## Verdict Tendency

- Tendency: `conditional_no_go_for_confident_customer_handoff`
- Customer build candidate: `true`
- Experience completeness: `mostly_complete`
- Formal handoff package complete: `false`
- Confidence: `medium_high`

当前仓库已经处于 late-stage，standard workflow 主链、桌面壳层、Tauri 打包 dry-run、authority alignment 和 release snapshot 都表明它不是“还在搭骨架”的状态，而是一个可运行、可演示、可作为客户候选构建的产品面。问题在于，它还不够干净，无法让我给出一个无保留的“现在就可自信交付客户”判断。

## Shipping Blocker

- `EvaluationPanel` 暴露的 novel quality check 很可能在真实运行时失效。
  - 前端请求：`desktop/src/api/evaluation.ts` -> `/api/novel/quality-check`
  - 后端注册：`src-ts/mcp/routes/content.ts` -> `/writing/quality`
  - 仓库内未发现兼容别名或 rewrite。
  - 现有前端测试没有发现它，是因为 `client.test.ts` 和 `EvaluationPanel.test.tsx` 都在 mock API，并且还把旧路径写成了通过条件。

如果 Evaluation 面板属于客户承诺范围，这一点就是正式 handoff 的 blocker。只有在以下任一条件满足时，我才会把 verdict 拉回 GO：

- 修复前端到 `/writing/quality`
- 后端补兼容别名
- 交付版本里隐藏/禁用该动作并明确降 scope

## Process Caveats

- `SIGN_OFF.md` 要求保留的 `authority-alignment.json`、`vitest-production-guard*.xml`、`vitest-e2e*.xml`、`governance-scripts.junit.xml` 没有在当前 checkout 中留存。
- `uiBridge` 虽然在设置和 config 面都被暴露，但真正的 route enablement 仍由启动时环境变量控制；这会让客户看到一个看似可切换、实则不一定生效的模式。

这些问题不代表主产品不可运行，但会削弱正式客户 handoff 的可信度和可审计性。

## Acceptable Residual Risks

- checkpoint `create/list/restore` 还没纳入与 execute/lifecycle/rollback 相同的 workspace authority 约束，属于有界设计债，不是当前默认路径 blocker。
- packaged desktop 仍依赖文档中已声明的 Python compatibility sidecar，但这条边界已被 release docs 和 packaging dry-run 明确化。

## Evidence Highlights

- `release-check-summary.md` 仍为 `Decision: GO`
- `.workflow/evidence/release/release-readiness-artifact.json` 仍为 `decision=GO`
- 本次复核重新跑通：
  - `npm --prefix src-ts exec -- vitest run tests/gateway-server.routes.test.ts tests/mcp/workflow-endpoints.integration.test.ts --reporter=default`
  - `npm --prefix desktop run test -- src/api/client.test.ts src/components/EvaluationPanel.test.tsx`
- `git status --short` 只有本次审计 session 目录新增

## Recommendation

技术上最合理的下一步不是重新怀疑整个产品，而是尽快收掉一个高杠杆缺口：

1. 先修正 novel quality check 的真实路径，并加一条不依赖 mock 的契约测试。
2. 然后决定 `uiBridge` 是要真正支持，还是在客户版本中隐藏。
3. 最后补齐 `SIGN_OFF.md` 规定的证据保留，形成正式 handoff bundle。

在这三步里，只有第一步直接影响“能不能自信交付客户”的判断。
