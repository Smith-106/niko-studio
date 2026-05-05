# Guidance Specification: Niko-Studio 下一阶段方向

> Session: brainstorm-next-phase-direction-20260505
> Date: 2026-05-05
> Mode: Auto | Roles: product-manager, ux-expert, system-architect

---

## 1. Terminology & Boundary

### Core Terms

| Term | Definition |
|------|-----------|
| **Project** | A multi-document writing container (novel, anthology, series) with chapters, volumes, and metadata |
| **Document** | A single TipTap editor instance — the atomic writing unit |
| **Version Snapshot** | A point-in-time capture of document content + metadata, stored locally |
| **Writing Intelligence** | AI-driven analysis of narrative structure, pacing, character arcs, and consistency |
| **Agent Workflow** | A multi-step AI pipeline (outline → draft → revise) triggered by user intent |
| **Template** | A reusable document scaffold with placeholder variables and structural guidance |

### Boundary: IN SCOPE

- Local-first features (no cloud dependency)
- Features that leverage existing Tauri + React + TipTap stack
- AI features via existing local gateway (niko-gateway)
- Incremental upgrades to existing components

### Boundary: OUT OF SCOPE

- Cloud sync / multi-device
- Real-time multi-user collaboration
- Mobile platforms
- General-purpose document processing (Word/Google Docs competitor)
- Custom model training / fine-tuning

---

## 2. Current State Assessment

### What's Built (M1–M7)

| Area | Status |
|------|--------|
| TipTap rich-text editor | Stable, production-ready |
| AI chat (multi-model) | Stable, gateway-abstracted |
| Agent modes | Working (writing, analysis, evaluation) |
| Story Bible | Character/setting/world CRUD |
| Outline generator | Phase-based outline scaffolding |
| Export | PDF via window.print() |
| i18n | zh-CN + en-US |
| Accessibility | Skip links, ARIA, keyboard nav |
| Knowledge management | CRUD with search |
| Error handling | ErrorBoundary + toast system |
| Automation panel | Pattern dashboard, session analytics |

### Deferred from Prior Milestones

1. **Multi-document project management** (M6 defer) — chapters, volumes
2. **Custom TipTap extensions** (M6 defer) — tables, math, collaborative cursors
3. **DOCX export** (M7 defer) — beyond PDF
4. **Localization expansion** (M6 defer) — beyond zh-CN/en-US

### Pain Points & Opportunities

- **Single-document limitation**: Writers of novels/series currently manage chapters as separate files with no structural coherence
- **No revision safety**: Accidental edits have no undo-beyond-session recovery
- **Export limited to PDF**: Writers need DOCX for publisher/editor workflows
- **AI analysis is flat**: Character arcs, pacing, foreshadowing tracking exist as UI but lack deep narrative intelligence
- **No templates**: Every new document starts blank, losing structural knowledge from completed works

---

## 3. Feature Decomposition

### F-001: Multi-Document Project Management (HIGH)
- **Why**: Top deferred item. Single-document model breaks for novels/series.
- **What**: Project → Volume → Chapter hierarchy, metadata panel, cross-document navigation, project-level word count & stats
- **Risk**: Large scope — data model migration, navigation UX, sidebar redesign

### F-002: Version History & Revision Tracking (HIGH)
- **Why**: No safety net for revisions. Writers need to compare drafts and roll back.
- **What**: Auto/manual snapshots, diff viewer, rollback, branch-and-merge for alternate versions
- **Risk**: Storage growth, diff algorithm complexity for rich text

### F-003: DOCX & Advanced Export (MEDIUM)
- **Why**: Deferred from M7. Publishers/editors expect DOCX. PDF-only is a workflow blocker.
- **What**: DOCX export via docx.js or similar, chapter-by-chapter assembly, style mapping, metadata injection
- **Risk**: Library maturity, style fidelity, large document performance

### F-004: Writing Intelligence Enhancement (MEDIUM)
- **Why**: Existing AI features are shallow. Deep narrative analysis is the differentiator.
- **What**: Character arc tracking with timeline visualization, pacing analysis per chapter, consistency checker (plot holes, timeline errors), reading-level scoring
- **Risk**: AI prompt complexity, performance on long documents, accuracy expectations

### F-005: Custom TipTap Extensions (MEDIUM)
- **Why**: Deferred from M6. Tables and math are table-stakes for academic/technical writing.
- **What**: Table extension, math/KaTeX extension, callout/admonition blocks, drag-and-drop block reorder
- **Risk**: TipTap extension API stability, performance with large tables

### F-006: Template & Scaffold System (LOW-MEDIUM)
- **Why**: Reduces friction for new documents. Captures structural patterns from completed works.
- **What**: Built-in templates (novel chapter, short story, essay, script), user-defined templates from existing documents, placeholder variables, template marketplace (local)
- **Risk**: Template schema design complexity

### F-007: Advanced AI Agent Workflows (MEDIUM)
- **Why**: Current agents are single-shot. Multi-step workflows unlock higher-value automation.
- **What**: Define workflow chains (outline → draft → revise → polish), per-step human checkpoints, workflow templates, execution history
- **Risk**: UX complexity, LLM context window limits for long documents

### F-008: Localization Expansion (LOW)
- **Why**: Deferred from M6. ja-JP, ko-KR, and additional European languages expand addressable market.
- **What**: i18n infrastructure for additional locales, community translation support, RTL layout consideration
- **Risk**: Translation cost/quality, UI layout adjustments, maintenance burden

---

## 4. Non-Goals (Explicit)

- Cloud storage or synchronization
- Real-time collaboration (Google Docs-style)
- Mobile or web app versions
- E-book format support (EPUB, MOBI)
- AI model training or hosting
- Payment / subscription system
- Social features (sharing, community)

---

## 5. Key Decisions (Locked)

| ID | Decision | Rationale |
|----|----------|-----------|
| D-001 | Project = folder of documents + metadata JSON | Local-first, git-friendly, no database migration for project structure |
| D-002 | Version history = content snapshots + metadata | Simpler than operational transforms; sufficient for single-user rollback |
| D-003 | DOCX via docx.js library | Browser-compatible, no native dependency, active maintenance |
| D-004 | AI intelligence via gateway prompts | Reuses existing architecture; no new infra needed |
| D-005 | Templates = TipTap JSON + metadata schema | Consistent with editor internal format; no format conversion needed |

---

## 6. Feature Priority Matrix

| Feature | User Impact | Technical Risk | Dependency | Recommended Phase |
|---------|-------------|----------------|------------|-------------------|
| F-001 Project Management | Critical | High | None | M8 Phase 1 |
| F-002 Version History | High | Medium | None | M8 Phase 1 |
| F-003 DOCX Export | Medium | Low | None | M8 Phase 2 |
| F-004 Writing Intelligence | High | Medium | F-001 (project context) | M9 Phase 1 |
| F-005 TipTap Extensions | Medium | Medium | None | M8 Phase 2 |
| F-006 Templates | Medium | Low | F-001 | M9 Phase 1 |
| F-007 Agent Workflows | High | High | F-004 (intelligence layer) | M9 Phase 2 |
| F-008 Localization | Low | Low | None | M10+ |

### Recommended Milestone Plan

- **M8**: Project Management + Version History + DOCX Export + TipTap Extensions
- **M9**: Writing Intelligence + Templates + Advanced Agent Workflows
- **M10**: Localization + Polish + Community Feedback Integration
