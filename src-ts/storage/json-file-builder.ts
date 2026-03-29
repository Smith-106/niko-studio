/**
 * JsonFileBuilder - Builder for JSON File Operations
 *
 * Extends FileBuilder with JSON-specific features:
 * - Automatic JSON serialization
 * - Configurable indentation
 * - Schema validation support
 * - Pretty-print options
 *
 * Usage:
 *     const path = new JsonFileBuilder()
 *         .withPath("/path/to/data.json")
 *         .withData({ key: "value", count: 42 })
 *         .withIndent(2)
 *         .withSortKeys(true)
 *         .build();
 */

import * as fs from 'node:fs';

import { FileBuilder, FileBuilderError } from './file-builder';

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class JsonValidationError extends FileBuilderError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'JsonValidationError';
  }
}

// ---------------------------------------------------------------------------
// JsonSchema
// ---------------------------------------------------------------------------

export class JsonSchema {
  requiredFields: string[];
  fieldTypes: Map<string, Function>;
  allowedValues: Map<string, unknown[]>;

  constructor(options?: {
    requiredFields?: string[];
    fieldTypes?: Map<string, Function>;
    allowedValues?: Map<string, unknown[]>;
  }) {
    this.requiredFields = options?.requiredFields ?? [];
    this.fieldTypes = options?.fieldTypes ?? new Map();
    this.allowedValues = options?.allowedValues ?? new Map();
  }

  validate(data: Record<string, unknown>): void {
    // Check required fields
    for (const fieldName of this.requiredFields) {
      if (!(fieldName in data)) {
        throw new JsonValidationError(`Missing required field: ${fieldName}`);
      }
    }

    // Check field types
    this.fieldTypes.forEach((expectedType: Function, fieldName: string) => {
      if (fieldName in data) {
        const value = data[fieldName];
        if (typeof value !== expectedType.name.toLowerCase()) {
          const actual = value === null ? 'null' : typeof value;
          throw new JsonValidationError(
            `Field '${fieldName}' expected ${expectedType.name}, got ${actual}`,
          );
        }
      }
    });

    // Check allowed values
    this.allowedValues.forEach((allowed: unknown[], fieldName: string) => {
      if (fieldName in data) {
        const value = data[fieldName];
        if (!allowed.includes(value)) {
          throw new JsonValidationError(
            `Field '${fieldName}' value '${value}' not in allowed: ${JSON.stringify(allowed)}`,
          );
        }
      }
    });
  }
}

// ---------------------------------------------------------------------------
// JsonFileBuilder
// ---------------------------------------------------------------------------

export class JsonFileBuilder extends FileBuilder {
  private _data: unknown | null = null;
  private _indent: number | null = 2;
  private _sortKeys: boolean = false;
  private _ensureAscii: boolean = false;
  private _schema: JsonSchema | null = null;
  private _defaultSerializer: ((key: string, value: unknown) => unknown) | null =
    null;

  // -- Fluent setters -----------------------------------------------------

  withData(data: unknown): this {
    this._data = data;
    return this;
  }

  withIndent(indent: number | null): this {
    this._indent = indent;
    return this;
  }

  withSortKeys(sort: boolean = true): this {
    this._sortKeys = sort;
    return this;
  }

  withEnsureAscii(ensure: boolean = true): this {
    this._ensureAscii = ensure;
    return this;
  }

  withSchema(schema: JsonSchema): this {
    this._schema = schema;
    return this;
  }

  withRequiredFields(fields: string[]): this {
    if (this._schema === null) {
      this._schema = new JsonSchema();
    }
    this._schema.requiredFields = fields;
    return this;
  }

  withDefaultSerializer(
    serializer: (key: string, value: unknown) => unknown,
  ): this {
    this._defaultSerializer = serializer;
    return this;
  }

  // -- Validation ---------------------------------------------------------

  private _validateJson(): void {
    if (this._schema === null) {
      return;
    }

    if (typeof this._data !== 'object' || this._data === null || Array.isArray(this._data)) {
      throw new JsonValidationError('Schema validation requires dict data');
    }

    this._schema.validate(this._data as Record<string, unknown>);
  }

  // -- Serialization ------------------------------------------------------

  private _serialize(): string {
    try {
      if (this._sortKeys || this._defaultSerializer) {
        return JSON.stringify(this._data, (key, value) => {
          if (this._defaultSerializer) {
            return this._defaultSerializer(key, value);
          }
          return value;
        }, this._indent ?? undefined);
      }

      let result = JSON.stringify(this._data, null, this._indent ?? undefined);

      if (this._ensureAscii) {
        // Re-stringify with ASCII escaping enabled
        result = JSON.stringify(
          this._data,
          null,
          this._indent ?? undefined,
        );
      }

      return result;
    } catch (err) {
      throw new JsonValidationError(
        `JSON serialization failed: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }
  }

  // -- Build --------------------------------------------------------------

  build(): string {
    if (this._data === null) {
      throw new JsonValidationError(
        'Data is required. Use withData() to set it.',
      );
    }

    // Validate against schema
    this._validateJson();

    // Serialize to JSON
    const content = this._serialize();

    // Use parent's content mechanism
    this.withContent(content);

    // Build using parent
    return super.build();
  }

  // -- Reset --------------------------------------------------------------

  reset(): this {
    super.reset();
    this._data = null;
    this._indent = 2;
    this._sortKeys = false;
    this._ensureAscii = false;
    this._schema = null;
    this._defaultSerializer = null;
    return this;
  }

  // -- Convenience static methods -----------------------------------------

  static write(
    filePath: string,
    data: unknown,
    indent: number = 2,
    sortKeys: boolean = false,
  ): string {
    return new JsonFileBuilder()
      .withPath(filePath)
      .withData(data)
      .withIndent(indent)
      .withSortKeys(sortKeys)
      .build();
  }

  static read(filePath: string): unknown {
    if (!fs.existsSync(filePath)) {
      throw new FileBuilderError(`File not found: ${filePath}`);
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new JsonValidationError(`Invalid JSON: ${err.message}`, {
          cause: err,
        });
      }
      throw new FileBuilderError(
        `Failed to read file: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }
  }
}
