# Phase 2 Analysis — 6-Dimension Scoring

**Milestone:** M8 | **Phase:** 2 — Export & Editor Extensions

---

## 1. Technical Feasibility: 9/10

**Evidence:**
- `docx` npm package is mature (1M+ weekly downloads), pure JS, synchronous API
- TipTap table extensions are official community packages with stable API
- KaTeX is well-established (used by Khan Academy, GitHub)
- Existing `nodeToMarkdown`/`nodeToHtml` pattern in `export.ts` provides clear template for `nodeToDocx`
- Phase 1 project structure provides all needed APIs for multi-chapter export

**Risks:**
- KaTeX ~300KB bundle size (mitigated: lazy loading per L-005)
- DOCX math rendering limited to text fallback (GA-001, low impact)

---

## 2. Architecture Fit: 9/10

**Evidence:**
- ExportDialog already has format selection pattern — adding 'docx' is additive
- `export.ts` recursive converter pattern scales naturally to `nodeToDocx`
- TipTap extension system designed for adding new node types
- Phase 1 project slice provides `getChaptersForProject()` for multi-chapter export
- No architectural changes needed — all new code extends existing patterns

**Risks:**
- Custom Callout extension must follow TipTap Node API correctly (well-documented)

---

## 3. Dependency Risk: 7/10

**Evidence:**
- 6 new npm packages (docx, katex, 4x @tiptap/extension-table-*)
- All packages are well-maintained with active communities
- docx: pure JS, no native deps, no build tool requirements
- @tiptap/extension-table: official TipTap ecosystem, version-compatible with existing TipTap packages
- katex: stable, widely used, CSS + JS only

**Risks:**
- TipTap table package version must match existing @tiptap/* packages in package.json
- KaTeX CSS must be loaded alongside JS (need to verify bundler handles CSS import)
- Potential version conflicts across TipTap ecosystem packages

---

## 4. Testability: 8/10

**Evidence:**
- DOCX generation output is a Blob/ArrayBuffer — can verify structure programmatically
- TipTap extensions can be tested with `createEditor()` in jsdom environment
- Export converters are pure functions — straightforward unit tests
- Existing test patterns (vitest + vi.mock for Tauri FS) apply directly

**Risks:**
- KaTeX rendering requires DOM — tests need jsdom setup
- Table extension integration tests need TipTap editor instance
- DOCX binary output validation is less readable than text formats

---

## 5. UX Impact: 9/10

**Evidence:**
- DOCX export is a top user request for writing tools
- Table support enables structured content (critical for technical writing)
- Math rendering expands use cases to academic/scientific writing
- Callout blocks improve document structure and readability
- Multi-chapter export (scope='project') leverages Phase 1 project management

**Risks:**
- KaTeX lazy load may cause brief delay on first math input (acceptable per spec)
- Table editing UX depends on community extension defaults (may need custom styling)

---

## 6. Maintenance Burden: 6/10

**Evidence:**
- 6 new dependencies increase update surface area
- Custom Callout extension is project-specific code to maintain
- Export converters for 3 new node types (table, math, callout) add ~150 lines each
- KaTeX version pinning needed to avoid breaking CSS changes

**Risks:**
- TipTap ecosystem upgrades may require coordinated version bumps across all extensions
- Custom extensions must track TipTap API changes across major versions
- DOCX spec edge cases (complex tables, nested content) may surface over time

---

## Overall Score: 48/60 (Go)

**Recommendation:** **GO** — proceed to planning

All dimensions score 6+. Maintenance burden (6) is the lowest due to dependency count, but all packages are mature and the implementation follows existing patterns. No blockers identified.

### Key Strengths
1. Clean architectural fit — extends existing export and editor patterns
2. All new dependencies are mature, well-maintained
3. Phase 1 provides needed project structure APIs
4. Pure additive changes — no refactoring of existing code

### Key Risks to Monitor
1. TipTap package version alignment during install
2. KaTeX bundle size — verify lazy loading works correctly
3. DOCX math output quality (text fallback may disappoint some users)
