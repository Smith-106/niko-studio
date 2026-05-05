# Product Manager Analysis: Niko-Studio 下一阶段方向

> Role: Product Manager
> Date: 2026-05-05

---

## User Persona Analysis

### Primary Persona: 长篇网络小说作家 (Web Novel Author)
- Writes 2000-5000 words/day
- Manages 50-300 chapters per project
- Needs: chapter organization, consistency tracking, export for platforms
- Pain: Currently managing chapters as separate documents with no overview

### Secondary Persona: 文学创作者 (Literary Writer)
- Writes novels, short stories, essays
- Needs: revision history, draft comparison, DOCX export for publishers
- Pain: No way to compare drafts or roll back changes

### Tertiary Persona: 学术/技术写作 (Academic Writer)
- Writes papers, reports, technical docs
- Needs: tables, math notation, structured templates
- Pain: TipTap lacks table/math support; forced to use other tools

---

## Feature Prioritization (RICE Framework)

| Feature | Reach | Impact | Confidence | Effort | RICE Score |
|---------|-------|--------|------------|--------|------------|
| F-001 Project Management | 3000 | 3 | 0.9 | 8 | 1012 |
| F-002 Version History | 2500 | 2 | 0.85 | 5 | 850 |
| F-004 Writing Intelligence | 2000 | 3 | 0.7 | 10 | 420 |
| F-003 DOCX Export | 2000 | 2 | 0.9 | 3 | 1200 |
| F-005 TipTap Extensions | 1000 | 2 | 0.8 | 6 | 267 |
| F-006 Templates | 1500 | 1 | 0.75 | 4 | 281 |
| F-007 Agent Workflows | 1500 | 2 | 0.6 | 12 | 150 |
| F-008 Localization | 500 | 1 | 0.5 | 8 | 31 |

**Ranking**: F-003 > F-001 > F-002 > F-004 > F-006 > F-005 > F-007 > F-008

### Rationale Adjustments

RICE suggests F-003 (DOCX) first due to low effort + high confidence. However, **F-001 (Project Management) is strategically more important** because:
1. It unlocks F-004, F-006, and enhances F-003 (chapter-by-chapter export)
2. Without project structure, other features operate in a flat document space
3. It addresses the most critical user pain point

**Recommended sequence**: F-001 → F-002 → F-003 + F-005 (parallel) → F-004 → F-006 → F-007

---

## User Story Breakdown (Top 3 Features)

### F-001: Project Management

| Story | Priority | Notes |
|-------|----------|-------|
| As a writer, I want to create a project with title, genre, and description so my work has context | P0 | Foundation |
| As a writer, I want to organize chapters into volumes so my novel structure is clear | P0 | Core hierarchy |
| As a writer, I want to see a project dashboard with word counts, chapter list, and progress | P0 | Navigation |
| As a writer, I want to reorder chapters via drag-and-drop | P1 | Usability |
| As a writer, I want project-level search across all chapters | P1 | Discovery |
| As a writer, I want to import existing documents into a project | P2 | Migration |

### F-002: Version History

| Story | Priority | Notes |
|-------|----------|-------|
| As a writer, I want automatic snapshots when I close a document or every 30 minutes | P0 | Safety net |
| As a writer, I want to create named snapshots ("Draft 2 - restructured ending") | P0 | Manual control |
| As a writer, I want to compare two snapshots side-by-side with highlighted differences | P1 | Diff viewer |
| As a writer, I want to restore a previous snapshot | P0 | Rollback |
| As a writer, I want to branch from a snapshot to explore alternate directions | P2 | Advanced |

### F-003: DOCX Export

| Story | Priority | Notes |
|-------|----------|-------|
| As a writer, I want to export a single document as DOCX with proper formatting | P0 | Core |
| As a writer, I want to export an entire project as a combined DOCX | P1 | Project feature |
| As a writer, I want to map TipTap styles to Word styles (Heading 1, Normal, etc.) | P0 | Fidelity |
| As a writer, I want to include metadata (title, author, date) in DOCX properties | P1 | Professional |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Project creation rate | 60% of users create ≥1 project within 7 days | Local analytics |
| Version history usage | 40% of users create ≥1 manual snapshot per week | Local analytics |
| DOCX export success | 95% of exports complete without error | Error tracking |
| Feature adoption (TipTap extensions) | 20% of documents use tables or math | Content analysis |

---

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Project data model too rigid for diverse writing styles | Medium | High | Start with minimal schema, iterate |
| Version history storage grows unbounded | High | Medium | Configurable retention + compression |
| DOCX style fidelity issues | Medium | Medium | Provide preview before export |
| User confusion with project vs document distinction | Medium | High | Onboarding flow + clear UI cues |
