# Roadmap: Niko-Studio Desktop — M9: Intelligence & Workflows

## Overview

M9 transforms Niko-Studio from a writing tool into an intelligent writing partner. Three features: Writing Intelligence Enhancement (F-004) provides cross-chapter narrative analysis, Template & Scaffold System (F-006) offers reusable document structures, and Advanced AI Agent Workflows (F-007) enables multi-step automated pipelines with human checkpoints.

**Source**: brainstorm-next-phase-direction-20260505 (BRN-001)

**Depends on**: M8 complete (9.9.0, 1062 tests passing, project management + version history + DOCX export)

## Phases

- [ ] **Phase 1: Intelligence & Templates** — Writing intelligence engine + template system (F-004, F-006)
- [ ] **Phase 2: Agent Workflows** — Multi-step AI agent pipelines with checkpoints (F-007)

---

## Phase Details

### Phase 1: Intelligence & Templates

**Goal**: Build the writing intelligence engine (character arc tracking, pacing analysis, consistency checking, readability scoring) and a template/scaffold system for reusable document structures.

**Depends on**: M8 complete (project management for cross-chapter analysis, F-001)

**Features**: F-004 (Writing Intelligence Enhancement), F-006 (Template & Scaffold System)

**Current State**:
- Single-document AI analysis exists via gateway
- Story Bible (knowledge graph) provides character/location/plot data
- Project→Volume→Chapter hierarchy from M8
- No cross-chapter narrative analysis
- No template system
- EvaluationPanel with per-module scores from M4

**Success Criteria** (what must be TRUE):
  1. Character arc timeline tracks appearances and development across all chapters
  2. Pacing analyzer generates tension curve per chapter and across project
  3. Consistency checker detects plot holes, timeline errors, character contradictions using Story Bible as ground truth
  4. Readability scoring produces per-chapter metrics (Chinese text adapted)
  5. Analysis results cached in SQLite with content_hash invalidation (only re-analyze changed chapters)
  6. Built-in template library: novel chapter, short story, essay, script, academic paper
  7. Users can create templates from existing chapters with placeholder variables
  8. Template application: browse → preview → fill variables → create chapter
  9. All existing 1062+ tests still pass
  10. Progressive disclosure: analysis on-demand (not automatic), templates optional

**Design Decisions**:
  - Prompt-based extraction via existing gateway (no custom ML models)
  - On-demand analysis (user-triggered, not auto-on-save)
  - Analysis stored in project metadata (SQLite `project.analysis` column)
  - Templates = TipTap JSON + metadata envelope (consistent with editor format)
  - Placeholder syntax: `{{variable_name}}` with form-based fill
  - User templates in `~/.niko-studio/templates/`, built-in bundled with app

---

### Phase 2: Agent Workflows

**Goal**: Extend single-shot AI agents into multi-step workflow chains with human checkpoints. Writers define pipelines (outline → draft → revise → polish) that execute step-by-step with approval gates.

**Depends on**: Phase 1 (intelligence layer F-004 for analysis steps in workflows)

**Features**: F-007 (Advanced AI Agent Workflows)

**Current State**:
- Single-shot AI chat via gateway
- No workflow chaining or step orchestration
- No human checkpoint mechanism between AI steps

**Success Criteria** (what must be TRUE):
  1. Workflow defined as ordered sequence of agent steps (JSON definition)
  2. Each step has configurable agent mode, prompt, input/output mapping
  3. Human checkpoint between steps (review output before proceeding)
  4. Workflow execution history with step outputs persisted
  5. Pre-built workflow templates: novel chapter pipeline, revision pass, style adaptation
  6. Workflow pause and resume works correctly
  7. Step output diff (before/after comparison) available
  8. All existing + new tests pass

**Design Decisions**:
  - Workflow as JSON array of step objects (serializable, editable)
  - Sequential execution with checkpoints (no background execution in V1)
  - Step input = previous step output (simple data flow)
  - Leverage existing gateway agent modes (no new AI capabilities)

---

## Feature Specs

| Feature | Spec | Priority | Phase |
|---------|------|----------|-------|
| F-004: Writing Intelligence Enhancement | `scratch/brainstorm-next-phase-direction-20260505/feature-specs/F-004-writing-intelligence.md` | MEDIUM | P1 |
| F-006: Template & Scaffold System | `scratch/brainstorm-next-phase-direction-20260505/feature-specs/F-006-template-scaffold.md` | LOW-MEDIUM | P1 |
| F-007: Advanced AI Agent Workflows | `scratch/brainstorm-next-phase-direction-20260505/feature-specs/F-007-agent-workflows.md` | MEDIUM | P2 |

## Out of Scope

- Localization expansion (F-008, M10+)
- Conditional workflow branching or parallel step execution
- Workflow scheduling (run overnight)
- Template marketplace
- Genre-specific AI writing advice beyond analysis
- Cloud sync or multi-device features
