---
title: Test Conventions
readMode: required
priority: high
category: test
keywords:
  - test
  - coverage
  - vitest
  - playwright
  - pytest
related:
  - "spec:project:test-conventions-002"
  - "spec:project:test-conventions-004"
  - "spec:project:test-conventions-005"
  - "spec:project:test-conventions-003"
---



# Test Conventions

Auto-generated from project analysis. Update manually as patterns evolve.

## Framework
- TypeScript: Vitest (backend + desktop)
- Python: pytest + pytest-asyncio
- E2E: Playwright

## Directory Structure
- Backend: co-located `*.test.ts` + `src-ts/tests/`
- Desktop: co-located `*.test.tsx` + `desktop/tests/`
- Python: `tests/unit/`
- E2E: `docs-site/e2e/`

## Naming Conventions
- Test files: `*.test.ts`, `*.test.tsx`, `*.integration.test.ts`, `*.e2e.test.ts`
- Python: `test_*.py`

## Coverage
- Backend: lines 80%, branches 70%, functions 80%, statements 80%
- Desktop: lines 75%, branches 70%, functions 70%, statements 75%
- Provider: v8

## Commands
- `npm run test` — vitest run
- `npm run test:watch` — vitest watch
- `npm run test:coverage` — vitest with coverage
- `pytest` — Python tests

## Entries
