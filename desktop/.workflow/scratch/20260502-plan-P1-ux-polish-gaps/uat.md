---
status: testing
target: P1-ux-polish-gaps
source: [verification.json, review.json, TASK-001-summary.md, TASK-002-summary.md, TASK-003-summary.md, TASK-004-summary.md]
started: "2026-05-02T00:00:00.000Z"
updated: "2026-05-02T00:00:00.000Z"
---

## Current Test

number: 1
name: BookmarkPlus button absent without knowledge panel config
expected: |
  The knowledge panel toggle button (BookmarkPlus icon) does NOT appear in the composer toolbar when no knowledge panel is configured
awaiting: user response

## Tests

### 1. BookmarkPlus button absent without knowledge panel config
expected: The knowledge panel toggle button (BookmarkPlus icon) does NOT appear in the composer toolbar when no knowledge panel is configured
result: [pending]

### 2. Copy button shows Check icon then reverts
expected: After clicking the copy-last-reply button, the icon changes to a checkmark and the label says 'copied!'. After ~1.5 seconds it reverts to the copy icon with 'copy last reply' label
result: [pending]

### 3. Clear draft button no layout shift
expected: The trash/clear button stays in the same position at all times. When the input is empty, the button appears faded/invisible but does not shift any other toolbar elements. When text is typed, the button fades in smoothly at the same position
result: [pending]

### 4. Draft restores on conversation switch
expected: Type some text in a conversation. Switch to a different conversation, then switch back. The typed text should be restored in the composer
result: [pending]

### 5. Draft does not overwrite on keystroke
expected: While typing in a conversation, the composer should not flicker or reset. Each keystroke updates the input without triggering a draft restore
result: [pending]

### 6. Composer dark mode focus ring
expected: In dark mode, focusing the composer textarea shows a violet/purple focus ring (not the default blue/light ring)
result: [pending]

### 7. Context footer non-interactive
expected: Tabbing through the interface, the context footer area (showing token usage like '~2K tokens') does not receive a focus ring. It is not focusable
result: [pending]

### 8. Toolbar buttons focus rings on keyboard nav
expected: Using Tab to navigate, the toolbar buttons (BookmarkPlus when visible, Trash2 when visible, Copy) show a visible focus ring when focused via keyboard
result: [pending]

### 9. Trash2 excluded from tab order when hidden
expected: When the composer input is empty, pressing Tab should skip over the clear-draft button — it should not receive keyboard focus
result: [pending]

### 10. Rapid conversation switch draft stability
expected: Type text in conversation A. Quickly switch to conversation B then back to A. The draft should show conversation A's text, not conversation B's
result: [pending]

## Summary

total: 10
passed: 0
issues: 0
pending: 10
skipped: 0

## Gaps

[none yet]
