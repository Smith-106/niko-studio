import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

const mainConsistencyCheckCliMock = vi.hoisted(() => vi.fn());
const logErrorMock = vi.hoisted(() => vi.fn());

vi.mock('../../logger/index.js', () => ({
  createLogger: () => ({
    error: logErrorMock,
  }),
}));

vi.mock('../../mcp/endpoints/critic.js', () => ({
  mainConsistencyCheckCli: mainConsistencyCheckCliMock,
}));

describe('consistency-check runtime entry additional coverage', () => {
  const originalArgv = [...process.argv];
  const modulePath = fileURLToPath(new URL('../../consistency-check.ts', import.meta.url));

  afterEach(() => {
    process.argv = [...originalArgv];
    vi.clearAllMocks();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('detects whether the module is running as the main entrypoint', async () => {
    const {
      bootstrapConsistencyCheckCli,
      isConsistencyCheckCliEntry,
    } = await import('../../consistency-check.ts?entry-check');

    expect(isConsistencyCheckCliEntry(undefined, 'file:///tmp/demo.mjs')).toBe(false);
    expect(isConsistencyCheckCliEntry(modulePath, 'file:///other/path.mjs')).toBe(false);
    expect(isConsistencyCheckCliEntry(modulePath, new URL('../../consistency-check.ts', import.meta.url).href)).toBe(true);
    expect(bootstrapConsistencyCheckCli('C:/tmp/not-main.mjs')).toBe(false);
  });

  it('logs Error rejections from the entry CLI and exits with code 1', async () => {
    const {
      runConsistencyCheckCli,
    } = await import('../../consistency-check.ts?async-error');
    const exitSpy = vi.fn();

    mainConsistencyCheckCliMock.mockRejectedValueOnce(new Error('async-boom'));

    await runConsistencyCheckCli(mainConsistencyCheckCliMock, { error: logErrorMock }, exitSpy);

    expect(mainConsistencyCheckCliMock).toHaveBeenCalledTimes(1);
    expect(logErrorMock).toHaveBeenCalledWith('Consistency check failed', { error: 'async-boom' });
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('uses the default exit handler when no custom exit callback is provided', async () => {
    const {
      runConsistencyCheckCli,
    } = await import('../../consistency-check.ts?default-exit');
    const exitError = new Error('process-exit-1');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw code === 1 ? exitError : new Error(`unexpected-exit-${String(code)}`);
    }) as never);

    mainConsistencyCheckCliMock.mockRejectedValueOnce(new Error('default-exit-boom'));

    await expect(
      runConsistencyCheckCli(mainConsistencyCheckCliMock, { error: logErrorMock }),
    ).rejects.toBe(exitError);

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(logErrorMock).toHaveBeenCalledWith('Consistency check failed', { error: 'default-exit-boom' });
  });

  it('stringifies non-Error rejections from the entry CLI and bootstraps the main path', async () => {
    const {
      bootstrapConsistencyCheckCli,
      runConsistencyCheckCli,
    } = await import('../../consistency-check.ts?string-error');
    const exitSpy = vi.fn();

    mainConsistencyCheckCliMock.mockResolvedValueOnce(undefined);
    expect(
      bootstrapConsistencyCheckCli(
        modulePath,
        mainConsistencyCheckCliMock,
        { error: logErrorMock },
        exitSpy,
      ),
    ).toBe(true);

    mainConsistencyCheckCliMock.mockRejectedValueOnce('string-boom');
    await runConsistencyCheckCli(mainConsistencyCheckCliMock, { error: logErrorMock }, exitSpy);

    expect(mainConsistencyCheckCliMock).toHaveBeenCalledTimes(2);
    expect(logErrorMock).toHaveBeenCalledWith('Consistency check failed', { error: 'string-boom' });
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
