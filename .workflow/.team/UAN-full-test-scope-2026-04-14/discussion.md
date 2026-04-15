# UAN Full Test Scope

Topic: 当前 niko-studio 需要全量测试吗

## Timeline
- 2026-04-14: Session created for quick decision analysis.

## Conclusions
### Summary
结论是条件性否定。对 2026-04-14 当前仓库状态的例行本地开发，不需要立刻跑一次全量回归；但如果要基于 2026-04-14 当前 HEAD 做正式 release、handoff 或 sign-off，则必须重新执行 L4 级别发布验证。关键原因是最新 GO 证据停留在 2026-04-13，之后已有 7 个提交，且 Windows packaging gate 的 CI 语义在 2026-04-14 发生了条件分支变化。

### Key Conclusions
- 例行开发不需要立即全量测试，当前更适合继续使用 L1/L2 分层检查。
- 当前 HEAD 若用于 release/handoff，不能直接复用 2026-04-13 的 GO 结果，必须重建 exact-head 证据。
- 当前新增风险主要是 release/CI packaging semantics，而不是广泛 runtime churn。
- launcher 与治理脚本改动具备定向回归与 self-test 支撑，本身不足以单独触发整仓回归。

### Recommendations
- 日常开发继续按 L1/L2 执行，不额外触发 blanket full regression。
- 当前 HEAD 做 release/handoff 前，重跑 L4：authority alignment、delivery gate、governance pytest、两个 `check:local`、`validate:package:dry-run`、`release_check_summary.py`。
- 额外补做 packaging prerequisite conditional branch 的定向验证，最好在干净 checkout 上完成。
- 若后续变更扩展到 runtime、workflow endpoint、desktop state 或 build path，直接升级到 L3/L4。

### Remaining Questions
- 是否要在下次 sign-off 前显式验证“缺少 compatibility artifact 的干净 checkout”这条分支？
- 是否计划直接从 2026-04-14 当前 HEAD 做 Windows package 或外部交付？

## Decision Trail
- Round 1: 保留 2026-04-13 GO 证据作为近端基线，但不把它当作当前 HEAD 的精确放行证明。
- Round 2: 明确区分例行开发判断与 release/handoff 判断，避免混淆。
- Round 3: 将 packaging gate conditional branch 认定为当前最需要补证据的风险点。

## Current Understanding (Final)
当前仓库不需要因为“今天又有新提交”就机械地重跑一次全量测试。真正需要立即升级到全量发布验证的触发器，是要对 2026-04-14 当前 HEAD 做正式放行，而不是继续本地开发。现阶段最该补的不是广谱 runtime regression，而是 release automation 尤其是 Windows packaging 条件分支的 exact-head 证据。

## Session Statistics
- Explorations: 2
- Analyses: 1
- Discussions: 0
- Synthesis strategy: simple
