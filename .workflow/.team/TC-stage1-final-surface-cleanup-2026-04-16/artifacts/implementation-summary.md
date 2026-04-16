# IMPL-001 Implementation Summary

## Files changed

- `D:/工作目录/niko-studio/desktop/src/components/AppHeader.tsx`
- `D:/工作目录/niko-studio/desktop/src/components/SettingsModal.tsx`
- `D:/工作目录/niko-studio/desktop/src/i18n/translations.ts`
- `D:/工作目录/niko-studio/desktop/src/components/AppHeader.test.tsx`
- `D:/工作目录/niko-studio/desktop/src/components/McpStatusPanel.test.tsx`
- `D:/工作目录/niko-studio/desktop/src/components/SettingsModal.test.tsx`
- `D:/工作目录/niko-studio/desktop/src/hooks/useAppHeaderViewModel.ts`
- `D:/工作目录/niko-studio/desktop/src/hooks/useAppShellViewModel.ts`
- `D:/工作目录/niko-studio/desktop/src/hooks/useAppShellViewModel.test.tsx`
- `D:/工作目录/niko-studio/desktop/src/hooks/useAppViewModel.test.tsx`
- `D:/工作目录/niko-studio/desktop/src/App.shell.test.tsx`

## User-facing outcome

- Header recovery CTA now uses `查看连接` / `Check connection` instead of diagnostics wording.
- Settings advanced-support labels now read `连接与本地服务` / `Connection & local service`, `本地服务设置` / `Local service settings`, and `本地服务地址` / `Local service address`.
- Settings diagnostics section now reads `连接帮助` / `Connection help` and no longer shows inline `Gateway metrics` or `Tool list` cards.
- The lightweight diagnostics path keeps refresh, a short help hint, and the button that opens the full detailed panel.
- Detailed diagnostics top framing is softened via translations: `连接详情` / `Connection details`, `连接状态` / `Connection status`, `连接情况` / `Connection`, and `恢复状态` / `Recovery`.

## Tests updated

- `D:/工作目录/niko-studio/desktop/src/components/AppHeader.test.tsx`
- `D:/工作目录/niko-studio/desktop/src/components/McpStatusPanel.test.tsx`
- `D:/工作目录/niko-studio/desktop/src/components/SettingsModal.test.tsx`
- `D:/工作目录/niko-studio/desktop/src/hooks/useAppShellViewModel.test.tsx`
- `D:/工作目录/niko-studio/desktop/src/hooks/useAppViewModel.test.tsx`
- `D:/工作目录/niko-studio/desktop/src/App.shell.test.tsx`

## Follow-up verification hardening

- Added direct rendered-label coverage for the softened `McpStatusPanel` top framing so `Connection details / Connection status / Connection / Recovery` is pinned by component tests.
- Added direct hook coverage for `useAppShellViewModel` so header/chat shell wiring is verified without relying only on downstream component behavior.
- Added direct hook coverage for `useAppViewModel` so shell input collection and forwarding into `useAppShellViewModel` is pinned.
- Added a lightweight `App` shell integration test that uses the real `useAppViewModel` path while stubbing child renderers, giving one bounded end-to-end check of shell prop fan-out and primary shell actions.

## Verification

- `npm.cmd run typecheck`
- `npm.cmd test -- src/components/AppHeader.test.tsx src/components/SettingsModal.test.tsx`
- `npm.cmd test -- src/components/McpStatusPanel.test.tsx src/hooks/useAppShellViewModel.test.tsx`
- `npm.cmd test -- src/hooks/useAppViewModel.test.tsx src/hooks/useAppShellViewModel.test.tsx src/components/McpStatusPanel.test.tsx`
- `npm.cmd test -- src/App.shell.test.tsx src/App.test.tsx src/hooks/useAppViewModel.test.tsx src/hooks/useAppShellViewModel.test.tsx`
- `npm.cmd test -- src/App.shell.test.tsx src/App.test.tsx src/components/AppHeader.test.tsx src/components/SettingsModal.test.tsx src/components/McpStatusPanel.test.tsx src/hooks/useAppViewModel.test.tsx src/hooks/useAppShellViewModel.test.tsx`

## Residual risks or deferred items

- The explicit button label `打开详细诊断` / `Open detailed diagnostics` was left unchanged to keep this patch inside the approved wording slice.
- Two pre-existing shell-path typecheck breaks in `useAppHeaderViewModel.ts` and `useAppShellViewModel.ts` were fixed as part of verification so the bounded patch could pass `tsc`.
- There is now bounded shell-level coverage, but no full browser/E2E path that exercises the real child components and stores together under production-like rendering.
