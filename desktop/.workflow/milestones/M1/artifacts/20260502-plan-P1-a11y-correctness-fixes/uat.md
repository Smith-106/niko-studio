---
status: complete
target: P1-a11y-correctness-fixes
source: [verification.json, review.json, EXC-003 summaries]
started: "2026-05-02T00:00:00.000Z"
updated: "2026-05-02T23:45:00.000Z"
---

## Current Test

number: 5
name: Draft restore still works (regression check)
expected: Type text, switch conversation, switch back — draft restored (same as before — regression check)
result: pass

## Tests

### 1. Trash2 excluded from keyboard tab order when input empty
expected: When composer input is empty, pressing Tab should skip the clear-draft button. When input has text, Tab should land on it and show a focus ring
result: pass

### 2. Send button responds to mouse click
expected: Clicking the send button with the mouse should send the message. The button should visually respond to hover and click
result: issue
reported: "点击右下角的发送按钮，无反应"
severity: major
note: z-10 fix from TASK-001 did not resolve the issue. onMouseDown workaround applied — pending verification.
fix_applied: "Added onMouseDown handler as primary trigger (fires on press instead of click). Kept onClick for keyboard accessibility. Removed ineffective relative z-10. Added cursor-pointer."
issue_id: ISS-20260502-065

### 3. Sent message does not reappear as draft
expected: Type a message and send it immediately (within 1 second). Switch conversations and come back. The sent message should NOT appear as a draft in the composer
result: pass

### 4. Copy feedback still works (regression check)
expected: Copy button shows checkmark after click, reverts after ~1.5s (same as before — regression check)
result: pass

### 5. Draft restore still works (regression check)
expected: Type text, switch conversation, switch back — draft restored (same as before — regression check)
result: pass

## Summary

total: 5
passed: 4
issues: 1
pending: 0
skipped: 0

## Gaps

- test: 2
  truth: "Send button responds to mouse click"
  status: fix_applied
  reason: "z-10 fix ineffective — mouse click event not reaching React handler. Applied onMouseDown workaround."
  severity: major
  issue_id: ISS-20260502-065
  fix: "Added onMouseDown with e.preventDefault() as primary trigger, kept onClick for keyboard a11y"
