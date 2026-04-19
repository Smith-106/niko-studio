# Retained Writer Smoke Attempt

## Outcome

- `task_id`: `TEST-001`
- `baseline`: `4d63e03 / 9.0.8`
- `attempted_at`: `2026-04-18T20:17:47.9652072+08:00`
- `decision`: `NOT_CLOSED`
- `status`: `retained_package_partial_walkthrough_incomplete`

## Method

1. Confirmed the frozen baseline and retained package set from:
   - `.workflow/evidence/release/customer-delivery-baseline.json`
   - `.workflow/.team/PEX-2026-04-18-client-delivery-remaining-work/artifacts/writer-golden-path-smoke.md`
   - `.workflow/.team/PEX-2026-04-18-client-delivery-remaining-work/artifacts/writer-smoke-operator-plan.md`
2. Verified the retained package files still exist with `2026-04-16` timestamps:
   - `desktop/src-tauri/target/release/bundle/nsis/Niko-Studio_9.0.8_x64-setup.exe`
   - `desktop/src-tauri/target/release/bundle/msi/Niko-Studio_9.0.8_x64_en-US.msi`
   - `desktop/src-tauri/target/release/bundle/msi/Niko-Studio_9.0.8_x64_zh-CN.msi`
3. Tried to restage the frozen installers from an ASCII-only path to avoid the workspace non-ASCII path:
   - staged hashes matched the retained installer hashes exactly
   - NSIS silent run returned `exit_code = 0` but produced no isolated target directory
   - MSI administrative install returned `1603` because Windows Installer detected the product was already installed
4. Bound the existing installed retained surface truthfully instead of switching to a newer debug shell:
   - machine-wide installed product code `{0DBAF73C-D2E8-4274-B5E1-918973BA41B0}`
   - install location `D:\写作\`
   - install source `D:\工作目录\niko-studio\desktop\src-tauri\target\release\bundle\msi\`
   - installed cache package `C:\WINDOWS\Installer\ca59f82.msi`
   - the same product code belongs to retained `Niko-Studio_9.0.8_x64_zh-CN.msi`
5. Launched `D:\写作\niko-studio-desktop.exe` and captured retained-package UI evidence.

## Direct Retained-Package Evidence

- Launch reached a visible `Niko-Studio` window on the retained install.
  - Evidence: `launch-window-foreground.png`
- `新建文档` created a left-side `新对话` entry.
  - Evidence: `after-new-doc-click.png`
- The app opened the settings surface on the retained package.
  - Evidence: `settings-entry-attempt-3.png`
- The app opened the knowledge base surface on the retained package.
  - Evidence: `knowledge-entry-attempt-3.png`

## Exact Blocker Notes

1. The retained package did not yield a directly verified writable document during this attempt.
   - After `新建文档`, the center pane still showed the landing surface `小说创作助手`.
   - Evidence: `after-new-doc-click.png`
2. A direct keyboard paste attempt into the center pane produced no visible editor text.
   - Evidence: `after-text-entry-attempt.png`
3. Because no writable document was directly verified, I could not truthfully claim a retained-package Writing Helper success on document text.
4. The retained knowledge surface also showed an error banner on entry: `保存角色失败，请稍后重试。`
   - Evidence: `knowledge-entry-attempt-3.png`

## Conclusion

This attempt closes the old ambiguity about whether the retained package can be launched here: it can, and the retained installed surface is bound to the frozen `9.0.8` MSI set.

It does **not** close the writer golden-path smoke. I did not directly verify:

- a writable retained-package document with visible edited text
- a retained-package Writing Helper completion or non-error response on that document
- a retained-package return from helper/settings/knowledge back to a confirmed usable writing surface

## Narrowest Next Action

Run one manual operator walkthrough on the already bound retained install `D:\写作\niko-studio-desktop.exe` or on a clean host installed from the same retained `zh-CN` MSI, and capture:

- launch
- visible edited text in the main writing surface
- Writing Helper response on that text
- settings
- knowledge entry

Only then should the shared smoke note move to `CLOSED`.
