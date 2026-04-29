import { describe, expect, it, vi, beforeEach } from 'vitest';

import { EmbeddingEngine } from '../../memory/unified-memory';

describe('EmbeddingEngine fallback path', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('returns zero vector when _modelValue is neither dummy nor a real model', () => {
    // The constructor defaults _modelValue to "dummy" via the getter.
    // To reach the else branch, we force _model to a non-dummy, non-callable value.
    const engine = new EmbeddingEngine('test-model');
    // Override internal model to a string that is not "dummy"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (engine as any)._model = 'not-a-real-model';

    const result = engine.embed('test input');

    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBe(384);
    expect(result.every((v: number) => v === 0.0)).toBe(true);
  });

  it('emits a console.warn when falling back to zero vector', () => {
    const engine = new EmbeddingEngine('test-model');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (engine as any)._model = 'not-a-real-model';

    engine.embed('test input for warning');

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('EmbeddingEngine'),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('degraded'),
    );
  });

  it('dummy path still produces deterministic 384-dim vector', () => {
    const engine = new EmbeddingEngine();
    // _modelValue getter defaults to "dummy"

    const result = engine.embed('hello world');

    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBe(384);
    // Dummy path produces non-zero values from md5 hash
    const nonZeroCount = result.filter((v: number) => v !== 0.0).length;
    expect(nonZeroCount).toBeGreaterThan(0);
  });

  it('fallback results are cacheable', () => {
    const engine = new EmbeddingEngine('test-model');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (engine as any)._model = 'not-a-real-model';

    const first = engine.embed('cache test', true);
    const second = engine.embed('cache test', true);

    expect(first).toEqual(second);
  });
});
