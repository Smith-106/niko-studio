import { describe, it, expect } from 'vitest';

import {
  normalizeWorkflowAuthority,
  defaultWorkflowAuthority,
  mergeWorkflowAuthority,
  authorityMismatchError,
  resolveRequestedWorkflowAuthority,
} from '../../../workflow/engine/authority.js';
import type { WorkflowAuthority } from '../../../workflow/engine/authority.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('authority', () => {
  // ------------------------------------------------------------------
  // normalizeWorkflowAuthority
  // ------------------------------------------------------------------
  describe('normalizeWorkflowAuthority', () => {
    it('returns null for null input', () => {
      expect(normalizeWorkflowAuthority(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(normalizeWorkflowAuthority(undefined)).toBeNull();
    });

    it('returns null when all fields are empty strings', () => {
      expect(normalizeWorkflowAuthority({ sessionId: '', workspaceId: '', projectId: '' })).toBeNull();
    });

    it('returns null when all fields are whitespace-only strings', () => {
      expect(normalizeWorkflowAuthority({ sessionId: '  ', workspaceId: '  ', projectId: '  ' })).toBeNull();
    });

    it('fills missing fields with null', () => {
      const result = normalizeWorkflowAuthority({ sessionId: 's1' });
      expect(result).toEqual({
        sessionId: 's1',
        workspaceId: null,
        projectId: null,
      });
    });

    it('trims whitespace from valid strings', () => {
      const result = normalizeWorkflowAuthority({
        sessionId: '  s1  ',
        workspaceId: '  w1  ',
        projectId: '  p1  ',
      });
      expect(result).toEqual({
        sessionId: 's1',
        workspaceId: 'w1',
        projectId: 'p1',
      });
    });

    it('keeps non-empty strings and nulls missing fields', () => {
      const result = normalizeWorkflowAuthority({ workspaceId: 'w1' });
      expect(result).toEqual({
        sessionId: null,
        workspaceId: 'w1',
        projectId: null,
      });
    });

    it('returns null for an empty object (all fields undefined)', () => {
      expect(normalizeWorkflowAuthority({})).toBeNull();
    });

    it('treats non-string fields as null', () => {
      const result = normalizeWorkflowAuthority({
        sessionId: 123 as unknown as string,
        workspaceId: null as unknown as string,
      });
      // sessionId is a number, not a string, so it becomes null
      // workspaceId is null, not a string, so it becomes null
      // all null => return null
      expect(result).toBeNull();
    });
  });

  // ------------------------------------------------------------------
  // defaultWorkflowAuthority
  // ------------------------------------------------------------------
  describe('defaultWorkflowAuthority', () => {
    it('creates authority with sessionId and null workspace/project', () => {
      const result = defaultWorkflowAuthority('session-abc');
      expect(result).toEqual({
        sessionId: 'session-abc',
        workspaceId: null,
        projectId: null,
      });
    });

    it('uses the provided sessionId exactly as given', () => {
      expect(defaultWorkflowAuthority('  spaced  ').sessionId).toBe('  spaced  ');
    });
  });

  // ------------------------------------------------------------------
  // mergeWorkflowAuthority
  // ------------------------------------------------------------------
  describe('mergeWorkflowAuthority', () => {
    it('incoming overrides current fields', () => {
      const current: WorkflowAuthority = {
        sessionId: 'old-session',
        workspaceId: 'old-workspace',
        projectId: 'old-project',
      };
      const incoming: WorkflowAuthority = {
        sessionId: 'new-session',
        workspaceId: 'new-workspace',
        projectId: 'new-project',
      };
      const result = mergeWorkflowAuthority(current, incoming, 'fallback');
      expect(result).toEqual({
        sessionId: 'new-session',
        workspaceId: 'new-workspace',
        projectId: 'new-project',
      });
    });

    it('uses current as fallback when incoming fields are null', () => {
      const current: WorkflowAuthority = {
        sessionId: 'current-session',
        workspaceId: 'current-workspace',
        projectId: 'current-project',
      };
      const incoming: WorkflowAuthority = {
        sessionId: null,
        workspaceId: 'new-workspace',
        projectId: null,
      };
      const result = mergeWorkflowAuthority(current, incoming, 'fallback');
      expect(result).toEqual({
        sessionId: 'current-session',
        workspaceId: 'new-workspace',
        projectId: 'current-project',
      });
    });

    it('uses fallbackSessionId as last resort for sessionId', () => {
      const current: WorkflowAuthority = {
        sessionId: null,
        workspaceId: null,
        projectId: null,
      };
      const incoming: WorkflowAuthority = {
        sessionId: null,
        workspaceId: null,
        projectId: null,
      };
      const result = mergeWorkflowAuthority(current, incoming, 'fallback-id');
      expect(result.sessionId).toBe('fallback-id');
      expect(result.workspaceId).toBeNull();
      expect(result.projectId).toBeNull();
    });

    it('handles both current and incoming being null', () => {
      const result = mergeWorkflowAuthority(null, null, 'fallback');
      expect(result).toEqual({
        sessionId: 'fallback',
        workspaceId: null,
        projectId: null,
      });
    });

    it('uses incoming sessionId over fallbackSessionId', () => {
      const result = mergeWorkflowAuthority(null, { sessionId: 'incoming', workspaceId: null, projectId: null }, 'fallback');
      expect(result.sessionId).toBe('incoming');
    });

    it('uses current workspaceId and projectId as fallback when incoming is null', () => {
      const current: WorkflowAuthority = {
        sessionId: 'current-session',
        workspaceId: 'current-workspace',
        projectId: 'current-project',
      };
      const incoming: WorkflowAuthority = {
        sessionId: 'new-session',
        workspaceId: null,
        projectId: null,
      };
      const result = mergeWorkflowAuthority(current, incoming, 'fallback');
      expect(result.workspaceId).toBe('current-workspace');
      expect(result.projectId).toBe('current-project');
    });
  });

  // ------------------------------------------------------------------
  // authorityMismatchError
  // ------------------------------------------------------------------
  describe('authorityMismatchError', () => {
    it('formats error for session mismatch', () => {
      const msg = authorityMismatchError('plan-1', 'workflow session', 'expected-123', 'received-456');
      expect(msg).toBe("Plan 'plan-1' is bound to workflow session 'expected-123' and cannot be used with 'received-456'");
    });

    it('formats error for workspace mismatch', () => {
      const msg = authorityMismatchError('plan-2', 'workspace', 'ws-a', 'ws-b');
      expect(msg).toBe("Plan 'plan-2' is bound to workspace 'ws-a' and cannot be used with 'ws-b'");
    });

    it('formats error for project mismatch', () => {
      const msg = authorityMismatchError('plan-3', 'project', 'proj-x', 'proj-y');
      expect(msg).toBe("Plan 'plan-3' is bound to project 'proj-x' and cannot be used with 'proj-y'");
    });
  });

  // ------------------------------------------------------------------
  // resolveRequestedWorkflowAuthority
  // ------------------------------------------------------------------
  describe('resolveRequestedWorkflowAuthority', () => {
    const stored: WorkflowAuthority = {
      sessionId: 'stored-session',
      workspaceId: 'stored-workspace',
      projectId: 'stored-project',
    };

    it('returns stored authority with no error when no request authority is provided', () => {
      const result = resolveRequestedWorkflowAuthority('plan-1', stored, null);
      expect(result.authority).toEqual({
        sessionId: 'stored-session',
        workspaceId: 'stored-workspace',
        projectId: 'stored-project',
      });
      expect(result.error).toBeUndefined();
    });

    it('returns merged authority when request matches stored values', () => {
      const result = resolveRequestedWorkflowAuthority('plan-1', stored, {
        sessionId: 'stored-session',
        workspaceId: 'stored-workspace',
        projectId: 'stored-project',
      });
      expect(result.authority).toEqual({
        sessionId: 'stored-session',
        workspaceId: 'stored-workspace',
        projectId: 'stored-project',
      });
      expect(result.error).toBeUndefined();
    });

    it('returns error on session mismatch', () => {
      const result = resolveRequestedWorkflowAuthority('plan-1', stored, {
        sessionId: 'different-session',
      });
      expect(result.authority).toBeNull();
      expect(result.error).toBe(
        "Plan 'plan-1' is bound to workflow session 'stored-session' and cannot be used with 'different-session'",
      );
    });

    it('returns error on workspace mismatch', () => {
      const result = resolveRequestedWorkflowAuthority('plan-1', stored, {
        sessionId: 'stored-session',
        workspaceId: 'different-workspace',
      });
      expect(result.authority).toBeNull();
      expect(result.error).toBe(
        "Plan 'plan-1' is bound to workspace 'stored-workspace' and cannot be used with 'different-workspace'",
      );
    });

    it('returns error on project mismatch', () => {
      const result = resolveRequestedWorkflowAuthority('plan-1', stored, {
        sessionId: 'stored-session',
        workspaceId: 'stored-workspace',
        projectId: 'different-project',
      });
      expect(result.authority).toBeNull();
      expect(result.error).toBe(
        "Plan 'plan-1' is bound to project 'stored-project' and cannot be used with 'different-project'",
      );
    });

    it('merges partial request authority with stored authority', () => {
      const result = resolveRequestedWorkflowAuthority('plan-1', stored, {
        sessionId: 'stored-session',
      });
      expect(result.authority).toEqual({
        sessionId: 'stored-session',
        workspaceId: 'stored-workspace',
        projectId: 'stored-project',
      });
      expect(result.error).toBeUndefined();
    });

    it('does not error when stored sessionId is null and request provides one', () => {
      const storedNoSession: WorkflowAuthority = {
        sessionId: null,
        workspaceId: 'w1',
        projectId: 'p1',
      };
      const result = resolveRequestedWorkflowAuthority('plan-1', storedNoSession, {
        sessionId: 'new-session',
      });
      expect(result.authority).toEqual({
        sessionId: 'new-session',
        workspaceId: 'w1',
        projectId: 'p1',
      });
      expect(result.error).toBeUndefined();
    });

    it('does not error when request workspaceId is null even if stored has one', () => {
      const result = resolveRequestedWorkflowAuthority('plan-1', stored, {
        workspaceId: null,
      });
      // normalizedRequest.workspaceId is null, so the mismatch check
      // (storedAuthority.workspaceId && normalizedRequest?.workspaceId) is false
      expect(result.error).toBeUndefined();
      expect(result.authority).toEqual({
        sessionId: 'stored-session',
        workspaceId: 'stored-workspace',
        projectId: 'stored-project',
      });
    });
  });
});
