import { describe, expect, it, vi } from 'vitest';

import { Level1Rapid } from '../../workflow/levels/level1-rapid';
import { Level2Lite } from '../../workflow/levels/level2-lite';
import { Level3Standard } from '../../workflow/levels/level3-standard';
import { AgentType } from '../../agents/base';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockWriter(output: string) {
  return { run: vi.fn().mockReturnValue({ content: output }) };
}

function mockCritic(score: number, decision: string, feedback: string) {
  return { run: vi.fn().mockReturnValue({ score, decision, feedback }) };
}

function mockContainer(...agents: Array<{ run: ReturnType<typeof vi.fn> }>) {
  let index = 0;
  return {
    getAgent: vi.fn().mockImplementation(() => {
      const agent = agents[index % agents.length];
      index++;
      return agent;
    }),
  };
}

// ---------------------------------------------------------------------------
// L1 Rapid E2E
// ---------------------------------------------------------------------------

describe('E2E: L1 Rapid authoring cycle', () => {
  it('user input -> writer directly outputs draft with correct input/output contract', () => {
    const writer = mockWriter('The corrected text output.');
    const rapid = new Level1Rapid({}, null, writer);

    const state = {
      user_request: 'Fix the grammar in this paragraph',
      context: 'Academic tone required',
      errors: [],
    } as Record<string, unknown>;

    const result = rapid.execute(state as never) as Record<string, unknown>;

    // Verify writer was invoked with correct prompt shape
    expect(writer.run).toHaveBeenCalledTimes(1);
    const promptArg = writer.run.mock.calls[0][0] as Record<string, unknown>;
    expect(promptArg.prompt).toContain('Fix the grammar in this paragraph');
    expect(promptArg.prompt).toContain('Academic tone required');
    expect(promptArg.mode).toBe('rapid');

    // Verify output contract
    expect(result.final_output).toBe('The corrected text output.');
    expect(result.decision).toBe('APPROVED');
  });

  it('produces APPROVED decision for any successful writer output', () => {
    const writer = mockWriter('Any arbitrary output');
    const rapid = new Level1Rapid({}, null, writer);

    const state = { user_request: 'task', errors: [] } as Record<string, unknown>;
    const result = rapid.execute(state as never) as Record<string, unknown>;

    expect(result.decision).toBe('APPROVED');
    expect(result.final_output).toBeTruthy();
  });

  it('produces FAILED decision when no writer is available', () => {
    const rapid = new Level1Rapid();
    const state = { user_request: 'task', errors: [] } as Record<string, unknown>;
    const result = rapid.execute(state as never) as Record<string, unknown>;

    expect(result.decision).toBe('FAILED');
    expect((result.errors as string[]).length).toBeGreaterThan(0);
  });

  it('exposes single required agent (writer) with zero-revision config', () => {
    const rapid = new Level1Rapid();

    expect(rapid.getRequiredAgents()).toEqual(['writer']);
    expect(rapid.getDefaultConfig()).toMatchObject({
      max_revisions: 0,
      pass_score: 0,
      verbose: false,
    });
  });
});

// ---------------------------------------------------------------------------
// L2 Lite E2E
// ---------------------------------------------------------------------------

