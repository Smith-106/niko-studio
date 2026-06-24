import { afterEach, describe, expect, it, vi } from 'vitest';

import { listTools } from '../../mcp/endpoints/health.js';
import type { HttpRequest } from '../../mcp/http-types.js';

const registerNarrativeToolsMock = vi.hoisted(() => vi.fn());

vi.mock('../../mcp/narrative-tools', () => ({
  registerNarrativeTools: registerNarrativeToolsMock,
}));

import { createMCPTools } from '../../mcp/all-tools.js';

describe('mcp/all-tools', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('merges the base narrative tool registry and keeps the registration arguments intact', async () => {
    const baseTool = vi.fn().mockResolvedValue('base-result');
    registerNarrativeToolsMock.mockReturnValue({ 'base.tool': baseTool });

    const services = {
      engine: { id: 'engine' },
      bridge: { id: 'bridge' },
      analyzer: { id: 'analyzer' },
      brainstorm: { analyzeWithRoles: vi.fn(), crossReview: vi.fn() },
      adversarialScorer: { score: vi.fn() },
      qualityGate: { evaluate: vi.fn(), revisionLoop: vi.fn(), quickScan: vi.fn() },
      agent: { suggestPlot: vi.fn(), checkContinuity: vi.fn(), getWritingContext: vi.fn() },
    };

    const tools = createMCPTools(services as never);

    expect(registerNarrativeToolsMock).toHaveBeenCalledWith(services.engine, services.bridge, services.analyzer);
    await expect(tools['base.tool']()).resolves.toBe('base-result');
    expect(baseTool).toHaveBeenCalledTimes(1);
  });

  it('routes brainstorm, scoring, quality-gate, and agent helpers through the provided services', async () => {
    registerNarrativeToolsMock.mockReturnValue({});

    const analyses = [{ roleId: 'plot', weightedScore: 80 }];
    const brainstorm = {
      analyzeWithRoles: vi.fn().mockReturnValue(analyses),
      crossReview: vi.fn().mockReturnValue({ conflicts: [], synergies: [], gaps: [] }),
    };
    const adversarialScorer = {
      score: vi.fn().mockReturnValue({ finalScore: 70 }),
    };
    const qualityGate = {
      evaluate: vi.fn().mockResolvedValue({ result: 'PASS' }),
      revisionLoop: vi.fn(async (_text: string, level: string, reviseFn: (text: string, report: unknown) => Promise<string>) => {
        const first = await reviseFn('draft-0', { overall: 50 });
        const second = await reviseFn(first, { overall: 55 });
        return { level, revisions: [first, second] };
      }),
      quickScan: vi.fn().mockReturnValue({ result: 'WARN' }),
    };
    const agent = {
      suggestPlot: vi.fn().mockResolvedValue([{ action: 'act' }]),
      checkContinuity: vi.fn().mockResolvedValue([{ type: 'warning' }]),
      getWritingContext: vi.fn().mockResolvedValue({ chapter: 3 }),
    };

    const tools = createMCPTools({
      engine: {} as never,
      bridge: {} as never,
      analyzer: {} as never,
      brainstorm: brainstorm as never,
      adversarialScorer: adversarialScorer as never,
      qualityGate: qualityGate as never,
      agent: agent as never,
    });

    await expect(tools['brainstorm.analyze_roles']({ text: 'scene text' })).resolves.toBe(analyses);
    expect(brainstorm.analyzeWithRoles).toHaveBeenCalledWith('scene text');

    await expect(tools['brainstorm.cross_review']({ text: 'scene text' })).resolves.toEqual({
      conflicts: [],
      synergies: [],
      gaps: [],
    });
    expect(brainstorm.crossReview).toHaveBeenCalledWith(analyses);

    await expect(tools['adversarial.score']({ text: 'draft', maxIterations: 2 })).resolves.toEqual({ finalScore: 70 });
    expect(adversarialScorer.score).toHaveBeenCalledWith('draft', { maxIterations: 2 });

    await expect(tools['quality.evaluate']({ text: 'draft' })).resolves.toEqual({ result: 'PASS' });
    expect(qualityGate.evaluate).toHaveBeenCalledWith('draft', 'standard');

    await expect(
      tools['quality.revision_loop']({ text: 'draft', revisions: ['rev-1', 'rev-2'], level: 'strict' }),
    ).resolves.toEqual({ level: 'strict', revisions: ['rev-1', 'rev-2'] });
    expect(qualityGate.revisionLoop).toHaveBeenCalledTimes(1);

    await expect(tools['quality.quick_scan']({ text: 'draft' })).resolves.toEqual({ result: 'WARN' });
    expect(qualityGate.quickScan).toHaveBeenCalledWith('draft');

    await expect(tools['agent.suggest_plot']({ action: 'continue', chapter: 3 })).resolves.toEqual([{ action: 'act' }]);
    await expect(tools['agent.check_continuity']({ chapter: 3 })).resolves.toEqual([{ type: 'warning' }]);
    await expect(tools['agent.writing_context']({ chapter: 3, lastText: 'tail' })).resolves.toEqual({ chapter: 3 });
    expect(agent.suggestPlot).toHaveBeenCalledWith('continue', 3);
    expect(agent.checkContinuity).toHaveBeenCalledWith(3);
    expect(agent.getWritingContext).toHaveBeenCalledWith(3, 'tail');
  });

  it('defaults revision loop level and keeps the current text when revisions are exhausted', async () => {
    registerNarrativeToolsMock.mockReturnValue({});

    const qualityGate = {
      evaluate: vi.fn(),
      revisionLoop: vi.fn(async (text: string, level: string, reviseFn: (text: string, report: unknown) => Promise<string>) => {
        const next = await reviseFn(text, { overall: 42 });
        return { level, next };
      }),
      quickScan: vi.fn(),
    };

    const tools = createMCPTools({
      engine: {} as never,
      bridge: {} as never,
      analyzer: {} as never,
      brainstorm: { analyzeWithRoles: vi.fn(), crossReview: vi.fn() } as never,
      adversarialScorer: { score: vi.fn() } as never,
      qualityGate: qualityGate as never,
      agent: { suggestPlot: vi.fn(), checkContinuity: vi.fn(), getWritingContext: vi.fn() } as never,
    });

    await expect(
      tools['quality.revision_loop']({ text: 'draft-0', revisions: [] }),
    ).resolves.toEqual({ level: 'standard', next: 'draft-0' });
    expect(qualityGate.revisionLoop).toHaveBeenCalledWith('draft-0', 'standard', expect.any(Function));
  });

  describe('listTools endpoint', () => {
    it('returns 200 with the eight tool categories', async () => {
      const request: HttpRequest = {
        method: 'GET',
        url: '/tools',
        headers: {},
        body: null,
        query: {},
        params: {},
      };

      const response = await listTools(request);

      expect(response.statusCode).toBe(200);
      expect(response.body).toBeInstanceOf(Object);

      const tools = response.body as Record<string, string[]>;
      expect(Object.keys(tools)).toEqual([
        'memory',
        'graph',
        'search',
        'workflow',
        'critic',
        'agent',
        'skills',
        'writing_helper',
      ]);
    });

    it('memory category contains expected tools', async () => {
      const response = await listTools({ method: 'GET', url: '/tools', headers: {}, body: null, query: {}, params: {} });
      const tools = response.body as Record<string, string[]>;
      expect(tools.memory).toContain('memory_add');
      expect(tools.memory).toContain('memory_search');
      expect(tools.memory).toContain('memory_get_temporal');
      expect(tools.memory).toContain('memory_get_conflicts');
      expect(tools.memory).toContain('memory_resolve_conflict');
    });

    it('graph category contains expected tools', async () => {
      const response = await listTools({ method: 'GET', url: '/tools', headers: {}, body: null, query: {}, params: {} });
      const tools = response.body as Record<string, string[]>;
      expect(tools.graph).toContain('graph_query');
      expect(tools.graph).toContain('graph_get_character');
      expect(tools.graph).toContain('graph_get_relationships');
      expect(tools.graph).toContain('graph_get_foreshadows');
      expect(tools.graph).toContain('graph_add_entity');
      expect(tools.graph).toContain('graph_add_relation');
    });

    it('search category contains expected tools', async () => {
      const response = await listTools({ method: 'GET', url: '/tools', headers: {}, body: null, query: {}, params: {} });
      const tools = response.body as Record<string, string[]>;
      expect(tools.search).toContain('search_hybrid');
      expect(tools.search).toContain('search_iterative');
      expect(tools.search).toContain('search_context');
    });

    it('workflow category contains expected tools', async () => {
      const response = await listTools({ method: 'GET', url: '/tools', headers: {}, body: null, query: {}, params: {} });
      const tools = response.body as Record<string, string[]>;
      expect(tools.workflow).toContain('workflow_route');
      expect(tools.workflow).toContain('workflow_plan');
      expect(tools.workflow).toContain('workflow_execute');
      expect(tools.workflow).toContain('checkpoint_create');
      expect(tools.workflow).toContain('checkpoint_restore');
      expect(tools.workflow).toContain('checkpoint_list');
    });

    it('critic category contains expected tools', async () => {
      const response = await listTools({ method: 'GET', url: '/tools', headers: {}, body: null, query: {}, params: {} });
      const tools = response.body as Record<string, string[]>;
      expect(tools.critic).toContain('evaluate_content');
      expect(tools.critic).toContain('get_improvement_suggestions');
      expect(tools.critic).toContain('compare_versions');
    });

    it('agent category contains expected tools', async () => {
      const response = await listTools({ method: 'GET', url: '/tools', headers: {}, body: null, query: {}, params: {} });
      const tools = response.body as Record<string, string[]>;
      expect(tools.agent).toContain('agent_route');
      expect(tools.agent).toContain('agent_write');
      expect(tools.agent).toContain('agent_revise');
      expect(tools.agent).toContain('agent_get_context');
    });

    it('skills category contains expected tools', async () => {
      const response = await listTools({ method: 'GET', url: '/tools', headers: {}, body: null, query: {}, params: {} });
      const tools = response.body as Record<string, string[]>;
      expect(tools.skills).toContain('skills_list');
      expect(tools.skills).toContain('skills_match');
      expect(tools.skills).toContain('skills_load');
      expect(tools.skills).toContain('skills_get_chain');
    });

    it('writing_helper category contains expected tool', async () => {
      const response = await listTools({ method: 'GET', url: '/tools', headers: {}, body: null, query: {}, params: {} });
      const tools = response.body as Record<string, string[]>;
      expect(tools.writing_helper).toContain('process_writing_helper');
    });
  });
});
