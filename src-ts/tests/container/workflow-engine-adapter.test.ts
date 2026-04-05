import { describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { WorkflowEngine } from '../../workflow/workflow-engine.js';
import { WorkflowEngineAdapter } from '../../container/adapters';

describe('WorkflowEngineAdapter', () => {
  it('uses task metadata instead of sessionId as workflow input', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'niko-workflow-adapter-'));

    try {
      const engine = new WorkflowEngine(workspace, 'adapter-test');
      const adapter = new WorkflowEngineAdapter(engine);

      const result = await adapter.executeLevel('L2', {
        sessionId: 'session-123',
        metadata: {
          task: '写一段带悬念的开场',
        },
      });

      expect(result.success).toBe(true);
      expect(result.metadata).toMatchObject({
        sessionId: 'session-123',
        level: 'L2',
        task: '写一段带悬念的开场',
      });
      expect((result.output as Record<string, unknown>)['status']).toBe('completed');
      expect((result.output as Record<string, unknown>)['plan_id']).toBeTruthy();
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('falls back to sessionId only when no task metadata is available', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'niko-workflow-adapter-'));

    try {
      const engine = new WorkflowEngine(workspace, 'adapter-test');
      const adapter = new WorkflowEngineAdapter(engine);

      const result = await adapter.executeLevel('L1', {
        sessionId: 'session-fallback',
      });

      expect(result.success).toBe(true);
      expect(result.metadata).toMatchObject({
        task: 'session-fallback',
      });
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
