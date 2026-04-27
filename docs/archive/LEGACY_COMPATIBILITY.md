# Legacy Compatibility Surfaces (Archived)

> **Status**: Archived — for historical reference only.
> **Current runtime**: `desktop/` + Tauri host + local `src-ts/` Node/TypeScript gateway.
> See [README.md](../../README.md) for the current delivery contract.

This document consolidates all legacy compatibility surfaces that have been superseded by the current `desktop + src-ts` architecture.

## Deprecated Surfaces

### Browser-First Web UI (Removed in 9.0.10)

- The browser-first web entry was removed from the codebase.
- `WEB_UI_FORWARD_URL` is no longer supported.
- Any documentation referencing a web-first runtime path is historical.

### Python Gateway Runtime (Legacy Override)

- `python scripts/start_gateway.py --runtime python` was an operator-facing entrypoint for launching the legacy Python gateway.
- The current checkout defaults to the Node/TypeScript gateway.
- The `--runtime python` override is only available when legacy `src/mcp/gateway.py` exists in the checkout.
- This surface is preserved as an explicit compatibility path only.

### Streamlit Validation Flows

- Streamlit UI surfaces existed in earlier versions for validation and testing.
- These are only present when a release candidate explicitly includes them.
- Not part of the current shipped product.

### Legacy Python Source (`src/mcp/**`)

- The original Python-based MCP implementation in `src/mcp/` has been superseded by `src-ts/`.
- These sources remain visible only as labeled compatibility surfaces.
- The Python sidecar can still be bundled via `desktop/src-tauri/bin/niko-gateway*.exe` for packaged desktop fallback.

## Historical Documentation References

The following documents are retained as historical references and should not be used as current runtime authority:

| Document | Status |
|----------|--------|
| `docs/TASKS_V10_OPTIMIZED.md` | Historical architecture roadmap |
| `docs/ui_design_guide.md` | Historical UI design reference |
| `docs/workflow-entrypoint-inventory.md` | Historical workflow inventory |
| `docs/API_REFERENCE.md` | Historical Python API reference (non-current) |
| `docs/tdd/01_Unit_Tests_Plan.md` | Historical Python/pytest test plan |
| `docs/tdd/03_Test_Cases_Inventory.md` | Historical Python/pytest case inventory |
| `docs/PDD.md` | Historical product design document |

## Migration Notes

When migrating from the Python runtime to the current Node/TypeScript runtime:

1. The gateway API surface (`/health`, `/metrics`, `/tools`, `/chat`) is compatible between Python and Node runtimes.
2. Configuration files (`config/niko-studio.yaml`) are shared between both runtimes.
3. The `.writing/` data directory format is compatible across both runtimes.
4. Desktop builds using the Python sidecar require `desktop/src-tauri/bin/niko-gateway*.exe` to be pre-built.
