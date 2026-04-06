import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  workflowEngineCtor,
  workflowPlan,
  workflowExecute,
  workflowRoute,
  workflowRun,
  workflowGetPlanStatus,
  workflowBindPlanSession,
  refreshProjectTechMetadata,
  startGatewayServer,
  createInterfaceMock,
} = vi.hoisted(() => ({
  workflowEngineCtor: vi.fn(),
  workflowPlan: vi.fn(),
  workflowExecute: vi.fn(),
  workflowRoute: vi.fn(),
  workflowRun: vi.fn(),
  workflowGetPlanStatus: vi.fn(),
  workflowBindPlanSession: vi.fn(),
  refreshProjectTechMetadata: vi.fn(),
  startGatewayServer: vi.fn(),
  createInterfaceMock: vi.fn(),
}));

vi.mock('../../workflow/workflow-engine', () => {
  class WorkflowEngineMock {
    constructor(...args: unknown[]) {
      workflowEngineCtor(...args);
    }
    plan = workflowPlan;
    execute = workflowExecute;
    route = workflowRoute;
    run = workflowRun;
    getPlanStatus = workflowGetPlanStatus;
    bindPlanSession = workflowBindPlanSession;
  }
  return { WorkflowEngine: WorkflowEngineMock };
});

vi.mock('node:readline', () => ({
  createInterface: createInterfaceMock,
}));

vi.mock('../../workflow/project-tech', () => ({
  refreshProjectTechMetadata,
}));

vi.mock('../../gateway-server', () => ({
  startGatewayServer,
}));

import {
  chatCommand,
  guidedDraftCommand,
  projectTechRefreshCommand,
  runCommand,
  serveCommand,
} from '../../cli/commands';

function createCtx() {
  return {
    console: {
      log: vi.fn(),
      error: vi.fn(),
      clear: vi.fn(),
    },
  };
}

describe('cli/commands parity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workflowPlan.mockResolvedValue({
      plan_id: 'plan-1',
      steps: [{ id: 's1' }, { id: 's2' }],
      total_steps: 2,
    });
    workflowExecute.mockResolvedValue({ status: 'completed', plan_status: 'completed' });
    workflowRoute.mockResolvedValue({ level: 'L3-Standard' });
    workflowRun.mockResolvedValue({ final_output: 'chat reply' });
    workflowGetPlanStatus.mockReturnValue({
      progress: '2/2',
      steps: [{ output: { draft_content: 'draft result' } }],
    });
    refreshProjectTechMetadata.mockReturnValue({
      path: '/tmp/project-tech.json',
      freshness: {
        generated_at: '2026-04-06T00:00:00Z',
        source: 'cli:manual',
        schema_version: '1.1.0',
        ttl_hours: 168,
      },
      language_file_counts: {
        Python: 1,
        TypeScript: 2,
      },
    });
    startGatewayServer.mockResolvedValue({});
    createInterfaceMock.mockReturnValue({
      question: (_prompt: string, cb: (value: string) => void) => cb('/quit'),
      close: vi.fn(),
    });
  });

  it('run command executes workflow through WorkflowEngine', async () => {
    const ctx = createCtx();
    await runCommand.execute(ctx, {
      task: 'write chapter',
      level: '3',
      session: 'session-run-1',
      namespace: 'cli-test',
      dryRun: false,
    });

    expect(workflowEngineCtor).toHaveBeenCalled();
    expect(workflowPlan).toHaveBeenCalledWith('write chapter', 'L3-Standard');
    expect(workflowBindPlanSession).toHaveBeenCalledWith('plan-1', 'session-run-1');
    expect(workflowExecute).toHaveBeenCalledWith('plan-1');
    expect(workflowGetPlanStatus).toHaveBeenCalledWith('plan-1');
    expect(ctx.console.log).toHaveBeenCalledWith(expect.stringContaining('Plan created:'));
    expect(ctx.console.log).toHaveBeenCalledWith(expect.stringContaining('Execution status:'));
  });

  it('guided-draft command uses route + plan + execute flow', async () => {
    const ctx = createCtx();
    await guidedDraftCommand.execute(ctx, {
      idea: 'a mystery setup',
      style: 'neutral',
      length: 'medium',
      genre: 'none',
      session: 'guided-session-1',
      namespace: 'draft-ns',
      maxSteps: 10,
    });

    expect(workflowRoute).toHaveBeenCalledWith('a mystery setup');
    expect(workflowPlan).toHaveBeenCalledWith(
      'a mystery setup',
      'L3-Standard',
      expect.any(Array),
    );
    expect(workflowBindPlanSession).toHaveBeenCalledWith('plan-1', 'guided-session-1');
    expect(workflowExecute).toHaveBeenCalled();
    expect(ctx.console.log).toHaveBeenCalledWith(expect.stringContaining('Guided draft completed.'));
  });

  it('project-tech-refresh command calls real refresh helper', async () => {
    const ctx = createCtx();
    await projectTechRefreshCommand.execute(ctx, {
      workspace: '.',
      source: 'cli:manual',
      ttlHours: 72,
    });

    expect(refreshProjectTechMetadata).toHaveBeenCalledWith('.', {
      source: 'cli:manual',
      ttlHours: 72,
    });
    expect(ctx.console.log).toHaveBeenCalledWith(expect.stringContaining('Project-tech refreshed:'));
  });

  it('serve command starts gateway-server runtime', async () => {
    const ctx = createCtx();
    await serveCommand.execute(ctx, {
      host: '127.0.0.1',
      port: 9000,
    });
    expect(startGatewayServer).toHaveBeenCalledWith({ host: '127.0.0.1', port: 9000 });
    expect(ctx.console.log).toHaveBeenCalledWith('Gateway serving at 127.0.0.1:9000');
  });

  it('chat command uses WorkflowEngine-backed replies instead of placeholder output', async () => {
    const questions = ['hello there', '/quit'];
    const closeMock = vi.fn();
    createInterfaceMock.mockReturnValue({
      question: (_prompt: string, cb: (value: string) => void) => cb(String(questions.shift() ?? '/quit')),
      close: closeMock,
    });
    workflowRun.mockResolvedValue({ final_output: 'real workflow reply' });

    const ctx = createCtx();
    await chatCommand.execute(ctx, {
      session: 'chat-session-1',
      level: '3',
      model: 'gemini-2.0-flash',
    });

    expect(workflowEngineCtor).toHaveBeenCalledWith(expect.any(String), 'chat-session-1');
    expect(workflowRun).toHaveBeenCalledWith('hello there', 'L3-Standard');
    expect(ctx.console.log).toHaveBeenCalledWith('Niko: real workflow reply');
    expect(closeMock).toHaveBeenCalled();
  });
});
