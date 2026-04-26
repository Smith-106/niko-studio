# Desktop Delivery Runbook

## Delivery Contract

This runbook follows the same four delivery labels as the root README and `docs/release/RELEASE_NOTES.md`.

- `Supported runtime`: `desktop/` + Tauri host + local `src-ts/` Node/TypeScript gateway. This is the shipped product, default build, and default runtime path.
- `Supported launcher`: `python scripts/start_gateway.py` remains an operator-facing entrypoint, but in the current checkout it starts the Node/TypeScript gateway by default.
- `Advisory compatibility surfaces`: explicit `--runtime python` legacy override, legacy `src/mcp/**` sources, and Streamlit validation flows only when a release candidate explicitly includes them.
- `Deprecated surface` (removed): browser-first web entry has been removed from the codebase.

## Quick Start

### Prerequisites
- Node.js 20+
- npm 10+
- Python 3.11+ (release helpers, governance scripts, compatibility launcher)

### Starting the Authoritative Desktop Path

On Windows, prefer the local launcher when `8000` may already be occupied:

```powershell
./scripts/start_desktop_local.ps1
```

It reuses an already healthy gateway when available, otherwise starts one on `8010` or another free loopback port, then launches the desktop process against that explicit gateway base.
If a `Niko-Studio` window is already running, the launcher reuses that window by default instead of opening duplicates; pass `-ForceDesktop` only when you intentionally want a second instance.
To stop any gateway / desktop processes that the launcher started itself, run `./scripts/stop_desktop_local.ps1`.
To inspect the current tracked gateway / desktop state without changing anything, run `./scripts/status_desktop_local.ps1`.
To smoke-test the local launcher lifecycle itself, run `./scripts/selftest_desktop_local.ps1`.
For `cmd.exe`, use `scripts\\start_desktop_local.cmd`, `scripts\\stop_desktop_local.cmd`, `scripts\\status_desktop_local.cmd`, and `scripts\\selftest_desktop_local.cmd`.
If you prefer package scripts, the same helpers are exposed as `npm --prefix desktop run local:start|local:start:force|local:start:binary|local:start:binary:force|local:gateway|local:status|local:stop|local:selftest`.
Use `npm --prefix desktop run local:gateway` when you want the launcher to reuse or start only the gateway without opening another desktop window.
Use `npm --prefix desktop run local:shell` after `npm --prefix desktop run local:gateway` when you need a browser-only Vite shell that still follows the tracked healthy gateway base from `.codex-run/desktop-local-state.json`.

For manual two-terminal startup, use:

```bash
# From project root
python scripts/start_gateway.py --host 127.0.0.1 --port 8000

# In a new terminal
cd desktop
npm install
npm run tauri:dev
```

Desktop dev mode still uses the Vite shell on port `5173`, but `npm run dev` alone only exercises the frontend shell and is not the full shipped runtime path.

## Security / runtime boundary

- Release CSP is explicit: packaged desktop content is limited to self/customprotocol/assets, loopback gateway traffic, and retained HTTPS provider calls used by settings-time model discovery.
- Dev CSP adds only localhost + websocket allowances needed for Vite HMR.
- The frontend webview is pinned to the `main-desktop` capability and only receives `core:default`; frontend code does not get direct shell/fs/dialog/http/notification plugin permissions.
- Runtime matrix:
  - `Supported local runtime`: Node-first launcher + local `src-ts/` gateway.
  - `Packaged compatibility runtime`: pre-staged Python sidecar artifact.
  - `Explicit fallback`: packaged builds do not currently bundle a target-triple Node sidecar binary, so packaged execution falls back to the Python compatibility artifact when the repo-local Node launcher is unavailable.
  - `Current limitation`: the default node-first checkout does not ship the retired Python gateway sources, so strict packaging validation expects the packaged Python artifact to be hydrated before release sign-off.
- Current dry-run packaging validation target: Windows x64 (`x86_64-pc-windows-msvc`).
- `npm --prefix desktop run validate:package:dry-run` is an unsigned `--no-bundle` proof run; signed external bundles require release-private `certificateThumbprint` and `timestampUrl` values outside git before `npm --prefix desktop run tauri:build`.

