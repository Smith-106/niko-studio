import { describe, expect, it, vi } from 'vitest';

import { AgentType } from '../../agents/base';
import { Level1Rapid } from '../../workflow/levels/level1-rapid';

describe('workflow/level1-rapid', () => {
  it('executes successfully with a provided writer and writes the direct output', () => {
    const writer = {
      run: vi.fn().mockReturnValue({
        content: '修正后的输出',
      }),
    };
    const rapid = new Level1Rapid({}, null, writer);
    const state = {
      user_request: '修正一段文案',
      context: '保持语气一致',
    } as Record<string, unknown>;

    const result = rapid.execute(state as never) as Record<string, unknown>;

    expect(writer.run).toHaveBeenCalledWith({
      prompt: expect.stringContaining('任務: 修正一段文案'),
      mode: 'rapid',
    });
    expect(String(writer.run.mock.calls[0][0].prompt)).toContain('上下文');
    expect(result.final_output).toBe('修正后的输出');
    expect(result.decision).toBe('APPROVED');
  });

  it('caches the writer resolved from the container across repeated executes', () => {
    const writer = {
      run: vi.fn().mockReturnValue({
        content: 'ok',
      }),
    };
    const container = {
      getAgent: vi.fn().mockReturnValue(writer),
    };
    const rapid = new Level1Rapid({}, container as never);

    rapid.execute({ user_request: '第一次' } as never);
    rapid.execute({ user_request: '第二次' } as never);

    expect(container.getAgent).toHaveBeenCalledTimes(1);
    expect(container.getAgent).toHaveBeenCalledWith(AgentType.WRITER);
    expect(writer.run).toHaveBeenCalledTimes(2);
  });

  it('fails gracefully when no writer/container is available', () => {
    const rapid = new Level1Rapid();
    const state = {
      user_request: '快速处理这个问题',
      errors: [],
    } as Record<string, unknown>;

    const result = rapid.execute(state as never) as Record<string, unknown>;

    expect(result.decision).toBe('FAILED');
    expect((result.errors as string[])[0]).toContain('ServiceContainer not available');
  });

  it('exposes required agents and default config helpers', () => {
    const rapid = new Level1Rapid();

    expect(rapid.getRequiredAgents()).toEqual(['writer']);
    expect(rapid.getDefaultConfig()).toEqual({
      max_revisions: 0,
      pass_score: 0,
      verbose: false,
    });
  });
});
