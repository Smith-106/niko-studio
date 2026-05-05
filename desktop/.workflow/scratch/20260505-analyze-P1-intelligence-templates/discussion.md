# Discussion: M9 Phase 1 — Intelligence & Templates

## Timeline

### Round 1: Current State Assessment

**Architecture Overview:**
- Frontend: React + TypeScript + Zustand + TipTap editor + Tauri (268 source files)
- State: Zustand slices — projectSlice (Project/Volume/Chapter CRUD), conversationSlice, skillsSlice, workspaceSlice
- API layer: `src/api/core.ts` → `callApi()` routes to sidecar gateway via HTTP
- Gateway: Sidecar service with REST endpoints (admin/mcp/services, agent/route, agent/write, agent/revise, analysis/*, knowledge/*)
- Persistence: Tauri filesystem (`projectFileService.ts`) — projects/{id}/meta.json, chapters/{id}/content.json, versions/{id}.json
- Editor: TipTap with extensions (Table, MathInline, MathBlock, Callout, SlashCommand)
- Export: DOCX via `exportDocx`, PDF via print, MD/HTML from TipTap JSON
- Intelligence panels: `src/components/intelligence/` — AccordionWrapper, IntelligenceBadge, MetricValue, ProgressBar, SectionHeader (from M4)
- Analysis API: `src/api/analysis.ts` — detectPatterns(), clusterSessions() (pattern detection, not narrative analysis)
- Workflow API: `src/api/workflow/` — contracts, plans, checkpoints, recommendations, endpoints (automation/scheduling framework, not writing workflows)
- Knowledge graph: `src/api/knowledge.ts` — graph writes, foreshadowing, character depth/profile
- Project hierarchy: Project → Volume → Chapter (types in `src/types/project.ts`)

**Key Finding:** The codebase has two layers of "intelligence":
1. **M4 UI panels** — Pure display components (ForeshadowingTracker, PatternDashboard, SessionAnalytics, EvaluationDrillDown, CharacterRelationships) that render data from the sidecar
2. **Sidecar analysis** — Pattern detection and session clustering in the backend

M9 needs to bridge these: add a **writing intelligence engine** that does cross-chapter narrative analysis (character arcs, pacing, consistency, readability) using the gateway's AI capabilities, and a **template system** for reusable document structures.

### Round 2: F-004 Writing Intelligence — Gap Analysis

**What exists:**
- `src/api/analysis.ts`: `detectPatterns()` and `clusterSessions()` — generic pattern/session analysis, not narrative-specific
- `src/components/intelligence/`: Shared UI components (AccordionWrapper, IntelligenceBadge, MetricValue, ProgressBar, SectionHeader)
- Gateway sidecar: Agent write/revise/route endpoints — single-shot AI operations
- Knowledge graph API: Character depth/profile endpoints — per-character data
- Project hierarchy: Full CRUD for Project→Volume→Chapter with Tauri filesystem persistence

**What's needed:**
1. **New analysis modules** (frontend services + sidecar endpoints):
   - Character arc tracker — cross-chapter appearance/development timeline
   - Pacing analyzer — tension curve per chapter and across project
   - Consistency checker — plot holes, timeline errors, character contradictions vs Story Bible
   - Readability scorer — per-chapter metrics (Chinese-adapted)

2. **Caching layer** — Analysis results stored with `content_hash` invalidation:
   - Use Tauri filesystem (consistent with existing `projectFileService.ts` pattern)
   - Store per-chapter hashes, re-analyze only changed chapters
   - Results in `{projectDir}/analysis/{module}.json`

3. **On-demand trigger** — User clicks "Analyze" button, not auto-on-save
   - Progress indicator during analysis (chapters processed / total)
   - Results displayed in new intelligence panel tabs

4. **Frontend wiring**:
   - New Zustand slice or extension of projectSlice for analysis state
   - New API module (extend `src/api/analysis.ts` or new `src/api/intelligence.ts`)
   - New UI components using existing intelligence shared components
   - Integration with existing EvaluationPanel

### Round 3: F-006 Template System — Gap Analysis

**What exists:**
- TipTap editor with JSON content model
- Chapter creation via `projectSlice.addChapter()` — creates empty chapter
- Tauri filesystem for persistence
- No template system whatsoever

**What's needed:**
1. **Template data model:**
   - `Template` interface: id, title, description, category, content (TipTap JSON), placeholders, isBuiltIn
   - `TemplatePlaceholder`: name, label, defaultValue, type (text/number/select)

2. **Built-in templates** (bundled with app):
   - Novel chapter, short story, essay, script, academic paper
   - Stored as JSON in `src/templates/` or bundled assets

3. **Template service:**
   - Read built-in templates from bundle
   - Read/write user templates from `~/.niko-studio/templates/` (Tauri filesystem)
   - Create template from existing chapter content
   - Apply template: replace `{{placeholders}}` → create new chapter

4. **Template UI:**
   - "From Template" option in chapter creation flow
   - Browse templates with preview
   - Fill-in placeholder form
   - Save-as-template action on existing chapter

### Round 4: Risk & Constraint Assessment

**Risks:**
1. **LLM context window** — Full-project analysis needs chapter-by-chapter processing with cross-references. Mitigate: sequential analysis with accumulated context summary.
2. **Analysis latency** — 2-5 min for full project. Mitigate: progress indicator, incremental (only changed chapters).
3. **Chinese readability metrics** — Standard formulas (Flesch-Kincaid) don't work for Chinese. Need adapted metrics or custom formula.
4. **Sidecar endpoint proliferation** — Each analysis module could be a separate endpoint. Mitigate: single `/intelligence/analyze` endpoint with `module` parameter.

**Constraints:**
- On-demand only (no auto-analysis on save) — respects AI call cost
- No custom ML models — prompt-based extraction via existing gateway
- Templates = TipTap JSON (consistent with editor format)
- Analysis results stored via Tauri filesystem (not SQLite, since project data already uses filesystem)

**Design Decisions:**
- Analysis services in `src/services/intelligenceService.ts` (new)
- Template services in `src/services/templateService.ts` (new)
- API endpoints: extend existing sidecar or add new frontend-only logic
- Since analysis is prompt-based, the gateway agent already handles AI calls — the intelligence service orchestrates multi-chapter analysis calls
- Template storage: built-in as JSON assets, user templates via Tauri appDataDir

## Current Understanding

M9 Phase 1 adds two orthogonal features to the existing M8 project infrastructure:

**F-004 Intelligence:**
- Leverages existing gateway agents + knowledge graph + project hierarchy
- New orchestration layer: chapter-by-chapter analysis → aggregated results
- Cached results with content_hash invalidation (SHA-256, already used in `projectFileService.ts`)
- UI: extend EvaluationPanel or new tab in AppRightPanels

**F-006 Templates:**
- Purely frontend feature (no AI involved)
- Reuses TipTap JSON format directly
- Storage via Tauri filesystem (consistent with project data)
- Minimal new UI — extend chapter creation flow + add "Save as Template" action
