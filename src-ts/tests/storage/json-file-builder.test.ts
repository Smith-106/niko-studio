import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  JsonFileBuilder,
  JsonSchema,
  JsonValidationError,
} from '../../storage/json-file-builder.js';
import { FileBuilderError } from '../../storage/file-builder.js';

describe('storage/json-file-builder', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'niko-json-builder-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('validates required fields, field types, and allowed values', () => {
    const schema = new JsonSchema({
      requiredFields: ['title'],
      fieldTypes: new Map([
        ['count', Number],
        ['title', String],
      ]),
      allowedValues: new Map([
        ['status', ['draft', 'published']],
      ]),
    });

    expect(() => schema.validate({ title: 'Atlas', count: 2, status: 'draft' })).not.toThrow();
    expect(() => schema.validate({ count: 2 })).toThrow('Missing required field: title');
    expect(() => schema.validate({ title: 'Atlas', count: 'two' })).toThrow("Field 'count' expected Number, got string");
    expect(() => schema.validate({ title: 'Atlas', count: 2, status: 'archived' })).toThrow(
      "Field 'status' value 'archived' not in allowed",
    );
  });

  it('writes JSON content with defaults and supports static read/write helpers', () => {
    const target = path.join(tempDir, 'story.json');
    const builder = new JsonFileBuilder()
      .withPath(target)
      .withData({ title: 'Atlas', count: 2 });

    expect(builder.build()).toBe(target);
    expect(fs.readFileSync(target, 'utf8')).toContain('"title": "Atlas"');
    expect(JsonFileBuilder.read(target)).toEqual({ title: 'Atlas', count: 2 });

    const staticTarget = path.join(tempDir, 'static.json');
    JsonFileBuilder.write(staticTarget, { ready: true }, 0, false);
    expect(JsonFileBuilder.read(staticTarget)).toEqual({ ready: true });
  });

  it('supports a default serializer and required-field convenience helper', () => {
    const target = path.join(tempDir, 'serialized.json');
    const builder = new JsonFileBuilder()
      .withPath(target)
      .withData({ title: 'Atlas', updatedAt: new Date('2026-01-02T03:04:05.000Z') })
      .withRequiredFields(['title'])
      .withDefaultSerializer((_key, value) => (
        value instanceof Date ? value.toISOString() : value
      ));

    builder.build();

    const parsed = JSON.parse(fs.readFileSync(target, 'utf8')) as Record<string, string>;
    expect(parsed.updatedAt).toBe('2026-01-02T03:04:05.000Z');
  });

  it('throws when data is missing or schema validation receives a non-object payload', () => {
    const missingDataBuilder = new JsonFileBuilder().withPath(path.join(tempDir, 'missing.json'));
    expect(() => missingDataBuilder.build()).toThrow('Data is required');

    const arrayBuilder = new JsonFileBuilder()
      .withPath(path.join(tempDir, 'array.json'))
      .withData(['bad'])
      .withSchema(new JsonSchema({ requiredFields: ['title'] }));

    expect(() => arrayBuilder.build()).toThrow('Schema validation requires dict data');
  });

  it('wraps JSON serialization failures and invalid reads with typed errors', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const circularBuilder = new JsonFileBuilder()
      .withPath(path.join(tempDir, 'circular.json'))
      .withData(circular);
    expect(() => circularBuilder.build()).toThrow(JsonValidationError);

    const invalidPath = path.join(tempDir, 'invalid.json');
    fs.writeFileSync(invalidPath, '{bad', 'utf8');
    expect(() => JsonFileBuilder.read(invalidPath)).toThrow(JsonValidationError);

    expect(() => JsonFileBuilder.read(path.join(tempDir, 'missing.json'))).toThrow(FileBuilderError);
  });

  it('resets custom JSON builder options back to defaults', () => {
    const builder = new JsonFileBuilder()
      .withPath(path.join(tempDir, 'reset.json'))
      .withData({ title: 'Atlas' })
      .withIndent(null)
      .withSortKeys(true)
      .withEnsureAscii(true)
      .withSchema(new JsonSchema({ requiredFields: ['title'] }))
      .withDefaultSerializer((_key, value) => value);

    builder.reset();

    const target = path.join(tempDir, 'reuse.json');
    builder.withPath(target).withData({ title: 'Reused' });
    builder.build();

    expect(JsonFileBuilder.read(target)).toEqual({ title: 'Reused' });
  });
});
