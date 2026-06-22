/**
 * Shared Input Validation Module
 *
 * Provides reusable input validation functions for MCP endpoints.
 * Implements the "input validation trio" pattern:
 *   1. validateStringLength  — max-length guard (SEC-001)
 *   2. safeResolveWorkspaceRoot — path containment guard (SEC-002)
 *   3. validateWeight — finite-in-range guard (SEC-004)
 *
 * Related: ISS-20260620-007, ISS-20260620-008, ISS-20260620-009
 */

import type { HttpResponse } from './http-types.js';
import { jsonResponse } from './http-types.js';
import path from 'node:path';

// ============================================================
// Constants
// ============================================================

/** Maximum length for novel/story identifiers */
export const MAX_NOVEL_ID_LENGTH = 256;

/** Maximum length for text content (100k chars, well above 24k chat limit) */
export const MAX_TEXT_LENGTH = 100_000;

/** Maximum length for user-provided names */
export const MAX_NAME_LENGTH = 200;

// ============================================================
// Validators
// ============================================================

/**
 * Validate that a string does not exceed a maximum length.
 *
 * Returns an HttpResponse with status 413 if the string exceeds the limit,
 * or null if the string passes validation.
 *
 * @param value - The string to validate
 * @param maxLength - Maximum allowed length
 * @param label - Human-readable label for error messages
 * @returns HttpResponse (413) on overflow, null on pass
 */
export function validateStringLength(
  value: string,
  maxLength: number,
  label: string,
): HttpResponse | null {
  if (value.length > maxLength) {
    return jsonResponse(
      { error: `${label} exceeds maximum length of ${maxLength} characters (got ${value.length})` },
      413,
    );
  }
  return null;
}

/**
 * Safely resolve the workspace root from NIKO_WORKFLOW_WORKSPACE env var.
 *
 * Reads NIKO_WORKFLOW_WORKSPACE, trims whitespace, resolves with path.resolve,
 * and validates that the resolved path is within the allowed root directory
 * (defaults to process.cwd()) to prevent path traversal attacks.
 *
 * If NIKO_WORKSPACE_ALLOW_OUTSIDE is set to 'true', the containment check
 * is skipped (escape hatch for development/testing).
 *
 * @param allowedRoot - Optional allowed root directory (defaults to process.cwd())
 * @returns Resolved workspace root path
 * @throws Error if path traversal is detected
 */
export function safeResolveWorkspaceRoot(allowedRoot?: string): string {
  const envValue = String(process.env['NIKO_WORKFLOW_WORKSPACE'] ?? '').trim();
  const root = path.resolve(allowedRoot ?? process.cwd());

  // Empty or whitespace-only env: fall back to allowed root
  if (!envValue) {
    return root;
  }

  const resolved = path.resolve(envValue);

  // Escape hatch: allow paths outside root when explicitly enabled
  if (process.env['NIKO_WORKSPACE_ALLOW_OUTSIDE'] === 'true') {
    return resolved;
  }

  // Containment check: resolved must be within root. path.resolve already
  // collapses lexical '..' segments, so a prefix check suffices. On Windows
  // (case-insensitive NTFS) the comparison must be case-insensitive, or a
  // workspace whose path case differs from cwd gets rejected as a false
  // positive path traversal.
  const isWindows = process.platform === 'win32';
  const cmpResolved = isWindows ? resolved.toLowerCase() : resolved;
  const cmpRoot = isWindows ? root.toLowerCase() : root;

  if (cmpResolved !== cmpRoot && !cmpResolved.startsWith(cmpRoot + path.sep)) {
    throw new Error(
      `Workspace path traversal detected: "${resolved}" is outside allowed root "${root}"`,
    );
  }

  return resolved;
}

/**
 * Validate that a numeric weight value is finite and within a specified range.
 *
 * Uses Number.isFinite() to explicitly reject NaN and Infinity values,
 * which would otherwise pass range checks (NaN < 0 === false, NaN > 1 === false).
 *
 * @param value - The value to validate
 * @param min - Minimum allowed value (inclusive)
 * @param max - Maximum allowed value (inclusive)
 * @param label - Human-readable label for error messages
 * @returns HttpResponse (400) on invalid value, null on pass
 */
export function validateWeight(
  value: unknown,
  min: number,
  max: number,
  label: string,
): HttpResponse | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return jsonResponse(
      { error: `${label} must be a finite number, got ${value}` },
      400,
    );
  }

  if (value < min || value > max) {
    return jsonResponse(
      { error: `${label} must be between ${min} and ${max}, got ${value}` },
      400,
    );
  }

  return null;
}
