import { describe, it, expect, vi } from 'vitest';

import {
  normalizeWorkflowPlanId,
  getWorkflowPlanSessionId,
  bindWorkflowPlanSession,
  bindWorkflowPlanAuthority,
  getWorkflowPlanAuthority,
  resolveWorkflowPlanAuthority,
} from '../../../workflow/engine/plan-authority-store.js';
import type { WorkflowAuthority } from '../../../workflow/engine/authority.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function freshMaps(): {
  planAuthorities: Map<string, WorkflowAuthority>;
  planSessions: Map<string, string>;
} {
  return {
    planAuthorities: new Map<string, WorkflowAuthority>(),
    planSessions: new Map<string, string>(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('plan-authority-store', () => {
  // ===================================================================
  // normalizeWorkflowPlanId
  // ===================================================================
  describe('normalizeWorkflowPlanId', () => {
    it('trims whitespace from planId', () => {
      expect(normalizeWorkflowPlanId('  plan-1  ')).toBe('plan-1');
    });

    it('returns the string unchanged when no whitespace', () => {
      expect(normalizeWorkflowPlanId('plan-abc')).toBe('plan-abc');
    });

    it('throws on empty string', () => {
      expect(() => normalizeWorkflowPlanId('')).toThrow('planId is required');
    });

    it('throws on whitespace-only string', () => {
      expect(() => normalizeWorkflowPlanId('   ')).toThrow('planId is required');
    });
  });

  // ===================================================================
  // getWorkflowPlanSessionId
  // ===================================================================
  describe('getWorkflowPlanSessionId', () => {
    it('calls ensureSessionId with normalized planId', () => {
      const ensureSessionId = vi.fn().mockReturnValue('session-generated');
      const result = getWorkflowPlanSessionId({
        planId: '  plan-X  ',
        ensureSessionId,
      });

      expect(ensureSessionId).toHaveBeenCalledWith('plan-X');
      expect(result).toBe('session-generated');
    });
  });

  // ===================================================================
  // bindWorkflowPlanSession
  // ===================================================================
  describe('bindWorkflowPlanSession', () => {
    it('sets planSessions and planAuthorities maps', () => {
      const maps = freshMaps();
      const ensureSessionId = vi.fn().mockReturnValue('sess-1');

      const result = bindWorkflowPlanSession({
        planId: 'plan-1',
        sessionId: 'sess-1',
        planAuthorities: maps.planAuthorities,
        planSessions: maps.planSessions,
        ensureSessionId,
      });

      expect(result).toBe('sess-1');
      expect(maps.planSessions.get('plan-1')).toBe('sess-1');
      expect(maps.planAuthorities.get('plan-1')).toEqual({
        sessionId: 'sess-1',
        workspaceId: null,
        projectId: null,
      });
    });

    it('preserves existing workspace/project from current authority', () => {
      const maps = freshMaps();
      maps.planAuthorities.set('plan-2', {
        sessionId: 'old-sess',
        workspaceId: 'ws-existing',
        projectId: 'proj-existing',
      });
      const ensureSessionId = vi.fn().mockReturnValue('sess-2');

      bindWorkflowPlanSession({
        planId: 'plan-2',
        sessionId: 'sess-2',
        planAuthorities: maps.planAuthorities,
        planSessions: maps.planSessions,
        ensureSessionId,
      });

      const authority = maps.planAuthorities.get('plan-2');
      expect(authority?.sessionId).toBe('sess-2');
      expect(authority?.workspaceId).toBe('ws-existing');
      expect(authority?.projectId).toBe('proj-existing');
    });

    it('falls back to ensureSessionId when sessionId is empty', () => {
      const maps = freshMaps();
      const ensureSessionId = vi.fn().mockReturnValue('fallback-sess');

      const result = bindWorkflowPlanSession({
        planId: 'plan-3',
        sessionId: '',
        planAuthorities: maps.planAuthorities,
        planSessions: maps.planSessions,
        ensureSessionId,
      });

      expect(ensureSessionId).toHaveBeenCalledWith('plan-3');
      expect(result).toBe('fallback-sess');
    });

    it('calls persistPlanState when provided', () => {
      const maps = freshMaps();
      const persist = vi.fn();
      const ensureSessionId = vi.fn().mockReturnValue('sess-4');

      bindWorkflowPlanSession({
        planId: 'plan-4',
        sessionId: 'sess-4',
        planAuthorities: maps.planAuthorities,
        planSessions: maps.planSessions,
        ensureSessionId,
        persistPlanState: persist,
      });

      expect(persist).toHaveBeenCalledOnce();
    });

    it('does not call persistPlanState when not provided', () => {
      const maps = freshMaps();
      const ensureSessionId = vi.fn().mockReturnValue('sess-5');

      // Should not throw when persistPlanState is omitted
      expect(() =>
        bindWorkflowPlanSession({
          planId: 'plan-5',
          sessionId: 'sess-5',
          planAuthorities: maps.planAuthorities,
          planSessions: maps.planSessions,
          ensureSessionId,
        }),
      ).not.toThrow();
    });
  });

  // ===================================================================
  // bindWorkflowPlanAuthority
  // ===================================================================
  describe('bindWorkflowPlanAuthority', () => {
    it('merges authority, updates maps, and returns a copy', () => {
      const maps = freshMaps();
      const ensureSessionId = vi.fn().mockReturnValue('sess-10');
      const authority: WorkflowAuthority = {
        sessionId: 'sess-10',
        workspaceId: 'ws-10',
        projectId: null,
      };

      const result = bindWorkflowPlanAuthority({
        planId: 'plan-10',
        authority,
        planAuthorities: maps.planAuthorities,
        planSessions: maps.planSessions,
        ensureSessionId,
      });

      expect(result.sessionId).toBe('sess-10');
      expect(result.workspaceId).toBe('ws-10');
      expect(result.projectId).toBeNull();
      // Verify returned value is a copy (different reference)
      expect(result).not.toBe(maps.planAuthorities.get('plan-10'));
      // But structurally equal
      expect(result).toEqual(maps.planAuthorities.get('plan-10'));
      // planSessions should also be updated
      expect(maps.planSessions.get('plan-10')).toBe('sess-10');
    });

    it('merges with existing authority when present', () => {
      const maps = freshMaps();
      maps.planAuthorities.set('plan-11', {
        sessionId: 'old-sess',
        workspaceId: 'old-ws',
        projectId: 'old-proj',
      });
      const ensureSessionId = vi.fn().mockReturnValue('fallback-sess');
      const authority: WorkflowAuthority = {
        sessionId: 'new-sess',
        workspaceId: null,
        projectId: null,
      };

      const result = bindWorkflowPlanAuthority({
        planId: 'plan-11',
        authority,
        planAuthorities: maps.planAuthorities,
        planSessions: maps.planSessions,
        ensureSessionId,
      });

      // new sessionId overrides, but workspace/project fall through to existing
      expect(result.sessionId).toBe('new-sess');
      expect(result.workspaceId).toBe('old-ws');
      expect(result.projectId).toBe('old-proj');
    });

    it('calls persistPlanState when provided', () => {
      const maps = freshMaps();
      const persist = vi.fn();
      const ensureSessionId = vi.fn().mockReturnValue('sess-12');
      const authority: WorkflowAuthority = {
        sessionId: 'sess-12',
        workspaceId: null,
        projectId: null,
      };

      bindWorkflowPlanAuthority({
        planId: 'plan-12',
        authority,
        planAuthorities: maps.planAuthorities,
        planSessions: maps.planSessions,
        ensureSessionId,
        persistPlanState: persist,
      });

      expect(persist).toHaveBeenCalledOnce();
    });
  });

  // ===================================================================
  // getWorkflowPlanAuthority
  // ===================================================================
  describe('getWorkflowPlanAuthority', () => {
    it('returns a copy of stored authority', () => {
      const maps = freshMaps();
      const stored: WorkflowAuthority = {
        sessionId: 'sess-20',
        workspaceId: 'ws-20',
        projectId: 'proj-20',
      };
      maps.planAuthorities.set('plan-20', stored);
      const ensureSessionId = vi.fn().mockReturnValue('default-sess');

      const result = getWorkflowPlanAuthority({
        planId: 'plan-20',
        planAuthorities: maps.planAuthorities,
        ensureSessionId,
      });

      expect(result).toEqual(stored);
      expect(result).not.toBe(stored);
      expect(ensureSessionId).not.toHaveBeenCalled();
    });

    it('returns default authority when nothing is stored', () => {
      const maps = freshMaps();
      const ensureSessionId = vi.fn().mockReturnValue('default-sess');

      const result = getWorkflowPlanAuthority({
        planId: 'plan-21',
        planAuthorities: maps.planAuthorities,
        ensureSessionId,
      });

      expect(result).toEqual({
        sessionId: 'default-sess',
        workspaceId: null,
        projectId: null,
      });
      expect(ensureSessionId).toHaveBeenCalledWith('plan-21');
    });
  });

  // ===================================================================
  // resolveWorkflowPlanAuthority
  // ===================================================================
  describe('resolveWorkflowPlanAuthority', () => {
    it('returns authority on successful resolution', () => {
      const stored: WorkflowAuthority = {
        sessionId: 'sess-30',
        workspaceId: 'ws-30',
        projectId: null,
      };
      const bound: WorkflowAuthority = {
        sessionId: 'sess-30',
        workspaceId: 'ws-30',
        projectId: null,
      };
      const getPlanAuthority = vi.fn().mockReturnValue(stored);
      const bindPlanAuthority = vi.fn().mockReturnValue(bound);

      const result = resolveWorkflowPlanAuthority({
        planId: 'plan-30',
        requestAuthority: { sessionId: 'sess-30' },
        getPlanAuthority,
        bindPlanAuthority,
      });

      expect(result.authority).toEqual(bound);
      expect(result.error).toBeUndefined();
      expect(bindPlanAuthority).toHaveBeenCalledWith('plan-30', expect.objectContaining({
        sessionId: 'sess-30',
      }));
    });

    it('returns error on mismatched sessionId', () => {
      const stored: WorkflowAuthority = {
        sessionId: 'sess-expected',
        workspaceId: null,
        projectId: null,
      };
      const getPlanAuthority = vi.fn().mockReturnValue(stored);
      const bindPlanAuthority = vi.fn();

      const result = resolveWorkflowPlanAuthority({
        planId: 'plan-31',
        requestAuthority: { sessionId: 'sess-wrong' },
        getPlanAuthority,
        bindPlanAuthority,
      });

      expect(result.authority).toBeNull();
      expect(result.error).toContain('workflow session');
      expect(result.error).toContain('sess-expected');
      expect(result.error).toContain('sess-wrong');
      expect(bindPlanAuthority).not.toHaveBeenCalled();
    });

    it('returns error on mismatched workspaceId', () => {
      const stored: WorkflowAuthority = {
        sessionId: null,
        workspaceId: 'ws-expected',
        projectId: null,
      };
      const getPlanAuthority = vi.fn().mockReturnValue(stored);
      const bindPlanAuthority = vi.fn();

      const result = resolveWorkflowPlanAuthority({
        planId: 'plan-32',
        requestAuthority: { workspaceId: 'ws-wrong' },
        getPlanAuthority,
        bindPlanAuthority,
      });

      expect(result.authority).toBeNull();
      expect(result.error).toContain('workspace');
      expect(result.error).toContain('ws-expected');
      expect(result.error).toContain('ws-wrong');
    });

    it('returns error on mismatched projectId', () => {
      const stored: WorkflowAuthority = {
        sessionId: null,
        workspaceId: null,
        projectId: 'proj-expected',
      };
      const getPlanAuthority = vi.fn().mockReturnValue(stored);
      const bindPlanAuthority = vi.fn();

      const result = resolveWorkflowPlanAuthority({
        planId: 'plan-33',
        requestAuthority: { projectId: 'proj-wrong' },
        getPlanAuthority,
        bindPlanAuthority,
      });

      expect(result.authority).toBeNull();
      expect(result.error).toContain('project');
    });

    it('returns error for empty planId', () => {
      const result = resolveWorkflowPlanAuthority({
        planId: '',
        getPlanAuthority: vi.fn(),
        bindPlanAuthority: vi.fn(),
      });

      expect(result.authority).toBeNull();
      expect(result.error).toBe('planId is required');
    });

    it('returns error for whitespace-only planId', () => {
      const result = resolveWorkflowPlanAuthority({
        planId: '   ',
        getPlanAuthority: vi.fn(),
        bindPlanAuthority: vi.fn(),
      });

      expect(result.authority).toBeNull();
      expect(result.error).toBe('planId is required');
    });

    it('succeeds when no requestAuthority is provided', () => {
      const stored: WorkflowAuthority = {
        sessionId: 'sess-34',
        workspaceId: null,
        projectId: null,
      };
      const getPlanAuthority = vi.fn().mockReturnValue(stored);
      const bindPlanAuthority = vi.fn().mockReturnValue({ ...stored });

      const result = resolveWorkflowPlanAuthority({
        planId: 'plan-34',
        requestAuthority: null,
        getPlanAuthority,
        bindPlanAuthority,
      });

      expect(result.authority).toEqual(stored);
    });
  });
});
