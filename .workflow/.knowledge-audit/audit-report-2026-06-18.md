# Knowledge Audit Report — 2026-06-18

## Scope
- Scope: all
- Filters: none

## Detection Summary
- Total findings: 18
- By priority: P0 0, P1 3, P2 15
- By store: spec 0, knowhow 0, artifact 18

## Findings

| ID | Store | Category | Priority | Target | Evidence | Recommended Action |
|---|---|---|---|---|---|---|
| AUD-3a998dd4 | artifact | F-T1-stale-harvested | P1 | BRN-20260515-novel-quality-reader-experience | 已完成 33 天、已 harvest、非当前 milestone | delete |
| AUD-5b466721 | artifact | F-T1-stale-harvested | P1 | RMAP-20260515-novel-quality-reader-experience | 已完成 33 天、已 harvest、非当前 milestone | delete |
| AUD-3235c2a7 | artifact | F-T1-stale-harvested | P1 | RMAP-20260517-m24-tech-debt-narrative-viz | 已完成 31 天、已 harvest、非当前 milestone | delete |
| AUD-4ff9904c | artifact | F-T4-orphan-directory | P2 | scratch/20260614-debug-consistency-gaps | 磁盘目录存在但 state.json artifacts[] 中无对应条目 | delete |
| AUD-7d390001 | artifact | F-T4-orphan-directory | P2 | scratch/20260614-debug-interface-gaps | 磁盘目录存在但 state.json artifacts[] 中无对应条目 | delete |
| AUD-65db88ad | artifact | F-T4-orphan-directory | P2 | scratch/20260614-plan-consistency-fix | 磁盘目录存在但 state.json artifacts[] 中无对应条目 | delete |
| AUD-cd6ee9aa | artifact | F-T4-orphan-directory | P2 | scratch/20260614-plan-interface-gaps | 磁盘目录存在但 state.json artifacts[] 中无对应条目 | delete |
| AUD-61109f92 | artifact | F-T4-orphan-directory | P2 | scratch/20260614-review-consistency | 磁盘目录存在但 state.json artifacts[] 中无对应条目 | delete |
| AUD-7397b3bf | artifact | F-T4-orphan-directory | P2 | scratch/20260614-review-frontend-backend-interface | 磁盘目录存在但 state.json artifacts[] 中无对应条目 | delete |
| AUD-42d176a0 | artifact | F-T4-orphan-directory | P2 | scratch/20260614-review-stability | 磁盘目录存在但 state.json artifacts[] 中无对应条目 | delete |
| AUD-20745822 | artifact | F-T4-orphan-directory | P2 | scratch/20260614-test-security-regression | 磁盘目录存在但 state.json artifacts[] 中无对应条目 | delete |
| AUD-2905f497 | artifact | F-T4-orphan-directory | P2 | scratch/20260615-review-stability | 磁盘目录存在但 state.json artifacts[] 中无对应条目 | delete |
| AUD-d50479b8 | artifact | F-T4-orphan-directory | P2 | .maestro/maestro-20260614-143000 | 磁盘目录存在但 state.json artifacts[] 中无对应条目 | delete |
| AUD-d0fa8059 | artifact | F-T4-orphan-directory | P2 | .maestro/maestro-20260614-173000 | 磁盘目录存在但 state.json artifacts[] 中无对应条目 | delete |
| AUD-a0df8349 | artifact | F-T4-orphan-directory | P2 | .maestro/maestro-20260614-181500 | 磁盘目录存在但 state.json artifacts[] 中无对应条目 | delete |
| AUD-623e0a23 | artifact | F-T4-orphan-directory | P2 | .maestro/maestro-20260615-201500 | 磁盘目录存在但 state.json artifacts[] 中无对应条目 | delete |
| AUD-14dd21ac | artifact | F-T4-orphan-directory | P2 | .maestro/maestro-20260616-131128 | 磁盘目录存在但 state.json artifacts[] 中无对应条目 | delete |
| AUD-dfeb7351 | artifact | F-T4-orphan-directory | P2 | .maestro/maestro-20260618-034959 | 磁盘目录存在但 state.json artifacts[] 中无对应条目 | delete |

## Actions Applied
_未执行任何变更。请在确认后使用 --mark / --delete / --purge 或手动处理。_

## Backup
_无变更，未生成备份。_

## Next Steps
- 应用决策：/manage-knowledge-audit --scope all（带 --mark / --delete / --purge）
- 抢救未抽取 artifact：/manage-harvest <artifact-id>
- 验证 spec 现状：/spec-load --role implement
