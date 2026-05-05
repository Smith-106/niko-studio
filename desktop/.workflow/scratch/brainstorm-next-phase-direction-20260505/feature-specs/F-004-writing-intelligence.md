# F-004: Writing Intelligence Enhancement

> Priority: MEDIUM | Phase: M9-P1 | Depends: F-001 (project context for cross-chapter analysis)
> Roles: product-manager, ux-expert, system-architect

---

## Requirements Summary

Enhance AI analysis capabilities from flat single-document analysis to deep narrative intelligence across an entire project. Leverage existing gateway infrastructure and Story Bible data to provide character arc tracking, pacing analysis, consistency checking, and readability scoring.

**MUST**:
- Character arc timeline: Track character appearances and development across chapters
- Pacing analyzer: Generate tension curve graph per chapter and across project
- Consistency checker: Detect plot holes, timeline errors, and character contradictions using Story Bible as ground truth
- Readability scoring: Per-chapter readability metrics (Chinese text adapted)

**SHOULD**:
- Incremental analysis (only re-analyze changed chapters)
- Analysis results cached in SQLite with invalidation on content change
- Export analysis report as markdown

**MAY**:
- Genre-specific writing advice based on analysis
- Automated outline validation (does manuscript follow planned outline)

---

## Design Decisions (40%+)

1. **Prompt-based extraction**: All intelligence modules use carefully crafted prompts via existing gateway. No custom ML models. Rationale: Reuses existing infrastructure, no new dependencies.

2. **On-demand analysis**: Analysis is triggered by user action (click "Analyze"), not automatic on save. Rationale: AI calls are expensive (time + tokens); user controls when to run.

3. **Incremental invalidation**: Cache analysis results with a `content_hash` per chapter. On next analysis request, only re-analyze chapters where hash changed. Rationale: Avoid re-processing entire project for minor edits.

4. **Analysis stored in project metadata**: Results stored as JSON in SQLite `project.analysis` column. Not in files. Rationale: Metadata belongs with project metadata, not as separate files.

---

## Interface Contract

### Gateway Intelligence API

```typescript
interface AnalysisRequest {
  projectId: string
  module: 'character_arc' | 'pacing' | 'consistency' | 'readability'
  chapterIds?: string[]       // undefined = all chapters
  storyBibleRef?: string      // path to Story Bible data
  forceRefresh?: boolean
}

interface AnalysisResult {
  module: string
  projectId: string
  chaptersAnalyzed: string[]
  result: unknown             // module-specific result
  createdAt: string
  contentHashes: Record<string, string>  // chapterId → hash
}

// Gateway endpoints (via sidecar IPC)
invoke('analyze_project', { request: AnalysisRequest }): Promise<AnalysisResult>
invoke('get_cached_analysis', { projectId: string, module: string }): Promise<AnalysisResult | null>
```

---

## Constraints & Risks

| Constraint | Impact | Mitigation |
|-----------|--------|------------|
| LLM context window limits | Cannot feed entire 200k-word novel in one prompt | Chapter-by-chapter analysis with cross-references |
| AI analysis accuracy | False positives in consistency checking | Present as "suggestions", not "errors" |
| Analysis latency | Full project analysis may take 2-5 minutes | Progress indicator, background processing |
| Chinese text analysis | Readability formulas designed for English | Use adapted Chinese readability metrics |

---

## Acceptance Criteria

- [ ] Character arc tracker produces timeline of character appearances across chapters
- [ ] Pacing analyzer generates tension curve visualization
- [ ] Consistency checker flags at least 3 types of inconsistencies (timeline, character, plot)
- [ ] Readability scores calculated per chapter with Chinese text adaptation
- [ ] Analysis results cached and invalidated on content change
- [ ] On-demand analysis triggered from UI with progress feedback

---

## Cross-Feature Dependencies

- **F-001 (Project Management)**: Required for cross-chapter analysis scope
- **F-007 (Agent Workflows)**: Intelligence layer feeds into automated workflows
