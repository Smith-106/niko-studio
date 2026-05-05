# F-003: DOCX & Advanced Export

> Priority: MEDIUM | Phase: M8-P2 | Depends: F-001 (project context for multi-chapter export)
> Roles: product-manager, system-architect

---

## Requirements Summary

Extend the existing export system (currently PDF-only via window.print()) to support DOCX format. This is a deferred item from M7 and addresses the publisher/editor workflow need.

**MUST**:
- Export single chapter as DOCX with style mapping
- Export entire project as combined DOCX with page breaks between chapters
- Map TipTap formatting to Word styles (headings, bold, italic, lists, blockquotes)
- Include document metadata (title, author) in DOCX properties

**SHOULD**:
- Title page generation for project-level export
- Table of contents generation
- Export preview before download
- Custom style templates (choose from preset Word styles)

**MAY**:
- EPUB export
- HTML export (clean, styled)
- Custom header/footer in exported document

---

## Design Decisions (40%+)

1. **docx.js library**: Use the `docx` npm package for DOCX generation. Runs in renderer process, no native dependencies. MIT licensed, actively maintained.

2. **Extend existing ExportDialog**: Add format selector (PDF/DOCX) and scope selector (current chapter/entire project) to the existing modal rather than creating a new one.

3. **Style mapping table**: Explicit mapping from TipTap node types to Word styles. No "smart" style inference — predictable, testable.

4. **Project export as concatenation**: Combine chapters sequentially with page breaks. Simple approach that works for novels. No need for complex Word master documents.

5. **Synchronous generation for <100k words**: DOCX generation for typical documents (<100k words) completes in <2s. No need for Web Worker in V1. Add worker if performance issues arise.

---

## Interface Contract

### Export Service (Frontend)

```typescript
interface ExportOptions {
  format: 'pdf' | 'docx'
  scope: 'current' | 'project'
  includeTitlePage: boolean
  includeToc: boolean
  metadata: {
    title: string
    author: string
    date: string
  }
}

function exportDocument(options: ExportOptions): Promise<void>
function generateDocx(content: TipTapJSON, options: ExportOptions): Promise<Blob>
function generateProjectDocx(projectId: string, options: ExportOptions): Promise<Blob>
```

### Style Mapping

```typescript
const TIPTAP_TO_DOCX: Record<string, string> = {
  'heading': (attrs) => `Heading ${attrs.level}`,
  'paragraph': 'Normal',
  'bulletList': 'List Bullet',
  'orderedList': 'List Number',
  'blockquote': 'Quote',
  'codeBlock': 'Code',
  'bold': 'Strong',
  'italic': 'Emphasis',
  'strike': 'Strikethrough',
  'image': 'InlineImage',
}
```

---

## Constraints & Risks

| Constraint | Impact | Mitigation |
|-----------|--------|------------|
| docx.js bundle size (~200KB) | Increases frontend bundle | Acceptable for desktop app |
| Image embedding requires base64 encoding | Memory spike for image-heavy docs | Stream images, warn for >50MB |
| Complex TipTap nodes may not have DOCX equivalent | Formatting loss | Document unsupported nodes, offer fallback |
| Chinese font support in DOCX | Default fonts may not render | Embed fonts or specify system fonts |

---

## Acceptance Criteria

- [ ] Export single chapter as DOCX with correct style mapping
- [ ] Export entire project as combined DOCX
- [ ] Heading styles (H1-H3) map correctly to Word heading styles
- [ ] Bold, italic, strikethrough formatting preserved
- [ ] Lists (ordered/unordered) render correctly in Word
- [ ] Metadata (title, author, date) embedded in DOCX properties
- [ ] Export dialog shows format and scope options
- [ ] PDF export continues to work unchanged

---

## Cross-Feature Dependencies

- **F-001 (Project Management)**: Required for project-level export
- **F-002 (Version History)**: Export from specific snapshot (nice-to-have)
