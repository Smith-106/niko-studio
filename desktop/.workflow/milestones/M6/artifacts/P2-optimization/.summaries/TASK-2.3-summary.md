# TASK-2.3 Summary: Add missing Zustand selectors

**Status**: Completed

## Changes
Added 3 targeted selectors to `src/stores/selectors.ts`:
- `useSelectConversation` — selects `selectConversation` from appStore
- `useCheckBackend` — selects `checkBackend` from appStore
- `useBackendStatus` — selects `backendStatus` from appStore

## Convergence
- `useSelectConversation` present: yes
- `useCheckBackend` present: yes
- `useBackendStatus` present: yes

## Notes
- Follows existing selector patterns (single-state-slice subscription)
- These selectors enable downstream tasks (TASK-2.4, TASK-2.5) to replace bare `useAppStore()` calls
