import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

class MockTensor {
  type: string;
  data: BigInt64Array | Float32Array;
  dims: number[];

  constructor(type: string, data: BigInt64Array | Float32Array, dims: number[]) {
    this.type = type;
    this.data = data;
    this.dims = dims;
  }
}

async function importProviderWithOrtMock(options?: {
  createImpl?: ReturnType<typeof vi.fn>;
  throwOnImport?: boolean;
}) {
  vi.resetModules();
  vi.doUnmock('onnxruntime-node');

  if (options?.throwOnImport) {
    vi.doMock('onnxruntime-node', () => {
      throw new Error('mocked import failure');
    });
  } else {
    const createMock =
      options?.createImpl
      ?? vi.fn().mockResolvedValue({
        run: vi.fn(),
      });

    vi.doMock('onnxruntime-node', () => ({
      InferenceSession: {
        create: createMock,
      },
      Tensor: MockTensor,
    }));
  }

  const mod = await import('../../knowledge/providers/local-embedding-v2.js');
  return mod.LocalEmbeddingProvider;
}

function createModelDir(withModel = true): string {
  const dir = mkdtempSync(join(tmpdir(), 'niko-local-embedding-v2-'));
  if (withModel) {
    writeFileSync(join(dir, 'model.onnx'), 'stub-model', 'utf8');
  }
  return dir;
}

