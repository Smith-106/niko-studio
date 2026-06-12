import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  createCli,
  evaluateCommand,
  exportCommand,
  guidedDraftCommand,
  initCommand,
  NikoCli,
  projectTechRefreshCommand,
  runCommand,
  searchCommand,
  serveCommand,
  statsCommand,
  statusCommand,
} from '../../cli/commands';

const tempDirs: string[] = [];
const originalCwd = process.cwd();

function createTempDir(label: string): string {
  const dir = mkdtempSync(join(tmpdir(), `${label}-`));
  tempDirs.push(dir);
  return dir;
}

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
  afterEach(() => {
    vi.unstubAllGlobals();
    process.chdir(originalCwd);
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

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

  it('run command short-circuits for dry-run, missing plan ids, and status errors', async () => {
    const ctx = createCtx();
    workflowPlan.mockResolvedValueOnce({
      steps: [],
      total_steps: 0,
    });

    await runCommand.execute(ctx, {
      task: 'outline',
      level: 'auto',
      dryRun: false,
    });

    expect(workflowExecute).not.toHaveBeenCalled();
    expect(ctx.console.log).toHaveBeenCalledWith('Workflow level: auto route');
    expect(ctx.console.log).toHaveBeenCalledWith('Dry run mode - plan generated only');
    expect(ctx.console.error).toHaveBeenCalledWith('Plan creation failed: missing plan_id');

    vi.clearAllMocks();
    workflowPlan.mockResolvedValueOnce({
      plan_id: 'plan-dry',
      steps: [{ id: 's1' }],
      total_steps: 1,
    });

    await runCommand.execute(ctx, {
      task: 'outline',
      level: '1',
      dryRun: true,
    });

    expect(workflowExecute).not.toHaveBeenCalled();
    expect(ctx.console.log).toHaveBeenCalledWith('Dry run mode - plan generated only');

    vi.clearAllMocks();
    workflowPlan.mockResolvedValueOnce({
      plan_id: 'plan-error',
      steps: [{ id: 's1' }],
      total_steps: 1,
    });
    workflowExecute.mockResolvedValueOnce({ status: 'blocked', error: 'needs confirmation' });
    workflowGetPlanStatus.mockReturnValueOnce({ error: 'status unavailable' });

    await runCommand.execute(ctx, {
      task: 'outline',
      level: '2',
    });

    expect(ctx.console.error).toHaveBeenCalledWith('Plan status failed: status unavailable');
  });

  it('run command reports execution errors after a successful status read', async () => {
    const ctx = createCtx();
    workflowPlan.mockResolvedValueOnce({
      plan_id: 'plan-runtime-error',
      steps: 'not-an-array',
    });
    workflowExecute.mockResolvedValueOnce({ status: 'running', error: 'loop failed' });
    workflowGetPlanStatus.mockReturnValueOnce({});

    await runCommand.execute(ctx, {
      task: 'draft a scene',
      level: 'custom-level',
      namespace: 'run-errors',
    });

    expect(workflowEngineCtor).toHaveBeenCalledWith(expect.any(String), 'run-errors');
    expect(workflowPlan).toHaveBeenCalledWith('draft a scene', 'custom-level');
    expect(ctx.console.log).toHaveBeenCalledWith('Plan created: plan-runtime-error (0 steps)');
    expect(ctx.console.log).toHaveBeenCalledWith('Execution status: running');
    expect(ctx.console.log).toHaveBeenCalledWith('Plan progress: unknown');
    expect(ctx.console.error).toHaveBeenCalledWith('Workflow execution failed: loop failed');
  });

  it('run command reports plan-status and unknown execution fallbacks', async () => {
    const ctx = createCtx();
    workflowPlan.mockResolvedValueOnce({
      plan_id: 'plan-status-only',
      steps: [{ id: 's1' }],
    });
    workflowExecute.mockResolvedValueOnce({ plan_status: 'completed' });
    workflowGetPlanStatus.mockReturnValueOnce({ progress: '1/1' });

    await runCommand.execute(ctx, {
      task: 'status only',
      level: '5',
    });

    expect(ctx.console.log).toHaveBeenCalledWith('Execution status: completed');
    expect(ctx.console.log).toHaveBeenCalledWith('Plan progress: 1/1');

    vi.clearAllMocks();
    workflowPlan.mockResolvedValueOnce({
      plan_id: 'plan-unknown',
      steps: [],
    });
    workflowExecute.mockResolvedValue({});
    workflowGetPlanStatus.mockReturnValueOnce({ progress: '' });

    await runCommand.execute(ctx, {
      task: 'unknown status',
      level: 'auto',
    });

    expect(workflowExecute).toHaveBeenCalledTimes(5);
    expect(ctx.console.log).toHaveBeenCalledWith('Execution status: unknown');
    expect(ctx.console.log).toHaveBeenCalledWith('Plan progress: ');
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

  it('guided-draft validates inputs, merges genre controls, and reports execution/status failures', async () => {
    const ctx = createCtx();

    await expect(
      guidedDraftCommand.execute(ctx, {
        idea: '   ',
      }),
    ).rejects.toThrow('idea cannot be empty');

    await expect(
      guidedDraftCommand.execute(ctx, {
        idea: 'seed idea',
        maxSteps: 0,
      }),
    ).rejects.toThrow('max-steps must be >= 1');

    workflowExecute.mockResolvedValueOnce({ status: 'blocked', error: 'draft failed' });
    await guidedDraftCommand.execute(ctx, {
      idea: 'mystery seed',
      genre: 'mystery',
      style: 'neutral',
      length: 'medium',
    });

    expect(workflowPlan).toHaveBeenCalledWith(
      'mystery seed',
      'L3-Standard',
      [
        expect.objectContaining({
          action: 'set_generation_controls',
          target: 'draft',
          params: expect.objectContaining({
            style: 'cinematic',
            length: 'medium',
            constraints: expect.arrayContaining([
              'Maintain clue consistency across all scenes',
            ]),
          }),
        }),
      ],
    );
    expect(ctx.console.error).toHaveBeenCalledWith('Guided draft failed: draft failed');

    vi.clearAllMocks();
    workflowPlan.mockResolvedValueOnce({
      plan_id: 'plan-guided-2',
      steps: [{ id: 's1' }],
      total_steps: 1,
    });
    workflowExecute.mockResolvedValueOnce({ status: 'completed', plan_status: 'completed' });
    workflowGetPlanStatus.mockReturnValueOnce({ error: 'final status failed' });

    await guidedDraftCommand.execute(ctx, {
      idea: 'clean seed',
      genre: 'none',
    });

    expect(ctx.console.error).toHaveBeenCalledWith(
      'Guided draft status failed: final status failed',
    );
  });

  it('guided-draft rejects missing plan ids and stops on execute errors', async () => {
    const ctx = createCtx();

    workflowPlan.mockResolvedValueOnce({
      steps: [],
    });

    await expect(
      guidedDraftCommand.execute(ctx, {
        idea: 'missing plan id seed',
        'max-steps': '2',
      }),
    ).rejects.toThrow('guided-draft failed: plan_id missing');

    vi.clearAllMocks();
    workflowPlan.mockResolvedValueOnce({
      plan_id: 'plan-guided-error',
      steps: [],
      total_steps: 0,
    });
    workflowExecute.mockResolvedValueOnce({ status: 'running', error: 'generator stopped' });

    await guidedDraftCommand.execute(ctx, {
      idea: 'execute error seed',
      style: '',
      length: '',
      genre: 'none',
      'max-steps': '2',
    });

    expect(ctx.console.error).toHaveBeenCalledWith(
      'Guided draft failed: generator stopped',
    );
  });

  it('guided-draft uses route and content fallbacks for final previews', async () => {
    const ctx = createCtx();
    const longDraft = 'draft '.repeat(80).trim();
    workflowRoute.mockResolvedValueOnce({});
    workflowPlan.mockResolvedValueOnce({
      plan_id: 'plan-guided-fallbacks',
      steps: [{ id: 's1' }, { id: 's2' }],
    });
    workflowExecute.mockResolvedValueOnce({ plan_status: 'completed' });
    workflowGetPlanStatus.mockReturnValueOnce({
      steps: [
        { output: { draft_content: '' } },
        { output: { content: longDraft } },
        null,
      ],
    });

    await guidedDraftCommand.execute(ctx, {
      idea: 'fallback final content',
      genre: 'none',
      maxSteps: 10,
    });

    expect(ctx.console.log).toHaveBeenCalledWith('Routed level: L3-Standard');
    expect(ctx.console.log).toHaveBeenCalledWith(expect.stringContaining('Draft preview: '));
    expect(ctx.console.log).toHaveBeenCalledWith(expect.stringContaining('...'));
    expect(ctx.console.log).toHaveBeenCalledWith(
      'Guided draft completed. Progress: unknown',
    );

    vi.clearAllMocks();
    workflowPlan.mockResolvedValueOnce({
      plan_id: 'plan-guided-empty-status',
      steps: 'not-an-array',
    });
    workflowExecute.mockResolvedValueOnce({ status: 'completed' });
    workflowGetPlanStatus.mockReturnValueOnce({
      steps: 'not-an-array',
      progress: '0/0',
    });

    await guidedDraftCommand.execute(ctx, {
      idea: 'empty final status',
      genre: 'none',
    });

    expect(ctx.console.log).toHaveBeenCalledWith(
      'Guided draft completed. Progress: 0/0',
    );
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

  it('project-tech-refresh command uses defaults and skips empty language summaries', async () => {
    refreshProjectTechMetadata.mockReturnValueOnce({
      freshness: {},
      language_file_counts: {},
    });

    const ctx = createCtx();
    await projectTechRefreshCommand.execute(ctx, {});

    expect(refreshProjectTechMetadata).toHaveBeenCalledWith('.', {
      source: 'cli:manual',
      ttlHours: 168,
    });
    expect(ctx.console.log).toHaveBeenCalledWith('Project-tech refreshed: ');
    expect(ctx.console.log).not.toHaveBeenCalledWith(expect.stringContaining('Language file counts:'));
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

  it('serve command falls back to default host and port', async () => {
    const ctx = createCtx();
    await serveCommand.execute(ctx, {});

    expect(startGatewayServer).toHaveBeenCalledWith({ host: '127.0.0.1', port: 8000 });
    expect(ctx.console.log).toHaveBeenCalledWith('Gateway serving at 127.0.0.1:8000');
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

  it('chat command creates a default session when one is not supplied', async () => {
    const closeMock = vi.fn();
    createInterfaceMock.mockReturnValue({
      question: (_prompt: string, cb: (value: string) => void) => cb('/quit'),
      close: closeMock,
    });

    const ctx = createCtx();
    await chatCommand.execute(ctx, {
      level: '3',
      model: 'test-model',
    });

    expect(workflowEngineCtor).toHaveBeenCalledWith(expect.any(String), expect.stringMatching(/^chat_/));
    expect(ctx.console.log).toHaveBeenCalledWith(expect.stringMatching(/^Chat session chat_/));
    expect(closeMock).toHaveBeenCalled();
  });

  it('chat command handles slash commands, persistence, and workflow errors', async () => {
    const workspace = createTempDir('niko-cli-chat');
    process.chdir(workspace);

    const prompts = ['/help', '/level', '/level 4', '/clear', 'hello', '/save', '/export', 'oops', '/quit'];
    const closeMock = vi.fn();
    createInterfaceMock.mockReturnValue({
      question: (_prompt: string, cb: (value: string) => void) => cb(String(prompts.shift() ?? '/quit')),
      close: closeMock,
    });
    workflowRun
      .mockResolvedValueOnce({ content: 'fallback content' })
      .mockResolvedValueOnce({ error: 'runtime failed' });

    const ctx = createCtx();
    await chatCommand.execute(ctx, {
      session: 'chat-save-1',
      level: '3',
      model: 'test-model',
    });

    expect(ctx.console.log).toHaveBeenCalledWith('Commands: /level N, /save, /export, /clear, /quit');
    expect(ctx.console.log).toHaveBeenCalledWith('Current level: L3');
    expect(ctx.console.log).toHaveBeenCalledWith('Level set to L4');
    expect(ctx.console.clear).toHaveBeenCalled();
    expect(ctx.console.log).toHaveBeenCalledWith('Chat history cleared');
    expect(ctx.console.log).toHaveBeenCalledWith('Niko: fallback content');
    expect(ctx.console.error).toHaveBeenCalledWith('Niko: runtime failed');
    expect(readFileSync(join(workspace, '.niko-chat-chat-save-1.json'), 'utf-8')).toContain(
      '"content": "hello"',
    );
    expect(readFileSync(join(workspace, '.niko-chat-chat-save-1.md'), 'utf-8')).toContain(
      '## You',
    );
    expect(closeMock).toHaveBeenCalled();
  });

  it('chat command extracts nested replies and falls back for empty workflow output', async () => {
    const prompts = ['', 'nested reply', 'fallback reply', 'empty object reply', '/quit'];
    createInterfaceMock.mockReturnValue({
      question: (_prompt: string, cb: (value: string) => void) => cb(String(prompts.shift() ?? '/quit')),
      close: vi.fn(),
    });
    workflowRun
      .mockResolvedValueOnce({ final_status: { result: { processed_text: 'nested output' } } })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({});

    const ctx = createCtx();
    await chatCommand.execute(ctx, {
      session: 'chat-nested',
      level: 'auto',
      model: 'test-model',
    });

    expect(workflowRun).toHaveBeenNthCalledWith(1, 'nested reply', 'L3-Standard');
    expect(workflowRun).toHaveBeenNthCalledWith(2, 'fallback reply', 'L3-Standard');
    expect(workflowRun).toHaveBeenNthCalledWith(3, 'empty object reply', 'L3-Standard');
    expect(ctx.console.log).toHaveBeenCalledWith('Niko: nested output');
    expect(ctx.console.log).toHaveBeenCalledWith('Niko: Workflow L3-Standard completed for: fallback reply');
    expect(ctx.console.log).toHaveBeenCalledWith('Niko: Workflow L3-Standard completed for: empty object reply');
  });

  it('initializes project structure and config files', async () => {
    const workspace = createTempDir('niko-cli-init');
    const ctx = createCtx();

    await initCommand.execute(ctx, {
      name: 'My Novel',
      template: 'novel',
      path: workspace,
    });

    const nikoDir = join(workspace, '.niko');
    expect(existsSync(join(nikoDir, 'sessions'))).toBe(true);
    expect(existsSync(join(nikoDir, 'memory'))).toBe(true);
    expect(existsSync(join(nikoDir, 'config', 'project.yaml'))).toBe(true);
    expect(readFileSync(join(nikoDir, 'config', 'project.yaml'), 'utf-8')).toContain(
      'name: "My Novel"',
    );
  });

  it('evaluates content from text or file and writes structured output', async () => {
    const workspace = createTempDir('niko-cli-evaluate');
    const inputFile = join(workspace, 'sample.txt');
    const outputFile = join(workspace, 'scores.json');
    writeFileSync(inputFile, 'I must solve this mystery. "Listen!" I hear the bell.', 'utf-8');

    const ctx = createCtx();
    await evaluateCommand.execute(ctx, {
      file: inputFile,
      output: outputFile,
    });

    expect(ctx.console.log).toHaveBeenCalledWith(expect.stringContaining('Evaluating content'));
    expect(ctx.console.log).toHaveBeenCalledWith(expect.stringContaining('LOCK Score:'));
    expect(JSON.parse(readFileSync(outputFile, 'utf-8'))).toEqual(
      expect.objectContaining({
        lock_total: expect.any(Number),
        quality_average: expect.any(Number),
      }),
    );

    vi.clearAllMocks();
    await evaluateCommand.execute(ctx, {
      text: '',
    });
    expect(ctx.console.error).toHaveBeenCalledWith('Provide either a file or --text');

    vi.clearAllMocks();
    await evaluateCommand.execute(ctx, {});
    expect(ctx.console.error).toHaveBeenCalledWith('Provide either a file or --text');

    vi.clearAllMocks();
    await evaluateCommand.execute(ctx, {
      text: 'quiet words only',
    });

    expect(ctx.console.log).toHaveBeenCalledWith('LOCK Score: 19/40');
    expect(ctx.console.log).toHaveBeenCalledWith('Quality Avg: 60.0/100');

    vi.clearAllMocks();
    await evaluateCommand.execute(ctx, {
      text: 'one two three four five six seven eight nine ten eleven twelve.',
    });

    expect(ctx.console.log).toHaveBeenCalledWith('Quality Avg: 62.5/100');

    vi.clearAllMocks();
    await evaluateCommand.execute(ctx, {
      text: `What must the hero do next? They need a want, a goal, and a mission, but however they fight against struggle. I see the harbor, hear bells, feel rain, smell smoke, taste salt, and touch the cold rail. ${'moment '.repeat(520)}! "Listen!"`,
    });

    expect(ctx.console.log).toHaveBeenCalledWith('LOCK Score: 37/40');
    expect(ctx.console.log).toHaveBeenCalledWith('Quality Avg: 69.4/100');
  });

  it('exports content using explicit and default output paths', async () => {
    const workspace = createTempDir('niko-cli-export');
    const source = join(workspace, 'chapter.md');
    const explicit = join(workspace, 'chapter.txt');
    writeFileSync(source, '# Chapter 1', 'utf-8');

    const ctx = createCtx();
    await exportCommand.execute(ctx, {
      source,
      format: 'txt',
      output: explicit,
    });
    expect(readFileSync(explicit, 'utf-8')).toBe('# Chapter 1');

    await exportCommand.execute(ctx, {
      source,
      format: 'json',
    });
    expect(readFileSync(join(workspace, 'chapter.json'), 'utf-8')).toBe('# Chapter 1');
  });

  it('status, stats, and search commands call gateway endpoints and handle failures', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        text: async () => JSON.stringify({ ok: true }),
      })
      .mockResolvedValueOnce({
        text: async () => '',
      })
      .mockResolvedValueOnce({
        text: async () => JSON.stringify({ items: [{ id: 'mem-1' }] }),
      })
      .mockResolvedValueOnce({
        status: 500,
        text: async () => 'plain text error',
      });
    vi.stubGlobal('fetch', fetchMock);

    const ctx = createCtx();
    await statusCommand.execute(ctx, { gateway: 'http://localhost:8000/' });
    await statsCommand.execute(ctx, { gateway: 'http://localhost:8000' });
    await searchCommand.execute(ctx, {
      gateway: 'http://localhost:8000',
      query: 'hero',
      scope: 'project',
      limit: 3,
    });
    await searchCommand.execute(ctx, {
      gateway: 'http://localhost:8000',
      query: 'broken',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://localhost:8000/health',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:8000/metrics',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'http://localhost:8000/memory/search',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ query: 'hero', scope: 'project', limit: 3 }),
      }),
    );
    expect(ctx.console.log).toHaveBeenCalledWith('Gateway status: {\n  "ok": true\n}');
    expect(ctx.console.log).toHaveBeenCalledWith('Gateway metrics: {}');
    expect(ctx.console.log).toHaveBeenCalledWith(
      'Search results: {\n  "items": [\n    {\n      "id": "mem-1"\n    }\n  ]\n}',
    );
    expect(ctx.console.error).toHaveBeenCalledWith(
      expect.stringContaining('Search failed: Error: Gateway returned non-JSON response'),
    );
  });

  it('status and stats commands report fetch failures', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('health down'))
      .mockRejectedValueOnce(new Error('metrics down'));
    vi.stubGlobal('fetch', fetchMock);

    const ctx = createCtx();
    await statusCommand.execute(ctx, {});
    await statsCommand.execute(ctx, {});

    expect(ctx.console.error).toHaveBeenCalledWith(
      'Status check failed: Error: health down',
    );
    expect(ctx.console.error).toHaveBeenCalledWith(
      'Stats check failed: Error: metrics down',
    );
  });

  it('NikoCli exposes commands and throws for unknown names', async () => {
    const cli = new NikoCli();
    const commands = cli.listCommands();

    expect(commands).toContain('run');
    expect(commands).toContain('chat');
    expect(cli.getCommand('serve')).toBeDefined();
    await expect(cli.run('unknown-command', {})).rejects.toThrow(
      'Unknown command: unknown-command',
    );
  });

  it('createCli returns a runnable CLI instance for registered commands', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const clearSpy = vi.spyOn(console, 'clear').mockImplementation(() => {});
    const cli = createCli();

    await cli.run('serve', {
      host: '0.0.0.0',
      port: 8123,
    });

    expect(startGatewayServer).toHaveBeenCalledWith({ host: '0.0.0.0', port: 8123 });
    expect(logSpy).toHaveBeenCalledWith('Gateway serving at 0.0.0.0:8123');
    expect(errorSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();

    logSpy.mockRestore();
    errorSpy.mockRestore();
    clearSpy.mockRestore();
  });

  it('createCli forwards built-in console error and clear handlers', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const clearSpy = vi.spyOn(console, 'clear').mockImplementation(() => {});
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);
    const cli = createCli();

    await cli.run('status', {});

    const prompts = ['/clear', '/quit'];
    createInterfaceMock.mockReturnValue({
      question: (_prompt: string, cb: (value: string) => void) => cb(String(prompts.shift() ?? '/quit')),
      close: vi.fn(),
    });

    await cli.run('chat', {
      session: 'cli-console',
      level: '3',
      model: 'test-model',
    });

    expect(errorSpy).toHaveBeenCalledWith('Status check failed: Error: offline');
    expect(clearSpy).toHaveBeenCalled();

    logSpy.mockRestore();
    errorSpy.mockRestore();
    clearSpy.mockRestore();
  });
});
