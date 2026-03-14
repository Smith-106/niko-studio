# Workflow Entrypoint Inventory Baseline (S-1 / QUE-20260304175803)

Date: 2026-03-15 (Updated: Streaming API Migration)
Scope: `WorkflowEngine` / `src.workflow.graph` / `NovelAdapter` call graph inventory
Goal: establish migration baseline for single-authority external workflow entry

## Inventory

| Entrypoint Type | Entrypoint Symbol | Caller (Path:Line) | Usage Tag | Notes |
|---|---|---|---|---|
| engine | `WorkflowEngine.plan/execute/run/run_stream` | `src/cli/commands/run.py:235` / `src/cli/commands/run.py:274` | external | Primary CLI runtime path |
| engine | `WorkflowEngine.plan/execute` | `src/cli/commands/guided_draft.py:207` / `src/cli/commands/guided_draft.py:234` | external | Guided draft CLI path |
| engine | `workflow_plan` + `workflow_execute` (via `get_workflow_engine`) | `src/mcp/gateway.py:1261` / `src/mcp/gateway.py:1282` | external | MCP/API workflow service path |
| engine | `WorkflowEngine.run_stream` | `src/web/app.py` | external | Web UI streaming path (migrated) |
| engine | `WorkflowEngine.run_stream` | `src/ui/streamlit_app.py` | external | Streamlit streaming path (migrated) |
| graph (legacy) | `create_writing_graph -> adapter.create_graph` | `src/workflow/graph.py:601` | internal | Compatibility wrapper; emits deprecation warning |
| graph (legacy) | `run_writing_session -> compile_graph` | `src/workflow/graph.py:659` | internal | Legacy facade call chain |
| adapter (legacy) | `NovelAdapter.create_graph` | `src/workflow/graph.py:601` | internal | Legacy graph build entry; emits deprecation warning |
| adapter | `AdapterRegistry.create_adapter` | `src/workflow/graph_factory.py:53` / `src/workflow/graph_factory.py:81` | internal | Factory-level adapter lifecycle |

## External Entrypoint Count (Authority View)

- Authoritative external workflow entry families: **3** (`CLI run`, `CLI guided_draft`, `MCP workflow_*`, `Web UI`, `Streamlit`), all on `WorkflowEngine`.
- Legacy external compatibility entry families: **0** (all migrated to WorkflowEngine.run_stream).

## Migration Status

### Completed (2026-03-15)
- ✅ `src/web/app.py`: Migrated from `compile_graph().astream()` to `WorkflowEngine.run_stream()`
- ✅ `src/ui/streamlit_app.py`: Migrated from `compile_graph().stream()` to `WorkflowEngine.run_stream()`
- ✅ Added `run_stream()` async generator method to WorkflowEngine for real-time streaming

### API Reference

```python
# Streaming workflow execution (recommended for UI)
engine = WorkflowEngine()
async for event in engine.run_stream(task="write a story", level="L3"):
    event_type = event.get("type")
    # event_type: plan_created | step_start | step_complete | plan_complete | plan_error | plan_blocked
    # event contains: plan_id, step_id, step_name, status, result, etc.

# Non-streaming workflow execution
result = await engine.run(task="write a story", level="L3")
```

## Migration Priority

1. ~~Keep `WorkflowEngine` as the only externally documented authority entry.~~ ✅ DONE
2. ~~Retain graph/adapter compatibility wrappers with deprecation warnings.~~ ✅ DONE (internal only)
3. ~~Migrate Web UI and Streamlit to use `run_stream`.~~ ✅ DONE
