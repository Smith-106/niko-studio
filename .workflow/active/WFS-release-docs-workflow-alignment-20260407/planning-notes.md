# Planning Notes

## User Intent

GOAL: 根据 `2026-04-07` 的项目进度报告，补齐一份可直接交给 `csv-wave-pipeline` 执行的剩余收尾计划。  
SCOPE: external release workflow, public release/status docs, workflow bookkeeping, evidence freshness/linkage, and final verification.  
CONTEXT: `WFS-core-migration-final-closure-20260407` / `cwp-core-migration-final-closure-20260407` 已完成核心迁移闭环；本会话只处理闭环之后仍未对齐的高可见面。

## Context Findings (Phase 2)

- `project-progress-analysis-2026-04-07.md` 判断主产品路径已经基本完成，但 external release、workflow bookkeeping、evidence freshness/linkage 仍未闭环。
- `.workflow/.csv-wave/cwp-core-migration-final-closure-20260407/context.md` 已记录 `Completed: 7`、`Failed: 0`、`Final Release Decision: GO`，说明旧的迁移闭环 CSV 已执行完毕。
- `.workflow/active/WFS-core-migration-final-closure-20260407/TODO_LIST.md` 仍是全未勾选状态，和同名 CSV 执行结果不一致。
- `.workflow/active/WFS-phase-4-data-layer-entry-20260404/workflow-session.json` 仍标记为 `active`，但该会话的 TODO 已全部完成。
- `.github/workflows/external-release-gate.yml` 仍引用 Python-era runtime and e2e assumptions。
- `docs/release/RELEASE_NOTES.md`、`README.md`、`docs/TASKS_V10_OPTIMIZED.md` 仍存在与当前 `desktop + src-ts` 权威面冲突的高可见口径。
- `release-check-summary.md` 仍有 `external_e2e_smoke = FAIL`（缺少 `tests/integration/test_e2e_workflow.py`）以及 freshness/linkage 相关 `WARN`。
- `scripts/release_check_summary.py` 的 freshness 信号依赖 `.workflow/evidence/{weekly,quality}` 的 14 天窗口，linkage 信号依赖 `.writing/sessions/active/*/.data/generation-snapshots/*.json`。

## Planning Decisions

- 不改写已经完成的 `cwp-core-migration-final-closure-20260407/tasks.csv`，而是为“报告暴露出的剩余对齐项”单独创建新会话。
- Wave 1 只放三类互不重叠的面：external CI、public docs、workflow bookkeeping，保证并行安全。
- evidence refresh 放在 Wave 2，确保它消费的是已更新后的 CI/docs/workflow 状态。
- final handoff 放到 Wave 3，只负责重新验证并沉淀新的权威闭环说明。

## Constraints

- 核心迁移闭环 `GO` 结论必须保留，不能因清理动作削弱既有有效门禁。
- 对旧 Python-era 路径的处理应以“显式边界/淘汰说明”为主，避免伪造历史兼容能力。
- 文档任务以澄清当前权威口径为目标，不进行大规模无关重写。
- CSV 任务需要满足 `csv-wave-pipeline` 现有 schema，并保持 wave 内 scope 不重叠。
- 历史说明：本会话已完成第一轮对齐，剩余最终一致性工作已移交到 `WFS-final-closure-consistency-20260407`。
