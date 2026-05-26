/**
 * CLI module - Command implementations
 *
 * Migrated from src/cli/commands/.
 */

const DEFAULT_GATEWAY_URL = 'http://127.0.0.1:8000';
const DEFAULT_GATEWAY_HOST = '127.0.0.1';
const DEFAULT_GATEWAY_PORT = 8000;

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import {
  CliContext,
  Command,
  GENRE_CHOICES,
  generateSessionId,
  mergeControlsWithGenre,
} from './types';
import { WorkflowEngine } from '../workflow/workflow-engine';
import { refreshProjectTechMetadata } from '../workflow/project-tech';

// ============================================================
// init command
// ============================================================

const TEMPLATE_CHOICES = ['novel', 'short-story', 'screenplay', 'custom'] as const;

export const initCommand: Command = {
  name: 'init',
  description: 'Initialize a new Niko Studio project',
  options: [
    { name: 'name', alias: 'n', required: true, type: 'string', description: 'Project or session name' },
    { name: 'template', alias: 't', type: 'choice', choices: [...TEMPLATE_CHOICES], default: 'novel', description: 'Project template type' },
    { name: 'path', alias: 'p', type: 'string', default: '.', description: 'Project root path' },
  ],
  async execute(ctx: CliContext, args: Record<string, unknown>): Promise<void> {
    const name = args.name as string;
    const template = args.template as string;
    const projectPath = args.path as string;

    ctx.console.log(`Initializing project: ${name}`);

    const resolvedPath = resolve(projectPath);
    const nikoDir = join(resolvedPath, '.niko');

    const dirs = ['sessions', 'memory', 'config', 'drafts', 'exports'];
    for (const dir of dirs) {
      mkdirSync(join(nikoDir, dir), { recursive: true });
      ctx.console.log(`  Created: ${dir}`);
    }

    const sessionId = generateSessionId('sess');
    const sessionDir = join(nikoDir, 'sessions', sessionId);
    mkdirSync(sessionDir, { recursive: true });

    const configContent = `# Niko Studio Project Configuration\n# Generated: ${new Date().toISOString()}\n\nproject:\n  name: "${name}"\n  template: "${template}"\n  created_at: "${new Date().toISOString()}"\n\nmemory:\n  db_path: ".niko/memory/memory.db"\n\nworkflow:\n  default_level: 3\n`;

    const configFile = join(nikoDir, 'config', 'project.yaml');
    writeFileSync(configFile, configContent, 'utf-8');

    ctx.console.log(`Project initialized at ${nikoDir}`);
  },
};

// ============================================================
// run command
// ============================================================

const LEVEL_MAP: Record<string, string> = {
  '1': 'L1-Rapid',
  '2': 'L2-Lite',
  '3': 'L3-Standard',
  '4': 'L4-Brainstorm',
  '5': 'L5-Coordinator',
};

function toWorkflowLevel(level: string): string | undefined {
  if (!level || level === 'auto') return undefined;
  return LEVEL_MAP[level] ?? level;
}

function getBooleanArg(args: Record<string, unknown>, ...keys: string[]): boolean {
  for (const key of keys) {
    const raw = args[key];
    if (typeof raw === 'boolean') return raw;
  }
  return false;
}

function asNumberArg(args: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const raw = args[key];
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'string' && raw.trim()) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function buildGenerationRecommendations(
  controls: { style: string; length: string; constraints: string[] },
): Array<{ action: string; target: string; params: Record<string, unknown> }> {
  return [
    {
      action: 'set_generation_controls',
      target: 'draft',
      params: {
        style: controls.style,
        length: controls.length,
        constraints: controls.constraints,
      },
    },
  ];
}

