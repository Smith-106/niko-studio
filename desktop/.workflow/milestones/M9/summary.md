# M9 Summary — Intelligence & Workflows

**Milestone:** M9 — Intelligence & Workflows
**Completed:** 2026-05-05
**Status:** Complete (Phase 1 + Phase 2)

## Features Delivered

### Phase 1: Intelligence & Templates

#### F-004: Writing Intelligence Enhancement
- **Intelligence Service** (`src/services/intelligenceService.ts`) — Project analysis with content-hash-based incremental caching, force-refresh, per-module analysis agents
- **Analysis API** (`src/api/intelligence.ts`) — Agent API integration for analysis modules (pacing, character_arc, consistency, world_building)
- **Intelligence Slice** (`src/stores/app/intelligenceSlice.ts`) — Zustand store slice with analysis state, progress tracking, cached result loading
- **Analysis Panel** (`src/components/panels/AnalysisPanel.tsx`) — UI panel for triggering and displaying analysis results

#### F-006: Template & Scaffold System
- **Template Service** (`src/services/templateService.ts`) — CRUD operations, placeholder extraction/substitution, 5 built-in templates, user template persistence
- **Template Slice** (`src/stores/app/templateSlice.ts`) — Zustand store slice with template loading, saving, deleting, duplicating
- **Template Browser Panel** (`src/components/panels/TemplateBrowserPanel.tsx`) — UI panel for browsing, filtering, previewing, and applying templates

### Phase 2: Agent Workflows

#### F-007: Multi-step AI Agent Pipelines
- **Workflow Types** (`src/types/workflow.ts`) — AgentMode, InputSource, CheckpointType, WorkflowStep, Workflow, WorkflowStepResult, WorkflowExecution
- **Workflow Service** (`src/services/workflowService.ts`) — CRUD + execution orchestration with sequential step execution, checkpoint pause/resume, approve/reject flow
- **Workflow Slice** (`src/stores/app/workflowSlice.ts`) — Zustand store slice with workflow loading, saving, deleting, execution lifecycle management
- **Workflow Editor Panel** (`src/components/WorkflowEditorPanel.tsx`) — Full UI with list/edit/execution views, checkpoint review UI with approve/modify/reject
- **3 Built-in Workflow Templates** — chapter-pipeline, revision-pass, style-analysis

## Quality Metrics

| Metric | Phase 1 | Phase 2 | Total |
|--------|---------|---------|-------|
| Unit Tests | 36 | 33 | 69 |
| Verification | passed | passed | — |
| Business Tests | 7/7 | 28/28 | 35/35 |
| Code Review | PASS | PASS | — |
| Anti-patterns | 0 | 0 | 0 |

## Key Decisions
1. Content-hash caching (SHA-256) for incremental analysis
2. Built-in templates embedded in code with `builtin-` prefix
3. Placeholder substitution via JSON.stringify + regex — preserves TipTap document structure
4. Workflow checkpoint system: `none` | `review` | `approve` — enables human-in-the-loop for AI pipelines
5. Agent mode dispatch: `writing` → agentWrite, `analysis` → callAnalysisAgent, `custom` → agentWrite with custom prompt
6. Input source resolution: `previous_step` chains step outputs, `chapter_content`/`story_bible`/`outline` pull from getters
