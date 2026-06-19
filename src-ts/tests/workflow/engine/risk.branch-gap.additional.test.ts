import { describe, expect, it } from 'vitest';

import {
  resolveAdaptiveWorkflowLevel,
  resolveWorkflowGateProfile,
} from '../../../workflow/engine/risk.js';
import { WorkflowLevel } from '../../../workflow/types.js';

describe('workflow/engine/risk branch-gap coverage', () => {
  it('falls back to default metric values when maintenance metrics are missing', () => {
    const level = resolveAdaptiveWorkflowLevel(
      WorkflowLevel.L2_LITE,
      'maintenance',
      {},
    );

    expect(level).toBe(WorkflowLevel.L2_LITE);
  });

  it('falls back to maintenance-soft when maintenance gate metrics are missing', () => {
    const profile = resolveWorkflowGateProfile(
      WorkflowLevel.L3_STANDARD,
      'maintenance',
      {},
      {},
    );

    expect(profile).toBe('maintenance-soft');
  });
});
