# Workflow Entrypoint Inventory Baseline (S-1 / QUE-20260304175803)

Date: 2026-03-07  
Scope: `WorkflowEngine` / `src.workflow.graph` / `NovelAdapter` call graph inventory  
Goal: establish migration baseline for single-authority external workflow entry

## Inventory

| Entrypoint Type | Entrypoint Symbol | Caller (Path:Line) | Usage Tag | Notes |
|---|---|---|---|---|
| engine | `WorkflowEngine.plan/execute` | `src/cli/commands/run.py:235` / `src/cli/commands/run.py:274` | external | Primary CLI runtime path |
| engine | `WorkflowEngine.plan/execute` | `src/cli/commands/guided_draft.py:207` / `src/cli/commands/guided_draft.py:234` | external | Guided draft CLI path |
| engine | `workflow_plan` + `workflow_execute` (via `get_workflow_engine`) | `src/mcp/gateway.py:1261` / `src/mcp/gateway.py:1282` | external | MCP/API workflow service path |
| graph (legacy) | `compile_graph` | `src/web/app.py:185` | external | Deprecated Web fallback path |
| graph (legacy) | `compile_graph` | `src/ui/streamlit_app.py:322` | external | Streamlit compatibility path |
| graph (legacy) | `run_writing_session` | `src/web/app.py:21` | external | Deprecated Web one-shot session |
| graph (legacy) | `create_writing_graph -> adapter.create_graph` | `src/workflow/graph.py:601` | internal | Compatibility wrapper; emits deprecation warning |
| graph (legacy) | `run_writing_session -> compile_graph` | `src/workflow/graph.py:659` | internal | Legacy facade call chain |
| adapter (legacy) | `NovelAdapter.create_graph` | `src/workflow/graph.py:601` | internal | Legacy graph build entry; emits deprecation warning |
| adapter | `AdapterRegistry.create_adapter` | `src/workflow/graph_factory.py:53` / `src/workflow/graph_factory.py:81` | internal | Factory-level adapter lifecycle |

## External Entrypoint Count (Authority View)

- Authoritative external workflow entry families: **3** (`CLI run`, `CLI guided_draft`, `MCP workflow_*`), all on `WorkflowEngine`.
- Legacy external compatibility entry families: **2** (`Web app`, `Streamlit app`) through graph facade with warning path retained for backward compatibility.

## Migration Priority

1. Keep `WorkflowEngine` as the only externally documented authority entry.
2. Retain graph/adapter compatibility wrappers with deprecation warnings.
3. Avoid introducing new external callers to `src.workflow.graph` / `NovelAdapter.create_graph`.