describe('LocalEmbeddingProvider v2', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock('onnxruntime-node');
  });

  it('reports readiness and dimension defaults before initialization', async () => {
    const LocalEmbeddingProvider = await importProviderWithOrtMock();
    const modelDir = createModelDir(false);

    try {
      const provider = new LocalEmbeddingProvider(modelDir);

      expect(provider.dimension).toBe(384);
      expect(provider.isReady).toBe(false);
      await expect(provider.embed('alpha beta')).resolves.toMatchObject({
        tokenCount: 0,
      });
      const result = await provider.embed('alpha beta');
      expect(result.embedding).toHaveLength(384);
      expect(result.embedding.every((value: number) => value === 0)).toBe(true);
    } finally {
      rmSync(modelDir, { recursive: true, force: true });
    }
  });

  it('returns false when the model file is missing and does not create a session', async () => {
    const createMock = vi.fn();
    const LocalEmbeddingProvider = await importProviderWithOrtMock({ createImpl: createMock });
    const modelDir = createModelDir(false);

    try {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const provider = new LocalEmbeddingProvider(modelDir);

      await expect(provider.initialize()).resolves.toBe(false);
      expect(provider.isReady).toBe(false);
      expect(createMock).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      rmSync(modelDir, { recursive: true, force: true });
    }
  });

  it('initializes once and reuses the created session', async () => {
    const session = { run: vi.fn() };
    const createMock = vi.fn().mockResolvedValue(session);
    const LocalEmbeddingProvider = await importProviderWithOrtMock({ createImpl: createMock });
    const modelDir = createModelDir(true);

    try {
      const provider = new LocalEmbeddingProvider(modelDir);

      await expect(provider.initialize()).resolves.toBe(true);
      await expect(provider.initialize()).resolves.toBe(true);
      expect(provider.isReady).toBe(true);
      expect(createMock).toHaveBeenCalledTimes(1);
      expect(createMock).toHaveBeenCalledWith(
        join(modelDir, 'model.onnx'),
        expect.objectContaining({
          executionProviders: ['cpu'],
          graphOptimizationLevel: 'all',
        }),
      );
    } finally {
      rmSync(modelDir, { recursive: true, force: true });
    }
  });

  it('returns false when importing or creating the ONNX session fails', async () => {
    const createFailure = vi.fn().mockRejectedValue(new Error('create failed'));
    const LocalEmbeddingProviderWithCreateFailure = await importProviderWithOrtMock({
      createImpl: createFailure,
    });
    const createFailDir = createModelDir(true);

    try {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const provider = new LocalEmbeddingProviderWithCreateFailure(createFailDir);

      await expect(provider.initialize()).resolves.toBe(false);
      expect(provider.isReady).toBe(false);
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      rmSync(createFailDir, { recursive: true, force: true });
    }

    const LocalEmbeddingProviderWithImportFailure = await importProviderWithOrtMock({
      throwOnImport: true,
    });
    const importFailDir = createModelDir(true);

    try {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const provider = new LocalEmbeddingProviderWithImportFailure(importFailDir);

      await expect(provider.initialize()).resolves.toBe(false);
      expect(provider.isReady).toBe(false);
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      rmSync(importFailDir, { recursive: true, force: true });
    }
  });

  it('produces normalized embeddings from the last hidden state output', async () => {
    const runMock = vi.fn().mockResolvedValue({
      last_hidden_state: {
        data: Float32Array.from([1, 3, 3, 5]),
        dims: [1, 2, 2],
      },
    });
    const createMock = vi.fn().mockResolvedValue({ run: runMock });
    const LocalEmbeddingProvider = await importProviderWithOrtMock({ createImpl: createMock });
    const modelDir = createModelDir(true);

    try {
      const provider = new LocalEmbeddingProvider(modelDir);
      await expect(provider.initialize()).resolves.toBe(true);

      const result = await provider.embed('alpha beta');

      expect(result.tokenCount).toBe(2);
      expect(result.embedding).toHaveLength(2);
      expect(result.embedding[0]).toBeCloseTo(0.4472135955, 6);
      expect(result.embedding[1]).toBeCloseTo(0.8944271910, 6);
      expect(runMock).toHaveBeenCalledTimes(1);
      expect(runMock).toHaveBeenCalledWith(
        expect.objectContaining({
          input_ids: expect.objectContaining({ dims: [1, 2] }),
          attention_mask: expect.objectContaining({ dims: [1, 2] }),
          token_type_ids: expect.objectContaining({ dims: [1, 2] }),
        }),
      );
    } finally {
      rmSync(modelDir, { recursive: true, force: true });
    }
  });

  it('returns the original mean-pooled vector when normalization sees a zero norm', async () => {
    const runMock = vi.fn().mockResolvedValue({
      last_hidden_state: {
        data: Float32Array.from([0, 0, 0, 0]),
        dims: [1, 2, 2],
      },
    });
    const createMock = vi.fn().mockResolvedValue({ run: runMock });
    const LocalEmbeddingProvider = await importProviderWithOrtMock({ createImpl: createMock });
    const modelDir = createModelDir(true);

    try {
      const provider = new LocalEmbeddingProvider(modelDir);
      await expect(provider.initialize()).resolves.toBe(true);

      const result = await provider.embed('alpha beta');

      expect(result.tokenCount).toBe(2);
      expect(result.embedding).toEqual([0, 0]);
    } finally {
      rmSync(modelDir, { recursive: true, force: true });
    }
  });

  it('falls back to dummy embeddings when inference returns no hidden state or throws', async () => {
    const emptyOutputRunMock = vi.fn().mockResolvedValue({});
    const createMock = vi.fn().mockResolvedValue({ run: emptyOutputRunMock });
    const LocalEmbeddingProvider = await importProviderWithOrtMock({ createImpl: createMock });
    const emptyOutputDir = createModelDir(true);

    try {
      const provider = new LocalEmbeddingProvider(emptyOutputDir);
      await provider.initialize();

      const result = await provider.embed('alpha beta gamma');

      expect(result.tokenCount).toBe(3);
      expect(result.embedding).toHaveLength(384);
      expect(result.embedding.every((value: number) => value === 0)).toBe(true);
    } finally {
      rmSync(emptyOutputDir, { recursive: true, force: true });
    }

    const throwingRunMock = vi.fn().mockRejectedValue(new Error('inference failed'));
    const ThrowingLocalEmbeddingProvider = await importProviderWithOrtMock({
      createImpl: vi.fn().mockResolvedValue({ run: throwingRunMock }),
    });
    const throwingDir = createModelDir(true);

    try {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const provider = new ThrowingLocalEmbeddingProvider(throwingDir);
      await provider.initialize();

      const result = await provider.embed('alpha beta');

      expect(result.tokenCount).toBe(0);
      expect(result.embedding).toHaveLength(384);
      expect(result.embedding.every((value: number) => value === 0)).toBe(true);
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      rmSync(throwingDir, { recursive: true, force: true });
    }
  });

  it('batches embeds in slices and preserves result order', async () => {
    const LocalEmbeddingProvider = await importProviderWithOrtMock();
    const modelDir = createModelDir(false);

    try {
      const provider = new LocalEmbeddingProvider(modelDir);
      const embedSpy = vi
        .spyOn(provider, 'embed')
        .mockImplementation(async (text: string) => ({
          embedding: [text.length],
          tokenCount: text.split(/\s+/).filter(Boolean).length,
        }));

      const results = await provider.embedBatch(['a', 'bb cc', 'dddd'], 2);

      expect(results).toEqual([
        { embedding: [1], tokenCount: 1 },
        { embedding: [5], tokenCount: 2 },
        { embedding: [4], tokenCount: 1 },
      ]);
      expect(embedSpy).toHaveBeenCalledTimes(3);
      expect(embedSpy.mock.calls.map((call) => call[0])).toEqual(['a', 'bb cc', 'dddd']);
    } finally {
      rmSync(modelDir, { recursive: true, force: true });
    }
  });
});
