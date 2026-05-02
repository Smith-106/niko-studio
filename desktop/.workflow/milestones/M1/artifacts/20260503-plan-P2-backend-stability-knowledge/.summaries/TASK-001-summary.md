# TASK-001: Checkpoint resume — skip completed steps on restart

## Changes
- `src-tauri/bin/sidecar/workflow/engine/flow-control.js`: Updated `resolveExecutableWorkflowStep()` — when `restoredFromCheckpoint=true`, finds steps stuck in 'executing' status and resets them to 'planned' so they can be re-executed. Completed ('done') steps are already skipped by the existing logic.
- `src-tauri/bin/sidecar/workflow/engine/runtime-state.js`: Updated `applyWorkflowRunnerTransition()` — accepts `restoredFromCheckpoint` parameter, sets `plan.restored_from_checkpoint = true` when resuming from checkpoint.
- `src-tauri/bin/sidecar/workflow/engine/risk.js`: Updated `restoreWorkflowCheckpoint()` — sets `restored_from_checkpoint: true` in the restore result.

## Convergence
- [x] runtime-state.js contains 'restored_from_checkpoint'
- [x] flow-control.js contains 'restored_from_checkpoint'
- [x] Steps with status 'done' are skipped; steps stuck in 'executing' are reset to 'planned'
