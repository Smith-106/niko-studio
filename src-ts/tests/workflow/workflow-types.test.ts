import { describe, expect, it } from 'vitest';

import {
  ANALYSIS_SCHEMA_VERSION,
  WorkflowDecision,
  WorkflowLevel,
  applyContractDefaults,
  buildLegacyContractFields,
  ensureContractPayload,
  getLevelConfig,
  isValidWorkflowLevel,
  LevelRouter,
  routeTask,
  routingRuleMatches,
  toWorkflowLabel,
  toWorkflowSlug,
  workflowLevelDescription,
  workflowLevelFromLabel,
  workflowLevelNameZh,
} from '../../workflow/types';

describe('workflow/types', () => {
  it('matches routing rules against keywords, complexity, persistence, and collaboration', () => {
    const rule = {
      name: 'brainstorm-test',
      description: 'test rule',
      targetLevel: WorkflowLevel.L4_BRAINSTORM,
      keywords: ['创意'],
      minComplexity: 60,
      maxComplexity: 100,
      requiresPersistence: true,
      requiresCollaboration: true,
      priority: 10,
    } as const;

    expect(
      routingRuleMatches(rule, {
        text: '需要创意方案',
        complexity: 70,
        persist: true,
        collaborate: true,
      }),
    ).toBe(true);
    expect(
      routingRuleMatches(rule, {
        text: '需要创意方案',
        complexity: 70,
        persist: false,
        collaborate: true,
      }),
    ).toBe(false);
    expect(
      routingRuleMatches(rule, {
        text: '只是普通任务',
        complexity: 70,
        persist: true,
        collaborate: true,
      }),
    ).toBe(false);
  });

  it('routes representative tasks through the level router and helper shortcuts', () => {
    const router = new LevelRouter();

    expect(router.estimateComplexity('简单修正一个错字')).toBeLessThan(50);
    expect(router.route({ text: '修正一个错字', complexity: 10 })).toBe(
      WorkflowLevel.L1_RAPID,
    );
    expect(
      router.route({
        text: '需要头脑风暴多个创意方向和冲突设计',
        complexity: 85,
        collaborate: true,
      }),
    ).toBe(WorkflowLevel.L4_BRAINSTORM);
    expect(
      routeTask('头脑风暴多个创意方向和冲突设计', {
        collaborate: true,
      }),
    ).toBe(WorkflowLevel.L3_STANDARD);
    expect(
      routeTask('写一个完整详细的章节大纲', {
        persist: true,
        collaborate: true,
      }),
    ).toBe(WorkflowLevel.L3_STANDARD);
    expect(routeTask('无关键词的普通任务')).toBe(WorkflowLevel.L3_STANDARD);
  });

  it('normalizes workflow labels, names, descriptions, and config accessors', () => {
    expect(workflowLevelFromLabel('l4')).toBe(WorkflowLevel.L4_BRAINSTORM);
    expect(workflowLevelFromLabel('storm')).toBe(WorkflowLevel.L4_BRAINSTORM);
    expect(workflowLevelFromLabel('unknown')).toBe(WorkflowLevel.L3_STANDARD);
    expect(isValidWorkflowLevel('coordinator')).toBe(true);
    expect(isValidWorkflowLevel('L5')).toBe(true);
    expect(isValidWorkflowLevel(true)).toBe(false);
    expect(toWorkflowLabel('brainstorm')).toBe('L4');
    expect(toWorkflowSlug(WorkflowLevel.L5_COORDINATOR)).toBe('coordinator');
    expect(workflowLevelNameZh(WorkflowLevel.L2_LITE)).toBe('轻量模式');
    expect(workflowLevelDescription(WorkflowLevel.L5_COORDINATOR)).toContain(
      '智能链推荐',
    );
    expect(getLevelConfig('l1').requiredAgents).toEqual(['writer']);
  });

  it('applies contract defaults and preserves legacy-compatible fields', () => {
    const payload = applyContractDefaults({
      workflow_level: WorkflowLevel.L4_BRAINSTORM,
      decision_result: 'rewrite',
      compatibility: null,
      diagnostics: null,
      legacy_contract_fields: null,
    });

    expect(payload.decision).toBe(WorkflowDecision.NO_GO);
    expect(payload.analysis_schema_version).toBe(ANALYSIS_SCHEMA_VERSION);
    expect(payload.contract_version).toBe(ANALYSIS_SCHEMA_VERSION);
    expect(payload.level).toBe(WorkflowLevel.L4_BRAINSTORM);
    expect(payload.workflowLevel).toBe(WorkflowLevel.L4_BRAINSTORM);
    expect(payload.level_slug).toBeUndefined();
    expect(payload.compatibility).toMatchObject({
      policy: 'incremental_fields',
      soft_gate: true,
    });
    expect(payload.diagnostics).toMatchObject({
      schema_version: ANALYSIS_SCHEMA_VERSION,
    });

    const legacy = buildLegacyContractFields({
      analysis_schema_version: ANALYSIS_SCHEMA_VERSION,
      workflow_level: WorkflowLevel.L2_LITE,
      decision: WorkflowDecision.SOFT_GO,
    });

    expect(legacy).toMatchObject({
      contract_version: ANALYSIS_SCHEMA_VERSION,
      workflowLevel: WorkflowLevel.L2_LITE,
      level: WorkflowLevel.L2_LITE,
      decision_result: WorkflowDecision.SOFT_GO,
    });
    expect(
      ensureContractPayload({
        workflow_level: WorkflowLevel.L1_RAPID,
      }).decision,
    ).toBe(WorkflowDecision.GO);
  });
});
