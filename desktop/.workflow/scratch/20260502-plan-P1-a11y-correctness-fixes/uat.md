---
status: testing
target: P1-a11y-correctness-fixes
source: [verification.json, review.json, EXC-003 summaries]
started: "2026-05-02T00:00:00.000Z"
updated: "2026-05-02T00:00:00.000Z"
---

## Current Test

number: 1
name: Trash2 excluded from keyboard tab order when input empty
expected: |
  When composer input is empty, pressing Tab should skip the clear-draft button. When input has text, Tab should land on it and show a focus ring
awaiting: user response

## Tests

### 1. Trash2 excluded from keyboard tab order when input empty
expected: When composer input is empty, pressing Tab should skip the clear-draft button. When input has text, Tab should land on it and show a focus ring
result: [pending]

### 2. Send button responds to mouse click
expected: Clicking the send button with the mouse should send the message. The button should visually respond to hover and click
result: [pending]

### 3. Sent message does not reappear as draft
expected: Type a message and send it immediately (within 1 second). Switch conversations and come back. The sent message should NOT appear as a draft in the composer
result: [pending]

### 4. Copy feedback still works (regression check)
expected: Copy button shows checkmark after click, reverts after ~1.5s (same as before — regression check)
result: [pending]

### 5. Draft restore still works (regression check)
expected: Type text, switch conversation, switch back — draft restored (same as before — regression check)
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0

## Gaps

[none yet]
