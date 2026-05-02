# TASK-001: Fix 6 issues in ChatAreaComposer.tsx

## Fixes Applied

### Fix 1 — A11Y-001 (ISS-061): Trash2 tabIndex
- Replaced `aria-hidden={input.length === 0 || undefined}` with `tabIndex={input.length === 0 ? -1 : undefined}` on the Trash2 button (line 121)
- Removed aria-hidden attribute entirely

### Fix 2 — A11Y-002 (ISS-062): Copy live region
- Added `<span role="status" className="sr-only">{copied ? 'Copied!' : ''}</span>` after the copy button (line 140)
- Wrapped both the copy button and live region in a React fragment (`<>...</>`) to satisfy JSX single-child constraint
- Conditioned on `copied !== undefined` so the region only renders when copy state has been initialized

### Fix 3 — CORR-001: Null guard on lastAssistantContent
- Added `if (!lastAssistantContent) return;` as first line of `copyLastReply` (line 56)
- Changed `lastAssistantContent!` to `lastAssistantContent` (removed non-null assertion)

### Fix 4 — ISS-065: Send button mouse click
- Investigated parent structure in ChatArea.tsx — no pointer-events:none, no overlay, no overflow:hidden blocking
- Added `relative z-10` to send button className (line 173) to ensure it renders above any stacking context from the sibling composer div's `focus-within:ring`

### Fix 5 — BP-011: Paperclip focus ring
- Added `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50` to Paperclip button className (line 101)

### Fix 6 — BP-008: setTimeout cleanup
- Removed `setTimeout(() => setCopied(false), 1500)` from `copyLastReply` handler
- Added `useEffect` with proper cleanup pattern (lines 62-66)
- Added `useEffect` to import statement (line 1)

## Convergence Verification (all passed)
- `aria-hidden`: 0 matches
- `tabIndex`: found on Trash2 button (line 121)
- `role="status"`: found on copy live region (line 140) + existing voice status div (line 144)
- `sr-only`: found on copy live region (line 140)
- `lastAssistantContent!`: 0 matches
- `if (!lastAssistantContent)`: found null guard (line 56)
- `focus-visible:ring-2`: 4 matches (Paperclip, BookmarkPlus, Trash2, Copy buttons)
- TypeScript: `npx tsc --noEmit` — 0 errors in ChatAreaComposer.tsx
