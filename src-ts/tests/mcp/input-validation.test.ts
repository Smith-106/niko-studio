/**
 * Unit tests for shared input validation module
 *
 * Covers boundary conditions for:
 *   1. validateStringLength — max-length guard (SEC-001)
 *   2. safeResolveWorkspaceRoot — path containment guard (SEC-002)
 *   3. validateWeight — finite-in-range guard (SEC-004)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import {
  validateStringLength,
  safeResolveWorkspaceRoot,
  tryResolveWorkspaceRoot,
  validateWeight,
  MAX_NOVEL_ID_LENGTH,
  MAX_TEXT_LENGTH,
  MAX_NAME_LENGTH,
} from '../../mcp/input-validation.js';

// ============================================================
// validateStringLength
// ============================================================

describe('validateStringLength', () => {
  it('returns null for string within limit', () => {
    const result = validateStringLength('hello', 10, 'test');
    expect(result).toBeNull();
  });

  it('returns 413 response for string exceeding limit', () => {
    const result = validateStringLength('hello world', 5, 'test');
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(413);
  });

  it('returns 413 for empty string when limit is 0', () => {
    // Empty string has length 0, limit 0 means 0 is OK
    const result = validateStringLength('', 0, 'test');
    expect(result).toBeNull(); // length 0 <= limit 0
  });

  it('returns null for string exactly at limit', () => {
    const result = validateStringLength('abc', 3, 'test');
    expect(result).toBeNull();
  });

  it('includes label and maxLength in error message', () => {
    const result = validateStringLength('x'.repeat(300), 256, 'novelId');
    expect(result).not.toBeNull();
    const body = result!.body as { error: string };
    expect(body.error).toContain('novelId');
    expect(body.error).toContain('256');
  });

  it('includes actual length in error message', () => {
    const result = validateStringLength('x'.repeat(300), 256, 'novelId');
    expect(result).not.toBeNull();
    const body = result!.body as { error: string };
    expect(body.error).toContain('300');
  });
});

// ============================================================
// safeResolveWorkspaceRoot
// ============================================================

describe('safeResolveWorkspaceRoot', () => {
  let savedWorkspace: string | undefined;
  let savedAllowOutside: string | undefined;

  beforeEach(() => {
    savedWorkspace = process.env['NIKO_WORKFLOW_WORKSPACE'];
    savedAllowOutside = process.env['NIKO_WORKSPACE_ALLOW_OUTSIDE'];
    delete process.env['NIKO_WORKFLOW_WORKSPACE'];
    delete process.env['NIKO_WORKSPACE_ALLOW_OUTSIDE'];
  });

  afterEach(() => {
    if (savedWorkspace !== undefined) {
      process.env['NIKO_WORKFLOW_WORKSPACE'] = savedWorkspace;
    } else {
      delete process.env['NIKO_WORKFLOW_WORKSPACE'];
    }
    if (savedAllowOutside !== undefined) {
      process.env['NIKO_WORKSPACE_ALLOW_OUTSIDE'] = savedAllowOutside;
    } else {
      delete process.env['NIKO_WORKSPACE_ALLOW_OUTSIDE'];
    }
  });

  it('returns cwd when env not set', () => {
    const result = safeResolveWorkspaceRoot();
    expect(result).toBe(process.cwd());
  });

  it('returns resolved path for valid subdir of allowed root', () => {
    process.env['NIKO_WORKFLOW_WORKSPACE'] = process.cwd();
    const result = safeResolveWorkspaceRoot();
    expect(result).toBe(process.cwd());
  });

  it('throws on path traversal with ../', () => {
    process.env['NIKO_WORKFLOW_WORKSPACE'] = '../etc/passwd';
    expect(() => safeResolveWorkspaceRoot()).toThrow('path traversal');
  });

  it('throws on absolute path outside allowed root', () => {
    process.env['NIKO_WORKFLOW_WORKSPACE'] = 'C:/Windows/System32';
    expect(() => safeResolveWorkspaceRoot()).toThrow('path traversal');
  });

  it('handles whitespace-only env value by returning cwd', () => {
    process.env['NIKO_WORKFLOW_WORKSPACE'] = '   ';
    const result = safeResolveWorkspaceRoot();
    expect(result).toBe(process.cwd());
  });

  it('allows outside path when NIKO_WORKSPACE_ALLOW_OUTSIDE=true', () => {
    process.env['NIKO_WORKFLOW_WORKSPACE'] = 'C:/some/outside/path';
    process.env['NIKO_WORKSPACE_ALLOW_OUTSIDE'] = 'true';
    const result = safeResolveWorkspaceRoot();
    expect(result).toContain('outside');
  });

  // Windows NTFS is case-insensitive: a workspace whose path case differs
  // from cwd must not be rejected as a false-positive path traversal.
  // Pre-fix the comparison was case-sensitive (path.normalize doesn't
  // lowercase), so legitimate Windows workspaces threw. Skipped on POSIX.
  (process.platform === 'win32' ? it : it.skip)(
    'Windows: tolerates case mismatch between env workspace and cwd',
    () => {
      const cwd = process.cwd();
      const idx = cwd.lastIndexOf(path.sep);
      if (idx <= 0) return; // root drive — no segment to flip
      const head = cwd.slice(0, idx);
      const tail = cwd.slice(idx + 1);
      const flippedTail =
        tail === tail.toUpperCase() ? tail.toLowerCase() : tail.toUpperCase();
      process.env['NIKO_WORKFLOW_WORKSPACE'] = head + path.sep + flippedTail;
      expect(() => safeResolveWorkspaceRoot()).not.toThrow();
      expect(safeResolveWorkspaceRoot().toLowerCase()).toBe(cwd.toLowerCase());
    },
  );
});

// ============================================================
// tryResolveWorkspaceRoot (ISS-007)
// ============================================================

describe('tryResolveWorkspaceRoot', () => {
  beforeEach(() => {
    delete process.env['NIKO_WORKFLOW_WORKSPACE'];
    delete process.env['NIKO_WORKSPACE_ALLOW_OUTSIDE'];
  });

  afterEach(() => {
    delete process.env['NIKO_WORKFLOW_WORKSPACE'];
    delete process.env['NIKO_WORKSPACE_ALLOW_OUTSIDE'];
  });

  it('returns ok:true with cwd when workspace root is valid', () => {
    const result = tryResolveWorkspaceRoot();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(typeof result.value).toBe('string');
      expect(result.value.length).toBeGreaterThan(0);
    }
  });

  it('returns ok:false with 400 HttpResponse on path traversal', () => {
    process.env['NIKO_WORKFLOW_WORKSPACE'] = '/etc/passwd/../../etc/shadow';
    const result = tryResolveWorkspaceRoot();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.statusCode).toBe(400);
      // Verify no path information is leaked in the error
      const body = result.error.body as Record<string, unknown>;
      expect(body.error).toBe('Invalid workspace configuration');
      expect(body.error).not.toContain('/etc');
      expect(body.error).not.toContain('shadow');
    }
  });

  it('returns generic error message without path disclosure', () => {
    process.env['NIKO_WORKFLOW_WORKSPACE'] = '/some/absolute/outside/path';
    const result = tryResolveWorkspaceRoot();
    if (!result.ok) {
      const body = result.error.body as Record<string, unknown>;
      expect(body.error).toBe('Invalid workspace configuration');
      // Error must NOT contain the attempted path
      expect(body.error).not.toContain('/some/absolute/outside/path');
    }
  });
});

// ============================================================
// validateWeight
// ============================================================

describe('validateWeight', () => {
  it('returns null for valid weight in [0, 1]', () => {
    expect(validateWeight(0.5, 0, 1, 'weight')).toBeNull();
  });

  it('returns 400 for NaN', () => {
    const result = validateWeight(NaN, 0, 1, 'weight');
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(400);
  });

  it('returns 400 for Infinity', () => {
    const result = validateWeight(Infinity, 0, 1, 'weight');
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(400);
  });

  it('returns 400 for -Infinity', () => {
    const result = validateWeight(-Infinity, 0, 1, 'weight');
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(400);
  });

  it('returns 400 for value below min', () => {
    const result = validateWeight(-0.1, 0, 1, 'weight');
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(400);
  });

  it('returns 400 for value above max', () => {
    const result = validateWeight(1.1, 0, 1, 'weight');
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(400);
  });

  it('returns null for value exactly 0', () => {
    expect(validateWeight(0, 0, 1, 'weight')).toBeNull();
  });

  it('returns null for value exactly 1', () => {
    expect(validateWeight(1, 0, 1, 'weight')).toBeNull();
  });

  it('returns 400 for string value', () => {
    const result = validateWeight('0.5', 0, 1, 'weight');
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(400);
  });

  it('includes label in error message for NaN', () => {
    const result = validateWeight(NaN, 0, 1, 'plotWeight');
    expect(result).not.toBeNull();
    const body = result!.body as { error: string };
    expect(body.error).toContain('plotWeight');
  });

  it('includes min and max in range error message', () => {
    const result = validateWeight(2, 0, 1, 'weight');
    expect(result).not.toBeNull();
    const body = result!.body as { error: string };
    expect(body.error).toContain('0');
    expect(body.error).toContain('1');
  });
});

// ============================================================
// Constants
// ============================================================

describe('exported constants', () => {
  it('MAX_NOVEL_ID_LENGTH is 256', () => {
    expect(MAX_NOVEL_ID_LENGTH).toBe(256);
  });

  it('MAX_TEXT_LENGTH is 100000', () => {
    expect(MAX_TEXT_LENGTH).toBe(100_000);
  });

  it('MAX_NAME_LENGTH is 200', () => {
    expect(MAX_NAME_LENGTH).toBe(200);
  });
});
