# Harvest Report — 2026-06-24

## Source Artifacts

| # | Source | ID / Path | Status |
|---|--------|-----------|--------|
| 1 | M28 archived plans | `.workflow/milestones/M28/artifacts/20260624-plan-P{1-4}-*` | reviewed; learnings already in `specs/learnings.md` |
| 2 | M28 analysis sessions | `ANL-20260622-P1`, `ANL-20260624-P2/P3/P4` | reviewed; decisions already captured in M28 summary/learnings |
| 3 | Coverage gap scanner design | `.workflow/scratch/20260624-design-coverage-gap-scanner/design.md` | reviewed; learning already in `specs/learnings.md` |
| 4 | Other recent scratch | `20260614-debug-consistency-gaps`, `20260614-debug-interface-gaps`, `20260614-plan-interface-gaps`, `20260616-analyze-test-coverage`, etc. | **skipped** — already present in `harvest-log.jsonl` |

## Extraction Summary

- Fragments found: 3
- Filtered by confidence (≥ 0.5): 0
- Duplicates skipped: older scratch sessions already harvested; M28 learnings already in `specs/learnings.md`

## Routing Results

### Issue (3 created)

| # | Severity | Title | ID | Status |
|---|----------|-------|-----|--------|
| 1 | low | P2 MCP endpoints/index.ts 直接 import P1 reader-routes 而非 P1 barrel | ISS-20260624-001 | CREATED |
| 2 | low | P4 content-routes-additional.test.ts 硬编码 route count 66 | ISS-20260624-002 | CREATED |
| 3 | low | P2 GatewayDeps 角色接口尚未被消费者收窄 | ISS-20260624-003 | CREATED |

## Skipped

| Source | Reason |
|--------|--------|
| M28 archived plan artifacts | Spec/learnings already captured during milestone-complete |
| M28 analysis sessions | Spec/learnings already captured during milestone-complete |
| Coverage gap scanner design | Spec/learnings already captured during milestone-complete |
| 20260614–20260616 scratch artifacts | Already routed in prior harvest runs (see `harvest-log.jsonl`) |

## Next Steps

- Triage new issues: `/manage-issue list --source harvest`
- Review M28 learnings: `/spec-load --category learning --keyword M28`
- Connect wiki graph: `/manage-wiki connect --fix`
