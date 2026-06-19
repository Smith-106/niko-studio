import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DistillationTemplate } from '../../services/distill-service.js';
import { DistillationNowledgeBridge } from '../../services/distillation-nowledge-bridge.js';

function createMockService() {
  return {
    status: vi.fn().mockResolvedValue({ connected: true, version: '1.0.0' }),
    addMemory: vi.fn().mockResolvedValue({ id: 'mem-1', content: 'test' }),
    createRelation: vi.fn().mockResolvedValue(undefined),
    summarizeMemories: vi.fn().mockResolvedValue('summary-1'),
  };
}

function makeResult(content = 'distilled', sourceIds: string[] = []) {
  return {
    resultId: 'dist-1',
    sourceIds,
    template: DistillationTemplate.SUMMARY,
    content,
    derivedFrom: [],
    createdAt: new Date().toISOString(),
    metadata: {},
  };
}

describe('DistillationNowledgeBridge additional coverage', () => {
  let service: ReturnType<typeof createMockService>;

  beforeEach(() => {
    service = createMockService();
  });

  it('marks the bridge unavailable when status throws', async () => {
    service.status.mockRejectedValueOnce(new Error('status unavailable'));
    const bridge = new DistillationNowledgeBridge(service as never);

    await bridge.initialize();

    await expect(bridge.persistDistillation(makeResult())).resolves.toBeNull();
    expect(service.addMemory).not.toHaveBeenCalled();
  });

  it('returns early when linking source memories while the bridge is unavailable', async () => {
    service.status.mockResolvedValueOnce({ connected: false, version: '1.0.0' });
    const bridge = new DistillationNowledgeBridge(service as never);

    await bridge.initialize();
    await bridge.linkToSourceMemories('mem-1', ['source-1', 'source-2']);

    expect(service.createRelation).not.toHaveBeenCalled();
  });

  it('swallows per-source relation failures and continues linking', async () => {
    service.createRelation
      .mockRejectedValueOnce(new Error('first relation failed'))
      .mockResolvedValueOnce(undefined);
    const bridge = new DistillationNowledgeBridge(service as never);

    await bridge.initialize();

    await expect(bridge.persistDistillation(makeResult('summary', ['s1', 's2']))).resolves.toBe('mem-1');
    expect(service.createRelation).toHaveBeenCalledTimes(2);
    expect(service.createRelation).toHaveBeenNthCalledWith(1, 'mem-1', 's1', { type: 'DISTILLED_FROM' });
    expect(service.createRelation).toHaveBeenNthCalledWith(2, 'mem-1', 's2', { type: 'DISTILLED_FROM' });
  });

  it('returns null from autoSummarize when there are no pending ids', async () => {
    const bridge = new DistillationNowledgeBridge(service as never);

    await bridge.initialize();

    await expect(bridge.autoSummarize()).resolves.toBeNull();
    expect(service.summarizeMemories).not.toHaveBeenCalled();
  });

  it('returns null from autoSummarize when summarizeMemories throws and keeps pending ids', async () => {
    service.summarizeMemories.mockRejectedValueOnce(new Error('summary failed'));
    const bridge = new DistillationNowledgeBridge(service as never, {
      autoSummarizeThreshold: 99,
    });

    await bridge.initialize();
    await bridge.persistDistillation(makeResult());

    await expect(bridge.autoSummarize()).resolves.toBeNull();
    expect(bridge.getPendingCount()).toBe(1);
  });

  it('swallows summary relation failures and still clears the pending queue', async () => {
    service.createRelation.mockRejectedValueOnce(new Error('summary relation failed'));
    const bridge = new DistillationNowledgeBridge(service as never, {
      autoSummarizeThreshold: 99,
      linkToSources: true,
    });

    await bridge.initialize();
    await bridge.persistDistillation(makeResult());

    await expect(bridge.autoSummarize()).resolves.toBe('summary-1');
    expect(service.createRelation).toHaveBeenCalledWith('summary-1', 'mem-1', { type: 'SUMMARIZES' });
    expect(bridge.getPendingCount()).toBe(0);
  });
});
