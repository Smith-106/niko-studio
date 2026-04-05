import { afterEach, describe, expect, it, vi } from 'vitest';

const ENV_KEYS = [
  'NIKO_GATEWAY_RELOAD',
  'NIKO_GATEWAY_PORT',
  'NIKO_GATEWAY_DETECTION_EVASION_GUARD',
  'NIKO_ENV',
] as const;

const ORIGINAL_ENV = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
) as Record<(typeof ENV_KEYS)[number], string | undefined>;

function restoreEnv(): void {
  for (const key of ENV_KEYS) {
    const original = ORIGINAL_ENV[key];
    if (original === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original;
    }
  }
}

describe('mcp config resolvers', () => {
  afterEach(() => {
    restoreEnv();
    vi.resetModules();
  });

  it('coerces boolean and number env values through getConfigValue', async () => {
    process.env['NIKO_GATEWAY_RELOAD'] = 'true';
    process.env['NIKO_GATEWAY_PORT'] = '8123';

    const { getConfigValue } = await import('../../mcp/config.js');

    expect(getConfigValue('gateway.reload', false)).toBe(true);
    expect(getConfigValue('gateway.port', 8000)).toBe(8123);

    process.env['NIKO_GATEWAY_RELOAD'] = 'off';
    vi.resetModules();

    const { getConfigValue: getConfigValueAgain } = await import('../../mcp/config.js');
    expect(getConfigValueAgain('gateway.reload', true)).toBe(false);
  });

  it('lets contract helpers consume canonical gateway boolean config env values', async () => {
    process.env['NIKO_GATEWAY_DETECTION_EVASION_GUARD'] = '1';

    const { resolveDetectionEvasionGuardEnabled } = await import('../../mcp/contract.js');
    expect(resolveDetectionEvasionGuardEnabled()).toBe(true);

    process.env['NIKO_GATEWAY_DETECTION_EVASION_GUARD'] = '0';
    vi.resetModules();

    const { resolveDetectionEvasionGuardEnabled: resolveDetectionEvasionGuardEnabledAgain } =
      await import('../../mcp/contract.js');
    expect(resolveDetectionEvasionGuardEnabledAgain()).toBe(false);
  });
});
