# TASK-002: Workflow service — CRUD + execution orchestration

**Status**: Completed
**Approach**: Created `src/services/workflowService.ts` with full CRUD (loadWorkflows, saveWorkflow, deleteWorkflow, getWorkflow) using Tauri FS for storage, plus execution orchestration (executeWorkflow, approveStep, rejectStep) delegating to agentWrite/callAnalysisAgent based on step.agentMode.

**Result**: Service provides thin orchestration over existing agent APIs with sequential step execution and checkpoint gates.
