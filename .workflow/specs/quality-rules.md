---
title: "Quality Rules"
readMode: required
priority: medium
category: review
keywords:
  - quality
  - lint
  - eslint
  - prettier
  - ruff
---

# Quality Rules

## ESLint
- Config: eslint.config.mjs (flat config, ESLint 9)
- Plugin: @typescript-eslint
- Focus: bug-prevention rules (no stylistic rules)
- Command: `npm run lint` → `eslint --max-warnings 0`

## Prettier
- Config: prettier.config.mjs
- printWidth: 100, semi: false, singleQuote: true, trailingComma: "all"
- Command: `npm run format` (write), `npm run format:check` (verify)

## Ruff (Python)
- Config: pyproject.toml [tool.ruff]
- line-length: 100, target: py311
- Command: `ruff check --fix . && ruff format .`

## Pre-commit
- Config: .pre-commit-config.yaml
- Runs: `python scripts/run_local_pre_commit.py`

## Type Checking
- Backend: `npm run typecheck` → `tsc --noEmit`
- Desktop: `npm run typecheck` → `tsc --noEmit`
- Python: `mypy` (if configured)

## Quick Check
- `npm run check:pre-commit` → lint + format:check
- `npm run check:quick` → lint + format:check + typecheck + test

## Entries