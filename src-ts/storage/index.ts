/**
 * Storage Package - Unified File Builder System
 *
 * Provides a builder pattern for atomic file operations with:
 * - Fluent API for file configuration
 * - Atomic writes (write to temp, rename)
 * - Rollback support
 * - JSON builder with schema validation
 *
 * Usage:
 *     import { FileBuilder, JsonFileBuilder } from './storage';
 *
 *     // Basic file writing
 *     FileBuilder().withPath("output.txt").withContent("Hello").build();
 *
 *     // JSON file writing
 *     JsonFileBuilder().withPath("data.json").withData({ key: "value" }).build();
 */

export { FileBuilderError, FileBuilder } from './file-builder';
export type { FileBuilderState } from './file-builder';
export {
  JsonValidationError,
  JsonSchema,
  JsonFileBuilder,
} from './json-file-builder';
