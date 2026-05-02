# TASK-002: Structured error classification — typed error events

## Changes
- `src-tauri/bin/sidecar/workflow/engine/responses.js`:
  - Added `WORKFLOW_ERROR_CLASSES` constant mapping 6 error types to `{recoverable, retry_after}` properties: rate_limit, timeout, schema_violation, auth_failure, model_error, unknown.
  - Added `classifyWorkflowError(error, statusCode)` function that maps HTTP status codes and error message patterns to error classes.
  - Updated `buildWorkflowStreamErrorEvent()` to include `error_class`, `recoverable`, `retry_after` fields.
  - Updated `buildWorkflowStreamPlanErrorEvent()` to include same error classification fields.

## Convergence
- [x] responses.js contains 'WORKFLOW_ERROR_CLASSES'
- [x] responses.js contains 'classifyWorkflowError'
- [x] responses.js contains 'rate_limit' and 'recoverable'
- [x] Error events now carry typed error_class for frontend routing
