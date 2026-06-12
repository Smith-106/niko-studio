import { describe, expect, it, vi } from 'vitest';

import { Level1Rapid } from '../../workflow/levels/level1-rapid.js';

describe('workflow/level1-rapid branch gap coverage', () => {
  it('falls back to empty request text and empty writer content', () => {
    const writer = {
      run: vi.fn().mockReturnValue({}),
    };
    const rapid = new Level1Rapid(null, null, writer);
    const state = {} as Record<string, unknown>;

    const result = rapid.execute(state as never) as Record<string, unknown>;

    expect(writer.run).toHaveBeenCalledWith({
      prompt: expect.stringContaining('任務: '),
      mode: 'rapid',
    });
    expect(String(writer.run.mock.calls[0][0].prompt)).not.toContain('上下文');
    expect(result.final_output).toBe('');
    expect(result.decision).toBe('APPROVED');
  });

  it('stringifies non-Error failures and initializes the errors array when absent', () => {
    const writer = {
      run: vi.fn(() => {
        throw 'writer failed';
      }),
    };
    const rapid = new Level1Rapid({}, null, writer);
    const state = {
      user_request: '触发失败',
    } as Record<string, unknown>;

    const result = rapid.execute(state as never) as Record<string, unknown>;

    expect(result.decision).toBe('FAILED');
    expect(result.errors).toEqual(['writer failed']);
  });
});
