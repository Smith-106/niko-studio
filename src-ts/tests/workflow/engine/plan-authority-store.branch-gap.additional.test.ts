import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  bindWorkflowPlanSession,
  normalizeWorkflowPlanId,
  resolveWorkflowPlanAuthority,
} from '../../../workflow/engine/plan-authority-store.js';
import type { WorkflowAuthority } from '../../../workflow/engine/authority.js';

describe('plan-authority-store branch gap coverage', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock('../../../workflow/engine/authority.js');
  });

  it('falls back from nullish plan and session ids before validation or ensureSessionId', () => {
    expect(() => normalizeWorkflowPlanId(undefined as never)).toThrow('planId is required');

    const planAuthorities = new Map<string, WorkflowAuthority>();
    const planSessions = new Map<string, string>();
    const ensureSessionId = vi.fn().mockReturnValue('generated-session');

    const result = bindWorkflowPlanSession({
      planId: 'plan-nullish-session',
      sessionId: undefined as never,
      planAuthorities,
      planSessions,
      ensureSessionId,
    });

    expect(result).toBe('generated-session');
    expect(ensureSessionId).toHaveBeenCalledWith('plan-nullish-session');
    expect(planSessions.size).toBe(0);
    expect(planAuthorities.size).toBe(0);
  });

  it('returns planId required when resolveWorkflowPlanAuthority receives a nullish planId', () => {
    const result = resolveWorkflowPlanAuthority({
      planId: undefined as never,
      getPlanAuthority: vi.fn(),
      bindPlanAuthority: vi.fn(),
    });

    expect(result).toEqual({
      authority: null,
      error: 'planId is required',
    });
  });

  it('uses the fallback resolution failure message when authority resolution returns no error text', async () => {
    vi.doMock('../../../workflow/engine/authority.js', async () => {
      const actual = await vi.importActual<typeof import('../../../workflow/engine/authority.js')>(
        '../../../workflow/engine/authority.js',
      );
      return {
        ...actual,
        resolveRequestedWorkflowAuthority: vi.fn(() => ({ authority: null })),
      };
    });

    const store = await import('../../../workflow/engine/plan-authority-store.js');

    const result = store.resolveWorkflowPlanAuthority({
      planId: 'plan-fallback-error',
      getPlanAuthority: vi.fn(() => ({
        sessionId: 'sess-1',
        workspaceId: null,
        projectId: null,
      })),
      bindPlanAuthority: vi.fn(),
    });

    expect(result).toEqual({
      authority: null,
      error: 'workflow authority resolution failed',
    });
  });
});
