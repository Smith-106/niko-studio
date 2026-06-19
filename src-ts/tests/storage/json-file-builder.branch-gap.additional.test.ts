import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  JsonFileBuilder,
  JsonSchema,
  JsonValidationError,
} from '../../storage/json-file-builder.js';
import { FileBuilderError } from '../../storage/file-builder.js';

describe('storage/json-file-builder branch gap coverage', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'niko-json-branch-gap-'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('reports null values with the explicit null type in schema validation', () => {
    const schema = new JsonSchema({
      fieldTypes: new Map([
        ['count', Number],
      ]),
    });

    expect(() => schema.validate({ count: null })).toThrow(
      "Field 'count' expected Number, got null",
    );
  });

  it('serializes through the sort-only branch and supports null indentation', () => {
    const target = path.join(tempDir, 'sorted-null-indent.json');

    const built = new JsonFileBuilder()
      .withPath(target)
      .withData({ b: 2, a: 1 })
      .withSortKeys(true)
      .withIndent(null)
      .build();

    expect(built).toBe(target);
    expect(fs.readFileSync(target, 'utf8')).toBe('{"b":2,"a":1}');
  });

  it('re-runs serialization when ensureAscii is enabled', () => {
    const target = path.join(tempDir, 'ascii.json');

    new JsonFileBuilder()
      .withPath(target)
      .withData({ title: '阿特拉斯' })
      .withIndent(null)
      .withEnsureAscii(true)
      .build();

    expect(fs.readFileSync(target, 'utf8')).toBe('{"title":"阿特拉斯"}');
  });

  it('wraps non-Error serialization failures and non-Error file read failures', () => {
    const target = path.join(tempDir, 'serializer-error.json');

    expect(() => new JsonFileBuilder()
      .withPath(target)
      .withData({ title: 'Atlas' })
      .withDefaultSerializer(() => {
        throw 'serializer exploded';
      })
      .build()).toThrowError(JsonValidationError);
    expect(() => new JsonFileBuilder()
      .withPath(target)
      .withData({ title: 'Atlas' })
      .withDefaultSerializer(() => {
        throw 'serializer exploded';
      })
      .build()).toThrow(/JSON serialization failed: serializer exploded/);

    vi.resetModules();
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
      return {
        ...actual,
        existsSync: () => true,
        readFileSync: () => {
          throw 'permission denied';
        },
      };
    });

    return import('../../storage/json-file-builder.js?primitive-read-error').then((mod) => {
      try {
        mod.JsonFileBuilder.read(path.join(tempDir, 'denied.json'));
      } catch (error) {
        expect(error).toMatchObject({
          name: 'FileBuilderError',
          message: 'Failed to read file: permission denied',
          cause: 'permission denied',
        });
        return;
      }

      throw new Error('Expected JsonFileBuilder.read to throw');
    });
  });

  it('wraps generic Error file read failures with the original error message', async () => {
    vi.resetModules();
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
      return {
        ...actual,
        existsSync: () => true,
        readFileSync: () => {
          throw new Error('disk offline');
        },
      };
    });

    const mod = await import('../../storage/json-file-builder.js?error-read-branch');

    expect(() => mod.JsonFileBuilder.read(path.join(tempDir, 'disk-offline.json'))).toThrow(
      /Failed to read file: disk offline/,
    );
  });
});
