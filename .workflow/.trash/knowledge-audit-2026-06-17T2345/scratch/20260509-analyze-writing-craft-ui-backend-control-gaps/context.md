# Context: writing-craft UI backend control gaps

**Date**: 2026-05-09
**Mode**: gaps
**Requested skill call**: `$maestro-analyze --gaps "修复 writing-craft UI 对后端控制链路的阻塞缺口：参考 .workflow/.csv-wave/20260509-verify-P1-ui-backend-interface-control/verification.json" -y`
**Downstream chain topic**: `quality-fix` step 1/4 for UI-backend interface control gap remediation

## Executive Summary

The backend control surface already exists and the isolated dashboard implementation is real, but the shipped desktop host path is broken. The primary blocker is that `AnalysisPanel` never mounts `WritingDashboard`, so users cannot reach the writing-craft backend from the production UI. A secondary blocker exists inside the dashboard: the deep-analysis branch is partially implemented in `WritingDimensionDetail`, yet `WritingDashboard` does not pass `text` or `llmConfig`, so that path is unreachable even if the dashboard is mounted.

## Root-Cause Findings

### 1. Production host path is absent
- Evidence:
  - `desktop/src/components/AnalysisPanel.tsx:11` defines `TabId` as only `character_arc`, `pacing`, `consistency`, and `readability`.
  - `desktop/src/components/AnalysisPanel.tsx:105` renders tabs exclusively from that set.
  - No import or render site for `WritingDashboard` exists in `AnalysisPanel`.
- Conclusion:
  - The writing-craft UI is implemented as a dead branch behind an unmounted component.

### 2. Desktop bridge exists but has no dedicated contract test
- Evidence:
  - `desktop/src/api/writing-craft.ts:27` posts to `/writing-craft/analyze`.
  - `desktop/src/api/writing-craft.ts:47` posts to `/writing-craft/llm-analyze`.
  - `desktop/src/api/writing-craft.test.ts` is absent.
- Conclusion:
  - The backend bridge is real, but regressions in request shape or endpoint usage are not directly protected.

### 3. Deep-analysis path is unreachable
- Evidence:
  - `desktop/src/components/intelligence/WritingDimensionDetail.tsx:20` accepts `text` and `llmConfig`.
  - `desktop/src/components/intelligence/WritingDimensionDetail.tsx:29` calls `analyzeWritingCraftLLM(text, llmConfig, [dimension.dimension])`.
  - `desktop/src/components/intelligence/WritingDashboard.tsx:167` renders `<WritingDimensionDetail dimension={activeDimension} />` without those props.
- Conclusion:
  - LLM deep analysis is implemented in the nested component but cannot be triggered from the current dashboard wiring.

### 4. Planned anti-pattern warning UI never shipped
- Evidence:
  - Verification reported `desktop/src/components/intelligence/AntiPatternWarning.tsx` missing.
  - No visible warning surface is present in the current detail flow.
- Conclusion:
  - The UI implementation is incomplete relative to the original phase plan.

## Decisions

### Locked
- Treat `AnalysisPanel` host integration as the first fix cluster, ahead of cosmetic or optional dashboard enhancements.
- Preserve the existing backend route contract in `desktop/src/api/writing-craft.ts`; the immediate problem is UI wiring, not endpoint redesign.
- Add dedicated regression coverage for both the desktop bridge and the production-visible host path as part of remediation.

### Free
- The visible host can be a new `AnalysisPanel` tab or another clearly shipped analysis surface, as long as the path is production-visible.
- The deep-analysis repair can either pass `text` and `llmConfig` through the current component chain or temporarily hide the deep-analysis control until configuration exists.

### Deferred
- Exact presentation details for anti-pattern visualization may follow after the host path and bridge coverage are restored.

## Fix Clusters For `quality-fix`

### Cluster 1 - Restore visible host control path
- Mount `WritingDashboard` from a shipped desktop analysis surface.
- Introduce the minimal state and navigation wiring needed to expose the feature to users.
- Add a host-level integration test proving a visible user action can reach the dashboard and trigger the backend bridge.

### Cluster 2 - Lock bridge contracts
- Add `desktop/src/api/writing-craft.test.ts`.
- Verify both `/writing-craft/analyze` and `/writing-craft/llm-analyze` payload shapes and response passthrough behavior.

### Cluster 3 - Repair nested feature completeness
- Pass `text` and `llmConfig` into `WritingDimensionDetail`, or intentionally hide the dormant control.
- Implement `AntiPatternWarning.tsx` only if the current phase still requires warning surfacing; otherwise explicitly descoped it in follow-up planning.

## Notes

- The referenced verification source is `.workflow/.csv-wave/20260509-verify-P1-ui-backend-interface-control/verification.json`.
- `.workflow/state.json` is currently malformed JSON in this checkout, so artifact registration was intentionally skipped for this analysis session.
- No matching writing-craft UI issue entry was found in `.workflow/issues/issues.jsonl`, so this gaps analysis was recorded as session artifacts only and did not mutate issue records.
