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
  throwOnCreate?: unknown; // non-Error value to throw
}) {
  vi.resetModules();
  vi.doUnmock('onnxruntime-node');

  if (options?.throwOnImport) {
    vi.doMock('onnxruntime-node', () => {
      throw new Error('mocked import failure');
    });
  } else if (options?.throwOnCreate !== undefined) {
    // Throw a non-Error from create
    vi.doMock('onnxruntime-node', () => ({
      InferenceSession: {
        create: () => Promise.reject(options.throwOnCreate),
      },
      Tensor: MockTensor,
    }));
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
  const dir = mkdtempSync(join(tmpdir(), 'niko-local-embedding-v2-gap-'));
  if (withModel) {
    writeFileSync(join(dir, 'model.onnx'), 'stub-model', 'utf8');
  }
  return dir;
}

describe('LocalEmbeddingProvider v2 branch-gap coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.doUnmock('onnxruntime-node');
  });

  it('logs warning with non-Error message when ONNX session creation rejects with a string (line 40)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const LocalEmbeddingProvider = await importProviderWithOrtMock({
      throwOnCreate: 'session creation exploded', // non-Error rejection
    });
    const modelDir = createModelDir(true);

    try {
      const provider = new LocalEmbeddingProvider(modelDir);
      await expect(provider.initialize()).resolves.toBe(false);
      expect(provider.isReady).toBe(false);
      // The warn log should be called with the string-ified error
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      rmSync(modelDir, { recursive: true, force: true });
    }
  });

  it('logs warning with non-Error message when inference fails with a string (line 72)', async () => {
    const runMock = vi.fn().mockRejectedValue('inference string error'); // non-Error
    const createMock = vi.fn().mockResolvedValue({ run: runMock });
    const LocalEmbeddingProvider = await importProviderWithOrtMock({ createImpl: createMock });
    const modelDir = createModelDir(true);

    try {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const provider = new LocalEmbeddingProvider(modelDir);
      await provider.initialize();

      const result = await provider.embed('alpha beta');

      expect(result.tokenCount).toBe(0);
      expect(result.embedding).toHaveLength(384);
      expect(result.embedding.every((value: number) => value === 0)).toBe(true);
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      rmSync(modelDir, { recursive: true, force: true });
    }
  });

  it('returns dummy when embed is called before initialize (not initialized path)', async () => {
    const LocalEmbeddingProvider = await importProviderWithOrtMock();
    const modelDir = createModelDir(false);

    try {
      const provider = new LocalEmbeddingProvider(modelDir);
      // Do NOT call initialize — embed should return dummy
      const result = await provider.embed('test text');
      expect(result.tokenCount).toBe(0);
      expect(result.embedding).toHaveLength(384);
      expect(result.embedding.every((v: number) => v === 0)).toBe(true);
    } finally {
      rmSync(modelDir, { recursive: true, force: true });
    }
  });
});
