/**
 * Unit tests for shared input validation module
 *
 * Covers boundary conditions for:
 *   1. validateStringLength — max-length guard (SEC-001)
 *   2. safeResolveWorkspaceRoot — path containment guard (SEC-002)
 *   3. validateWeight — finite-in-range guard (SEC-004)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  validateStringLength,
  safeResolveWorkspaceRoot,
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
