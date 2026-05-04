# M4 Scope Analysis — Discussion

**Date**: 2026-05-03
**Scope**: Adhoc/Standalone (no current milestone, no M4 roadmap)
**Output**: `.workflow/scratch/analyze-m4-next-milestone-20260503/`

---

## Table of Contents

1. [Current State Assessment](#current-state)
2. [Gap Analysis](#gap-analysis)
3. [M4 Direction Proposals](#m4-directions)
4. [Current Understanding](#current-understanding)

---

## Current State Assessment

### Milestone Progression

| Milestone | Focus | Status |
|-----------|-------|--------|
| M1 | UX & Stability — UI polish, CRUD basics, error handling | Completed (v9.2.5) |
| M2 | Intelligence — backend modules, vector search, evaluators | Completed (v9.3.0) |
| M3 | Wiring — MCP endpoints, frontend API, evaluator expansion | Completed (v9.4.0) |

### Backend Inventory (Mature, Well-Stocked)

**Narrative Intelligence** (`src-tauri/bin/sidecar/narrative/`):
- 15 evaluators: character, cliche, deadly-sins, dialogue, dream, four-selves, pacing, premise, pyramid, research, subtext, suspense, theme, voice, worldbuilding
- 5 analyzers: character-state, conflict, sensory, tension-curve + base
- Character depth + cross-chapter tracking
- Foreshadowing lifecycle (plant/hint/harvest)
- Fictional Dream engine (empathy, identification, immersion, sympathy)
- Narrative voice, scene coherence, timeline consistency, worldview coherence
- Premise validator, style system, suspense analyzer

**Search** (`src-tauri/bin/sidecar/search/`):
- VectorSearch (fastembed), HybridSearch (FTS5 + vector RRF), IterativeRetriever, SmartSearch

**Workflow** (`src-tauri/bin/sidecar/workflow/`):
- L1-L5 levels, session management, plan-act mode, revision loop
- Novel-specific adapters, quality checks, state management

**MCP Endpoints** (17): agent, analysis, character, chat, config, critic, foreshadow, graph, health, mcp-admin, memory, skills, wiki, workflow, workspace, writing

### Frontend Inventory (Basic Exposure, Room for Depth)

**84 components**, but narrative intelligence exposure is thin:
- `EvaluationPanel` — shows evaluation scores + suggestions, has revision loop workflow
- `WritingHelperPanel` — polish/rewrite/expand/summarize/outline with style controls
- `StoryBiblePanel` — wiki canon + graph items
- `KnowledgeModal` — character/location/plot tabs with CRUD
- `AutomationPanel` — workflow scheduler management
- `McpStatusPanel` — connection diagnostics

**Right panel types**: settings, knowledge, evaluation, writingHelper, automation, mcpStatus, aiTextOptimizer

### Frontend API Layer (`src/api/`)

- 27+ API modules covering all MCP endpoints
- analysis.ts — detectPatterns, clusterSessions (added M3)
- knowledge.ts — graph writes, foreshadowing, character depth/profile (added M3)
- evaluation.ts — consistency check + recommendations

### What's Missing (The Gap)

1. **No narrative intelligence visualization** — 15 evaluators, 5 analyzers, fictional dream engine all produce data, but no dashboard/timeline/graph view exists
2. **No foreshadowing tracker UI** — plant/hint/harvest lifecycle has endpoints but no dedicated panel
3. **No character relationship visualization** — character depth + cross-chapter tracking exists, but only basic profile panel
4. **No writing session analytics** — session clustering backend exists, no visualization
5. **No pattern detection UI** — narrative patterns detected but not surfaced to writer
6. **M3 deferred items unresolved** — 6 items sitting in backlog

---

## Gap Analysis

### Backend → Frontend Coverage Matrix

| Backend Module | Has Endpoint | Has API Function | Has UI | Depth |
|---------------|-------------|-----------------|--------|-------|
| CriticEngine (15 evaluators) | critic | evaluation.ts | EvaluationPanel | Scores only |
| Character Depth | character | knowledge.ts | CharacterTab profile | Basic profile |
| Foreshadowing | foreshadow | knowledge.ts | None | N/A |
| Pattern Detection | analysis | analysis.ts | None | N/A |
| Session Clustering | analysis | analysis.ts | None | N/A |
| Fictional Dream | — | — | None | N/A |
| Timeline Consistency | — | — | None | N/A |
| Scene Coherence | — | — | None | N/A |
| Narrative Voice | — | — | None | N/A |
| Suspense Analyzer | — | — | None | N/A |
| Conflict Analyzer | — | — | None | N/A |
| Tension Curve | — | — | None | N/A |
| Sensory Analyzer | — | — | None | N/A |

### Key Observation

The backend has ~12 narrative intelligence modules. Only 3-4 have frontend exposure, and the exposure is shallow (scores, basic text). The writer sees numbers but not the story behind the numbers.

---

## M4 Direction Proposals

### Option A: **Writer Intelligence Dashboard** (Recommended)

**Focus**: Surface narrative intelligence through rich, writer-centric visualization panels.

**What**: Build dedicated panels for foreshadowing tracking, character relationship mapping, narrative pattern visualization, and writing session analytics. Connect the 12 backend modules to the writer's creative process.

**Why**: M1 built the foundation, M2 built the brain, M3 wired the nervous system. M4 should make the brain visible. Writers can't use intelligence they can't see.

**Scope**:
- Foreshadowing tracker panel (plant/hint/harvest timeline)
- Character relationship graph/visualization
- Narrative pattern dashboard (pattern types, frequency, chapter distribution)
- Writing session analytics (session clustering visualization, writing patterns over time)
- Evaluation depth expansion (per-evaluator drill-down, historical trend)
- Resolve 3-4 deferred M3 items (DEF-M3-001, DEF-M3-003, DEF-M3-004, DEF-M3-006)

**Risk**: UI-heavy milestone requires design decisions before implementation.

### Option B: **End-to-End Workflow Polish**

**Focus**: Make the L1-L5 workflow system feel complete and reliable in production use.

**What**: Progress indicators, result visualization, workflow status tracking, error recovery UX, checkpoint browsing.

**Why**: The workflow system is powerful but invisible. Writers don't know when workflows are running, what they're doing, or how to recover from failures.

**Scope**:
- Workflow progress panel with live status
- Checkpoint browser and diff viewer
- L4/L5 result visualization (brainstorm cards, coordinator plan tree)
- Error recovery UI with retry/resume controls
- Session history and comparison

**Risk**: Niche audience — power users only. Doesn't advance core writing value.

### Option C: **Chinese Novelist Deep Features**

**Focus**: Market-specific features for the target audience (Chinese long-form novelists).

**What**: Genre convention detection, classical Chinese style evaluation, tone analysis, cultural pattern detection.

**Why**: Product differentiation — these features make Niko Studio uniquely valuable to its target market.

**Scope**:
- Chinese genre convention evaluator (DEF-M3-005)
- Tone analysis UI with style comparison
- Classical Chinese writing style support
- Market research to validate feature direction

**Risk**: Needs user research validation. Building without data risks building the wrong things.

---

## Current Understanding

The strongest M4 candidate is **Option A: Writer Intelligence Dashboard** because:

1. **Builds on M3 investment** — M3 wired the endpoints; M4 consumes them with real UI
2. **Clear value chain** — M1→M2→M3→M4 follows "build→equip→connect→reveal" pattern
3. **Addresses deferred items** — naturally resolves DEF-M3-001, 003, 004, 006
4. **No research needed** — backend modules exist, endpoints exist, just need UI
5. **Directly serves core value** — "AI writing assistant" means writers need to SEE the AI's understanding

The remaining question is **phase structure**:
- Single phase (all UI panels in one wave)?
- Two phases (panels first, integration + polish second)?

Given M3 used a single milestone-scoped phase successfully, a single phase with wave-based ordering should work.
