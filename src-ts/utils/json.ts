/**
 * Safe JSON parse — strips BOM (U+FEFF) before parsing.
 *
 * Windows Notepad and some editors prepend BOM to UTF-8 files,
 * which causes `JSON.parse` to throw SyntaxError.
 */

export function parseJsonSafe(raw: string): unknown {
  const cleaned = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw;
  return JSON.parse(cleaned);
}
