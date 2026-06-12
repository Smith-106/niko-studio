import { afterEach, describe, expect, it, vi } from 'vitest';

const initializeAllMock = vi.fn();
const containerMock = {
  memory: { id: 'memory-engine' },
  graph: { id: 'graph-engine' },
  search: { id: 'search-engine' },
  workflow: { id: 'workflow-engine' },
  critic: { id: 'critic-engine' },
  initializeAll: initializeAllMock,
};

vi.mock('../../container/ServiceContainer', () => ({
  getContainer: vi.fn(() => containerMock),
}));

import {
  getCriticEngine,
  getGraphEngine,
  getMemoryEngine,
  getSearchEngine,
  getWorkflowEngine,
  prewarmEngines,
} from '../../mcp/engine';

describe('mcp/engine additional coverage', () => {
  afterEach(() => {
    initializeAllMock.mockReset();
  });

  it('delegates every engine accessor to the service container', () => {
    expect(getMemoryEngine()).toBe(containerMock.memory);
    expect(getGraphEngine()).toBe(containerMock.graph);
    expect(getSearchEngine()).toBe(containerMock.search);
    expect(getWorkflowEngine()).toBe(containerMock.workflow);
    expect(getCriticEngine()).toBe(containerMock.critic);
  });

  it('prewarms engines through container.initializeAll', async () => {
    initializeAllMock.mockResolvedValueOnce(undefined);

    await prewarmEngines();

    expect(initializeAllMock).toHaveBeenCalledTimes(1);
  });
});
