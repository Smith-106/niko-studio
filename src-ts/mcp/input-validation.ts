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

/** Maximum length for persona identifiers */
export const MAX_PERSONA_ID_LENGTH = 256;

/** Maximum length for feedback identifiers */
export const MAX_FEEDBACK_ID_LENGTH = 256;

/** Maximum length for dimension names */
export const MAX_DIMENSION_LENGTH = 100;

/** Maximum length for target style descriptions */
export const MAX_TARGET_STYLE_LENGTH = 200;

/** Maximum length for version labels */
export const MAX_LABEL_LENGTH = 200;

/** Maximum number of items in a string array */
export const MAX_ARRAY_LENGTH = 64;

/** Maximum length of each item in a string array */
export const MAX_ARRAY_ITEM_LENGTH = 200;

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
 * Try to resolve the workspace root, returning a Result instead of throwing.
 *
 * Wraps safeResolveWorkspaceRoot in a try/catch so callers can handle
 * path-traversal errors as HTTP 400 responses instead of unhandled 500s.
 * The original error message (containing absolute paths) is NOT exposed
 * to the client — only a generic "Invalid workspace configuration" is
 * returned, preventing information disclosure of host filesystem layout.
 *
 * @param allowedRoot - Optional allowed root directory (defaults to process.cwd())
 * @returns `{ ok: true, value: string }` on success,
 *          `{ ok: false, error: HttpResponse(400) }` on traversal detection
 */
export function tryResolveWorkspaceRoot(allowedRoot?: string):
  | { ok: true; value: string }
  | { ok: false; error: HttpResponse } {
  try {
    return { ok: true, value: safeResolveWorkspaceRoot(allowedRoot) };
  } catch {
    return {
      ok: false,
      error: jsonResponse({ error: 'Invalid workspace configuration' }, 400),
    };
  }
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

// ============================================================
// Array & Enum Validators
// ============================================================

export interface ValidateStringArrayOpts {
  maxLength?: number;
  maxItemLength?: number;
  label?: string;
}

/**
 * Validate that a value is an array of strings, with bounded length and item size.
 *
 * Rejects non-array values, arrays exceeding maxLength, non-string elements,
 * and string elements exceeding maxItemLength.
 *
 * @param items - The value to validate
 * @param opts - Validation options (maxLength, maxItemLength, label)
 * @returns HttpResponse (400) on validation failure, null on pass
 */
export function validateStringArray(
  items: unknown,
  opts: ValidateStringArrayOpts = {},
): HttpResponse | null {
  const maxLength = opts.maxLength ?? MAX_ARRAY_LENGTH;
  const maxItemLength = opts.maxItemLength ?? MAX_ARRAY_ITEM_LENGTH;
  const label = opts.label ?? 'items';

  if (!Array.isArray(items)) {
    return jsonResponse({ error: `${label} must be an array` }, 400);
  }

  if (items.length > maxLength) {
    return jsonResponse(
      { error: `${label} exceeds maximum length of ${maxLength} items (got ${items.length})` },
      400,
    );
  }

  for (const item of items) {
    if (typeof item !== 'string') {
      return jsonResponse({ error: `Each ${label} item must be a string` }, 400);
    }
    if (item.length > maxItemLength) {
      return jsonResponse(
        { error: `${label} item exceeds maximum length of ${maxItemLength} characters (got ${item.length})` },
        400,
      );
    }
  }

  return null;
}

/**
 * Validate that a value is one of an allowed set of string values.
 *
 * @param value - The value to validate
 * @param allowedSet - Set of allowed string values
 * @param label - Human-readable label for error messages
 * @returns HttpResponse (400) on invalid value, null on pass
 */
export function validateEnum(
  value: unknown,
  allowedSet: Set<string>,
  label: string,
): HttpResponse | null {
  if (typeof value !== 'string' || !allowedSet.has(value)) {
    const allowed = Array.from(allowedSet).join(', ');
    return jsonResponse(
      { error: `${label} must be one of: ${allowed}, got ${JSON.stringify(value)}` },
      400,
    );
  }
  return null;
}
