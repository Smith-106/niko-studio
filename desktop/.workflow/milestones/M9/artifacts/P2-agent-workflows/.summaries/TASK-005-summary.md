# TASK-005: Pre-built workflow templates

**Status**: Completed
**Approach**: Verified builtinWorkflows array already exists in workflowService.ts with 3 templates: builtin-chapter-pipeline, builtin-revision-pass, builtin-style-analysis. Each has 3+ steps covering writing, analysis, and evaluation agent modes.

**Result**: Templates load merged with user workflows via loadWorkflows(). No additional work needed.