### Port Conflict Handling

If port 5173 is already in use:

```bash
# Option 1: Kill process using the port (Windows)
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# Option 2: Kill process using the port (Linux/macOS)
lsof -ti:5173 | xargs kill -9

# Option 3: Use different port
npm run dev -- --port 5174
```

---

## Language Switch Smoke Test

### Objective
Verify i18n parity between EN and ZH across all user-facing components.

### Test Steps

1. **Start frontend**: `npm run dev`
2. **Open browser**: Navigate to `http://localhost:5173`
3. **Open Settings**: Click gear icon in sidebar
4. **Switch language**:
   - Find "Language" dropdown
   - Change from default to "English" or "简体中文"
5. **Verify UI updates**:
   - Sidebar labels (New Chat, Skill Packs, Knowledge Base, Settings)
   - Settings modal headers
   - Knowledge modal tabs (Characters, Locations, Plots, Skills)
   - Form labels (Temporal Facts, Character Details, Foreshadow Filters, Add Memory)

### Automated Verification

```bash
# Run i18n key parity check
python scripts/check_i18n_keys.py

# Run KnowledgeModal i18n tests
npm --prefix desktop run test -- src/components/KnowledgeModal.test.tsx

# Run all desktop tests
npm --prefix desktop run test
```

### Expected Results
- All labels update immediately without page refresh
- No mixed-language strings visible
- `scripts/check_i18n_keys.py` reports: `i18n check: ok`

---

## Contract Verification Commands

### Frontend API Client Contract

```bash
# Verify API client tests (base URL resolution, method parity)
npm --prefix desktop run test -- src/api/client.test.ts
```

### Gateway Route / CORS Contract

```bash
# Verify route registry and preflight handling on the current TypeScript gateway
npm --prefix src-ts exec -- vitest run tests/gateway-server.routes.test.ts tests/gateway-server.request-handler.test.ts --reporter=default
```

### Full Contract Suite (CI Hard Gate)

```bash
# Current local targeted contract run
python scripts/check_authority_alignment.py
python scripts/run_targeted_pytest.py tests/unit/scripts/test_governance_scripts.py -q
npm --prefix src-ts exec -- vitest run tests/workflow/workflow-engine.integration.test.ts tests/mcp/workflow-service.test.ts tests/gateway-server.routes.test.ts tests/gateway-server.request-handler.test.ts --reporter=default
npm --prefix desktop run test -- src/api/client.test.ts src/components/EvaluationPanel.test.tsx src/components/KnowledgeModal.test.tsx
```

### Desktop packaging / sidecar boundary

```bash
# Validate the explicit desktop security/runtime matrix
npm --prefix desktop run validate:sidecar-contract

# Validate the supported dry-run packaging path (Windows x64, no bundle)
npm --prefix desktop run validate:package:dry-run
```

For the current migration baseline, these commands validate the repo-local Node launcher plus the pre-staged packaged Python compatibility artifact; they do not rebuild the retired Python fallback from source.

### Release sign-off

- Use `docs/release/SIGN_OFF.md` as the authoritative local release checklist.
- The Windows acceptance leg mirrors `.github/workflows/writing-helper-acceptance.yml` and should be run with the Node-first gateway path, not a direct legacy Python server.

---

## Troubleshooting

### i18n Key Mismatch Error
```
Error: i18n key mismatch: zhOnly=[...], enOnly=[...]
```
**Solution**: Add missing keys to both `zh` and `en` sections in `desktop/src/i18n/translations.ts`.

### Translation Not Updating
1. Clear browser cache (Ctrl+Shift+Delete)
2. Hard refresh (Ctrl+F5)
3. Check Zustand store: `useSettingsStore.getState().settings.language`

### Port Already in Use
See [Port Conflict Handling](#port-conflict-handling) section above.

---

## Acceptance Checklist

- [ ] Frontend starts without errors on `npm run dev`
- [ ] Language switch updates all visible UI elements
- [ ] i18n key parity check passes
- [ ] KnowledgeModal tests pass (4 tests)
- [ ] API client tests pass (28 tests)
- [ ] Contract tests pass (CORS, method, base parity)
