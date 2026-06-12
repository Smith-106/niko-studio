import { describe, expect, it } from 'vitest';

import { WaveExecutionEngineImpl } from '../../workflow/wave-engine.js';
import type { WaveSpec } from '../../workflow/wave-engine.js';

describe('workflow/wave-engine tail coverage', () => {
  it('routes sequential waves through the core executor helper', async () => {
    const engine = new WaveExecutionEngineImpl(null, undefined, {
      failureStrategy: 'skip',
      maxRetriesPerWave: 0,
      taskTimeoutMs: 100,
    });

    const result = await (engine as any)._executeWaveCore(
      { wave: 9, tasks: ['seq-a'], parallel: false } satisfies WaveSpec,
      async () => {},
      new AbortController(),
    );

    expect(result).toEqual({
      'seq-a': { status: 'success', durationMs: expect.any(Number) },
    });
  });
});
