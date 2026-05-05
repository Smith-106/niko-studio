# F-005: Custom TipTap Extensions

> Priority: MEDIUM | Phase: M8-P2 | Depends: None
> Roles: ux-expert, system-architect

---

## Requirements Summary

Extend the TipTap editor with table support, math/KaTeX rendering, and callout/admonition blocks. These are deferred from M6 and address the academic/technical writing segment.

**MUST**:
- Table extension: Insert table, add/remove rows and columns, cell editing
- Math extension: Inline and block math via LaTeX syntax, KaTeX rendering
- Callout blocks: Info, warning, tip, important variants with color coding

**SHOULD**:
- Table cell merge (V2)
- Floating toolbar for table operations
- Drag-and-drop block reordering

**MAY**:
- Collaborative cursors (deferred — requires multiplayer infrastructure)
- Custom block types via plugin API

---

## Design Decisions (40%+)

1. **Community extensions where available**: Use `@tiptap/extension-table` for tables, existing math extensions for KaTeX. Only build custom where no mature option exists (callouts).

2. **KaTeX for math rendering**: KaTeX is faster than MathJax for desktop app use case (no network dependency, fast render). LaTeX stored as plain text attribute in TipTap node.

3. **Callout as custom node extension**: Simple TipTap Node extension with `type` attribute. 4 preset variants. Extensible via configuration.

4. **Backward compatible**: Existing documents without tables/math/callouts open unchanged. New node types stored as standard TipTap JSON — compatible with export, search, and version history.

---

## Interface Contract

### TipTap Extension Registration

```typescript
// In editor setup
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import { MathInline, MathBlock } from './extensions/math'
import { Callout } from './extensions/callout'

const extensions = [
  Table.configure({ resizable: true }),
  TableRow,
  TableCell,
  TableHeader,
  MathInline,
  MathBlock,
  Callout,
]
```

### Slash Commands

```
/table [rows] [cols]  → Insert table (default 3×3)
/math                 → Insert inline math
/math block           → Insert block math
/callout [type]       → Insert callout (info|warning|tip|important)
```

### Data Format (TipTap JSON)

```json
// Table
{ "type": "table", "content": [{ "type": "tableRow", "content": [...] }] }

// Math inline
{ "type": "mathInline", "attrs": { "latex": "E = mc^2" } }

// Math block
{ "type": "mathBlock", "attrs": { "latex": "\\int_0^\\infty e^{-x} dx = 1" } }

// Callout
{ "type": "callout", "attrs": { "variant": "warning" }, "content": [...] }
```

---

## Constraints & Risks

| Constraint | Impact | Mitigation |
|-----------|--------|------------|
| KaTeX bundle size (~300KB) | Increases frontend bundle | Lazy load math extension |
| Table performance with large tables | 50+ row tables may lag | Virtual rendering for tables >20 rows |
| LaTeX syntax barrier | Non-technical users may struggle | Provide common symbol palette UI |
| TipTap extension API stability | Breaking changes on TipTap updates | Pin TipTap version, test on upgrade |

---

## Acceptance Criteria

- [ ] Table: insert 3×3 table, add row, add column, delete row, edit cell content
- [ ] Math inline: type LaTeX, renders via KaTeX, click to re-edit
- [ ] Math block: display-mode equations with KaTeX rendering
- [ ] Callout: 4 variants rendered with distinct colors and icons
- [ ] All extensions serialize/deserialize correctly in TipTap JSON
- [ ] Existing documents without these nodes open without errors
- [ ] Slash commands trigger extension insertion

---

## Cross-Feature Dependencies

- **F-003 (DOCX Export)**: Tables and math must map to DOCX equivalents
