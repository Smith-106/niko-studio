# TASK-001: 前端 console 收口到结构化 logger

## Status: COMPLETED

## Changes
- Created: `desktop/src/utils/logger.ts` — structured logger (dev=console, prod=noop, error always outputs)
- Modified: `desktop/src/api/core.ts` (1 call)
- Modified: `desktop/src/api/chat.ts` (2 calls)
- Modified: `desktop/src/api/gateway/models.ts` (2 calls)
- Modified: `desktop/src/hooks/useEditorAI.ts` (2 calls)
- Modified: `desktop/src/hooks/useEvaluationData.ts` (2 calls)
- Modified: `desktop/src/components/knowledge/SkillTab.tsx` (1 call)
- Modified: `desktop/src/components/knowledge/PersistedEntityTab.tsx` (3 calls)
- Modified: `desktop/src/components/StoryBiblePanel.tsx` (10 calls)
- Modified: `desktop/src/services/revisionOrchestrator.ts` (9 calls)

## Summary
Created frontend logger utility and replaced 32 console.* calls across 9 source files. Production builds will have zero console noise (except errors).

## Key Decisions
1. Simple bind pattern matching project's minimalist style — no logging framework
2. error always outputs even in production for visibility
3. Used import.meta.env.DEV for environment detection (Vite standard)

## Verification
- grep 'console\.' in non-test/non-logger files returns 0 matches
- 9 files import logger
- npx tsc --noEmit exits 0
- All tests pass (70+ test files green)
