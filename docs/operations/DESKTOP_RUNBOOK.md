# Desktop Frontend Runbook

## Quick Start

### Prerequisites
- Node.js 20+
- npm 10+
- Python 3.11+ (for backend services)

### Starting Frontend Development Server

```bash
# From project root
cd desktop
npm install
npm run dev
```

Default port: `5173`

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

### Gateway CORS Contract

```bash
# Verify CORS preflight allows PUT
python scripts/run_targeted_pytest.py tests/unit/mcp/test_gateway_endpoints.py -k "cors_preflight_allows_put" -q
```

### Full Contract Suite (CI Hard Gate)

```bash
# P2 selected hard gate contracts (local targeted run)
python scripts/run_targeted_pytest.py tests/unit/workflow/test_workflow_engine.py -k "decision" -q
python scripts/run_targeted_pytest.py tests/unit/mcp/test_gateway_stream.py -k "contract" -q
python scripts/run_targeted_pytest.py tests/unit/test_ci_gate_workflows.py -q
python scripts/run_targeted_pytest.py tests/unit/mcp/test_gateway_endpoints.py -k "cors_preflight_allows_put" -q
npm --prefix desktop run test -- src/api/client.test.ts src/components/EvaluationPanel.test.tsx src/components/KnowledgeModal.test.tsx
```

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
