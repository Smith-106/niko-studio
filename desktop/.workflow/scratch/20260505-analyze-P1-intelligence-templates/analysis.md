# Analysis: M9 Phase 1 — Intelligence & Templates

## 6-Dimension Scoring

### D1: Feasibility — 9/10

**Evidence:**
- Project hierarchy (Project→Volume→Chapter) fully operational since M8
- Tauri filesystem persistence pattern well-established (`projectFileService.ts`)
- Content hashing already implemented (SHA-256 in `projectFileService.ts:hashContent()`)
- Gateway agent endpoints (write/revise/route) provide AI call infrastructure
- TipTap JSON is the canonical content format — templates reuse it directly
- 1062+ existing tests passing — stable codebase to build on

**Gap:** Sidecar may need new endpoints for analysis orchestration, or the frontend can drive multi-step analysis using existing agent endpoints.

### D2: Impact — 8/10

**Evidence:**
- Cross-chapter narrative analysis is a clear differentiator for writing tools
- Template system reduces friction for new chapter creation
- Both features leverage existing infrastructure — high value-to-effort ratio
- Intelligence results cached for incremental updates — sustainable for long documents

**Risk:** Analysis quality depends on LLM prompt engineering. False positives in consistency checking could frustrate users.

### D3: Complexity — 6/10

**Evidence:**
- F-004 is moderate: orchestration of existing AI calls + caching + UI
- F-006 is low: CRUD service + file I/O + minimal UI additions
- No new ML models or dependencies
- No database changes (filesystem-based caching consistent with existing patterns)
- Total estimated: ~800-1000 LOC new code + ~300 LOC tests

**Risk:** Multi-chapter analysis orchestration has edge cases (partial failures, progress tracking, cancellation).

### D4: Dependencies — 9/10

**Evidence:**
- All dependencies satisfied by M8:
  - Project hierarchy ✓
  - Tauri filesystem ✓
  - Content hashing ✓
  - Gateway AI calls ✓
  - TipTap editor ✓
- No external packages needed
- No sidecar changes required if frontend orchestrates analysis via existing agent endpoints

**Gap:** If sidecar analysis endpoints are preferred, a sidecar PR is needed. Frontend-only orchestration is simpler.

### D5: Test Coverage — 7/10

**Evidence:**
- Existing test patterns: Zustand slice tests, API mock tests, component rendering tests
- Intelligence service: test analysis orchestration with mocked gateway calls
- Template service: test CRUD operations with Tauri filesystem mocks
- UI: test new components + integration with existing panels
- 1062 tests provide regression safety net

**Risk:** Testing multi-chapter analysis orchestration requires careful mocking of sequential async calls.

### D6: Specification Clarity — 8/10

**Evidence:**
- F-004 and F-006 feature specs are detailed with interface contracts
- Success criteria are measurable (character arc timeline, tension curve, etc.)
- Design decisions documented (prompt-based, on-demand, filesystem cache)
- Placeholder syntax defined (`{{variable_name}}`)

**Gap:** Chinese readability formula needs specification. UI layout for analysis results needs design.

---

## Overall Score: 7.8/10

**Recommendation: GO**

All dependencies satisfied. Complexity is moderate. The two features are orthogonal and can be implemented independently within the same phase.

## Key Files to Modify/Create

### New Files
| File | Purpose |
|------|---------|
| `src/services/intelligenceService.ts` | Cross-chapter analysis orchestration + caching |
| `src/services/templateService.ts` | Template CRUD + placeholder substitution |
| `src/api/intelligence.ts` | Analysis API calls (extend gateway) |
| `src/stores/app/intelligenceSlice.ts` | Analysis state in Zustand |
| `src/stores/app/templateSlice.ts` | Template state in Zustand |
| `src/templates/*.json` | Built-in template definitions |
| `src/components/intelligence/AnalysisPanel.tsx` | Main analysis UI |
| `src/components/intelligence/CharacterArcTimeline.tsx` | Character arc visualization |
| `src/components/intelligence/PacingCurve.tsx` | Tension curve chart |
| `src/components/intelligence/ConsistencyReport.tsx` | Consistency findings list |
| `src/components/intelligence/ReadabilityScore.tsx` | Readability metrics display |
| `src/components/templates/TemplateBrowser.tsx` | Template selection UI |
| `src/components/templates/TemplatePreview.tsx` | Template content preview |
| `src/components/templates/PlaceholderForm.tsx` | Variable fill-in form |
| `src/components/templates/SaveAsTemplateDialog.tsx` | Save chapter as template |

### Modified Files
| File | Change |
|------|--------|
| `src/stores/appStore.ts` | Register new slices |
| `src/components/AppRightPanels.tsx` | Add Analysis tab |
| `src/components/DocumentEditor.tsx` | Add "Save as Template" action |
| `src/stores/app/projectSlice.ts` | Add template-based chapter creation |
| `src/api/analysis.ts` | Extend or replace with intelligence API |
| `src/components/intelligence/index.ts` | Export new components |
