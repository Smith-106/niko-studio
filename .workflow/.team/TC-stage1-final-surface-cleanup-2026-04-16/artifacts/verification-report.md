# TEST-001 Verification Report

## Scope selection

- Verified the bounded Stage 1 cleanup against the modified desktop surfaces in `AppHeader`, `SettingsModal`, shared translations, and the adjacent shell hook wiring in `useAppHeaderViewModel` and `useAppShellViewModel`.
- Re-ran `typecheck` because the shell hook files changed and part of their patch was wiring/typing related.
- Expanded the regression scope to close the earlier direct-coverage gaps: rendered `McpStatusPanel` top labels, `useAppShellViewModel`, `useAppViewModel`, and one bounded `App` shell integration path that does not mock `useAppViewModel`.
- Kept the suite targeted to the Stage 1 frontstage cleanup path rather than broadening into unrelated desktop flows.

## Commands run

```powershell
npm.cmd run typecheck
npm.cmd test -- src/components/AppHeader.test.tsx src/components/SettingsModal.test.tsx
npm.cmd test -- src/components/McpStatusPanel.test.tsx src/hooks/useAppShellViewModel.test.tsx
npm.cmd test -- src/hooks/useAppViewModel.test.tsx src/hooks/useAppShellViewModel.test.tsx src/components/McpStatusPanel.test.tsx
npm.cmd test -- src/App.shell.test.tsx src/App.test.tsx src/hooks/useAppViewModel.test.tsx src/hooks/useAppShellViewModel.test.tsx
npm.cmd test -- src/App.shell.test.tsx src/App.test.tsx src/components/AppHeader.test.tsx src/components/SettingsModal.test.tsx src/components/McpStatusPanel.test.tsx src/hooks/useAppViewModel.test.tsx src/hooks/useAppShellViewModel.test.tsx
npm.cmd test -- src/App.shell.test.tsx src/App.test.tsx src/hooks/writerWorkflowExperience.test.tsx src/components/KnowledgeModal.test.tsx src/components/ChatArea.test.tsx src/components/EvaluationPanel.test.tsx src/components/AppHeader.test.tsx src/components/SettingsModal.test.tsx src/components/McpStatusPanel.test.tsx src/hooks/useAppViewModel.test.tsx src/hooks/useAppShellViewModel.test.tsx
npm.cmd run check:local
```

Working directory:

```text
D:/工作目录/niko-studio/desktop
```

## Coverage provided

- `npm.cmd run typecheck`
  - Covers the changed hook/type wiring in:
    - `desktop/src/hooks/useAppHeaderViewModel.ts`
    - `desktop/src/hooks/useAppShellViewModel.ts`
    - `desktop/src/hooks/useAppViewModel.ts`
- `src/components/AppHeader.test.tsx`
  - Covers the renamed header recovery CTA and diagnostics button behavior.
- `src/components/McpStatusPanel.test.tsx`
  - Covers the softened top-level detailed diagnostics framing and verifies the old gateway-centric wording is absent.
- `src/components/SettingsModal.test.tsx`
  - Covers the advanced support / connection help flow, direct open-to-diagnostics behavior, and the detailed diagnostics action.
- `src/hooks/useAppShellViewModel.test.tsx`
  - Covers the direct header/chat shell wiring and key shell action routing.
- `src/hooks/useAppViewModel.test.tsx`
  - Covers the shell input collection layer and verifies forwarding into `useAppShellViewModel`.
- `src/App.shell.test.tsx`
  - Covers a bounded real `useAppViewModel` app-shell path and verifies shell prop fan-out plus primary shell actions.
- `src/App.test.tsx`
  - Still covers the skip-link accessibility path; retained alongside the new shell integration test.
- `src/hooks/writerWorkflowExperience.test.tsx`
  - Covers the writer-first workflow path across sidebar, chat, evaluation, and workspace-scoped conversation behavior.
- `src/components/KnowledgeModal.test.tsx`
  - Covers the task-oriented knowledge modal surfaces and the read-only detail path for non-skill tabs.