describe('E2E: L2 Lite authoring cycle', () => {
  it('input -> plan -> draft -> evaluation with correct stage transitions', () => {
    const writer = mockWriter('Draft from lite writer.');
    const critic = mockCritic(82, 'APPROVED', 'Good structure.');
    const container = mockContainer(writer, critic);

    const lite = new Level2Lite({}, container as never);

    const state = {
      user_request: 'Write a suspenseful short scene with an old pocket watch',
      context: 'Rainy night, abandoned warehouse',
      errors: [],
    } as Record<string, unknown>;

    const result = lite.execute(state as never) as Record<string, unknown>;

    // Verify plan stage: lite_plan was populated
    const plan = result.lite_plan as Record<string, unknown>;
    expect(plan).toBeDefined();
    expect(plan.objective).toBe('Write a suspenseful short scene with an old pocket watch');
    expect(plan.key_points).toBeDefined();
    // Tone is inferred from user_request + context; both lack Chinese tone keywords
    expect(['neutral', 'suspense']).toContain(plan.tone);

    // Verify draft stage: writer was called
    expect(writer.run).toHaveBeenCalled();
    const writerArg = writer.run.mock.calls[0][0] as Record<string, unknown>;
    expect(writerArg.mode).toBe('lite');

    // Verify evaluation stage: critic was called
    expect(critic.run).toHaveBeenCalled();
    const criticArg = critic.run.mock.calls[0][0] as Record<string, unknown>;
    expect(criticArg.mode).toBe('quick');
    expect(criticArg.content).toBe('Draft from lite writer.');

    // Verify output contract
    expect(result.draft_content).toBe('Draft from lite writer.');
    expect(result.score).toBe(82);
    expect(result.decision).toBe('APPROVED');
  });

  it('performs one revision cycle when initial score is below pass threshold', () => {
    const writer = mockWriter('Revised draft content.');
    const criticFirst = mockCritic(60, 'REVISE', 'Needs more tension.');
    const criticSecond = mockCritic(78, 'APPROVED', 'Improved.');

    let agentIndex = 0;
    const agents = [writer, criticFirst, writer, criticSecond];
    const container = {
      getAgent: vi.fn().mockImplementation(() => agents[agentIndex++]),
    };

    const lite = new Level2Lite({}, container as never);

    const state = {
      user_request: 'Write a scene with an old pocket watch',
      context: 'Tension needed',
      errors: [],
    } as Record<string, unknown>;

    const result = lite.execute(state as never) as Record<string, unknown>;

    // Writer should be called twice (initial + 1 revision), critic twice
    expect(writer.run).toHaveBeenCalledTimes(2);
    expect(criticFirst.run).toHaveBeenCalledTimes(1);
    expect(criticSecond.run).toHaveBeenCalledTimes(1);

    expect(result.decision).toBe('APPROVED');
    expect(result.revision_count).toBe(1);
  });

  it('auto-approves when verification fails (critic throws)', () => {
    const writer = mockWriter('Draft content.');
    const brokenCritic = {
      run: vi.fn().mockImplementation(() => {
        throw new Error('Critic service unavailable');
      }),
    };
    const container = mockContainer(writer, brokenCritic);

    const lite = new Level2Lite({}, container as never);

    const state = {
      user_request: 'Write something',
      errors: [],
    } as Record<string, unknown>;

    const result = lite.execute(state as never) as Record<string, unknown>;

    expect(result.decision).toBe('APPROVED');
    expect(result.score).toBe(70);
    expect((result.errors as string[])[0]).toContain('验证失败');
  });

  it('exposes required agents and default config consistent with L2 spec', () => {
    const lite = new Level2Lite();

    expect(lite.getRequiredAgents()).toEqual(['writer', 'critic']);
    expect(lite.getDefaultConfig()).toMatchObject({
      max_revisions: 1,
      pass_score: 70,
      verbose: true,
    });
  });
});

// ---------------------------------------------------------------------------
// L3 Standard E2E
// ---------------------------------------------------------------------------

