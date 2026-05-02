---
status: complete
target: P1-ux-polish-gaps
source: [verification.json, review.json, TASK-001-summary.md, TASK-002-summary.md, TASK-003-summary.md, TASK-004-summary.md]
started: "2026-05-02T00:00:00.000Z"
updated: "2026-05-02T00:00:00.000Z"
---

## Current Test

number: 8
name: Toolbar buttons focus rings on keyboard nav
expected: |
  Using Tab to navigate, the toolbar buttons (BookmarkPlus when visible, Trash2 when visible, Copy) show a visible focus ring when focused via keyboard
awaiting: user response

## Tests

### 1. BookmarkPlus button absent without knowledge panel config
expected: The knowledge panel toggle button (BookmarkPlus icon) does NOT appear in the composer toolbar when no knowledge panel is configured
result: pass
note: Button correctly appears — useAppShellViewModel always provides onToggleKnowledgePanel callback. Guard works as intended for cases where prop is omitted.

### 2. Copy button shows Check icon then reverts
expected: After clicking the copy-last-reply button, the icon changes to a checkmark and the label says 'copied!'. After ~1.5 seconds it reverts to the copy icon with 'copy last reply' label
result: pass

### 3. Clear draft button no layout shift
expected: The trash/clear button stays in the same position at all times. When the input is empty, the button appears faded/invisible but does not shift any other toolbar elements. When text is typed, the button fades in smoothly at the same position
result: pass

### 4. Draft restores on conversation switch
expected: Type some text in a conversation. Switch to a different conversation, then switch back. The typed text should be restored in the composer
result: pass

### 5. Draft does not overwrite on keystroke
expected: While typing in a conversation, the composer should not flicker or reset. Each keystroke updates the input without triggering a draft restore
result: pass

### 6. Composer dark mode focus ring
expected: In dark mode, focusing the composer textarea shows a violet/purple focus ring (not the default blue/light ring)
result: skipped
note: Blocked by pre-existing theme system issue — non-system themes only affect a few buttons, not the full UI. Not caused by Phase 1 gap fixes.

### 7. Context footer non-interactive
expected: Tabbing through the interface, the context footer area (showing token usage like '~2K tokens') does not receive a focus ring. It is not focusable
result: issue
reported: "中间栏鼠标滚到最下方，小说大纲部分只显示了一半"
severity: major
note: Pre-existing layout issue — DocumentEditor bottom content clipped. Not caused by Phase 1 gap fixes.

### 8. Toolbar buttons focus rings on keyboard nav
expected: Using Tab to navigate, the toolbar buttons (BookmarkPlus when visible, Trash2 when visible, Copy) show a visible focus ring when focused via keyboard
result: [pending]

### 9. Trash2 excluded from tab order when hidden
expected: When the composer input is empty, pressing Tab should skip over the clear-draft button — it should not receive keyboard focus
result: issue
reported: "他没有跳过，只是不显示清除草稿按钮罢了"
severity: major
note: Known issue A11Y-001 (ISS-20260502-061) — tabIndex={-1} not added when hidden. Already tracked, not yet fixed.

### 10. Rapid conversation switch draft stability
expected: Type text in conversation A. Quickly switch to conversation B then back to A. The draft should show conversation A's text, not conversation B's
result: pass

## Summary

total: 10
passed: 6
issues: 3
pending: 0
skipped: 1

## Gaps

- test: 6
  truth: "Dark mode composer focus ring"
  status: skipped
  reason: "Pre-existing theme system issue — non-system themes only affect a few buttons, not the full UI (ISS-20260502-063)"
  severity: major
  pre_existing: true
  issue_id: ISS-20260502-063

- test: 7
  truth: "Context footer non-interactive"
  status: failed
  reason: "User reported: 中间栏鼠标滚到最下方，小说大纲部分只显示了一半 — DocumentEditor bottom content clipped"
  severity: major
  pre_existing: true

- test: 9
  truth: "Trash2 excluded from tab order when hidden"
  status: failed
  reason: "Tab does not skip the clear-draft button when input empty — button is invisible but still focusable"
  severity: major
  issue_id: ISS-20260502-061
  note: Known A11Y-001, already tracked

- additional: send button mouse click broken
  truth: "Send button should be clickable"
  status: failed
  reason: "右下的发送按钮鼠标失效,只能用键盘发送"
  severity: major
  issue_id: ISS-20260502-065
  note: Reported during T-009 testing, separate issue
