# M9 Learnings — Intelligence & Workflows

<spec-entry category="learning" keywords="zustand,slice,mock,testing" date="2026-05-05" source="M9-P1/TASK-003,TASK-004">
Zustand slice unit tests cannot use `create()` due to React hooks in middleware. Use manual `set`/`get` mock with `Object.assign(state, next)` for in-place mutation to avoid stale reference bugs.
</spec-entry>

<spec-entry category="learning" keywords="tauri,fs,mock,vi.hoisted" date="2026-05-05" source="M9-P1/TASK-001,TASK-002">
Tauri filesystem plugin must be mocked with `vi.hoisted()` + `vi.mock('@tauri-apps/plugin-fs')` before imports. Without hoisting, the mock is registered after module evaluation and calls go to the real plugin.
</spec-entry>

<spec-entry category="learning" keywords="template,builtin,id-prefix" date="2026-05-05" source="M9-P1/TASK-002">
Built-in template IDs use `builtin-` prefix (e.g. `builtin-basic-chapter`). User-created templates get UUIDs. The distinction is critical for getTemplate() lookup order: check builtins first, then filesystem.
</spec-entry>

<spec-entry category="learning" keywords="caching,sha256,incremental,analysis" date="2026-05-05" source="M9-P1/TASK-001">
Content hash caching with SHA-256 (`crypto.subtle.digest`) enables incremental re-analysis — only chapters with changed content are re-sent to the analysis agent. This reduces API calls and latency for large projects.
</spec-entry>

<spec-entry category="learning" keywords="template,substitution,json" date="2026-05-05" source="M9-P1/TASK-002">
Template placeholder substitution works by JSON.stringify → regex `/\{\{(\w+)\}\}/g` replacement → JSON.parse. This preserves TipTap document structure while replacing placeholders in all text nodes.
</spec-entry>

<spec-entry category="learning" keywords="workflow,checkpoint,human-in-the-loop,execution" date="2026-05-05" source="M9-P2/workflowService">
Workflow execution pauses at checkpoint gates (`review`/`approve`) by returning execution with status `paused`. The caller (UI) decides to approve (advance to next step) or reject (mark failed). This enables human-in-the-loop AI pipelines without complex async coordination.
</spec-entry>

<spec-entry category="learning" keywords="agent,dispatch,mock,agentWrite" date="2026-05-05" source="M9-P2/workflowService.test">
agentWrite receives a single object argument `{ content: string }`, not separate string args. Test assertions must use `expect.objectContaining({ content: ... })` not `expect.stringContaining(...), expect.anything()`.
</spec-entry>

<spec-entry category="learning" keywords="workflow,disabled-steps,throw" date="2026-05-05" source="M9-P2/workflowService.test">
When all workflow steps are disabled, executeWorkflow throws `Error('No enabled steps in workflow')` rather than returning a completed execution with 0 results. Tests must use `rejects.toThrow` not result status assertions.
</spec-entry>