function extractWorkflowContent(value: unknown): string {
  if (typeof value !== 'object' || value === null) {
    return '';
  }

  const record = value as Record<string, unknown>;
  for (const key of ['final_output', 'draft_content', 'content', 'processed_text']) {
    const candidate = record[key];
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  for (const key of ['last_step', 'final_status', 'result']) {
    const nested = extractWorkflowContent(record[key]);
    if (nested) {
      return nested;
    }
  }

  return '';
}

export const runCommand: Command = {
  name: 'run',
  description: 'Execute a writing workflow',
  options: [
    { name: 'task', alias: 't', required: true, type: 'string', description: 'Task description' },
    { name: 'level', alias: 'l', type: 'choice', choices: ['1', '2', '3', '4', '5', 'auto'], default: 'auto', description: 'Workflow level' },
    { name: 'session', alias: 's', type: 'string', description: 'Session ID' },
    { name: 'dry-run', type: 'boolean', default: false, description: 'Show plan without executing' },
    { name: 'genre', type: 'choice', choices: [...GENRE_CHOICES], default: 'none', description: 'Genre profile' },
    { name: 'namespace', type: 'string', default: '', description: 'Session namespace' },
  ],
  async execute(ctx: CliContext, args: Record<string, unknown>): Promise<void> {
    const task = args.task as string;
    const level = args.level as string;
    const sessionId = ((args.session as string) ?? '').trim();
    const dryRun = getBooleanArg(args, 'dryRun', 'dry-run');
    const namespace = ((args.namespace as string) ?? '').trim();
    const workflowLevel = toWorkflowLevel(level);
    const workspace = process.cwd();
    const engine = new WorkflowEngine(workspace, namespace || undefined);

    ctx.console.log(`Executing workflow: ${task}`);
    if (workflowLevel) {
      ctx.console.log(`Workflow level: ${workflowLevel}`);
    } else {
      ctx.console.log('Workflow level: auto route');
    }

    const plan = await engine.plan(task, workflowLevel);
    const planId = String(plan.plan_id ?? '');
    const steps = Array.isArray(plan.steps) ? plan.steps.length : 0;
    if (planId && sessionId) {
      engine.bindPlanSession(planId, sessionId);
    }
    ctx.console.log(`Plan created: ${planId} (${steps} steps)`);

    if (dryRun || !planId) {
      ctx.console.log('Dry run mode - plan generated only');
      if (!planId) ctx.console.error('Plan creation failed: missing plan_id');
      return;
    }

    const maxIterations = Math.max(steps + 5, 5);
    let latest: Record<string, unknown> = {};
    for (let i = 0; i < maxIterations; i++) {
      latest = await engine.execute(planId);
      const status = String(latest.status ?? '');
      const planStatus = String(latest.plan_status ?? '');
      if (status === 'completed' || planStatus === 'completed') break;
      if (status === 'blocked' || status === 'waiting_confirmation' || status === 'preflight_blocked' || status === 'gate_blocked') {
        break;
      }
      if (latest.error) break;
    }

    const finalStatus = engine.getPlanStatus(planId);
    ctx.console.log(`Execution status: ${String(latest.status ?? latest.plan_status ?? 'unknown')}`);
    if ('error' in finalStatus) {
      ctx.console.error(`Plan status failed: ${String(finalStatus.error)}`);
      return;
    }
    ctx.console.log(`Plan progress: ${String(finalStatus.progress ?? 'unknown')}`);
    if (latest.error) {
      ctx.console.error(`Workflow execution failed: ${String(latest.error)}`);
    }
  },
};

// ============================================================
// chat command
// ============================================================

export const chatCommand: Command = {
  name: 'chat',
  description: 'Start an interactive chat session',
  options: [
    { name: 'session', alias: 's', type: 'string', description: 'Session ID to resume' },
    { name: 'level', alias: 'l', type: 'choice', choices: ['1', '2', '3', '4', '5'], default: '3', description: 'Default workflow level' },
    { name: 'model', alias: 'm', type: 'string', default: 'gemini-2.0-flash', description: 'LLM model' },
  ],
  async execute(ctx: CliContext, args: Record<string, unknown>): Promise<void> {
    const sessionId = (args.session as string) || generateSessionId('chat');
    let level = args.level as string;
    const model = args.model as string;
    const engine = new WorkflowEngine(process.cwd(), sessionId);

    ctx.console.log(`Chat session ${sessionId} started (Level L${level}, Model: ${model})`);
    ctx.console.log('Type /help for commands, /quit to exit');

    const history: Array<{ role: string; content: string }> = [];
    const rl = createInterface({ input: process.stdin, output: process.stdout });

    const askQuestion = (prompt: string): Promise<string> =>
      new Promise(resolve => rl.question(prompt, resolve));

    while (true) {
      const input = await askQuestion('\nYou> ');
      if (!input || !input.trim()) continue;

      if (input.startsWith('/')) {
        const cmd = input.toLowerCase().trim();
        if (['/quit', '/exit', '/q'].includes(cmd)) break;
        if (cmd === '/help') {
          ctx.console.log('Commands: /level N, /save, /export, /clear, /quit');
        } else if (cmd.startsWith('/level')) {
          const nextLevel = cmd.replace('/level', '').trim();
          if (nextLevel && ['1', '2', '3', '4', '5'].includes(nextLevel)) {
            level = nextLevel;
            ctx.console.log(`Level set to L${level}`);
          } else {
            ctx.console.log(`Current level: L${level}`);
          }
        } else if (cmd === '/clear') {
          history.length = 0;
          ctx.console.clear();
          ctx.console.log('Chat history cleared');
        } else if (cmd === '/save') {
          const outPath = join(process.cwd(), `.niko-chat-${sessionId}.json`);
          writeFileSync(outPath, JSON.stringify(history, null, 2), 'utf-8');
          ctx.console.log(`Chat saved to ${outPath}`);
        } else if (cmd === '/export') {
          const outPath = join(process.cwd(), `.niko-chat-${sessionId}.md`);
          const markdown = history
            .map(entry => `## ${entry.role === 'user' ? 'You' : 'Niko'}\n\n${entry.content}`)
            .join('\n\n');
          writeFileSync(outPath, markdown, 'utf-8');
          ctx.console.log(`Chat exported to ${outPath}`);
        }
        continue;
      }

      history.push({ role: 'user', content: input });

      const workflowLevel = toWorkflowLevel(level) ?? 'L3-Standard';
      const result = await engine.run(input, workflowLevel);

      if (result && typeof result === 'object' && result.error) {
        ctx.console.error(`Niko: ${String(result.error)}`);
        continue;
      }

      const response = extractWorkflowContent(result) || `Workflow ${workflowLevel} completed for: ${input}`;
      history.push({ role: 'assistant', content: response });
      ctx.console.log(`Niko: ${response}`);
    }

    rl.close();
  },
};

// ============================================================
// evaluate command
// ============================================================

function analyzeLock(content: string): Record<string, number> {
  const words = content.split(/\s+/);
  const firstPara = content.slice(0, 500);

  const lScore = Math.min(10, 5 + (firstPara.includes('?') ? 3 : 0) + (firstPara.length > 100 ? 2 : 0));
  const goalWords = ['must', 'need', 'want', 'goal', 'mission'];
  const oScore = Math.min(10, 5 + goalWords.filter(w => content.toLowerCase().includes(w)).length * 2);
  const conflictWords = ['but', 'however', 'against', 'fight', 'struggle'];
  const cScore = Math.min(10, 4 + conflictWords.filter(w => content.toLowerCase().includes(w)).length);
  const kScore = Math.min(10, 5 + (words.length > 500 ? 3 : 0));

  return { L: lScore, O: oScore, C: cScore, K: kScore };
}

function analyzeQuality(content: string): Record<string, number> {
  const words = content.split(/\s+/);
  const sentences = (content.match(/[.!?]/g) || []).length;
  const avgLen = words.length / Math.max(sentences, 1);
  const sensoryWords = ['see', 'hear', 'feel', 'smell', 'taste', 'touch'];
  const sensory = sensoryWords.filter(w => content.toLowerCase().includes(w)).length;
  const dialogueCount = Math.floor((content.match(/"/g) || []).length / 2);

  return {
    'Sensory Balance': Math.min(100, 50 + sensory * 10),
    'Visual Quality': Math.min(100, 60 + (content.length > 1000 ? 10 : 0)),
    'Dialogue Quality': Math.min(100, 40 + dialogueCount * 5),
    'Character Consistency': 75,
    'Pacing Control': avgLen > 10 && avgLen < 25 ? 70 : 50,
    'Emotional Tension': Math.min(100, 60 + (content.match(/!/g) || []).length * 5),
    'Narrative Logic': 70,
    'Style Consistency': 75,
  };
}

export const evaluateCommand: Command = {
  name: 'evaluate',
  description: 'Evaluate writing content quality',
  options: [
    { name: 'file', type: 'string', required: false, description: 'File to evaluate' },
    { name: 'text', alias: 't', type: 'string', description: 'Text content' },
    { name: 'format', alias: 'f', type: 'choice', choices: ['full', 'lock', 'quality', 'summary'], default: 'full', description: 'Output format' },
    { name: 'output', alias: 'o', type: 'string', description: 'Output file' },
  ],
  async execute(ctx: CliContext, args: Record<string, unknown>): Promise<void> {
    const file = args.file as string | undefined;
    const text = args.text as string | undefined;

    const content = file ? readFileSync(file, 'utf-8') : text ?? '';
    if (!content) {
      ctx.console.error('Provide either a file or --text');
      return;
    }

    ctx.console.log(`Evaluating content (${content.length} chars)`);

    const lockScores = analyzeLock(content);
    const qualityScores = analyzeQuality(content);

    const lockTotal = Object.values(lockScores).reduce((a, b) => a + b, 0);
    const qualityAvg = Object.values(qualityScores).reduce((a, b) => a + b, 0) / Object.keys(qualityScores).length;

    ctx.console.log(`LOCK Score: ${lockTotal}/40`);
    ctx.console.log(`Quality Avg: ${qualityAvg.toFixed(1)}/100`);

    if (args.output) {
      writeFileSync(args.output as string, JSON.stringify({
        lock_scores: lockScores,
        quality_scores: qualityScores,
        lock_total: lockTotal,
        quality_average: qualityAvg,
      }, null, 2), 'utf-8');
    }
  },
};

// ============================================================
// export command
// ============================================================

const EXPORT_FORMATS = ['md', 'json', 'docx', 'txt', 'html'];

export const exportCommand: Command = {
  name: 'export',
  description: 'Export content to various formats',
  options: [
    { name: 'source', type: 'string', required: true, description: 'Source file path' },
    { name: 'format', alias: 'f', type: 'choice', choices: EXPORT_FORMATS, default: 'md', description: 'Export format' },
    { name: 'output', alias: 'o', type: 'string', description: 'Output file path' },
    { name: 'template', alias: 't', type: 'choice', choices: ['novel', 'screenplay', 'report', 'plain'], default: 'plain', description: 'Export template' },
    { name: 'include-meta', type: 'boolean', default: false, description: 'Include metadata' },
  ],
  async execute(ctx: CliContext, args: Record<string, unknown>): Promise<void> {
    const source = args.source as string;
    const format = args.format as string;

    ctx.console.log(`Exporting ${source} as ${format}`);

    const content = readFileSync(source, 'utf-8');
    const outputPath = (args.output as string) || source.replace(/\.\w+$/, `.${format}`);

    writeFileSync(outputPath, content, 'utf-8');
    ctx.console.log(`Exported to ${outputPath}`);
  },
};

// ============================================================
// runtime commands
// ============================================================

async function gatewayRequest(
  path: string,
  options: {
    method?: string;
    payload?: Record<string, unknown>;
    gateway?: string;
    timeout?: number;
  } = {},
): Promise<Record<string, unknown>> {
  const base = (options.gateway ?? 'http://127.0.0.1:8000').replace(/\/$/, '');
  const url = `${base}${path}`;

  const fetchOptions: RequestInit = {
    method: options.method ?? 'GET',
    headers: { accept: 'application/json' },
  };

  if (options.payload) {
    (fetchOptions.headers as Record<string, string>)['content-type'] = 'application/json';
    fetchOptions.body = JSON.stringify(options.payload);
  }

  const response = await fetch(url, { ...fetchOptions, signal: AbortSignal.timeout(options.timeout ?? 10000) });
  const body = await response.text();
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`Gateway returned non-JSON response (${response.status}): ${body.slice(0, 200)}`);
  }
}

export const statusCommand: Command = {
  name: 'status',
  description: 'Show gateway health status',
  options: [
    { name: 'gateway', type: 'string', default: 'http://127.0.0.1:8000', description: 'Gateway URL' },
  ],
  async execute(ctx: CliContext, args: Record<string, unknown>): Promise<void> {
    try {
      const result = await gatewayRequest('/health', { gateway: args.gateway as string });
      ctx.console.log(`Gateway status: ${JSON.stringify(result, null, 2)}`);
    } catch (e) {
      ctx.console.error(`Status check failed: ${e}`);
    }
  },
};

export const statsCommand: Command = {
  name: 'stats',
  description: 'Show gateway runtime metrics',
  options: [
    { name: 'gateway', type: 'string', default: 'http://127.0.0.1:8000', description: 'Gateway URL' },
  ],
  async execute(ctx: CliContext, args: Record<string, unknown>): Promise<void> {
    try {
      const result = await gatewayRequest('/metrics', { gateway: args.gateway as string });
      ctx.console.log(`Gateway metrics: ${JSON.stringify(result, null, 2)}`);
    } catch (e) {
      ctx.console.error(`Stats check failed: ${e}`);
    }
  },
};

export const searchCommand: Command = {
  name: 'search',
  description: 'Search memories through gateway',
  options: [
    { name: 'query', type: 'string', required: true, description: 'Search query' },
    { name: 'scope', type: 'string', default: 'all', description: 'Search scope' },
    { name: 'limit', type: 'number', default: 10, description: 'Max results' },
    { name: 'gateway', type: 'string', default: 'http://127.0.0.1:8000', description: 'Gateway URL' },
  ],
  async execute(ctx: CliContext, args: Record<string, unknown>): Promise<void> {
    try {
      const result = await gatewayRequest('/memory/search', {
        method: 'POST',
        payload: { query: args.query, scope: args.scope, limit: args.limit },
        gateway: args.gateway as string,
      });
      ctx.console.log(`Search results: ${JSON.stringify(result, null, 2)}`);
    } catch (e) {
      ctx.console.error(`Search failed: ${e}`);
    }
  },
};

export const serveCommand: Command = {
  name: 'serve',
  description: 'Serve the gateway process',
  options: [
    { name: 'host', type: 'string', description: 'Gateway host' },
    { name: 'port', type: 'number', description: 'Gateway port' },
  ],
  async execute(ctx: CliContext, args: Record<string, unknown>): Promise<void> {
    const host = (args.host as string) || '127.0.0.1';
    const port = (args.port as number) || 8000;
    const { startGatewayServer } = await import('../gateway-server');
    await startGatewayServer({ host, port });
    ctx.console.log(`Gateway serving at ${host}:${port}`);
  },
};

// ============================================================
// guided-draft command
// ============================================================

const STYLE_CHOICES = ['neutral', 'cinematic', 'lyrical', 'minimal'];
const LENGTH_CHOICES = ['short', 'medium', 'long'];

export const guidedDraftCommand: Command = {
  name: 'guided-draft',
  description: 'Start a guided idea-to-draft session',
  options: [
    { name: 'idea', alias: 'i', required: true, type: 'string', description: 'Idea input' },
    { name: 'style', type: 'choice', choices: STYLE_CHOICES, default: 'neutral', description: 'Draft style' },
    { name: 'length', type: 'choice', choices: LENGTH_CHOICES, default: 'medium', description: 'Draft length' },
    { name: 'constraint', type: 'string', description: 'Draft constraint (repeatable)' },
    { name: 'max-steps', type: 'number', default: 20, description: 'Max execute iterations' },
    { name: 'genre', type: 'choice', choices: [...GENRE_CHOICES], default: 'none', description: 'Genre profile' },
    { name: 'session', type: 'string', default: '', description: 'Session ID' },
    { name: 'namespace', type: 'string', default: '', description: 'Session namespace' },
  ],
  async execute(ctx: CliContext, args: Record<string, unknown>): Promise<void> {
    const idea = args.idea as string;
    const style = (args.style as string) || 'neutral';
    const length = (args.length as string) || 'medium';
    const genre = (args.genre as string) || 'none';
    const sessionId = ((args.session as string) ?? '').trim();
    const namespace = ((args.namespace as string) ?? '').trim();
    const maxSteps = asNumberArg(args, 'maxSteps', 'max-steps') ?? 20;

    if (!idea.trim()) throw new Error('idea cannot be empty');
    if (maxSteps < 1) throw new Error('max-steps must be >= 1');

    const controls = mergeControlsWithGenre(
      { style, length, constraints: [] },
      genre,
    );

    ctx.console.log(`Guided draft: ${idea.slice(0, 80)}...`);
    ctx.console.log(`Style: ${controls.style}, Length: ${controls.length}`);
    const engine = new WorkflowEngine(process.cwd(), namespace || undefined);
    const recommendations = buildGenerationRecommendations(controls);

    const routing = await engine.route(idea);
    ctx.console.log(`Routed level: ${String(routing.level ?? 'L3-Standard')}`);

    const plan = await engine.plan(idea, 'L3-Standard', recommendations);
    const planId = String(plan.plan_id ?? '');
    if (!planId) {
      throw new Error('guided-draft failed: plan_id missing');
    }
    if (sessionId) {
      engine.bindPlanSession(planId, sessionId);
    }
    ctx.console.log(`Plan created: ${planId}`);

    const totalSteps = Number(plan.total_steps ?? (Array.isArray(plan.steps) ? plan.steps.length : 0));
    const maxIterations = Math.min(Math.max(totalSteps + 5, 5), maxSteps);
    let latest: Record<string, unknown> = {};
    for (let i = 0; i < maxIterations; i++) {
      latest = await engine.execute(planId, undefined, recommendations);
      const status = String(latest.status ?? '');
      const planStatus = String(latest.plan_status ?? '');
      if (status === 'completed' || planStatus === 'completed') break;
      if (status === 'blocked' || status === 'waiting_confirmation' || status === 'preflight_blocked' || status === 'gate_blocked') break;
      if (latest.error) break;
    }

    if (latest.error) {
      ctx.console.error(`Guided draft failed: ${String(latest.error)}`);
      return;
    }

    const finalStatus = engine.getPlanStatus(planId);
    if ('error' in finalStatus) {
      ctx.console.error(`Guided draft status failed: ${String(finalStatus.error)}`);
      return;
    }
    const finalSteps = Array.isArray(finalStatus.steps) ? finalStatus.steps : [];
    const contentStep = [...finalSteps]
      .reverse()
      .find(step => {
        if (!step || typeof step !== 'object') return false;
        const output = (step as Record<string, unknown>).output;
        return typeof output === 'object' && output !== null;
      }) as Record<string, unknown> | undefined;
    const output = (contentStep?.output as Record<string, unknown> | undefined) ?? {};
    const draft = String(output.draft_content ?? output.content ?? '').trim();

    if (draft) {
      ctx.console.log(`Draft preview: ${draft.slice(0, 280)}${draft.length > 280 ? '...' : ''}`);
    }
    ctx.console.log(`Guided draft completed. Progress: ${String(finalStatus.progress ?? 'unknown')}`);
  },
};

// ============================================================
// project-tech command
// ============================================================

export const projectTechRefreshCommand: Command = {
  name: 'project-tech-refresh',
  description: 'Refresh project-tech metadata',
  options: [
    { name: 'workspace', type: 'string', default: '.', description: 'Workspace root' },
    { name: 'source', type: 'string', default: 'cli:manual', description: 'Source label' },
    { name: 'ttl-hours', type: 'number', default: 168, description: 'TTL in hours' },
  ],
  async execute(ctx: CliContext, args: Record<string, unknown>): Promise<void> {
    const workspace = String(args.workspace ?? '.');
    const source = String(args.source ?? 'cli:manual');
    const ttlHours = asNumberArg(args, 'ttlHours', 'ttl-hours') ?? 168;
    const result = refreshProjectTechMetadata(workspace, { source, ttlHours });
    const freshness = result.freshness;
    const generatedAt = String(freshness.generated_at ?? '');
    const schemaVersion = String(freshness.schema_version ?? '');
    const outputPath = String(result.path ?? '');
    ctx.console.log(`Project-tech refreshed: ${outputPath}`);
    ctx.console.log(`Generated at: ${generatedAt}`);
    ctx.console.log(`Source: ${String(freshness.source ?? '')}, schema: ${schemaVersion}, ttl_hours: ${String(freshness.ttl_hours ?? '')}`);
    const langCounts = result.language_file_counts;
    const countSummary = Object.entries(langCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([lang, count]) => `${lang}=${count}`)
      .join(', ');
    if (countSummary) {
      ctx.console.log(`Language file counts: ${countSummary}`);
    }
  },
};

// ============================================================
// Main CLI
// ============================================================

const ALL_COMMANDS: Command[] = [
  initCommand,
  runCommand,
  chatCommand,
  evaluateCommand,
  exportCommand,
  statusCommand,
  statsCommand,
  searchCommand,
  serveCommand,
  guidedDraftCommand,
  projectTechRefreshCommand,
];

export class NikoCli {
  private commands: Map<string, Command> = new Map();

  constructor() {
    for (const cmd of ALL_COMMANDS) {
      this.commands.set(cmd.name, cmd);
    }
  }

  async run(commandName: string, args: Record<string, unknown>): Promise<void> {
    const cmd = this.commands.get(commandName);
    if (!cmd) {
      throw new Error(`Unknown command: ${commandName}`);
    }
    const ctx: CliContext = {
      console: {
        log: (...a: unknown[]) => console.log(...a),
        error: (...a: unknown[]) => console.error(...a),
        clear: () => console.clear(),
      },
    };
    await cmd.execute(ctx, args);
  }

  listCommands(): string[] {
    return Array.from(this.commands.keys());
  }

  getCommand(name: string): Command | undefined {
    return this.commands.get(name);
  }
}

export function createCli(): NikoCli {
  return new NikoCli();
}
