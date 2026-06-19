import { describe, expect, it } from 'vitest';

import {
  buildWorkflowPauseReplayPayload,
  resolveWorkflowLifecycleSessionStatus,
} from '../../../workflow/engine/flow-control.js';

describe('flow-control additional coverage', () => {
  it('builds a pause replay payload with a cloned recommendations array', () => {
    const plan = {
      id: 'plan-42',
      plan_hash: 'hash-42',
      recommendations: [
        { id: 'rec-1', score: 0.9 },
        { id: 'rec-2', score: 0.6 },
      ],
      recommendations_frozen: true,
      template_meta: {},
    };

    const payload = buildWorkflowPauseReplayPayload(plan);

    expect(payload).toEqual({
      plan_id: 'plan-42',
      plan_hash: 'hash-42',
      recommendations: [
        { id: 'rec-1', score: 0.9 },
        { id: 'rec-2', score: 0.6 },
      ],
      recommendations_frozen: true,
    });
    expect(payload.recommendations).not.toBe(plan.recommendations);
  });

  it('prefers runtime session status, falls back to template meta, then returns null', () => {
    expect(
      resolveWorkflowLifecycleSessionStatus(
        { status: 'paused' },
        { session_status: 'active' },
      ),
    ).toBe('paused');

    expect(
      resolveWorkflowLifecycleSessionStatus(
        {},
        { session_status: 'active' },
      ),
    ).toBe('active');

    expect(
      resolveWorkflowLifecycleSessionStatus(
        {},
        {},
      ),
    ).toBeNull();
  });
});
