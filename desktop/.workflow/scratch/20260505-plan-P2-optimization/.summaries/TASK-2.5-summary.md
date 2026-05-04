# TASK-2.5 Summary: Replace useAppStore() in SettingsModal and useAppViewModel

**Status**: Completed

## Changes
- `src/components/SettingsModal.tsx`: Replaced `const { checkBackend } = useAppStore()` with `useCheckBackend()` from `../stores/selectors`
- `src/hooks/useAppViewModel.ts`: Replaced `const { backendStatus, checkBackend } = useAppStore()` with `useBackendStatus()` and `useCheckBackend()` from `../stores/selectors`

## Convergence
- `useAppStore()` removed from SettingsModal.tsx: yes
- `useAppStore()` removed from useAppViewModel.ts: yes
- `useCheckBackend` in SettingsModal.tsx: yes
- `useBackendStatus` in useAppViewModel.ts: yes
- `useCheckBackend` in useAppViewModel.ts: yes

## Test fixes required
- `useAppViewModel.test.tsx`: Added `useBackendStatusMock` and `useCheckBackendMock` to hoisted mocks, updated selectors mock to wire them, added `.mockReturnValue()` calls in both test cases
- `App.shell.test.tsx`: Added `useBackendStatus: vi.fn()` and `useCheckBackend: vi.fn()` to selectors mock
- All 899 tests pass after fixes
