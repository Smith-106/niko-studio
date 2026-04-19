# Writer Golden-Path Smoke

## Result

- `task_id`: `EXEC-003`
- `issue_id`: `ISS-20260418-003`
- `baseline`: `4d63e03 / 9.0.8`
- `decision`: `NOT_CLOSED`
- `status`: `retained_package_partial_walkthrough_incomplete`

## What This Session Verified

1. The customer-delivery baseline is frozen to `4d63e03db1f673379901fb827aff1a1f6947faa8 / 9.0.8`.
   - Source: `.workflow/.team/PEX-2026-04-18-client-delivery-remaining-work/artifacts/customer-delivery-baseline-decision.json`
   - Source: `.workflow/evidence/release/customer-delivery-baseline.json`
   - Source: `release-check-summary.md`
2. The retained release package artifacts that match that baseline still exist locally.
   - `desktop/src-tauri/target/release/niko-studio-desktop.exe` (`LastWriteTime: 2026-04-16 00:34:46 +08:00`)
   - `desktop/src-tauri/target/release/bundle/nsis/Niko-Studio_9.0.8_x64-setup.exe` (`LastWriteTime: 2026-04-16 00:34:46 +08:00`)
   - `desktop/src-tauri/target/release/bundle/msi/Niko-Studio_9.0.8_x64_en-US.msi` (`LastWriteTime: 2026-04-16 00:33:35 +08:00`)
3. The retained `zh-CN` MSI is already installed on this host and remains bound to the frozen package set.
   - Installed product code: `{0DBAF73C-D2E8-4274-B5E1-918973BA41B0}`
   - Install location: `D:\写作\`
   - Install source: `D:\工作目录\niko-studio\desktop\src-tauri\target\release\bundle\msi\`
   - Cached local package: `C:\WINDOWS\Installer\ca59f82.msi`
   - Matching retained package: `desktop/src-tauri/target/release/bundle/msi/Niko-Studio_9.0.8_x64_zh-CN.msi`
4. The previous blocked note remains the same one recorded on `2026-04-13`.
   - Source: `.workflow/.csv-wave/cwp-client-delivery-handoff-20260413/context.md`
   - Prior statement: the live writer smoke was blocked by a local Chrome DevTools MCP browser/profile lock, leaving the session in a historical blocked-note state.
5. This retained-package attempt directly reached multiple frozen UI surfaces.
   - Launch evidence: `.workflow/.team/TC-2026-04-18-retained-handoff-closeout/artifacts/launch-window-foreground.png`
   - New document attempt evidence: `.workflow/.team/TC-2026-04-18-retained-handoff-closeout/artifacts/after-new-doc-click.png`
   - Settings evidence: `.workflow/.team/TC-2026-04-18-retained-handoff-closeout/artifacts/settings-entry-attempt-3.png`
   - Knowledge evidence: `.workflow/.team/TC-2026-04-18-retained-handoff-closeout/artifacts/knowledge-entry-attempt-3.png`

## Why This Session Did Not Mark The Note Closed

1. The session did reach the retained package, but it still did not directly verify the editor-plus-helper golden path.
   - `新建文档` created a left-side `新对话` entry, but the center pane stayed on the landing surface `小说创作助手`.
   - Evidence: `.workflow/.team/TC-2026-04-18-retained-handoff-closeout/artifacts/after-new-doc-click.png`
2. A direct keyboard paste attempt into the center pane produced no visible edited text.
   - Evidence: `.workflow/.team/TC-2026-04-18-retained-handoff-closeout/artifacts/after-text-entry-attempt.png`
3. Because a writable retained-package document was not directly verified, this session cannot truthfully claim retained-package Writing Helper success on document text.
4. The retained knowledge surface opened, but the screen also displayed `保存角色失败，请稍后重试。`
   - Evidence: `.workflow/.team/TC-2026-04-18-retained-handoff-closeout/artifacts/knowledge-entry-attempt-3.png`
5. Newer local debug/browser surfaces remain explicitly excluded from smoke-closing evidence.
   - `.codex-run/local-shell-4177.out.log` shows `local:shell` serving a `2026-04-18` browser shell against `.codex-run/desktop-local-state.json`.
   - `desktop/src-tauri/target/x86_64-pc-windows-msvc/debug/niko-studio-desktop.exe` has `LastWriteTime: 2026-04-18 00:59:39 +08:00`.
   - Those artifacts are useful for local debugging, but they still cannot be promoted to customer-delivery evidence for frozen `4d63e03 / 9.0.8`.

## Current Closure State

The prior blocked-note gap is **still unresolved**. What is resolved here is the ambiguity around retained execution:

- the retained installed surface is now bound to the frozen `zh-CN` MSI,
- the retained package is shown launching on this host,
- the non-qualifying local debug surfaces are explicitly excluded,
- the settings and knowledge surfaces are directly evidenced,
- the remaining unverified gap is narrowed to the actual writer/editor/helper flow.

## Hold Artifacts

- Retained blocker source: `.workflow/.team/TC-2026-04-18-retained-handoff-closeout/artifacts/retained-writer-smoke-attempt.md`
- Current hold-status source: `.workflow/.team/TC-2026-04-18-retained-handoff-closeout/artifacts/final-handoff-status.md`
- Interpretation rule: this smoke artifact remains the content-level source of the blocker, while overall customer-delivery readiness stays on hold under the retained closeout artifacts above.

## Required Next Action

Run one manual operator walkthrough using the already bound retained install `D:\写作\niko-studio-desktop.exe` or a clean host installed from the same retained `desktop/src-tauri/target/release/bundle/msi/Niko-Studio_9.0.8_x64_zh-CN.msi`, capture launch/editor/helper/settings/knowledge screenshots plus an operator note, then update this artifact and `writer-golden-path-smoke.json` to `decision = CLOSED` only if the retained writer path completes without a customer-blocking defect.
