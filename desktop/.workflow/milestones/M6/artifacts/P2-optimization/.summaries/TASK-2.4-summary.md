# TASK-2.4 Summary: Replace useAppStore() in Sidebar and EvaluationPanel

**Status**: Completed

## Changes
- `src/components/Sidebar.tsx`: Replaced `const { createConversation, selectConversation } = useAppStore()` with targeted selectors `useCreateConversation()` and `useSelectConversation()` from `../stores/selectors`
- `src/components/EvaluationPanel.tsx`: Replaced `const { addMessage } = useAppStore()` with `useAddMessage()` from `../stores/selectors`

## Convergence
- `useAppStore()` removed from Sidebar.tsx: yes
- `useAppStore()` removed from EvaluationPanel.tsx: yes
- `useCreateConversation` in Sidebar.tsx: yes
- `useSelectConversation` in Sidebar.tsx: yes
- `useAddMessage` in EvaluationPanel.tsx: yes

## Test fixes
- `Sidebar.test.tsx`: No changes needed — test mocks `../stores/selectors` directly