- `src/components/ChatArea.test.tsx`
  - Covers the writing-first starter actions, chat request wiring, retrieval/explanation output, template actions, and comparison flow.
- `src/components/EvaluationPanel.test.tsx`
  - Covers the lighter default review posture, support tools, workflow actions, retry behavior, and quality-check output.
- `npm.cmd run check:local`
  - Covers the broader local delivery gate: lint, formatting check, full desktop Vitest run, sidecar build selection, sidecar contract validation, and production build.

## Results

- `npm.cmd run typecheck`
  - Status: passed
  - Result: exit code `0`, `tsc --noEmit` completed without reported errors
- `npm.cmd test -- src/components/AppHeader.test.tsx src/components/SettingsModal.test.tsx`
  - Status: passed
  - Test files: `2 passed`
  - Tests: `19 passed`, `0 failed`
  - Notable file counts:
    - `src/components/AppHeader.test.tsx`: `3` tests passed
    - `src/components/SettingsModal.test.tsx`: `16` tests passed
- `npm.cmd test -- src/components/McpStatusPanel.test.tsx src/hooks/useAppShellViewModel.test.tsx`
  - Status: passed
  - Test files: `2 passed`
  - Tests: `6 passed`, `0 failed`
- `npm.cmd test -- src/hooks/useAppViewModel.test.tsx src/hooks/useAppShellViewModel.test.tsx src/components/McpStatusPanel.test.tsx`
  - Status: passed
  - Test files: `3 passed`
  - Tests: `7 passed`, `0 failed`
- `npm.cmd test -- src/App.shell.test.tsx src/App.test.tsx src/hooks/useAppViewModel.test.tsx src/hooks/useAppShellViewModel.test.tsx`
  - Status: passed
  - Test files: `4 passed`
  - Tests: `5 passed`, `0 failed`
- `npm.cmd test -- src/App.shell.test.tsx src/App.test.tsx src/components/AppHeader.test.tsx src/components/SettingsModal.test.tsx src/components/McpStatusPanel.test.tsx src/hooks/useAppViewModel.test.tsx src/hooks/useAppShellViewModel.test.tsx`
  - Status: passed
  - Test files: `7 passed`
  - Tests: `28 passed`, `0 failed`
- `npm.cmd test -- src/App.shell.test.tsx src/App.test.tsx src/hooks/writerWorkflowExperience.test.tsx src/components/KnowledgeModal.test.tsx src/components/ChatArea.test.tsx src/components/EvaluationPanel.test.tsx src/components/AppHeader.test.tsx src/components/SettingsModal.test.tsx src/components/McpStatusPanel.test.tsx src/hooks/useAppViewModel.test.tsx src/hooks/useAppShellViewModel.test.tsx`
  - Status: passed
  - Test files: `11 passed`
  - Tests: `79 passed`, `0 failed`
- `npm.cmd run check:local`
  - Status: passed
  - Gate summary:
    - `lint`: passed
    - `format:check`: passed
    - full desktop `test`: passed with `32` test files and `208` tests green
    - `build:sidecar`: passed
    - `validate:sidecar-contract`: passed
    - `build`: passed

## Failing cases

- None in the selected regression scope.

## Residual gaps and risk

- The earlier direct-coverage gaps for `McpStatusPanel`, `useAppShellViewModel`, and `useAppViewModel` are now closed.
- `src/App.shell.test.tsx` gives bounded shell integration evidence, but it still uses stubbed child renderers and mocked input hooks; it is not a full production-like browser/E2E regression.
- A broader frontstage-oriented Vitest slice and the full local desktop gate now both pass, but no true browser/E2E runner was added for production-like desktop rendering.

## Pass/fail summary

- Overall status: pass
- Evidence set: `typecheck` + targeted component/hook/app-shell tests + broader frontstage regression + full local desktop gate
- Aggregate result: latest broader frontstage regression `79/79` tests passed, and `check:local` passed with `208/208` desktop tests green plus lint/build/contract validation
