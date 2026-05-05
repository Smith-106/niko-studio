# Phase 2 Analysis: Agent Workflows (F-007)

**Milestone:** M9 — Intelligence & Workflows
**Phase:** 2 (Agent Workflows)
**Date:** 2026-05-05

---

## Locked Decisions (cannot change)

1. **Workflow = JSON step array** — Serializable, editable, stored as JSON definition per brainstorm spec
2. **Sequential execution with checkpoints** — One step at a time, human approval gates between steps, no background V1
3. **Step input = previous step output** — Simple linear data flow, no complex routing
4. **Leverage existing agent gateway** — Steps use `agentWrite`, `agentRevise`, `agentGetContext`, `callAnalysisAgent` — no new AI capabilities
5. **Existing workflow API layer** — `src/api/workflow/` (plans, execute, lifecycle, checkpoints, rollback, scheduler, recommendations) is the backend execution engine. Workflow orchestration wraps it.
6. **Existing AutomationPanel** — `src/components/AutomationPanel.tsx` provides scheduler task management UI with plan lifecycle controls. Workflow editor is a separate concern.
7. **Zustand slice pattern** — AppSlice<T> with set/get, manual mock testing pattern (Phase 1 learning)
8. **Tauri FS mock pattern** — `vi.hoisted()` + `vi.mock('@tauri-apps/plugin-fs')` (Phase 1 learning)
9. **Right panel architecture** — `AppRightPanels.tsx` with lazy-loaded panels, `RightPanelType` union
10. **WorkflowBackendMode** — `'standard' | 'uiBridge'` dual-backend from `src/api/workflow/endpoints.ts`
11. **Phase 1 delivered** — Intelligence slice (`intelligenceSlice.ts`), template slice (`templateSlice.ts`), analysis panel, template browser panel — all tested and working

## Free Decisions (to decide during planning)

1. **Workflow editor UI design** — Form-based step editor vs. node-based visual editor vs. hybrid. Recommendation: form-based with step list + detail panel (matches existing panel patterns, lower complexity)
2. **Workflow storage location** — Where user-created workflows persist. Options: project metadata, filesystem (`~/.niko-studio/workflows/`), or localStorage. Recommendation: filesystem with `builtin-` prefix pattern (consistent with Phase 1 templates)
3. **Orchestration service architecture** — Thin wrapper over existing `workflowExecutePlan` + `workflowLifecycle`, or independent orchestration engine. Recommendation: thin orchestration service that maps F-007 WorkflowSteps to existing plan/execute lifecycle calls
4. **Checkpoint UI interaction** — Modal dialog vs. inline panel vs. side panel for human review. Recommendation: inline within workflow panel (step output + approve/modify/reject buttons)
5. **Pre-built workflow templates** — Which pipelines to include. Recommendation: 3 built-in (chapter pipeline, revision pass, style analysis) matching brainstorm spec
6. **Step output diff** — How to render before/after comparison. Recommendation: side-by-side diff view within the panel, using existing TipTap editor rendering
7. **Workflow slice structure** — Single flat slice vs. nested sub-slices. Recommendation: single `workflowSlice.ts` following intelligenceSlice pattern
8. **Execution history persistence** — SQLite vs. filesystem JSON. Recommendation: project metadata (consistent with Phase 1 analysis caching)

## Deferred (out of scope for Phase 2)

1. Conditional workflow branching (if/else routing based on content)
2. Parallel step execution
3. Workflow scheduling (timed execution)
4. Workflow versioning and undo history
5. Template marketplace / community workflows
6. Custom agent mode creation (beyond writing/analysis/evaluation/custom)
7. Cross-project workflow sharing
8. Workflow step recording (macro-like record user actions)

---

## Implementation Scope

### New Files (estimated)

| File | Purpose |
|------|---------|
| `src/services/workflowService.ts` | Workflow CRUD, execution orchestration, step chaining |
| `src/stores/app/workflowSlice.ts` | Zustand slice for workflow state, execution tracking |
| `src/components/panels/WorkflowEditorPanel.tsx` | Workflow editor + execution UI |
| `src/services/__tests__/workflowService.test.ts` | Service unit tests |
| `src/stores/app/__tests__/workflowSlice.test.ts` | Slice unit tests |

### Modified Files (estimated)

| File | Change |
|------|--------|
| `src/components/AppRightPanels.tsx` | Add WorkflowEditorPanel to RightPanelType + lazy load |
| `src/types/index.ts` or new `src/types/workflow.ts` | Workflow, WorkflowStep, WorkflowExecution types |

### Existing Code to Reuse

| Component | Usage |
|-----------|-------|
| `src/api/agents.ts` | `agentWrite()`, `agentRevise()`, `agentGetContext()` for step execution |
| `src/api/intelligence.ts` | `callAnalysisAgent()` for analysis-type workflow steps |
| `src/api/workflow/plans.ts` | `workflowExecutePlan()`, `workflowLifecycle()` for backend execution |
| `src/api/workflow/checkpoints.ts` | Checkpoint create/restore for workflow pause/resume |
| `src/api/workflow/recommendations.ts` | `applyRecommendation()` pattern for step execution |
| `src/services/templateService.ts` | Builtin + user template pattern (adopt for workflows) |
| `src/stores/app/intelligenceSlice.ts` | Slice pattern reference |

---

## Gray Areas

1. **Step-to-plan mapping** — How F-007 WorkflowSteps map to existing AutomationTaskDefinition / plan steps. The existing workflow API has its own task definition schema. Decision needed: map 1:1 or flatten?
2. **Error recovery** — When a step fails mid-workflow, how to handle partial results. Checkpoint system exists but integration with F-007 execution model needs design.
3. **Chapter context injection** — How to inject chapter content / story bible into step prompts. `agentGetContext()` exists but workflow steps need structured input assembly.
4. **Execution history UI** — How to present completed workflow runs. Separate tab in workflow panel? History list with drill-down?

---

## Recommendation: GO

The existing workflow infrastructure is comprehensive. Phase 2 primarily adds:
- A **workflow definition layer** (F-007 types + CRUD service)
- A **step orchestration service** that chains agent calls with checkpoint gates
- A **workflow editor UI** for creating and executing workflows
- **Built-in workflow templates** following the established pattern

Technical risk is low — no new AI capabilities needed, existing patterns well-established in Phase 1.
