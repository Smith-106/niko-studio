import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

const mainConsistencyCheckCliMock = vi.hoisted(() => vi.fn());
const logErrorMock = vi.hoisted(() => vi.fn());

vi.mock('../../mcp/endpoints/critic.js', () => ({
  mainConsistencyCheckCli: mainConsistencyCheckCliMock,
}));

vi.mock('../../logger/index.js', () => ({
  createLogger: () => ({
    error: logErrorMock,
  }),
}));

describe('consistency-check runtime entry', () => {
  const originalArgv = [...process.argv];
  const modulePath = fileURLToPath(new URL('../../consistency-check.ts', import.meta.url));

  afterEach(() => {
    process.argv = [...originalArgv];
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('does not invoke the CLI when imported as a non-entry module', async () => {
    process.argv = ['node', 'not-the-entry.js'];

    await import('../../consistency-check.ts?non-entry');

    expect(mainConsistencyCheckCliMock).not.toHaveBeenCalled();
  });

  it('does not invoke the CLI when no entry path is present', async () => {
    process.argv = ['node'];

    await import('../../consistency-check.ts?missing-entry');

    expect(mainConsistencyCheckCliMock).not.toHaveBeenCalled();
  });

  it('invokes the CLI when imported as the current entry module', async () => {
    process.argv = ['node', modulePath];
    mainConsistencyCheckCliMock.mockResolvedValueOnce(undefined);

    await import('../../consistency-check.ts');

    expect(mainConsistencyCheckCliMock).toHaveBeenCalledTimes(1);
    expect(logErrorMock).not.toHaveBeenCalled();
  });

  it('logs and exits when the CLI rejects', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => code as never) as never);
    process.argv = ['node', modulePath];
    mainConsistencyCheckCliMock.mockRejectedValueOnce(new Error('boom'));

    await import('../../consistency-check.ts');
    await Promise.resolve();
    await Promise.resolve();

    expect(logErrorMock).toHaveBeenCalledWith('Consistency check failed', { error: 'boom' });
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('stringifies non-Error rejections before logging and exiting', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => code as never) as never);
    process.argv = ['node', modulePath];
    mainConsistencyCheckCliMock.mockRejectedValueOnce('boom-text');

    await import('../../consistency-check.ts?string-rejection');
    await Promise.resolve();
    await Promise.resolve();

    expect(logErrorMock).toHaveBeenCalledWith('Consistency check failed', { error: 'boom-text' });
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
