# UX Expert Analysis: Niko-Studio 下一阶段方向

> Role: UX Expert
> Date: 2026-05-05

---

## Current UX Audit

### Strengths
- **Sidebar navigation**: Clean, functional, good icon use
- **Skip link + ARIA**: Accessibility foundation solid
- **Toast notifications**: Non-intrusive feedback system
- **ErrorBoundary**: Graceful degradation
- **Dark mode**: Properly implemented with CSS variables
- **Chat sidebar**: Contextual AI assistance without disrupting writing flow

### Weaknesses
- **Flat document model**: No sense of project/chapter hierarchy
- **Editor-only layout**: All features compete for screen space
- **No undo history visibility**: Users can't see or navigate revision timeline
- **Modal-heavy workflows**: Knowledge, export, settings all use modals
- **Information density**: Feature-rich panels can overwhelm new users

---

## Feature UX Design Principles

### P1: Writing Flow Preservation
New features MUST NOT interrupt the writing flow. The editor remains the primary focus area at all times.

### P2: Progressive Disclosure
Complex features (project management, version history) should be invisible until needed. Default view remains simple.

### P3: Contextual Anchoring
Every new panel/feature should anchor to the user's current context (current chapter, current selection, current project).

---

## UX Recommendations by Feature

### F-001: Project Management

**Navigation Model**: Tree sidebar replacing current flat document list

```
┌─────────────────────────────────────────────────┐
│ 📁 My Novel                    [+ New Chapter]  │
│ ├─ 📖 Volume 1: Beginning                      │
│ │  ├─ Ch 1: The Arrival          ■■■□□  3.2k   │
│ │  ├─ Ch 2: First Contact        ■■□□□  1.8k   │
│ │  └─ Ch 3: The Decision         ■□□□□  800    │
│ ├─ 📖 Volume 2: Rising Action                   │
│ │  └─ Ch 4: The Chase            □□□□□  0      │
│ └─ 📋 Notes & Outline            —      2.1k   │
├─────────────────────────────────────────────────┤
│ Stats: 4 chapters | 7.9k words | Last edited 2h │
└─────────────────────────────────────────────────┘
```

**Key UX decisions**:
- Project switcher in sidebar header (dropdown, not modal)
- Chapter list shows progress bar (word count vs target)
- Drag-and-drop reordering with visual feedback
- Right-click context menu for chapter operations (rename, delete, duplicate, export)
- Inline word-count editing (click to set target)

**Onboarding**: First-time project creation wizard — 3 steps: Name → Genre → Import existing docs?

### F-002: Version History

**Interaction Model**: Timeline rail attached to editor

```
┌─ Editor ────────────────────────┬─ History Rail ──┐
│                                  │ ● Now (autosave) │
│  [Document content...]           │ ○ 14:30 Manual   │
│                                  │   "After rewrite" │
│                                  │ ○ 13:15 Autosave │
│                                  │ ○ 11:00 Manual   │
│                                  │   "Morning draft" │
│                                  │ ─────────────── │
│                                  │ [Compare] [Restore]│
└──────────────────────────────────┴─────────────────┘
```

**Key UX decisions**:
- History rail as collapsible side panel (default: hidden)
- Click snapshot to preview in read-only mode
- "Compare" opens split-view with diff highlights
- Autosave snapshots are dimmed (less prominent than manual)
- Keyboard shortcut: Ctrl+Shift+H to toggle history
- Confirmation dialog before restore with preview

**Critical flow**: Restore must show "This will replace current content. Create snapshot first?" prompt.

### F-003: DOCX Export

**Interaction Model**: Enhanced ExportDialog

```
┌─ Export ──────────────────────────────────┐
│ Format: [PDF ▼]  →  [DOCX]              │
│                                           │
│ Scope:  ● Current chapter                │
│         ○ Entire project (combined)       │
│         ○ Selected chapters               │
│                                           │
│ Style:  ● Preserve formatting             │
│         ○ Custom template                 │
│                                           │
│ Include: ☑ Title page  ☑ Metadata         │
│          ☐ Table of contents              │
│                                           │
│ [Preview]          [Export]               │
└───────────────────────────────────────────┘
```

**Key UX decisions**:
- Extend existing ExportDialog (not new modal)
- Format selector with clear icons (PDF icon, DOCX icon)
- "Entire project" option only shown when project exists
- Preview opens in read-only view before download
- Progress bar for large document assembly

### F-005: TipTap Extensions

**Table UX**:
- Insert via `/table` slash command or toolbar button
- Row/column operations via right-click or floating toolbar
- Resize handles on columns
- Minimal: merge cells in V2 (not V1)

**Math UX**:
- Insert via `/math` or `$$` inline trigger
- Live preview as user types LaTeX
- Click to edit, click-away to render

**Callout Blocks**:
- Insert via `/callout` or `/note`
- 4 variants: info, warning, tip, important (color-coded)
- Inline editable, no modal needed

---

## Accessibility Considerations

| Feature | A11y Requirement |
|---------|-----------------|
| Project tree | ARIA tree role, keyboard navigation (arrow keys), focus management |
| Drag-and-drop | Keyboard alternative (move up/down buttons), screen reader announcements |
| Version history | Timeline navigable via keyboard, diff view has text alternative |
| DOCX export | All form controls labeled, progress announced |
| Tables | Proper `<th>` headers, scope attributes, caption support |
| Math | Alt text for rendered equations, LaTeX source accessible |

---

## Responsive Layout Strategy

Current 1200×800 min is maintained. Key breakpoints:

- **≥1400px**: Full layout — sidebar + editor + history rail + chat sidebar
- **1200-1399px**: Collapsed sidebar icons + editor + toggleable panels
- **<1200px**: Not supported (min-width enforced)

New panels (history rail, project stats) should follow the existing `AppRightPanels` overlay pattern — slide-in from right, dismissible.

---

## Animation & Transition Guidelines

| Element | Transition | Duration |
|---------|-----------|----------|
| History rail open/close | Slide + fade | 200ms ease-out |
| Chapter switch | Cross-fade | 150ms |
| Drag-and-drop reorder | Translate + shadow | 150ms |
| Snapshot comparison highlight | Background color pulse | 300ms |
| Project switcher dropdown | Scale + fade | 150ms |

All transitions respect `prefers-reduced-motion`.
