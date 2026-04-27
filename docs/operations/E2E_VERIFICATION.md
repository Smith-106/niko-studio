# E2E Verification Checklist

End-to-end verification checklist for Niko Studio desktop application.

## Prerequisites

- [ ] Node.js 20+ installed
- [ ] Python 3.11+ installed
- [ ] At least one LLM API key configured (OpenAI, Google, or Anthropic)
- [ ] `.env` file created from `.env.example` with valid API key

## 1. Build Verification

```bash
# TypeScript type check (both packages)
cd src-ts && npx tsc --noEmit     # Expected: 0 errors
cd desktop && npx tsc --noEmit    # Expected: 0 errors

# Backend tests
cd src-ts && npx vitest run       # Expected: 197 files, ~2229 tests, all pass

# Desktop tests
cd desktop && npx vitest run      # Expected: 84 files, 812 tests, all pass

# Python governance tests
python -m pytest tests/unit/ -q   # Expected: 35+ passed
```

## 2. Gateway Startup

```powershell
# Start gateway only
npm --prefix desktop run local:gateway
```

- [ ] Gateway starts without errors
- [ ] Health endpoint responds: `curl http://127.0.0.1:8000/health`
- [ ] Metrics endpoint responds: `curl http://127.0.0.1:8000/metrics`
- [ ] Tools endpoint responds: `curl http://127.0.0.1:8000/tools`

## 3. Desktop Application

```powershell
# Start full desktop
npm --prefix desktop run local:start
```

- [ ] Desktop window opens
- [ ] Gateway connection established (check McpStatusPanel)
- [ ] Sidebar loads correctly
- [ ] Settings can be opened and saved
- [ ] Language toggle works (zh/en)

## 4. Writing Features

- [ ] Create a new chat session
- [ ] Send a message and receive AI response
- [ ] Open Knowledge Modal — verify character/location/plot tabs render
- [ ] Open StoryBiblePanel — verify it loads without errors
- [ ] Open EvaluationPanel — verify it renders correctly

## 5. Workflow Features

- [ ] Open AutomationPanel
- [ ] Select a workflow level (e.g., Level 1 - Rapid)
- [ ] Submit a workflow request
- [ ] Verify workflow progresses through stages
- [ ] Check checkpoint functionality

## 6. Document Editing

- [ ] Open DocumentEditor
- [ ] Type text — verify TipTap editor works
- [ ] Test formatting toolbar (bold, italic, heading)
- [ ] Test slash commands
- [ ] Verify AI text optimizer integration

## 7. Search & Knowledge

- [ ] Test content search functionality
- [ ] Verify knowledge browsing works
- [ ] Test memory upload functionality

## 8. Configuration

- [ ] Change settings and verify persistence after restart
- [ ] Test config reload: `curl -X POST http://127.0.0.1:8000/config/reload`
- [ ] Verify CORS settings apply correctly

## 9. Error Handling

- [ ] Disconnect gateway — verify desktop shows error gracefully
- [ ] Reconnect gateway — verify desktop recovers
- [ ] Test with invalid API key — verify error feedback
- [ ] Test with no API key — verify graceful degradation

## 10. Build & Package

```powershell
# Build sidecar
npm --prefix desktop run build:sidecar

# Validate sidecar contract
npm --prefix desktop run validate:sidecar-contract

# Build desktop
npm --prefix desktop run build
```

- [ ] Sidecar builds without errors
- [ ] Sidecar contract validation passes
- [ ] Desktop build produces output in `desktop/dist/`

## 11. Authority Alignment

```bash
python scripts/check_authority_alignment.py   # Expected: mismatches: []
python scripts/check_versions.py              # Expected: all versions aligned at 9.0.10
python scripts/delivery_gate.py               # Expected: PASS
```

## 12. Clean Shutdown

```powershell
# Stop all processes
npm --prefix desktop run local:stop
```

- [ ] Gateway shuts down cleanly
- [ ] Desktop window closes without errors
- [ ] No orphaned processes remaining

## Results Template

| Step | Status | Notes |
|------|--------|-------|
| 1. Build Verification | | |
| 2. Gateway Startup | | |
| 3. Desktop Application | | |
| 4. Writing Features | | |
| 5. Workflow Features | | |
| 6. Document Editing | | |
| 7. Search & Knowledge | | |
| 8. Configuration | | |
| 9. Error Handling | | |
| 10. Build & Package | | |
| 11. Authority Alignment | | |
| 12. Clean Shutdown | | |

**Overall**: PASS / FAIL / PARTIAL
**Date**: 
**Tester**: 
**Build version**: 9.0.10