describe('E2E: L3 Standard full multi-agent pipeline', () => {
  it('input -> architect -> writer -> critic -> revision completes with APPROVED', () => {
    const architect = {
      run: vi.fn().mockReturnValue({
        phases: [
          { phase: 1, output: 'Requirement analysis' },
          { phase: 2, output: 'Content analysis' },
          { phase: 3, output: 'Change scope definition' },
          { phase: 4, output: 'Implementation plan' },
          { phase: 5, output: 'Verification criteria' },
        ],
        plan: { steps: ['step-1', 'step-2'] },
      }),
    };
    const writer = {
      run: vi
        .fn()
        .mockReturnValueOnce({ content: 'Initial draft chapter.' })
        .mockReturnValueOnce({ content: 'Revised draft chapter.' }),
    };
    const critic = {
      run: vi
        .fn()
        .mockReturnValueOnce({
          score: 65,
          decision: 'REVISE',
          feedback: 'Strengthen the conflict between characters.',
        })
        .mockReturnValueOnce({
          score: 85,
          decision: 'APPROVED',
          feedback: '',
        }),
    };

    const standard = new Level3Standard({ architect, writer, critic });

    const state = {
      user_request: 'Write a chapter introducing the main antagonist',
      context: 'Dark fantasy setting, third person limited POV',
      errors: [],
    } as Record<string, unknown>;

    const result = standard.execute(state as never) as Record<string, unknown>;

    // Architect phase: 5-phase plan generated
    expect(architect.run).toHaveBeenCalledTimes(1);
    const phases = result.plan_phases as Array<Record<string, unknown>>;
    expect(phases).toHaveLength(5);
    expect(phases[0].output).toBe('Requirement analysis');
    expect(phases[4].output).toBe('Verification criteria');

    // Plan verification passed (all phases have output)
    expect(result.errors).not.toContain('計劃驗證失敗');

    // Writer phase: called twice (initial + 1 revision)
    expect(writer.run).toHaveBeenCalledTimes(2);
    expect(writer.run.mock.calls[0][0].mode).toBe('execute');
    expect(writer.run.mock.calls[1][0].feedback).toBe('Strengthen the conflict between characters.');

    // Critic phase: called twice
    expect(critic.run).toHaveBeenCalledTimes(2);
    expect(critic.run.mock.calls[0][0].mode).toBe('evaluate');

    // Final output contract
    expect(result.decision).toBe('APPROVED');
    expect(result.score).toBe(85);
    expect(result.revision_count).toBe(1);
    expect(result.draft_content).toBe('Revised draft chapter.');
  });

  it('halts with HUMAN_REVIEW when critic requests it', () => {
    const architect = {
      run: vi.fn().mockReturnValue({
        phases: Array.from({ length: 5 }, (_, i) => ({
          phase: i + 1,
          output: `phase-${i + 1}`,
        })),
        plan: { steps: ['step-1'] },
      }),
    };
    const writer = mockWriter('Draft with issues.');
    const critic = mockCritic(40, 'HUMAN_REVIEW', 'Requires human judgment on tone.');

    const standard = new Level3Standard({ architect, writer, critic });

    const state = {
      user_request: 'Write a controversial political chapter',
      errors: [],
    } as Record<string, unknown>;

    const result = standard.execute(state as never) as Record<string, unknown>;

    expect(result.decision).toBe('HUMAN_REVIEW');
    // Only one writer + one critic call (no revision loop after HUMAN_REVIEW)
    expect(writer.run).toHaveBeenCalledTimes(1);
    expect(critic.run).toHaveBeenCalledTimes(1);
  });

  it('escalates to HUMAN_REVIEW after exhausting max revisions', () => {
    const architect = {
      run: vi.fn().mockReturnValue({
        phases: Array.from({ length: 5 }, (_, i) => ({
          phase: i + 1,
          output: `phase-${i + 1}`,
        })),
        plan: { steps: ['step-1'] },
      }),
    };
    const writer = mockWriter('Consistently poor draft.');
    const critic = mockCritic(45, 'REVISE', 'Still needs work.');

    const standard = new Level3Standard({
      architect,
      writer,
      critic,
      config: { max_revisions: 1 },
    });

    const state = {
      user_request: 'Write a complex technical chapter',
      errors: [],
    } as Record<string, unknown>;

    const result = standard.execute(state as never) as Record<string, unknown>;

    expect(result.decision).toBe('HUMAN_REVIEW');
    // With max_revisions=1: loop runs once (revisionCount starts at 0, < 1),
    // then exits. After exit, revisionCount=1 >= maxRevisions triggers HUMAN_REVIEW.
    // So writer is called 1 time, critic 1 time.
    expect(writer.run).toHaveBeenCalledTimes(1);
    expect(critic.run).toHaveBeenCalledTimes(1);
    expect(result.revision_count).toBe(1);
  });

  it('fails plan verification when architect returns incomplete phases', () => {
    const architect = {
      run: vi.fn().mockReturnValue({
        phases: [
          { phase: 1, output: 'Done' },
          { phase: 2, output: null }, // Incomplete
        ],
        plan: { steps: ['step-1'] },
      }),
    };

    const standard = new Level3Standard({ architect });

    const state = {
      user_request: 'Write a chapter',
      errors: [],
    } as Record<string, unknown>;

    const result = standard.execute(state as never) as Record<string, unknown>;

    expect(result.decision).toBe('HUMAN_REVIEW');
    expect((result.errors as string[])[0]).toContain('計劃驗證失敗');
    // No writer/critic calls when plan verification fails
  });

  it('exposes required agents and default config consistent with L3 spec', () => {
    const standard = new Level3Standard();

    expect(standard.getRequiredAgents()).toEqual(['architect', 'writer', 'critic']);
    expect(standard.getDefaultConfig()).toMatchObject({
      max_revisions: 3,
      pass_score: 80,
      verbose: true,
    });
  });
});
