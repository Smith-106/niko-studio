# Discussion: 修复剩余风险与建议

## Session Metadata
- **Session**: maestro-20260619-184051
- **Topic**: 修复四、剩余风险与建议
- **Mode**: quick (-q)
- **Date**: 2026-06-19
- **Artifact**: ANL-20260619-fix-remaining-risks

## User Intent
1. 修复 desktop/src-ts 低/中危依赖漏洞。
2. 清理源码 TODO / 控制台输出。
3. 整理工作树并分块提交。
4. 补充部署/回滚/监控文档或确认 CI 覆盖。

## Interview Decisions
见 `context.md` 中 Decisions 与 Constraints 部分。

## Current Understanding
本次会话范围为 M26 交付前的收尾风险修复，不引入新功能或大规模重构。四类风险已分别锁定决策：依赖漏洞优先自动可修复项；TODO/console 必须实现/删除/转 issue；工作树分块提交；文档补充最小可运行手册或引用现有脚本。

## Intent Coverage Matrix
| # | Original Intent | Status | Where Addressed |
|---|----------------|--------|-----------------|
| 1 | 修复低/中危依赖漏洞 | ✅ Addressed | Decision 1, Locked constraints |
| 2 | 清理 TODO / 控制台输出 | ✅ Addressed | Decision 2, Locked constraints |
| 3 | 整理工作树并分块提交 | ✅ Addressed | Decision 3, Locked/Free constraints |
| 4 | 补充部署/回滚/监控文档 | ✅ Addressed | Decision 4, Locked/Free constraints |

## Next Step
进入 `maestro-plan --dir .workflow/scratch/20260619-analyze-fix-remaining-risks` 制定执行计划。
