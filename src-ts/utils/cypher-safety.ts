/**
 * Cypher Query Safety Utilities
 *
 * Provides escaping and validation helpers for constructing safe Cypher queries.
 * All dynamic values interpolated into Cypher strings must use these helpers
 * to prevent injection attacks.
 */

/**
 * Allowed entity types for Cypher label positions.
 * Only these values may appear after the colon in `(n:Label)`.
 */
const ALLOWED_ENTITY_TYPES = new Set([
  'Character',
  'Location',
  'Event',
  'Foreshadow',
  'Plot',
  'Theme',
])

/**
 * Validate that an entityType is in the allowlist.
 * Throws if the value is not permitted.
 */
export function validateEntityType(entityType: string): void {
  if (!ALLOWED_ENTITY_TYPES.has(entityType)) {
    throw new Error(
      `Invalid entity type: "${entityType}". Allowed: ${[...ALLOWED_ENTITY_TYPES].join(', ')}`
    )
  }
}

/**
 * Escape a string value for safe Cypher single-quoted string literal.
 * Doubles any single-quote characters and escapes backslashes (Cypher convention).
 */
export function escapeCypherString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}
