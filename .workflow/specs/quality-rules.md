---
title: Quality Rules
readMode: required
priority: medium
category: review
keywords:
  - quality
  - lint
  - eslint
  - prettier
  - ruff
related:
  - "spec:project:quality-rules-005"
  - "spec:project:quality-rules-006"
  - "spec:project:quality-rules-007"
  - "spec:project:quality-rules-008"
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

<spec-entry category="quality" keywords="scoring,rules-based,no-llm,hook,cliffhanger" date="2026-06-13" title="钩子悬念评分用规则评分而非 LLM" description="提取前 200 字和后 200 字，关键词匹配+结构分析打分 0-100">
### 钩子悬念评分用规则评分而非 LLM
提取前 200 字和后 200 字，关键词匹配+结构分析打分 0-100。
</spec-entry>

<spec-entry category="quality" keywords="uat,ui-testing,manual-testing,gap" date="2026-06-13" title="UAT 覆盖策略：自动化覆盖构建/单测，UI 目视需人工补测" description="自动化 UAT 仅覆盖 build/unit-test 和部分 editor 行为">
### UAT 覆盖策略：自动化覆盖构建/单测，UI 目视需人工补测
自动化 UAT 仅覆盖 build/unit-test 和部分 editor 行为。
</spec-entry>

<spec-entry category="quality" keywords="console.log,logger,替换,清理" date="2026-06-20" title="console.log 统一替换为 logger 或删除" description="遵循 Fix Don't Hide 原则，console.log 必须替换为 logger 或删除">
### console.log 统一替换为 logger 或删除
M26 交付前清理：console.log 统一替换为 logger 或删除，遵循 Coding Philosophy 的 Fix Don't Hide 原则。TODO 不在当前发布路径上的转为 issue 记录，不阻塞发布。
参考：ANL-20260619-fix-remaining-risks, EXC-20260619-fix-remaining-risks
</spec-entry>