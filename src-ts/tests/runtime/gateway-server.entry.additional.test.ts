import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

const mainGatewayMock = vi.hoisted(() => vi.fn());

vi.mock('../../mcp/gateway-bootstrap.js', () => ({
  main: mainGatewayMock,
  startGatewayServer: vi.fn(),
}));

vi.mock('../../mcp/gateway-state.js', () => ({
  buildConfigAccess: vi.fn(),
  buildGatewayDeps: vi.fn(),
}));

describe('gateway-server runtime entry additional branches', () => {
  const originalArgv = [...process.argv];
  const modulePath = fileURLToPath(new URL('../../gateway-server.ts', import.meta.url));

  afterEach(() => {
    process.argv = [...originalArgv];
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('does not invoke main when the process has no entry path', async () => {
    process.argv = ['node'];

    await import('../../gateway-server.ts?missing-entry');

    expect(mainGatewayMock).not.toHaveBeenCalled();
    expect(modulePath.length).toBeGreaterThan(0);
  });
});
